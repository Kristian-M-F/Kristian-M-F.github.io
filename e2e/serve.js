// Serves the website folder for the end-to-end tests (no extra packages needed).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 5510;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".json": "application/json",
  ".png": "image/png",
};

http
  .createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
    if (!file.startsWith(ROOT) || file.includes(`${path.sep}e2e${path.sep}`) || file.includes("node_modules")) {
      response.writeHead(404).end();
      return;
    }
    fs.readFile(file, (error, content) => {
      if (error) {
        // Like GitHub Pages: unknown addresses get 404.html with the status 404
        response.writeHead(404, { "Content-Type": TYPES[".html"] });
        response.end(fs.readFileSync(path.join(ROOT, "404.html")));
        return;
      }
      response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      response.end(content);
    });
  })
  .listen(PORT, () => console.log(`Website on http://localhost:${PORT}`));
