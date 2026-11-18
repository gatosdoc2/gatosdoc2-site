// Turns the plain HTML that Markdown produces into the prototype's components (design/prototype/ in the
// planning repo). Only markup changes here; the words come from the Markdown copy unchanged
// (scripts/check.mjs compares them). Which section gets which look: src/_data/componentes.json.
import { readFileSync } from "node:fs";

const SECTION_LOOKS = JSON.parse(readFileSync(new URL("../../src/_data/componentes.json", import.meta.url), "utf8")).secoes;

const START = "<!-- components:start -->";
const END = "<!-- components:end -->";

export function slugify(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const plain = (html) => html.replace(/<[^>]+>/g, "").trim();
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Remove every HTML comment (source codes, GAP notes, photo notes) from the built page. */
export function stripComments(html) {
  return html.replace(/[ \t]*<!--[\s\S]*?-->(\n(?=\s*\n))?/g, "").replace(/[ \t]+(<\/(?:p|li|td|th)>)/g, "$1");
}

/** Apply components only between the markers the page layout writes around the Markdown body. */
import { ENFEITES, GATO_ANDA } from "./enfeites.mjs";
import { applyExtras } from "./extras.mjs";
const PAGINAS = JSON.parse(readFileSync(new URL("../../src/_data/paginas.json", import.meta.url), "utf8"));
const ARROW = '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
const PAW = '<svg class="paw-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#pata"></use></svg>';
const tile = (b) => `<li class="t-${b.cor}"><a class="tile" href="${b.url}"><span class="tile__label">${b.titulo}</span><span class="tile__hint">${b.dica}</span>${ARROW}</a></li>`;

export function components(html, page = {}) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1) return html;
  const body = html.slice(a + START.length, b);
  return html.slice(0, a) + transformBody(body, PAGINAS[page.url]) + html.slice(b + END.length);
}

let OUTRA = "mist"; // alternate field colour (lead, 2026-11-18: no beige backgrounds)
function transformBody(body, look) {
  OUTRA = "mist";
  // Photo slots first (they live in comments), then every other comment goes, then the components.
  const [head, ...sections] = stripComments(photoSlots(body)).split(/(?=<h2>)/);
  const used = new Set();
  let alt = 0;
  let body2 = sections.map((s) => section(common(s), used, look ? alt++ : -1)).join("\n");
  if (look && look.extras) body2 = applyExtras(body2, look.extras);
  if (look && look.anda) body2 = body2.replace(/(<div class="wrap sheet">\n)/, `$1${GATO_ANDA}\n`);
  // "Continue por aqui" takes the colour the last section does not have, so two bands never merge.
  const ultima = body2.lastIndexOf('<section class="'), lastField = ultima >= 0 && /^<section class="[^"]*field-/.test(body2.slice(ultima));
  const cont = look && look.continue ? `<nav class="continue${lastField ? "" : ` field-${OUTRA}`}" aria-labelledby="continue" data-sem-copia><div class="wrap"><div class="section-head"><h2 id="continue">Continue por aqui</h2></div><ul class="frentes-grid">${look.continue.map(tile).join("")}</ul></div></nav>\n` : "";
  return pageHead(common(head), look) + body2 + cont;
}

// h1 + first paragraph (lede) + anything before the first h2.
function pageHead(html, look) {
  const withLede = html.replace(/(<\/h1>\s*)<p>/, '$1<p class="lede">');
  if (!look) return `<div class="wrap page-head">\n<div class="sheet">\n${withLede.trim()}\n</div>\n</div>\n`;
  // Visual head (src/_data/paginas.json): colour field, text left, photo + two coloured tiles right.
  const foto = look.foto
    ? `<li class="cm-foto"><span class="foto-só"><img src="/assets/img/paginas/${look.foto}-480.jpg" width="480" height="600" alt="" eleventy:ignore></span></li>`
    : `<li class="cm-foto cm-pata">${PAW}</li>`;
  return `<div class="page-head page-head--visual field-${look.campo || "mist"}">\n<div class="wrap page-head__grid">\n<div class="sheet">\n${withLede.trim()}\n</div>\n` +
    `<div class="cabeca-mosaico-caixa">${look.enfeite ? `<div class="enfeite enfeite--${look.enfeite}" aria-hidden="true" data-sem-copia>${ENFEITES[look.enfeite]}</div>` : ""}<ul class="cabeca-mosaico" aria-label="Veja também" data-sem-copia>${foto}${(look.blocos || []).map(tile).join("")}</ul></div>\n</div>\n</div>\n`;
}

