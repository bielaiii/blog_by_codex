// End-to-end local deployment check using Node.js 22+ and a Chromium browser.
// All external HTTP requests are blocked; the temporary draft is deleted.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8000/';
const base = new URL(baseUrl);
const address = base.hostname.split('.').map(Number);
const privateIPv4 = address.length === 4 && address.every(part => Number.isInteger(part) && part >= 0 && part <= 255) &&
  (address[0] === 10 || (address[0] === 172 && address[1] >= 16 && address[1] <= 31) || (address[0] === 192 && address[1] === 168));
assert(['127.0.0.1', 'localhost'].includes(base.hostname) || privateIPv4, 'Use a local or LAN preview server');
const cache = path.join(os.homedir(), '.cache/ms-playwright');
const cachedBrowsers = fs.existsSync(cache)
  ? fs.readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
    .map(name => path.join(cache, name, 'chrome-linux64/chrome'))
  : [];
const executable = process.env.CHROME_PATH || cachedBrowsers.find(file => fs.existsSync(file));
assert(executable, 'Set CHROME_PATH to a Chromium/Chrome executable');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-browser-check-'));
const browser = spawn(executable, [
  '--headless', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
let session;
let sequence = 0;
const pending = new Map();
const exceptions = [];
const externalRequests = [];
const slug = `browser-check-${Date.now()}`;
let shouldCleanDraft = false;

function send(method, params = {}, browserCommand = false) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(!browserCommand && session ? { sessionId: session } : {}) }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, result.exceptionDetails?.exception?.description);
  return result.result.value;
}

async function waitFor(expression, label) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    if (await evaluate(expression)) return;
    if (exceptions.length) throw new Error(exceptions.join('\n'));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const editorStatus = await evaluate("document.querySelector('#markdown-editor-status')?.textContent || ''");
  throw new Error(`Timed out: ${label}${editorStatus ? `; editor: ${editorStatus}` : ''}`);
}

try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Browser did not start: ${output}`)), 10000);
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once('error', error => { clearTimeout(timer); reject(error); });
    browser.once('exit', code => { clearTimeout(timer); reject(new Error(`Browser exited (${code}): ${output}`)); });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      exceptions.push(details.exception?.description || details.text);
    }
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      const external = ['http:', 'https:'].includes(url.protocol) && url.origin !== base.origin;
      if (external) externalRequests.push(request.url);
      send(external ? 'Fetch.failRequest' : 'Fetch.continueRequest', {
        requestId, ...(external ? { errorReason: 'BlockedByClient' } : {})
      }).catch(error => exceptions.push(error.message));
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(error => exceptions.push(error.message));
    }
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true);
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true);
  session = attached.sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Page.navigate', { url: baseUrl });
  await waitFor("document.querySelector('#skill-diamond')?.children.length > 0 && document.querySelector('#activity-grid')?.children.length > 0", 'home initialization');
  const initialTheme = await evaluate('document.documentElement.dataset.theme');
  await evaluate("document.querySelector('#theme-toggle').click()");
  assert.notEqual(await evaluate('document.documentElement.dataset.theme'), initialTheme);
  await evaluate("document.querySelector('[data-tab=articles]').click()");
  await waitFor("!document.querySelector('#article-list-view').hidden && document.querySelectorAll('#article-list .archive-card').length > 0", 'article archive');
  await evaluate("document.querySelector('#article-list .archive-card').click()");
  await waitFor("!document.querySelector('#article-detail-view').hidden && document.querySelector('#article-content').textContent.length > 30 && document.querySelector('#article-loading').hidden", 'article reading');
  await evaluate("document.querySelector('[data-tab=projects]').click()");
  await waitFor("document.querySelectorAll('#article-list .project-card').length > 0", 'project archive');
  await evaluate("document.querySelector('[data-tab=resume]').click()");
  await waitFor("location.hash.includes('tab=resume') && document.querySelector('#article-title').textContent === '个人简历' && document.querySelector('#article-loading').hidden", 'resume');
  await evaluate("document.querySelector('[data-tab=articles]').click()");
  await waitFor("!document.querySelector('#article-list-view').hidden && document.querySelector('.local-editor-create')", 'local editor entry');
  await evaluate("document.querySelector('.local-editor-create').click()");
  await waitFor("!!document.querySelector('#markdown-editor-input')", 'editor');
  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\ndate: 2026-10-06\ntab: articles\ndraft: true\n---\n\n# ${slug}\n\n**Markdown**\n\n$$x^2$$\n\n\`\`\`javascript\nconst answer = 42;\n\`\`\`\n\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n`;
  await evaluate(`(() => { const input=document.querySelector('#markdown-editor-input'); input.value=${JSON.stringify(markdown)}; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await waitFor("document.querySelector('#markdown-editor-preview strong') && document.querySelector('#markdown-editor-preview .katex') && document.querySelector('#markdown-editor-preview .hljs') && document.querySelector('#markdown-editor-preview .mermaid-diagram svg')", 'Markdown, math, code and diagrams');
  await evaluate("document.querySelector('#markdown-editor-snippets').click()");
  await waitFor("document.querySelectorAll('.markdown-editor-snippet-item').length > 0", 'snippets');
  shouldCleanDraft = true;
  await evaluate("document.querySelector('#markdown-editor-save').click()");
  await waitFor("document.querySelector('#markdown-editor-input').dataset.mode === 'update'", 'save draft');
  const persisted = await evaluate(`fetch(${JSON.stringify(`posts/${slug}.md`)}).then(r=>r.text())`);
  assert.equal(persisted, markdown);
  const drafts = await evaluate("fetch('data/posts.json').then(r=>r.json())");
  assert(drafts.some(post => post.slug === slug && post.draft), 'Saved draft must appear in local archive');
  if (process.env.BROWSER_SCREENSHOT) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.BROWSER_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  await evaluate("document.querySelector('#markdown-editor-delete').click()");
  await waitFor("!document.body.classList.contains('is-editor-mode') && location.hash === '#tab=articles'", 'delete draft');
  const remaining = await evaluate("fetch('data/posts.json').then(r=>r.json())");
  assert(!remaining.some(post => post.slug === slug), 'Deleted draft must leave archive');
  shouldCleanDraft = false;
  assert.deepEqual(exceptions, [], 'Browser runtime errors');
  assert.deepEqual(externalRequests, [], 'Page must not request external assets');
  console.log('PASS: offline home, theme, articles, projects, resume, Markdown/math/code/diagrams, snippets, draft save/delete');
} finally {
  if (shouldCleanDraft && ws?.readyState === WebSocket.OPEN && session) {
    await evaluate(`fetch('/api/delete-post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(slug)}})})`).catch(() => {});
  }
  ws?.close();
  browser.kill();
}
