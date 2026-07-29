const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8934;

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/Miles OS UI Kit.html";
    const full = path.join(ROOT, p);
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(full);
      const type = ext === ".html" ? "text/html" : ext === ".md" ? "text/plain" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`serving design/ on ${PORT}`));