function section(html, used, alt = -1) {
  const m = html.match(/^<h2>([\s\S]*?)<\/h2>/);
  const title = plain(m[1]);
  let id = slugify(title) || "secao";
  while (used.has(id)) id += "-2";
  used.add(id);
  const h2 = alt >= 0 ? `<div class="section-head"><h2 id="${id}">${m[1]}</h2></div>` : `<h2 id="${id}">${m[1]}</h2>`;
  let rest = html.slice(m[0].length).trim();
  const look = SECTION_LOOKS[title] || "padrao";

  if (look === "rotas") {
    return `<div class="wrap section section--flush">\n<nav aria-labelledby="${id}">\n${h2}\n${routes(rest)}\n</nav>\n</div>\n`;
  }
  let cls = "section";
  if (look === "alternada") cls += " section--alt";
  else if (alt >= 0 && alt % 2 === 1 && look === "padrao") cls += ` field-${OUTRA}`;
  if (look === "contato") {
    cls += " contact-strip";
    rest = linkListToButtons(rest, "button--action", "button--secondary").replace(/<p>/g, '<p class="contact-strip__note">');
  }
  if (look === "faixa-ajude") {
    cls = "band-ajude on-field section section--flush";
    rest = rest.replace(/<p>(<a href="[^"]+">[^<]+<\/a>)<\/p>/g, (_, a) =>
      `<div class="actions">${a.replace("<a ", '<a class="button button--on-field" ')}</div>`);
  }
  // Long stretches of text get a paw divider at the end (decoration, no words).
  const longa = alt >= 0 && rest.replace(/<[^>]+>/g, "").length > 1200;
  const DIV = `<div class="divisor-pata" aria-hidden="true">${PAW}${PAW}${PAW}</div>`;
  if (longa && /<h3/.test(rest)) { let k = 0; rest = rest.replace(/<h3/g, (m) => (k++ ? `${DIV}\n${m}` : m)); }
  else if (longa) { let k = 0; rest = rest.replace(/<\/(p|ul|ol|table)>\n/g, (m) => (++k % 5 === 0 ? `${m}${DIV}\n` : m)); }
  const divisor = longa ? `\n<div class="divisor-pata" aria-hidden="true">${PAW}${PAW}${PAW}</div>` : "";
  return `<section class="${cls}" aria-labelledby="${id}">\n<div class="wrap sheet">\n${h2}\n${rest}${divisor}\n</div>\n</section>\n`;
}

// Rules that apply in every section.
function common(html) {
  return figures(tables(records(html)))
    .replace(/<strong>Em construção\.<\/strong>/g, '<span class="em-construcao__label">Em construção.</span>');
}

// "- [Título](/url/): dica." list → the route index from the prototype.
function routes(html) {
  return html.replace(/<ul>([\s\S]*?)<\/ul>/, (_, items) => {
    let first = true;
    const lis = items.replace(/<li>\s*<a href="([^"]+)">([^<]+)<\/a>:?\s*([\s\S]*?)\s*<\/li>/g, (_, href, t, hint) => {
      const cls = first ? "route route--first" : "route";
      first = false;
      return `<li class="${cls}"><a class="route__link" href="${href}"><span class="route__title">${t}</span>` +
        `<span class="route__hint">${capitalize(plain(hint))}</span></a></li>`;
    });
    return `<ul class="routes">${lis}</ul>`;
  });
}

// A list whose items are only links → a row of buttons.
function linkListToButtons(html, firstCls, otherCls) {
  return html.replace(/<ul>\s*((?:<li><a href="[^"]+">[^<]+<\/a>\s*<\/li>\s*)+)<\/ul>/g, (_, items) => {
    let i = 0;
    const links = [...items.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(([, href, t]) =>
      `<a class="button ${i++ === 0 ? firstCls : otherCls}" href="${href}">${t}</a>`);
    return `<div class="actions">\n${links.join("\n")}\n</div>`;
  });
}

// "**21 e 22 de março de 2024:** texto. Fonte: …" → dated record.
function records(html) {
  return html.replace(/<p><strong>([^<]*\d{4}):<\/strong>\s*([\s\S]*?)<\/p>/g, (_, date, text) => {
    const [main, source] = text.split(/\s*(?=Fonte: )/);
    return `<div class="record">\n<p class="record__date">${date}</p>\n<p class="record__text">${capitalize(main.trim())}</p>\n` +
      (source ? `<p class="record__source">${source.trim()}</p>\n` : "") + "</div>";
  });
}

// Markdown tables → the prototype's data table (labels for the stacked mobile view, roles kept for
// screen readers when CSS changes the display).
function tables(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_, inner) => {
    const labels = [...(inner.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => plain(m[1]));
    let out = inner
      .replace(/<thead>/, '<thead role="rowgroup">')
      .replace(/<tbody>/, '<tbody role="rowgroup">')
      .replace(/<tr>/g, '<tr role="row">')
      .replace(/<th>/g, '<th scope="col" role="columnheader">');
    out = out.replace(/<tbody role="rowgroup">([\s\S]*?)<\/tbody>/, (_, rows) =>
      `<tbody role="rowgroup">${rows.replace(/<tr role="row">([\s\S]*?)<\/tr>/g, (_, cells) => {
        let col = 0;
        const c = cells.replace(/<td>([\s\S]*?)<\/td>/g, (_, v) => {
          const label = labels[col];
          const last = col === labels.length - 1;
          const cell = col === 0
            ? `<th scope="row" role="rowheader">${v}</th>`
            : `<td role="cell"${last && label === "Fonte" ? ' class="source-cell"' : ""} data-label="${label}">${v}</td>`;
          col++;
          return cell;
        });
        return `<tr role="row">${c}</tr>`;
      })}</tbody>`);
    return `<table class="data-table full" role="table">${out}</table>`;
  });
}

// A paragraph with only an image (or the <picture> made from it) → figure; the Markdown title is the caption.
function figures(html) {
  return html.replace(/<p>\s*(<picture>[\s\S]*?<\/picture>|<img [^>]*>)\s*<\/p>/g, (_, media) => {
    const cap = media.match(/ title="([^"]*)"/)?.[1];
    const m = media.replace(/ title="[^"]*"/, "");
    return `<figure class="figure figure--margin">${m}${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
  });
}

// "<!-- PHOTO: … -->" not yet replaced by an image → neutral placeholder (no text, ignored by screen readers).
// Slots marked "optional" stay empty. scripts/check.mjs lists every slot as a warning.
function photoSlots(html) {
  return html.replace(/<!--\s*PHOTO:\s*([\s\S]*?)-->/g, (_, note) =>
    /^optional/i.test(note.trim())
      ? ""
      : '<div class="figure figure--margin" data-foto="pendente"><div class="placeholder placeholder--4x5"></div></div>');
}
