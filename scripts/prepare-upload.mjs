#!/usr/bin/env node
// npm run prepare-upload — prepares (never runs) the upload of _site/ to the EESC server (decision 0018).
// This script NEVER connects to the server. It:
//   1. rebuilds _site/ and confirms it is the same build that passed `npm run check`;
//   2. writes upload.sftp (git-ignored): one `put` per file, so only _site/ can be sent;
//   3. prints the command a person runs, and the files sent last time that no longer exist (delete by hand).
// Server data (host, user, port, folder) comes from upload.local.json (git-ignored; copy
// upload.local.example.json) or from arguments: --host=… --usuario=… --porta=… --pasta=…
// Step by step: docs/publicacao.md
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { siteHash, walk } from "./lib/static-checks.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const LOCAL = join(ROOT, "upload.local.json");
const stop = (msg) => { console.log(`prepare-upload: ${msg}`); console.log("prepare-upload: 1 falha, nada foi preparado"); process.exit(1); };

// Server data: arguments win over the local file. Nothing here is ever written to a tracked file.
const fromArgs = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--") && a.includes("="))
  .map((a) => a.slice(2).split(/=(.*)/s).slice(0, 2)));
const skipCheck = process.argv.includes("--sem-verificacao");
if (existsSync(LOCAL)) {
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "upload.local.json"], { cwd: ROOT, encoding: "utf8" });
  if (tracked.status === 0) stop("upload.local.json está no git. Tire do repositório (git rm --cached upload.local.json) antes de continuar.");
}
const local = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, "utf8")) : {};
const cfg = { ...local, ...fromArgs };
for (const k of ["host", "usuario", "pasta"]) {
  if (!cfg[k] || /exemplo|EXEMPLO|<|>/.test(cfg[k])) stop(`falta "${k}": preencha upload.local.json (modelo: upload.local.example.json) ou use --${k}=…`);
}
if (/["'\s;]/.test(cfg.pasta)) stop("a pasta no servidor não pode ter espaços, aspas ou ponto e vírgula");
const port = cfg.porta ? String(cfg.porta) : "";
if (port && !/^\d+$/.test(port)) stop("porta inválida");

// 1. Rebuild and compare with the build that passed the check
const r = spawnSync(process.execPath, [join(ROOT, "node_modules/@11ty/eleventy/cmd.cjs"), "--quiet"], { cwd: ROOT, encoding: "utf8" });
if (r.status !== 0) stop("o build falhou; rode npm run check para ver o erro");
const stampFile = join(ROOT, ".cache/check-ok.json");
const stamp = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, "utf8")) : null;
if (!skipCheck && (!stamp || stamp.hash !== siteHash(ROOT))) {
  stop("este build não passou pelo npm run check completo (ou algo mudou depois). Rode npm run check até 0 falhas.");
}

// 2. Batch file: lcd/cd + one put per file. "-mkdir" ignores "already exists". No rm: deleting is a person's choice.
const out = join(ROOT, "_site");
const files = walk(out).map((f) => relative(out, f).split("\\").join("/")).filter((f) => !f.split("/").some((p) => p.startsWith("."))).sort();
const dirs = [...new Set(files.flatMap((f) => f.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))))].sort();
const q = (s) => `"${s}"`;
const lines = [
  "# Gerado por npm run prepare-upload. Não edite; não coloque no git.",
  `lcd ${q(out)}`,
  `cd ${q(cfg.pasta)}`,
  ...dirs.map((d) => `-mkdir ${q(d)}`),
  ...files.map((f) => `put ${q(f)} ${q(f)}`),
  "ls -l",
];
writeFileSync(join(ROOT, "upload.sftp"), lines.join("\n") + "\n");

// 3. Stale files: sent last time, not in this build
const manifestFile = join(ROOT, "upload-manifest.json");
const before = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")).arquivos : [];
const stale = before.filter((f) => !files.includes(f));
writeFileSync(manifestFile, JSON.stringify({ _leia: "Arquivos do último envio preparado (git-ignored).", arquivos: files }, null, 2) + "\n");

const dest = `${cfg.usuario}@${cfg.host}`;
const p = port ? `-P ${port} ` : "";
console.log(`prepare-upload: ${files.length} arquivos de _site/ em upload.sftp (pasta no servidor: ${cfg.pasta})`);
console.log("");
console.log("Uma pessoa roda UM destes comandos no terminal, na pasta do repositório:");
console.log(`  com chave SSH:   sftp ${p}-b upload.sftp ${dest}`);
console.log(`  com senha:       sftp ${p}${dest}`);
console.log("                   (digite a senha; depois cole as linhas de upload.sftp, a partir de \"lcd\")");
if (stale.length) {
  console.log("");
  console.log("Arquivos enviados da última vez que não existem mais (apague à mão no sftp, se for o caso):");
  for (const f of stale) console.log(`  rm ${q(`${cfg.pasta.replace(/\/$/, "")}/${f}`)}`);
}
console.log("");
console.log("Depois do envio: peça à IA para conferir com curl -sI a página inicial, uma página e um endereço inexistente (404).");
console.log(`prepare-upload: 0 falhas${stale.length ? `, ${stale.length} arquivos antigos para apagar à mão` : ""}`);
