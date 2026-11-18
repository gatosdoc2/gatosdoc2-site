#!/usr/bin/env node
// npm run check — builds the site and runs every check (decision 0020). Prints only problems and one
// summary line. Exit 0 = nothing blocks; exit 1 = at least one failure.
//   npm run check                  # everything (build, HTML, links, accessibility, Lighthouse, own checks)
//   npm run check -- --rapido      # without the browser checks (pa11y, Lighthouse): for quick edits only
//   npm run check -- --externos    # also checks links to other sites (warnings; needs internet)
// Limits: config/thresholds.json. Allowed domains/e-mails: config/hosts.json. Help: docs/verificacao.md
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runStatic, siteHash } from "./lib/static-checks.mjs";
import { serve } from "./lib/serve.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const quick = args.includes("--rapido");
const external = args.includes("--externos");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const thresholds = json("config/thresholds.json");
const hosts = json("config/hosts.json");
const site = json("src/_data/site.json");

const failures = [];
const warnings = [];
const fail = (m) => { if (failures.includes(m)) return; failures.push(m); console.log(`FALHA  ${m}`); };
const warn = (m) => { if (warnings.includes(m)) return; warnings.push(m); console.log(`aviso  ${m}`); };
const ran = [];

function summary() {
  const skipped = quick ? " (sem pa11y e Lighthouse: --rapido)" : "";
  console.log(`check: ${failures.length} falhas, ${warnings.length} avisos [${ran.join(", ")}]${skipped}`);
  process.exit(failures.length ? 1 : 0);
}

// 1. Build
{
  rmSync(join(ROOT, "_site"), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [join(ROOT, "node_modules/@11ty/eleventy/cmd.cjs"), "--quiet"], { cwd: ROOT, encoding: "utf8" });
  ran.push("build");
  if (r.status !== 0) {
    fail(`build do Eleventy falhou:\n${(r.stderr || r.stdout).split("\n").filter((l) => /Error|error|rro/.test(l)).slice(0, 8).join("\n")}`);
    summary();
  }
}

// 2. Own checks on the built files (weight, images, privacy, comments, copy match…)
const htmlFiles = runStatic({ root: ROOT, site, thresholds, hosts, fail, warn });
ran.push("próprios");

// 3. Copy in content/ (planning repo) newer than the last sync?
if (existsSync(join(ROOT, "..", "content", "pages"))) {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts/sync-content.mjs"), "--verificar"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) warn("content/ mudou desde a última sincronização: rode npm run sync-content");
}

// 4. HTML validity
{
  const { HtmlValidate, FileSystemConfigLoader } = await import("html-validate");
  const loader = new FileSystemConfigLoader(json("config/htmlvalidate.json"));
  const hv = new HtmlValidate(loader);
  for (const f of htmlFiles) {
    const report = await hv.validateFile(join(ROOT, f));
    for (const r of report.results) for (const m of r.messages) {
      (m.severity === 2 ? fail : warn)(`${f}:${m.line}:${m.column}: ${m.message} [${m.ruleId}]`);
    }
  }
  ran.push("html-validate");
}

// 5. Links (internal always; other sites only with --externos, as warnings)
const server = await serve(join(ROOT, "_site"));
try {
  const { LinkChecker } = await import("linkinator");
  const checker = new LinkChecker();
  const result = await checker.check({
    path: [`${server.url}/`, `${server.url}/404.html`],
    recurse: true,
    checkCss: true,
    checkFragments: true,
    redirects: "error",
    timeout: 15000,
    linksToSkip: async (link) => !link.startsWith(server.url) && !external,
  });
  for (const l of result.links.filter((x) => x.state === "BROKEN")) {
    const internal = l.url.startsWith(server.url);
    const where = (l.parent ?? "").replace(server.url, "");
    const msg = `link quebrado (${l.status || "erro"}): ${l.url.replace(server.url, "")} em ${where || "/"}`;
    internal ? fail(msg) : warn(msg);
  }
  ran.push(external ? "links+externos" : "links");

  // 6. Browser checks: accessibility (pa11y-ci, axe) and Lighthouse
  if (!quick) {
    const chrome = await findChrome();
    if (!chrome) {
      fail("nenhum Chrome encontrado para pa11y/Lighthouse: rode `npx puppeteer browsers install chrome` ou defina CHROME_PATH (docs/verificacao.md)");
    } else {
      const urls = htmlFiles.map((f) => `${server.url}/${f.replace(/^_site\//, "").replace(/index\.html$/, "")}`);
      await pa11y(chrome, urls);
      ran.push("pa11y");
      await lighthouse(chrome, urls);
      ran.push("lighthouse");
    }
  }
} finally {
  server.close();
}

