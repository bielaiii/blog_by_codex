// Run browser regressions against isolated working trees and a published subpath.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSite } from './lib/build-site.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-browser-suite-'));
const root = path.join(temporary, 'repo');
fs.mkdirSync(root);
for (const item of ['preview-server.js', 'index.html', 'app.js', 'styles.css', 'server', 'modules', 'shared', 'scripts', 'vendor', 'data', 'posts', 'snippets']) fs.cpSync(path.join(project, item), path.join(root, item), { recursive: true });
let preview;
let staticServer;
async function run(args, env = {}) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
  await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Browser check exited ${code}`))); });
}
try {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  preview = spawn(process.execPath, ['preview-server.js'], { cwd: root, env: { ...process.env, HOST: '0.0.0.0', PORT: String(port), BLOG_EDITOR_ENABLED: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Preview startup timed out: ${output}`)), 10000);
    preview.stdout.on('data', chunk => { output += chunk; if (output.includes('Preview server running')) { clearTimeout(timer); resolve(); } });
    preview.stderr.on('data', chunk => { output += chunk; });
    preview.on('error', reject);
    preview.on('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited ${code}: ${output}`)); });
  });
  await run(['scripts/check-browser.mjs', `http://127.0.0.1:${port}/`]);
  await run(['scripts/check-browser.mjs', `http://127.0.0.2:${port}/`]);
  const site = path.join(temporary, 'site');
  await buildSite(root, site);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  staticServer = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/blog/')) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(pathname.slice('/blog/'.length)) || 'index.html';
    const file = path.resolve(site, relative);
    if (!file.startsWith(`${site}${path.sep}`)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    });
  });
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
  await run(['scripts/check-browser.mjs', `http://127.0.0.1:${staticServer.address().port}/blog/`, '--read-only']);
} finally {
  if (preview && preview.exitCode === null) { preview.kill(); await new Promise(resolve => preview.once('exit', resolve)); }
  if (staticServer) await new Promise(resolve => staticServer.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
