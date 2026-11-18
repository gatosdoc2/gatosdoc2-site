// Visual modules for Markdown pages (src/_data/paginas.json → "extras": [{ "apos": "<h2 id>", "tipo": "..." }]).
// Lead, 2026-11-18: "Quem somos" more visual; example content allowed if labelled (decisions 0028, 0034).
// Real facts reuse sourced text from the "O que fazemos" hub; invented items carry data-exemplo (EXEMPLOS=0 drops them).
const IMG = (f, w = 480, h = 360) => `<img src="/assets/img/paginas/${f}-480.jpg" width="${w}" height="${h}" loading="lazy" alt="" eleventy:ignore>`;
const ARROW = '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
const GATO = (c) => `<svg class="avatar" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="24" fill="var(--color-${c})"></circle><path d="M12 36c0-9 5-15 12-15s12 6 12 15z" fill="var(--color-navy)"></path><path d="M14 22l2-10 7 6zM34 22l-2-10-7 6z" fill="var(--color-navy)"></path><circle cx="24" cy="24" r="9" fill="var(--color-navy)"></circle><circle cx="20.5" cy="23.5" r="1.6" fill="var(--color-eye)"></circle><circle cx="27.5" cy="23.5" r="1.6" fill="var(--color-eye)"></circle></svg>`;
export const EXTRAS = {
  fotos: () => `<div class="qs-fotos" aria-hidden="true" data-sem-copia>${["p14b-rosto", "p29-gramado", "f05-praca", "p39-caminho"].map((f) => `<span>${IMG(f)}</span>`).join("")}</div>`,
  "linha-tempo": () => `<ol class="linha-tempo qs-linha" data-sem-copia><li><span class="linha-tempo__data"><time datetime="2022">meados de 2022</time></span><span>O grupo começa a acompanhar a colônia do Campus 2.</span></li><li><span class="linha-tempo__data"><time datetime="2024-03">mar. 2024</time></span><span><a href="/noticias/vinte-gatos-castrados-no-campus-2/">Vinte gatos castrados no Campus 2.</a></span></li><li><span class="linha-tempo__data"><em>data a confirmar</em></span><span><a href="/frentes/educacao/">Palestra no Projeto Pequeno Cidadão.</a></span></li></ol>`,
  equipe: () => `<div class="equipe-caixa" data-exemplo data-sem-copia><p class="chip chip--exemplo">Exemplo</p><ul class="equipe">${[
    ["eye", "Coordenação docente", "Orienta o projeto de extensão."], ["beige", "Coordenação discente", "Organiza as frentes e as reuniões."],
    ["mist", "Capturas", "Planeja cada ação de captura e devolução."], ["eye", "Comunicação", "Cuida do Instagram e do site."],
    ["beige", "Adoção", "Conversa com quem quer adotar."], ["mist", "Lojinha", "Desenha os produtos e organiza as vendas."],
  ].map(([c, t, d]) => `<li>${GATO(c)}<p class="equipe__nome">${t}</p><p class="equipe__dica">${d}</p></li>`).join("")}</ul></div>`,
  projetos: () => `<ul class="cartoes-foto" data-sem-copia>${[
    ["/frentes/capturas/", "p04-armadilha", "Capturas e castrações", "Como fazemos"], ["/frentes/educacao/", "f05-praca", "Educação", "Palestras e conversas"],
    ["/frentes/pesquisa/", "p23-ficha", "Trabalhos e monografias", "O que estudamos"], ["/frentes/parcerias/", "f01-ru-campus2", "Parcerias", "Quem caminha junto"],
  ].map(([h, f, t, d]) => `<li><a href="${h}">${IMG(f)}<span class="cartoes-foto__texto"><span class="cartoes-foto__titulo">${t}</span><span class="cartoes-foto__dica">${d}</span></span>${ARROW}</a></li>`).join("")}</ul>`,
};
// Insert each module at the end of the section whose h2 has that id ("inicio" = before the first section).
export function applyExtras(html, extras = []) {
  for (const { apos, tipo } of extras) {
    const mod = EXTRAS[tipo] ? EXTRAS[tipo]() : "";
    if (!mod) continue;
    if (apos === "inicio") { html = html.replace(/<section class="section/, `<div class="wrap qs-fotos-caixa">${mod}</div>\n$&`); continue; }
    const i = html.indexOf(`aria-labelledby="${apos}"`); if (i < 0) continue;
    const j = html.indexOf("</div>\n</section>", i); if (j < 0) continue;
    html = html.slice(0, j) + mod + "\n" + html.slice(j);
  }
  return html;
}
