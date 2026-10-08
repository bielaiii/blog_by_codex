const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { formatMarkdown } = require('./server/format.cjs');
const listSnippets = require('./server/snippets.cjs');
const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || '127.0.0.1';
const editorEnabled = process.env.BLOG_EDITOR_ENABLED !== 'false';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.pdf': 'application/pdf'
};
function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function failure(status, message) { return Object.assign(new Error(message), { status }); }
function canEdit() {
  return editorEnabled;
}
async function readBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw failure(415, 'Use application/json');
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw failure(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Expected an object');
    return payload;
  }
  catch { throw failure(400, 'Invalid JSON payload'); }
}
(async () => {
  const { createPostService } = await import('./scripts/lib/post-service.mjs');
  const { generateCatalog, safeFile, readJson } = await import('./scripts/lib/content.mjs');
  const { parseFrontmatter, isPostVisible } = await import('./shared/post-model.mjs');
  const service = createPostService(root);
  await generateCatalog(root, { includeDrafts: true });
  const server = http.createServer(async (req, res) => {
    try {
      let url;
      try { url = new URL(req.url || '/', `http://${req.headers.host}`); }
      catch { throw failure(400, 'Invalid URL or Host'); }
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const allowedHosts = (process.env.BLOG_ALLOWED_HOSTS || '').split(',');
      if (hostname !== 'localhost' && !net.isIP(hostname) && !allowedHosts.includes(hostname)) throw failure(403, 'Host is not allowed');
      const route = url.pathname;
      const api = route.startsWith('/api/');
      if (api && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== url.origin))) throw failure(403, 'Cross-origin editing is not allowed');
      if (req.method === 'GET' && route === '/api/preview-config') {
        sendJson(res, 200, { localEditor: canEdit() }); return;
      }
      if (api) {
        if (!canEdit()) throw failure(403, 'Editing is disabled');
        if (req.method === 'GET' && route === '/api/snippets') { sendJson(res, 200, listSnippets(path.join(root, 'snippets'))); return; }
        if (req.method === 'GET' && route === '/api/post') { sendJson(res, 200, { ok: true, ...await service.read(url.searchParams.get('slug')) }); return; }
        if (req.method === 'POST') {
          const payload = await readBody(req);
          let result;
          if (route === '/api/save-post') result = await service.save(payload);
          else if (route === '/api/delete-post') result = await service.delete(payload);
          else if (route === '/api/format-post') result = { ok: true, ...await formatMarkdown(String(payload.markdown || '')) };
          else throw failure(404, 'API not found');
          sendJson(res, 200, result); return;
        }
        throw failure(404, 'API not found');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw failure(405, 'Method not allowed');
      if (['/data/catalog.json', '/data/posts.json', '/data/post-metadata.json'].includes(route)) {
        const catalog = readJson(path.join(root, 'data/catalog.json'));
        if (!canEdit()) {
          const config = readJson(path.join(root, 'data/site-config.json'));
          catalog.posts = catalog.posts.filter(post => isPostVisible(post, { publishDrafts: config.publishDrafts === true }));
          for (const key of ['postMetadata', 'searchText']) catalog[key] = Object.fromEntries(catalog.posts.map(post => [post.slug, catalog[key][post.slug]]));
        }
        sendJson(res, 200, route === '/data/posts.json' ? catalog.posts : route === '/data/post-metadata.json' ? catalog.postMetadata : catalog); return;
      }
      let relative;
      try { relative = decodeURIComponent(route).replace(/^\//, '') || 'index.html'; }
      catch { throw failure(400, 'Invalid URL'); }
      if (!['index.html', 'app.js', 'styles.css'].includes(relative) && !/^(modules|shared|vendor|assets|posts|data)\//.test(relative)) throw failure(403, 'Private project files are not served');
      let file;
      try { file = safeFile(root, relative); } catch { throw failure(403, 'Forbidden path'); }
      if (relative.startsWith('posts/') && relative.endsWith('.md') && !canEdit()) {
        const metadata = parseFrontmatter(fs.readFileSync(file, 'utf8')).metadata;
        const config = readJson(path.join(root, 'data/site-config.json'));
        if (!isPostVisible(metadata, { publishDrafts: config.publishDrafts === true })) throw failure(404, 'Post not found');
      }
      const data = await fs.promises.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!res.headersSent) sendJson(res, error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.message });
      else res.end();
    }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Preview server running at http://${host}:${port}`));
})().catch(error => { console.error(error); process.exitCode = 1; });
