/**
 * The static server the browser tests run against.
 *
 * WHY IT EXISTS AT ALL. Production is GitHub Pages: a plain static host with no
 * server-side anything. So the closest honest local stand-in is a plain static
 * file server, and writing forty lines of `node:http` costs less than a
 * dependency and behaves more like Pages than most of them would.
 *
 * WHY IT SERVES THE REPOSITORY ROOT rather than `app/`. The Mini App reaches
 * outside its own directory twice — `/assets/daily-plan-copy.js` absolutely and
 * `../assets/magic-esim-logo-header.png` relatively — and the older browser
 * tests each special-cased `/assets/` in their own server to paper over that.
 * Serving the root makes both resolve the way they resolve in production,
 * because they resolve the same way. It also means the storefront is reachable
 * from the same server when tests for it arrive.
 *
 * WHAT IT DOES NOT DO: no API, no backend, no Platega, no credentials. Every
 * request the app makes to an API host is intercepted in the browser by
 * `test/e2e/harness.js`, so nothing here ever needs to know what an order is.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = createServer(async (req, res) => {
  // `normalize` collapses `..`, and the prefix check refuses anything that
  // still points outside the repository. A test server is still a server.
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');

    return;
  }

  let target = file;
  try {
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
  } catch {
    res.writeHead(404).end('not found');

    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      // Pages sends max-age=600; a cache is the last thing a test suite needs.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`storefront on http://127.0.0.1:${PORT}/`);
});
