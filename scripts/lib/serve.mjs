// Tiny static server for the checks (no dependencies, local only). Mimics what we assume Apache does on the
// EESC server (assumption until the server probe): /pasta/ → /pasta/index.html, /pasta → 301 /pasta/,
// unknown path → 404 with /404.html as the body.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2",
};

export function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith("/")) { res.writeHead(301, { Location: path + "/" }).end(); return; }
      file = join(file, "index.html");
    }
    if (!existsSync(file)) {
      const body = existsSync(join(root, "404.html")) ? readFileSync(join(root, "404.html")) : "404";
      res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(body);
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
