// Front matter reader for the copy in src/pages/. The copy writes descriptions with ": " inside
// (e.g. "… pelo grupo: fale conosco …"), which strict YAML rejects. This reader follows the same
// simple rules as the planning repo's check-content.py: one `chave: valor` per line, inline lists
// [a, b], block lists "  - a", true/false. Nothing else from YAML is supported (on purpose).
export function parseFrontMatter(text) {
  const data = {};
  let key = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    let m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) {
      key = m[1];
      let val = m[2].trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val.slice(1, -1).split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      } else if (val === "") {
        val = [];
      } else if (val === "true" || val === "false") {
        val = val === "true";
      } else {
        val = val.replace(/^(['"])(.*)\1$/, "$2");
      }
      data[key] = val;
      continue;
    }
    m = line.match(/^\s+-\s*(.+)$/);
    if (m && key && Array.isArray(data[key])) {
      data[key].push(m[1].trim().replace(/^['"]|['"]$/g, ""));
      continue;
    }
    throw new Error(`front matter: linha não reconhecida: "${line}"`);
  }
  return data;
}
