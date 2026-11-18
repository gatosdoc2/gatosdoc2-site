// Removes every element marked data-exemplo (decision 0028: example content only in development).
// Works on the well-formed HTML our templates produce: finds the opening tag and its matching closing tag.
const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "source", "wbr", "use", "circle", "ellipse", "path"]);

export const stripExamples = (html) => stripMarked(html, "data-exemplo");

export function stripMarked(html, attr) {
  const open = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\s${attr}\\b[^>]*>`, "i");
  for (let guard = 0, m; (m = open.exec(html)) && guard < 5000; guard++) {
    const tag = m[1].toLowerCase(), start = m.index, afterOpen = start + m[0].length;
    if (VOID.has(tag) || m[0].endsWith("/>")) { html = html.slice(0, start) + html.slice(afterOpen); continue; }
    const tok = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    tok.lastIndex = afterOpen;
    let depth = 1, t;
    while (depth > 0 && (t = tok.exec(html))) depth += t[1] ? -1 : 1;
    html = html.slice(0, start) + html.slice(t ? t.index + t[0].length : afterOpen);
  }
  return html;
}
