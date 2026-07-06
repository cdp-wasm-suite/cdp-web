// Zero-dependency static server for the cdp-web app.
//
// The app imports the engine via the bare specifier "@olilarkin/cdp-wasm",
// resolved by the import map in index.html to ./node_modules/@olilarkin/cdp-wasm/
// (a file: link to ../cdp-wasm). The server root is this directory, so the app
// files and node_modules/ (incl. the package's wasm/ assets) are both served.
//
// Usage:  node serve.mjs  [port]   (then open the printed URL)

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, normalize, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // cdp-web/
const ROOT = here; // app root (serves app files + node_modules/)
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json',
  '.wav': 'audio/wav', '.map': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http
  .createServer(async (req, res) => {
    try {
      let p = normalize(join(ROOT, decodeURI(req.url.split('?')[0])));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
      if ((await stat(p)).isDirectory()) p = join(p, 'index.html');
      const body = await readFile(p);
      res.writeHead(200, {
        'content-type': TYPES[extname(p)] || 'application/octet-stream',
        'cache-control': 'no-cache, no-store, must-revalidate', // dev: always serve fresh modules/workers
      });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('404 Not Found');
    }
  })
  .listen(PORT, () => {
    console.log(`Serving ${ROOT}`);
    console.log(`\n  Open:  http://localhost:${PORT}/\n`);
  });