// Stamp for prepare-upload: the exact build that passed the full check
if (!failures.length && !quick) {
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  writeFileSync(join(ROOT, ".cache/check-ok.json"), JSON.stringify({ hash: siteHash(ROOT), data: new Date().toISOString() }) + "\n");
}
summary();

// ---------- helpers ----------

// Async child process: the static server runs in this process, so the event loop must stay free.
function run(argv) {
  return new Promise((ok) => {
    const child = spawn(process.execPath, argv, { cwd: ROOT });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => ok({ status, stdout, stderr }));
  });
}

async function findChrome() {
  const candidates = [process.env.CHROME_PATH];
  try {
    const p = await import("puppeteer");
    candidates.push(await p.default.executablePath());
  } catch { /* puppeteer's own Chrome not installed */ }
  candidates.push(
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  );
  return candidates.find((c) => c && existsSync(c));
}

async function pa11y(chrome, urls) {
  mkdirSync(join(ROOT, ".cache"), { recursive: true });
  const cfg = join(ROOT, ".cache/pa11y.json");
  writeFileSync(cfg, JSON.stringify({
    defaults: {
      runners: ["axe"],
      standard: "WCAG2AA",
      rules: ["target-size"], // WCAG 2.2 AA rule that pa11y's WCAG2AA tag list leaves out
      includeWarnings: false,
      timeout: 60000,
      chromeLaunchConfig: { executablePath: chrome, args: ["--no-sandbox", "--headless=new"] },
    },
    urls,
  }));
  const r = await run([join(ROOT, "node_modules/pa11y-ci/bin/pa11y-ci.js"), "--config", cfg, "--json"]);
  let out;
  try { out = JSON.parse(r.stdout); } catch {
    fail(`pa11y-ci não rodou: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ")}`);
    return;
  }
  for (const [url, issues] of Object.entries(out.results)) {
    const path = url.replace(server.url, "") || "/";
    if (!Array.isArray(issues)) { fail(`acessibilidade ${path}: pa11y falhou (${JSON.stringify(issues).slice(0, 120)})`); continue; }
    for (const i of issues) fail(`acessibilidade ${path}: ${i.message.split("\n")[0]} [${i.code}] em ${i.selector}`);
  }
}

async function lighthouse(chrome, urls) {
  const dir = join(ROOT, ".lighthouseci");
  rmSync(dir, { recursive: true, force: true });
  const runs = thresholds.lighthouse.execucoes;
  const r = await run([
    join(ROOT, "node_modules/@lhci/cli/src/cli.js"), "collect", `--numberOfRuns=${runs}`, `--chromePath=${chrome}`,
    "--settings.chromeFlags=--headless=new --no-sandbox", ...urls.map((u) => `--url=${u}`),
  ]);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)) : [];
  if (r.status !== 0 || !files.length) {
    fail(`Lighthouse não rodou: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ")}`);
    return;
  }
  const byUrl = new Map();
  for (const f of files) {
    const lhr = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const key = lhr.requestedUrl;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(lhr);
  }
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const { falha, aviso } = thresholds.lighthouse;
  for (const [url, lhrs] of byUrl) {
    const path = url.replace(server.url, "") || "/";
    for (const cat of ["performance", "accessibility", "seo", "best-practices"]) {
      const scores = lhrs.map((l) => l.categories[cat]?.score).filter((s) => s != null);
      if (!scores.length) { fail(`lighthouse ${path}: sem nota de ${cat}`); continue; }
      const s = median(scores);
      if (s < falha[cat]) fail(`lighthouse ${path}: ${cat} ${Math.round(s * 100)} (mínimo ${falha[cat] * 100})`);
      else if (aviso[cat] && s < aviso[cat]) warn(`lighthouse ${path}: ${cat} ${Math.round(s * 100)}`);
    }
    const lcp = median(lhrs.map((l) => l.audits["largest-contentful-paint"]?.numericValue ?? Infinity));
    const cls = median(lhrs.map((l) => l.audits["cumulative-layout-shift"]?.numericValue ?? Infinity));
    if (lcp > falha.lcp_ms) fail(`lighthouse ${path}: LCP ${Math.round(lcp)} ms (máx. ${falha.lcp_ms})`);
    else if (lcp > aviso.lcp_ms) warn(`lighthouse ${path}: LCP ${Math.round(lcp)} ms`);
    if (cls > falha.cls) fail(`lighthouse ${path}: CLS ${cls.toFixed(3)} (máx. ${falha.cls})`);
    // Cookies and third-party requests seen by the browser (decision 0017)
    for (const l of lhrs.slice(0, 1)) {
      const reqs = l.audits["network-requests"]?.details?.items ?? [];
      for (const q of reqs) if (!q.url.startsWith(server.url) && !q.url.startsWith("data:")) fail(`lighthouse ${path}: pedido a terceiros: ${q.url}`);
    }
  }
}
