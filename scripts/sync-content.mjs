#!/usr/bin/env node
// Copies the approved copy from the planning repo's content/ into this repo (decision 0024).
//   npm run sync-content                 # source: ../content (site/ cloned inside the planning repo)
//   npm run sync-content -- <pasta>      # another path to content/
//   npm run sync-content -- --verificar  # only report differences, change nothing (exit 1 if any)
//   npm run sync-content -- --forcar     # overwrite pages edited here since the last sync
// Copies content/pages/*.md → src/pages/ and content/shared.md → src/_includes/compartilhado.md.
// This repo is public: planning notes stay in content/. On copy, every HTML comment (src codes, GAP, review
// notes) and the `sources:` front-matter line are removed; a photo slot becomes a bare "<!-- PHOTO -->"
// (or "<!-- PHOTO: optional -->") marker that the build turns into a placeholder.
// A page edited in src/pages/ after the last sync is never overwritten silently: the script stops and says so.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST = join(ROOT, "config", "content-sync.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--verificar");
const force = args.includes("--forcar");
const src = resolve(ROOT, args.find((a) => !a.startsWith("--")) ?? "../content");

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function clean(text) {
  return text
    .replace(/^sources:.*\n/m, "")
    .replace(/[ \t]*<!--([\s\S]*?)-->/g, (_, body) =>
      /^\s*PHOTO:/.test(body) ? (/^\s*PHOTO:\s*optional/i.test(body) ? "<!-- PHOTO: optional -->" : "<!-- PHOTO: -->") : "")
    .replace(/\n{3,}/g, "\n\n");
}

if (!existsSync(join(src, "pages"))) {
  console.log(`sync-content: pasta não encontrada: ${join(src, "pages")}`);
  console.log("sync-content: 1 falha (informe o caminho de content/ como argumento)");
  process.exit(1);
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { arquivos: {} };
// target path (relative to ROOT) → source path
const plan = new Map();
for (const f of readdirSync(join(src, "pages")).filter((f) => f.endsWith(".md")).sort()) {
  plan.set(`src/pages/${f}`, join(src, "pages", f));
}
if (existsSync(join(src, "shared.md"))) plan.set("src/_includes/compartilhado.md", join(src, "shared.md"));

const changes = { novo: [], alterado: [], removido: [], conflito: [] };
const next = {};

for (const [target, from] of plan) {
  const data = Buffer.from(clean(readFileSync(from, "utf8")), "utf8");
  const abs = join(ROOT, target);
  const known = manifest.arquivos[target];
  const here = existsSync(abs) ? sha(readFileSync(abs)) : null;
  next[target] = sha(data);
  if (here === next[target]) continue;
  if (here && known && here !== known && !force) {
    changes.conflito.push(target);
    next[target] = known;
    continue;
  }
  (here ? changes.alterado : changes.novo).push(target);
  if (!dryRun) {
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, data);
  }
}
for (const target of Object.keys(manifest.arquivos)) {
  if (plan.has(target)) continue;
  const abs = join(ROOT, target);
  if (existsSync(abs) && sha(readFileSync(abs)) !== manifest.arquivos[target] && !force) {
    changes.conflito.push(target);
    continue;
  }
  changes.removido.push(target);
  if (!dryRun && existsSync(abs)) rmSync(abs);
}

for (const [kind, list] of Object.entries(changes)) {
  for (const t of list) {
    const why = kind === "conflito" ? " (editado aqui depois da última sincronização; use --forcar ou leve a mudança para content/)" : "";
    console.log(`sync-content: ${kind}: ${t}${why}`);
  }
}
const total = changes.novo.length + changes.alterado.length + changes.removido.length;
if (!dryRun && total > 0) {
  writeFileSync(MANIFEST, JSON.stringify({ _leia: "Gerado por scripts/sync-content.mjs. Não edite.", origem: basename(src), arquivos: next }, null, 2) + "\n");
}
const verb = dryRun ? "a sincronizar" : "sincronizados";
console.log(`sync-content: ${changes.conflito.length} falhas, ${total} arquivos ${verb} (${plan.size} na origem)`);
process.exit(changes.conflito.length > 0 || (dryRun && total > 0) ? 1 : 0);
