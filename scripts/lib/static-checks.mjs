// Checks that read the built files in _site/ (no browser). Each check calls fail()/warn() with
// "arquivo: mensagem". Used by scripts/check.mjs.
import { stripMarked } from "./exemplos.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";

const read = (p) => readFileSync(p, "utf8");

export function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
export const words = (s) => (decode(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** Visible words of a Markdown page as the copy defines them (comments and markup removed). */
export function markdownWords(md) {
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const text = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)\s]*(?:\s+"([^"]*)")?\)/g, " $1 ") // image: only the caption is visible
    .replace(/\[([^\]]*)\]\([^)]*\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ") // table separator rows
    .replace(/^\s*(?:#+|[-*+]|\d+\.|>)\s+/gm, " ")
    .replace(/[*_`|]/g, " ");
  return words(text);
}

const mainOf = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
const htmlWords = (html) => words(html.replace(/<[^>]+>/g, " "));

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function runStatic({ root, site, thresholds, hosts, fail, warn }) {
  const out = join(root, "_site");
  const files = walk(out);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  const rel = (p) => relative(root, p).split("\\").join("/");
  const own = new Set(hosts.proprios);
  const linkOk = new Set([...hosts.proprios, ...hosts.links_permitidos]);
  const emailsOk = new Set(hosts.emails_permitidos.map((e) => e.toLowerCase()));
  const shared = existsSync(join(root, "src/_includes/compartilhado.md")) ? markdownWords(read(join(root, "src/_includes/compartilhado.md"))).join(" ") : "";
  const pagesDir = join(root, "src/pages");
  const homeMd = existsSync(join(pagesDir, "index.md")) ? markdownWords(read(join(pagesDir, "index.md"))).join(" ") : "";

  for (const file of htmlFiles) {
    const html = read(file);
    const f = rel(file);
    const main = mainOf(html);

    // Structure and metadata
    if (!/^<!doctype html>/i.test(html)) fail(`${f}: sem <!doctype html>`);
    const lang = /^_site\/en\//.test(f) ? "en" : "pt-BR"; // English pages live under /en/ (decision 0029)
    if (!html.includes(`<html lang="${lang}">`)) fail(`${f}: <html> sem lang="${lang}"`);
    const titles = html.match(/<title>([^<]*)<\/title>/g) ?? [];
    if (titles.length !== 1 || /<title>\s*<\/title>/.test(html)) fail(`${f}: precisa de exatamente um <title> com texto`);
    const desc = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
    if (!desc) fail(`${f}: sem <meta name="description">`);
    else if (decode(desc).length > thresholds.descricao.max_caracteres) warn(`${f}: descrição com ${decode(desc).length} caracteres (máx. ${thresholds.descricao.max_caracteres})`);
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fail(`${f}: ${h1} títulos <h1> (deve ser 1)`);
    if (!main) fail(`${f}: sem <main>`);

    // Source comments must not reach the public page (decision 0024)
    if (/<!--/.test(html)) fail(`${f}: comentário HTML no site publicado (fonte, GAP ou nota): ${html.match(/<!--[^\n]{0,60}/)[0]}`);
    for (const m of html.matchAll(/\[GAP|\bTODO\b/g)) {
      (thresholds.gap_e_todo_falham ? fail : warn)(`${f}: "${m[0]}" no texto publicado`);
    }

    // No JavaScript at all (decision 0013), no frames
    for (const m of html.matchAll(/\shref="(\/\/[^"]*)"/g)) fail(`${f}: link "${m[1]}" começa com // (vira outro site; use um caminho como /pagina/)`);
    // Only the decorative eyes script is allowed (decision 0035); nothing else, no inline code.
    for (const sc of html.matchAll(/<script\b[^>]*>/gi)) if (!/^<script src="\/assets\/js\/olhos\.js" defer(="")?>$/.test(sc[0])) fail(`${f}: <script> não permitido: ${sc[0]} (só /assets/js/olhos.js, decisão 0035)`);
    if (/\son[a-z]+\s*=/i.test(html)) fail(`${f}: atributo de evento (onclick etc.) encontrado`);
    if (/<(iframe|object|embed)[\s>]/i.test(html)) fail(`${f}: <iframe>/<object>/<embed> encontrado`);

    // Third-party resources (decision 0017) and allowed link hosts (Portaria GR 3361/2002, Q-46)
    for (const m of html.matchAll(/<(link|img|source|script|video|audio)\b[^>]*?\s(?:src|href|srcset)="([^"]+)"/gi)) {
      for (const u of m[2].split(",").map((s) => s.trim().split(/\s+/)[0])) {
        if (/^(https?:)?\/\//i.test(u) && !own.has(new URL(u, "https://x").hostname)) fail(`${f}: recurso de terceiros: ${u}`);
      }
    }
    for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)) {
      const href = m[1];
      if (/^https?:\/\//i.test(href)) {
        const host = new URL(href).hostname;
        if (!linkOk.has(host)) fail(`${f}: link para domínio não permitido: ${host} (ver config/hosts.json)`);
        if (href.startsWith("http://")) fail(`${f}: link sem https: ${href}`);
      } else if (href.startsWith("mailto:")) {
        if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) fail(`${f}: mailto malformado: ${href}`);
      } else if (href.startsWith("tel:")) {
        fail(`${f}: link tel: (telefones não são publicados)`);
      } else if (href.startsWith("#")) {
        // checked by linkinator (fragments)
      } else if (!href.startsWith("/")) {
        fail(`${f}: link relativo "${href}" (use endereços que começam com /)`);
      } else if (!/\/$|\.[a-z0-9]+$/i.test(href.split("#")[0])) {
        fail(`${f}: link interno sem / no fim: ${href} (o servidor redirecionaria)`);
      }
    }

    // Privacy patterns (decision 0020): ID numbers, phones, e-mails other than the group's
    const text = decode(html.replace(/<[^>]+>/g, " "));
    if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(text)) fail(`${f}: padrão de CPF no texto`);
    if (/\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/.test(text)) fail(`${f}: padrão de RG no texto`);
    if (/(?:\(\d{2}\)\s?|\b\d{2}\s)9?\d{4}[-\s]\d{4}\b|\+55\s?\d{2}/.test(text)) fail(`${f}: padrão de telefone no texto`);
    for (const m of html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      if (!emailsOk.has(m[0].toLowerCase())) fail(`${f}: e-mail não permitido: ${m[0]}`);
    }

    // Images: alt, width, height, no placeholder alt text
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/\salt="/.test(tag)) fail(`${f}: imagem sem alt: ${tag.slice(0, 80)}`);
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) fail(`${f}: imagem sem width/height: ${tag.slice(0, 80)}`);
      if (/alt="[^"]*(TO WRITE|A ESCREVER|\[confirmar\]|DRAFT)/i.test(tag)) fail(`${f}: texto alternativo ainda é rascunho: ${tag.slice(0, 80)}`);
    }
    for (const _ of html.matchAll(/data-foto="pendente"/g)) warn(`${f}: espaço de foto sem foto (escolher foto e escrever o alt, Q-57)`);
    const emc = (main.match(/class="em-construcao"/g) ?? []).length;
    if (emc) warn(`${f}: ${emc} bloco(s) "em construção"`);

    // Page weight: HTML + linked CSS + fonts used by CSS + images (largest candidate)
    let bytes = Buffer.byteLength(html);
    let textBytes = gzipSync(html).length;
    const cssFiles = [...html.matchAll(/<link rel="stylesheet" href="(\/[^"]+)">/g)].map((x) => join(out, x[1]));
    const fonts = new Set();
    for (const c of cssFiles.filter(existsSync)) {
      const css = read(c);
      bytes += Buffer.byteLength(css);
      textBytes += gzipSync(css).length;
      for (const u of css.matchAll(/url\("?([^")]+)"?\)/g)) {
        if (/^(https?:)?\/\//.test(u[1]) || u[1].startsWith("data:")) { if (!u[1].startsWith("data:")) fail(`${rel(c)}: url() de terceiros: ${u[1]}`); continue; }
        fonts.add(join(c, "..", u[1]));
      }
      if (/@import/.test(css)) fail(`${rel(c)}: @import (junte os arquivos ou use <link>)`);
    }
    for (const p of fonts) if (existsSync(p)) bytes += statSync(p).size;
    for (const m of html.matchAll(/<(?:img|source)\b[^>]*?\s(?:src|srcset)="([^"]+)"/g)) {
      const cands = m[1].split(",").map((s) => s.trim().split(/\s+/)[0]).filter((u) => u.startsWith("/"));
      const sizes = cands.map((u) => join(out, decodeURI(u))).filter(existsSync).map((p) => statSync(p).size);
      if (sizes.length) bytes += Math.max(...sizes);
    }
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    if (bytes > thresholds.pagina.falha_bytes) fail(`${f}: página com ${kb(bytes)} (máx. ${kb(thresholds.pagina.falha_bytes)})`);
    else if (bytes > thresholds.pagina.aviso_bytes) warn(`${f}: página com ${kb(bytes)} (aviso acima de ${kb(thresholds.pagina.aviso_bytes)})`);
    if (textBytes > thresholds.pagina.html_css_js_gzip_falha_bytes) fail(`${f}: HTML+CSS comprimidos ${kb(textBytes)} (máx. ${kb(thresholds.pagina.html_css_js_gzip_falha_bytes)})`);

    // Header, footer and 404 words must come from the shared copy (compartilhado.md) or the home page
    // The prototype options panel (data-sem-copia) is a review tool, not site copy.
    const chrome = stripMarked(html.replace(/<main[\s\S]*?<\/main>/, " "), "data-sem-copia");
    const blocks = f === "_site/404.html" ? [chrome, main] : [chrome];
    for (const part of blocks) {
      for (const seg of part.replace(/<head>[\s\S]*?<\/head>/, " ").split(/<[^>]+>/)) {
        const w = words(seg);
        if (w.length < 2) continue;
        const s = w.join(" ");
        if (!shared.includes(s) && !homeMd.includes(s)) fail(`${f}: texto fora da cópia aprovada (compartilhado.md): "${seg.trim().slice(0, 70)}"`);
      }
    }
  }

  // Every Markdown page: built words == copy words (order and spelling; punctuation and case ignored)
  const builtFor = (name) => join(out, name === "index" ? "index.html" : `${name}/index.html`);
  for (const md of existsSync(pagesDir) ? readdirSync(pagesDir).filter((x) => x.endsWith(".md")) : []) {
    const name = md.replace(/\.md$/, "");
    if (name === "index") continue; // the home page is a template (src/paginas-v5/index.njk); index.md stays as text source
    const built = builtFor(name);
    if (!existsSync(built)) { fail(`src/pages/${md}: página não gerada (${rel(built)})`); continue; }
    const a = markdownWords(read(join(pagesDir, md)));
    // Navigation tiles added by the layout (src/_data/paginas.json) are not part of the copy.
    const b = htmlWords(stripMarked(mainOf(read(built)), "data-sem-copia"));
    if (a.join(" ") !== b.join(" ")) {
      const i = firstDiff(a, b);
      fail(`${rel(built)}: texto difere da cópia em src/pages/${md}, palavra ${i + 1}: cópia "${a.slice(i, i + 6).join(" ")}" / site "${b.slice(i, i + 6).join(" ")}"`);
    }
    for (const m of read(join(pagesDir, md)).matchAll(/<!--\s*PHOTO:\s*optional/gi)) warn(`src/pages/${md}: espaço de foto opcional sem foto`);
  }

  // The 404 page lists the same routes as the home page (compartilhado.md: "mesma lista da página inicial")
  const routeLinks = (p) => existsSync(p) ? [...read(p).matchAll(/class="route__link" href="([^"]+)"/g)].map((m) => m[1]).join(" ") : "";
  if (routeLinks(join(out, "index.html")) !== routeLinks(join(out, "404.html"))) {
    fail("_site/404.html: atalhos diferentes da página inicial (corrija src/_data/rotas.json)");
  }

  // Section looks that match no heading (a heading was renamed in content/)
  const looks = JSON.parse(read(join(root, "src/_data/componentes.json"))).secoes;
  const allMd = existsSync(pagesDir) ? readdirSync(pagesDir).filter((x) => x.endsWith(".md")).map((x) => read(join(pagesDir, x))).join("\n") : "";
  for (const t of Object.keys(looks)) {
    if (!allMd.split("\n").some((l) => l.trim() === `## ${t}`)) warn(`src/_data/componentes.json: nenhuma seção "## ${t}" nas páginas (título mudou?)`);
  }

  // Sitemap lists every page except 404
  const sitemap = existsSync(join(out, "sitemap.xml")) ? read(join(out, "sitemap.xml")) : "";
  for (const file of htmlFiles.filter((p) => !p.endsWith("404.html") && !/<meta name="robots" content="noindex">/.test(read(p)))) {
    const path = "/" + relative(out, file).split("\\").join("/").replace(/index\.html$/, "");
    if (!sitemap.includes(`<loc>${site.url}${path}</loc>`)) fail(`_site/sitemap.xml: falta ${path}`);
  }
  if (!existsSync(join(out, "robots.txt"))) fail("_site/robots.txt: não gerado");

  // Image files
  for (const p of files.filter((x) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(x))) {
    const size = statSync(p).size;
    if (size > thresholds.imagem.falha_bytes) fail(`${rel(p)}: imagem com ${Math.round(size / 1024)} KB (máx. ${Math.round(thresholds.imagem.falha_bytes / 1024)} KB)`);
    else if (size > thresholds.imagem.aviso_bytes) warn(`${rel(p)}: imagem com ${Math.round(size / 1024)} KB`);
  }
  for (const x of files.filter((x) => /\.(js|mjs)$/i.test(x) && !/assets[\\/]js[\\/]olhos\.js$/.test(x))) fail(`_site: arquivo JavaScript na saída: ${x} (só olhos.js, decisão 0035)`);
  checkMotion({ files, rel, fail, warn });
  if (files.some((x) => /(^|[\\/])\.[^\\/]+$/.test(relative(out, x)))) warn("_site: arquivo oculto (começa com .) na saída");
  return htmlFiles.map(rel);
}

