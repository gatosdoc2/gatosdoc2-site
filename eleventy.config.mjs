// Eleventy configuration for the Gatos do C2 site (decision 0013: Eleventy 3.1.8, Markdown, no client JS).
// Maintainer guide: docs/como-funciona.md
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { components, stripComments } from "./scripts/lib/components.mjs";
import { parseFrontMatter } from "./scripts/lib/front-matter.mjs";
import { stripExamples } from "./scripts/lib/exemplos.mjs";

// Example content, the shop and the prototype options panel ARE published in the first version (project lead,
// 2026-11-18; decision 0034). To build without them later: EXEMPLOS=0 npm run build (drops pages with
// `exemplo: true`, every element marked data-exemplo and the panel).
const EXEMPLOS = process.env.EXEMPLOS !== "0";

export default function (eleventyConfig) {
  // Pages are copied from the planning repo's content/ by scripts/sync-content.mjs (decision 0024).
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  // GitHub Pages serves the site under /<repo>/: PATH_PREFIX (e.g. "/gatosdoc2-site/") rewrites every href/src in the HTML;
  // SITE_URL (full public URL, no trailing slash) feeds canonical links, sitemap and robots. Both unset = root of the domain.
  eleventyConfig.addGlobalData("urlBase", (process.env.SITE_URL || "").replace(/\/$/, ""));
  eleventyConfig.addGlobalData("ano", () => String(new Date().getFullYear()));
  eleventyConfig.addGlobalData("versao", () => Date.now().toString(36)); // CSS cache-busting on every build // decorative eyes only (decision 0035)
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addGlobalData("versao", () => Date.now().toString(36)); // CSS cache-busting on every build // decorative eyes only (decision 0035)
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/apple-touch-icon.png": "apple-touch-icon.png" });

  eleventyConfig.addGlobalData("exemplos", EXEMPLOS);
  eleventyConfig.addPreprocessor("exemplos", "njk,md", (data) => (data.exemplo && !EXEMPLOS ? false : undefined));
  // The home page is a template (src/paginas-v5/index.njk); the synced Markdown home stays as text source only.
  eleventyConfig.ignores.add("src/pages/index.md");

  // Front matter: simple `chave: valor` lines (see scripts/lib/front-matter.mjs for why not full YAML).
  eleventyConfig.setFrontMatterParsingOptions({ engines: { yaml: parseFrontMatter } });

  // Markdown: links for bare e-mail addresses (the copy writes gatosdoc2@gmail.com as text); no fuzzy web links.
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ html: true, linkify: true, typographer: false });
    md.linkify.set({ fuzzyLink: false, fuzzyIP: false, fuzzyEmail: true });
  });

  // Photos: a Markdown image ![alt](/assets/fotos/x.jpg "legenda") becomes a responsive <picture>.
  // Originals live in src/assets/fotos/ (max 2400 px, see docs/fotos.md); output in _site/assets/fotos/.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [480, 960], // figures are at most 30rem wide: 960 px covers 2x screens
    urlPath: "/assets/fotos/",
    outputDir: "./_site/assets/fotos/",
    failOnError: true,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "(min-width: 34rem) 30rem, 100vw" },
    },
  });

  // Order matters: components first (needs the source comments for photo slots), then comments go.
  eleventyConfig.addTransform("components", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    const html = stripComments(components(content, this.page));
    return EXEMPLOS ? html : stripExamples(html);
  });

  eleventyConfig.addFilter("absoluteUrl", (path, base) => new URL(path, base).href);

  // Last transform: under a path prefix (GitHub Pages), every root-relative href/src/srcset gets it, including the HTML
  // the transforms above add (page heads, "Continue por aqui"). No prefix = no change.
  const PREFIXO = (process.env.PATH_PREFIX || "/").replace(/\/?$/, "/");
  if (PREFIXO !== "/") eleventyConfig.addTransform("prefixo", (html, out) => {
    if (!out || !out.endsWith(".html")) return html;
    const fix = (u) => (u.startsWith("/") && !u.startsWith("//") && !u.startsWith(PREFIXO) ? PREFIXO + u.slice(1) : u);
    return html.replace(/\s(href|src)="([^"]*)"/g, (m, a, u) => ` ${a}="${fix(u)}"`)
      .replace(/\ssrcset="([^"]*)"/g, (m, v) => ` srcset="${v.split(",").map((x) => x.trim().replace(/^\S+/, fix)).join(", ")}"`);
  });
  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false, // Markdown copy is plain text: no template code inside pages
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"],
  };
}