/** Hash of every file in _site/ (used to prove that the uploaded build is the one that passed the check). */
export function siteHash(root) {
  const h = createHash("sha256");
  for (const f of walk(join(root, "_site")).sort()) h.update(relative(root, f).split("\\").join("/")).update(readFileSync(f));
  return h.digest("hex");
}

// ---------- Motion (decision 0026; rules M1–M7 + LCP warning from research/motion-css.md §3) ----------
// Reads every .css file, every <style> and style="" in .html/.svg. A small brace-depth scanner, no CSS package.
// Allowed pattern: animation inside @media (prefers-reduced-motion: no-preference), finite, ≤ 5 s, only
// transform/translate/scale/rotate/opacity in @keyframes, animation-timeline inside @supports (animation-timeline: …).

const REDUCED_OK = /^@media\b[^{]*prefers-reduced-motion\s*:\s*no-preference/i;
const SUPPORTS_TL = /^@supports\b[^{]*animation-timeline/i;
const KEYFRAME_OK = /^(transform|translate|scale|rotate|opacity|offset(-[a-z-]+)?|animation-timing-function|animation-composition)$/;
const MOVING = new Set(["transform", "translate", "scale", "rotate", "all"]);
const NOT_PROP = /^(ease(-in|-out|-in-out)?|linear|step-start|step-end|allow-discrete|normal|initial|inherit|unset|revert)$/;
const LCP_SEL = /(^|[\s>+~,(])h1\b|\.hero\b|(^|[\s>+~,(])picture\b/i;
const INTERACTION = /:(hover|focus|focus-visible|active)\b/i;

/** Split at top-level `sep` (outside parentheses). */
function splitTop(s, sep) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && (sep === " " ? /\s/.test(ch) : ch === sep)) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
const seconds = (t) => { const m = /^(-?[\d.]+)(ms|s)$/i.exec(t); return m ? (+m[1]) / (m[2].toLowerCase() === "ms" ? 1000 : 1) : null; };
const count = (t) => (/^infinite$/i.test(t) ? Infinity : /^[\d.]+$/.test(t) ? +t : null);

/** CSS text → declarations [{prop, value, line, ctx, block}] and at-rule blocks [{prelude, line, ctx, inner}]. */
export function scanCss(css) {
  // Blank comments and string contents, keeping line breaks so line numbers stay right
  const blank = (m) => m.replace(/[^\n]/g, " ");
  const src = css.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => m[0] + blank(m.slice(1, -1)) + m[0]);
  const decls = [], ats = [];
  const stack = [];
  let start = 0, line = 1, blockId = 0;
  const lineAt = [];
  for (let i = 0; i < src.length; i++) { lineAt[i] = line; if (src[i] === "\n") line++; }
  const firstLine = (a, b) => { for (let k = a; k < b; k++) if (/\S/.test(src[k])) return lineAt[k]; return lineAt[a] ?? 1; };
  const ctx = () => stack.map((b) => b.prelude);
  const declaration = (a, b) => {
    const seg = src.slice(a, b).trim();
    if (!seg || seg.startsWith("@") || !stack.length) return;
    const c = seg.indexOf(":");
    if (c < 1) return;
    decls.push({ prop: seg.slice(0, c).trim().toLowerCase(), value: seg.slice(c + 1).replace(/!important/i, "").trim(),
      line: firstLine(a, b), ctx: ctx(), block: stack[stack.length - 1].id });
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      const prelude = src.slice(start, i).trim().replace(/\s+/g, " ");
      const rec = prelude.startsWith("@") ? { prelude, line: firstLine(start, i), ctx: ctx(), inner: [] } : null;
      if (rec) ats.push(rec);
      else for (const b of stack) b.rec?.inner.push(prelude); // selectors nested in an at-rule
      stack.push({ prelude, id: ++blockId, rec });
      start = i + 1;
    } else if (ch === ";") { declaration(start, i); start = i + 1; }
    else if (ch === "}") { declaration(start, i); stack.pop(); start = i + 1; }
  }
  return { decls, ats };
}

/** Runs M1–M7 + LCP warning on CSS sources [{name, css}] and the file list (for M7). */
export function motionRules(sources, files, rel, fail, warn) {
  for (const { name, css } of sources) {
    // Live tiles (decision 0030): looping is allowed only for `.live` rules when the CSS also has the pause control
    // (`:has(#pausar-animacoes:checked)`), which satisfies WCAG 2.2.2 (pause, stop, hide).
    const pausable = /#pausar-animacoes:checked/.test(css);
    const liveOk = (sel) => pausable && /\.live\b/.test(sel);
    const { decls, ats } = scanCss(css);
    const where = (l) => `${name}:${l}`;
    const reduced = (c) => c.some((p) => REDUCED_OK.test(p));
    const inKeyframes = (c) => c.some((p) => /^@(-webkit-)?keyframes\b/i.test(p));
    const selectors = (c) => c.filter((p) => !p.startsWith("@")).join(" ");
    for (const a of ats) {
      if (/^@view-transition\b/i.test(a.prelude) && !reduced(a.ctx)) fail(`${where(a.line)}: M1 @view-transition fora de @media (prefers-reduced-motion: no-preference)`);
      if (/^@starting-style\b/i.test(a.prelude) && LCP_SEL.test([selectors(a.ctx), ...a.inner].join(" , "))) {
        warn(`${where(a.line)}: @starting-style no h1/.hero/picture pode atrasar o LCP (elemento principal da página)`);
      }
    }
    const blocks = new Map();
    for (const d of decls) {
      if (inKeyframes(d.ctx)) {
        if (!KEYFRAME_OK.test(d.prop)) fail(`${where(d.line)}: M5 @keyframes anima "${d.prop}" (use só transform, translate, scale, rotate ou opacity)`);
        continue;
      }
      const v = d.value.toLowerCase();
      const isNone = /^(none|initial|unset|inherit|revert)$/.test(v) || splitTop(v, ",").every((x) => x === "none");
      if (d.prop === "animation" || d.prop === "animation-name") {
        if (!isNone && !reduced(d.ctx)) fail(`${where(d.line)}: M1 ${d.prop} fora de @media (prefers-reduced-motion: no-preference)`);
        if (!isNone && d.prop === "animation" && LCP_SEL.test(selectors(d.ctx))) warn(`${where(d.line)}: animação no h1/.hero/picture pode atrasar o LCP (elemento principal da página)`);
      }
      if (d.prop === "animation-timeline" && !/^(auto|none)$/.test(v)) {
        if (!reduced(d.ctx)) fail(`${where(d.line)}: M1 animation-timeline fora de @media (prefers-reduced-motion: no-preference)`);
        if (!d.ctx.some((p) => SUPPORTS_TL.test(p))) fail(`${where(d.line)}: M6 animation-timeline fora de @supports (animation-timeline: …)`);
      }
      if (d.prop === "transition" || d.prop === "transition-property") {
        const props = splitTop(v, ",").map((item) => {
          if (d.prop === "transition-property") return item;
          const ident = splitTop(item, " ").find((t) => /^-?[a-z][a-z-]*$/.test(t) && !NOT_PROP.test(t));
          return ident ?? "all"; // a shorthand without a property animates all
        });
        const moving = props.filter((p) => MOVING.has(p));
        if (moving.length && !reduced(d.ctx)) fail(`${where(d.line)}: M1 transition de ${moving.join(", ")} fora de @media (prefers-reduced-motion: no-preference)`);
      }
      if (/^animation(-iteration-count)?$/.test(d.prop) && /\binfinite\b/.test(v) && !liveOk(selectors(d.ctx))) fail(`${where(d.line)}: M2 animação infinita (infinite): precisa parar sozinha`);
      if (/^animation(-duration|-delay|-iteration-count|-timeline|-name)?$/.test(d.prop)) {
        if (!blocks.has(d.block)) blocks.set(d.block, []);
        blocks.get(d.block).push(d);
      }
    }
    // M3 (≤ 5 s) and M4 (no flash) per rule block: shorthand first, longhands override
    for (const list of blocks.values()) {
      const sel = selectors(list[0].ctx);
      let dur = [0], delay = [0], iter = [1], timeline = false, named = false;
      for (const d of list) {
        const items = splitTop(d.value.toLowerCase(), ",");
        if (d.prop === "animation") {
          dur = [], delay = [], iter = [];
          for (const it of items) {
            const toks = splitTop(it, " ");
            const times = toks.map(seconds).filter((x) => x !== null);
            const n = toks.map(count).find((x) => x !== null);
            dur.push(times[0] ?? 0); delay.push(times[1] ?? 0); iter.push(n ?? 1);
            if (!/^none$/.test(it)) named = true;
          }
        }
        if (d.prop === "animation-name" && !/^none$/.test(d.value.trim())) named = true;
        if (d.prop === "animation-duration") dur = items.map((x) => seconds(x) ?? 0);
        if (d.prop === "animation-delay") delay = items.map((x) => seconds(x) ?? 0);
        if (d.prop === "animation-iteration-count") iter = items.map((x) => count(x) ?? 1);
        if (d.prop === "animation-timeline" && !/^(auto|none)$/i.test(d.value.trim())) timeline = true;
      }
      if (!named) continue;
      const n = Math.max(dur.length, delay.length, iter.length);
      const line = list[0].line;
      for (let i = 0; i < n; i++) {
        const du = dur[i % dur.length], de = delay[i % delay.length], it = iter[i % iter.length];
        if (!timeline && !INTERACTION.test(sel) && !liveOk(sel) && du > 0 && Number.isFinite(it) && du * it + Math.max(de, 0) > 5) {
          const total = `${Math.round((du * it + Math.max(de, 0)) * 10) / 10} s`;
          fail(`${where(line)}: M3 animação dura ${total} (máx. 5 s, contando repetições e atraso)`);
        }
        if (du > 0 && du < 0.333 && it > 1) fail(`${where(line)}: M4 animação de ${Math.round(du * 1000)} ms repetida ${Number.isFinite(it) ? it : "sem fim"} vezes (risco de piscar: mín. 333 ms por ciclo)`);
      }
    }
  }
  // M7: SMIL animation in HTML/SVG, GIF, animated WebP/PNG
  for (const p of files) {
    if (/\.(html|svg)$/i.test(p)) {
      const m = readFileSync(p, "utf8").match(/<(animate|animateTransform|animateMotion|set)[\s/>]/);
      if (m) fail(`${rel(p)}: M7 animação SMIL <${m[1]}> (não obedece à preferência "reduzir movimento"; use CSS)`);
    } else if (/\.gif$/i.test(p)) fail(`${rel(p)}: M7 arquivo GIF (use foto parada ou vídeo curto sem autoplay)`);
    else if (/\.(webp|png|apng)$/i.test(p)) {
      const b = readFileSync(p);
      const animated = /\.webp$/i.test(p)
        ? b.toString("latin1", 12, 16) === "VP8X" && (b[20] & 0x02) !== 0
        : (() => { const a = b.indexOf("acTL"), d = b.indexOf("IDAT"); return a > 0 && (d < 0 || a < d); })();
      if (animated) fail(`${rel(p)}: M7 imagem animada (${/\.webp$/i.test(p) ? "WebP" : "PNG"})`);
    }
  }
}

/** Collects CSS sources from files: .css, <style> blocks and style="" attributes in .html/.svg. */
export function motionSources(files, rel) {
  const sources = [];
  for (const p of files) {
    if (/\.css$/i.test(p)) sources.push({ name: rel(p), css: readFileSync(p, "utf8") });
    else if (/\.(html|svg)$/i.test(p)) {
      const html = readFileSync(p, "utf8");
      for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
        const before = html.slice(0, m.index).split("\n").length - 1;
        sources.push({ name: rel(p), css: "\n".repeat(before) + m[1] });
      }
      for (const m of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*?)\sstyle="([^"]*)"/gi)) {
        const cls = /\sclass="([^"]*)"/.exec(m[2])?.[1]?.trim().split(/\s+/).map((c) => "." + c).join("") ?? "";
        const before = html.slice(0, m.index).split("\n").length - 1;
        sources.push({ name: rel(p), css: "\n".repeat(before) + `${m[1]}${cls} { ${m[3].replace(/&quot;/g, '"')} }` });
      }
    }
  }
  return sources;
}

export function checkMotion({ files, rel, fail, warn }) {
  motionRules(motionSources(files, rel), files, rel, fail, warn);
}

// Stand-alone: motion rules only, on any folder (e.g. a design prototype):
//   node scripts/lib/static-checks.mjs --movimento ../design/prototype-v2
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename) && process.argv[2] === "--movimento") {
  const dir = resolve(process.argv[3] ?? join(import.meta.dirname, "../../_site"));
  if (!existsSync(dir)) { console.log(`FALHA  pasta não encontrada: ${dir}`); process.exit(1); }
  let f = 0, w = 0;
  const files = walk(dir).filter((p) => !/[\\/]node_modules[\\/]/.test(p));
  checkMotion({ files, rel: (p) => relative(process.cwd(), p).split("\\").join("/"),
    fail: (m) => { f++; console.log(`FALHA  ${m}`); }, warn: (m) => { w++; console.log(`aviso  ${m}`); } });
  console.log(`movimento: ${f} falhas, ${w} avisos [${files.length} arquivos em ${relative(process.cwd(), dir) || "."}]`);
  process.exit(f ? 1 : 0);
}
