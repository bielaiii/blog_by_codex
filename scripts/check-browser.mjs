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
  (address[0] === 127 || address[0] === 10 || (address[0] === 172 && address[1] >= 16 && address[1] <= 31) || (address[0] === 192 && address[1] === 168));
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
let acceptNextDialog = true;
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
      send('Page.handleJavaScriptDialog', { accept: acceptNextDialog }).catch(error => exceptions.push(error.message));
      acceptNextDialog = true;
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
  assert.equal(await evaluate("!!document.querySelector('.editor-access, .editor-access-trigger, input[type=password]')"), false, 'editing must not require a password');
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
  await evaluate("location.hash = '#tab=projects&post=async_io_frame'");
  await waitFor("document.querySelector('#article-content .project-visual-shell') && document.querySelector('#article-content').textContent.includes('项目定位') && document.querySelector('#article-content .mermaid-diagram svg')", 'project visual and Markdown body');
  await evaluate("(() => { window.__originalFetch = window.fetch; window.fetch = (url, options) => String(url).endsWith('first-post.md') ? new Promise(resolve => { window.__releaseArticle = () => resolve(new Response('# STALE ARTICLE\\n\\n## OLD HEADING')); }) : window.__originalFetch(url, options); location.hash = '#tab=articles&post=first-post'; })()");
  await waitFor("!!window.__releaseArticle", 'delayed article request');
  await evaluate("location.hash = '#tab=articles&post=code-snippet-demo'");
  await waitFor("document.querySelector('#article-title').textContent.includes('Markdown 与代码高亮') && document.querySelector('#article-content').textContent.includes('Markdown')", 'new article before old fetch');
  await evaluate("window.fetch = window.__originalFetch; window.__releaseArticle(); delete window.__releaseArticle;");
  await evaluate("new Promise(resolve => setTimeout(resolve, 30))");
  assert.equal(await evaluate("document.querySelector('#article-content').textContent.includes('STALE ARTICLE')"), false);
  if (process.argv.includes('--read-only')) {
    await evaluate("document.querySelector('[data-tab=articles]').click()");
    await waitFor("!document.querySelector('#article-list-view').hidden", 'read-only archive');
    assert.equal(await evaluate("!!document.querySelector('.local-editor-create')"), false);
    assert.equal(await evaluate("!!document.querySelector('.editor-access')"), false);
    const publicPosts = await evaluate("fetch('data/catalog.json').then(r=>r.json()).then(c=>c.posts)");
    assert(!publicPosts.some(post => post.draft));
  } else {
  await evaluate("document.querySelector('[data-tab=articles]').click()");
  await waitFor("!document.querySelector('#article-list-view').hidden && document.querySelector('.local-editor-create')", 'local editor entry');
  await evaluate("document.querySelector('.local-editor-create').click()");
  await waitFor("!!document.querySelector('#markdown-editor-input')", 'editor');
  const defaultTemplate = await evaluate("document.querySelector('#markdown-editor-input').value");
  assert.match(defaultTemplate, /\ndraft: true\n/);
  assert.match(defaultTemplate, /\ntab: "articles"\n/);
  assert.equal(await evaluate("document.querySelector('[data-draft-value=true]').getAttribute('aria-pressed')"), 'true');
  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\ndate: 2026-10-06\ntab: articles\ndraft: true\n---\n\n# ${slug}\n\n**Markdown**\n\n$$x^2$$\n\n\`\`\`javascript\nconst answer = 42;\n\`\`\`\n\n\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n`;
  await evaluate(`(() => { const input=document.querySelector('#markdown-editor-input'); input.value=${JSON.stringify(markdown)}; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  acceptNextDialog = false;
  await evaluate("location.hash='#tab=projects'");
  await waitFor("location.hash.includes('tab=editor')", 'reject navigation with unsaved edits');
  assert.equal(await evaluate("document.querySelector('#markdown-editor-input').value"), markdown);
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
  const twoColumn = markdown.replace('draft: true', 'draft: true\nlayout: two-column') + '\n<!-- row -->\n\n左侧内容\n\n<!-- column -->\n\n右侧内容\n';
  await evaluate(`(() => { const input = document.querySelector('#markdown-editor-input'); input.value = ${JSON.stringify(twoColumn)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor("document.querySelector('#markdown-editor-preview .article-row-pair .article-column-left')?.textContent.includes('左侧内容')", 'two-column preview');
  await evaluate("document.querySelector('#markdown-editor-save').click()");
  await waitFor(`document.querySelector('#markdown-editor-input').dataset.savedValue === ${JSON.stringify(twoColumn)}`, 'save two-column');
  await evaluate("document.querySelector('#markdown-editor-read').click()");
  await waitFor("document.querySelector('#article-content .article-row-pair .article-column-right')?.textContent.includes('右侧内容')", 'two-column reading parity');
  await evaluate("document.querySelector('.article-edit-action').click()");
  await waitFor("!!document.querySelector('#markdown-editor-input')", 'reopen editor');
  // Hold Mermaid after it starts, supersede the preview, then release the old work.
  await evaluate("(() => { window.__originalMermaid = window.mermaid.render; window.mermaid.render = (...args) => new Promise(resolve => { window.__releaseMermaid = () => resolve({svg: '<svg data-stale-render=\"true\"></svg>'}); }); })()");
  await evaluate(`(() => { const input = document.querySelector('#markdown-editor-input'); input.value = ${JSON.stringify(markdown + '\nold preview')}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor("!!window.__releaseMermaid", 'delayed Mermaid starts');
  const latest = markdown.replace(/\n\x60\x60\x60mermaid[\s\S]*?\x60\x60\x60\n/, '\n') + '\n最新预览内容';
  await evaluate(`(() => { const input = document.querySelector('#markdown-editor-input'); input.value = ${JSON.stringify(latest)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor("document.querySelector('#markdown-editor-preview').textContent.includes('最新预览内容')", 'newer preview wins');
  await evaluate("window.mermaid.render = window.__originalMermaid; window.__releaseMermaid(); delete window.__releaseMermaid;");
  await waitFor("!document.querySelector('#markdown-editor-preview [data-stale-render]')", 'old Mermaid cannot overwrite new preview');
  await evaluate("document.querySelector('#markdown-editor-save').click()");
  await waitFor(`document.querySelector('#markdown-editor-input').dataset.savedValue === ${JSON.stringify(latest)}`, 'save latest preview');
  const staleVersion = await evaluate("document.querySelector('#markdown-editor-input').dataset.version");
  const outside = latest + '\n另一个窗口的修改';
  await evaluate(`fetch('/api/save-post', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'update',slug:${JSON.stringify(slug)},version:${JSON.stringify(staleVersion)},markdown:${JSON.stringify(outside)}})}).then(r=>r.json())`);
  await evaluate("document.querySelector('#markdown-editor-save').click()");
  await waitFor("document.querySelector('#markdown-editor-status').textContent.includes('其他窗口修改')", 'stale editor conflict');
  assert.equal(await evaluate(`fetch(${JSON.stringify(`posts/${slug}.md`)}).then(r=>r.text())`), outside);
  await evaluate("(async () => { const input = document.querySelector('#markdown-editor-input'); const post = await fetch('/api/post?slug='+encodeURIComponent(input.dataset.slug)).then(r=>r.json()); input.value=post.markdown; input.dataset.savedValue=post.markdown; input.dataset.version=post.version; })()");
  if (process.env.BROWSER_SCREENSHOT) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.BROWSER_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  await evaluate("document.querySelector('#markdown-editor-delete').click()");
  await waitFor("!document.body.classList.contains('is-editor-mode') && location.hash === '#tab=articles'", 'delete draft');
  const remaining = await evaluate("fetch('data/posts.json').then(r=>r.json())");
  assert(!remaining.some(post => post.slug === slug), 'Deleted draft must leave archive');
  await evaluate("(() => { window.__originalFetch = window.fetch; window.fetch = (url, options) => String(url).startsWith('/api/post?slug=Hillis-Steele_scan') ? new Promise(resolve => { window.__releaseEditor = () => resolve(new Response(JSON.stringify({ok:true,markdown:'# STALE EDITOR',version:'stale'}),{headers:{'Content-Type':'application/json'}})); }) : window.__originalFetch(url, options); location.hash='#tab=editor&post=Hillis-Steele_scan'; })()");
  await waitFor("!!window.__releaseEditor", 'delayed editor load');
  await evaluate("location.hash='#tab=welcome'");
  await waitFor("!document.querySelector('#welcome-view').hidden", 'leave delayed editor');
  await evaluate("window.fetch=window.__originalFetch; window.__releaseEditor(); delete window.__releaseEditor;");
  await evaluate("new Promise(resolve=>setTimeout(resolve,30))");
  assert.equal(await evaluate("!!document.querySelector('#markdown-editor-input')"), false);
  shouldCleanDraft = false;
  }
  assert.deepEqual(exceptions, [], 'Browser runtime errors');
  assert.deepEqual(externalRequests, [], 'Page must not request external assets');
  console.log(process.argv.includes('--read-only') ? 'PASS: published static site, project content, no editor or drafts' : 'PASS: home/theme/archive/resume/project content, draft template, shared two-column rendering, cancellation, optimistic conflicts, save/delete');
} finally {
  if (shouldCleanDraft && ws?.readyState === WebSocket.OPEN && session) {
    await evaluate(`(async () => { const post = await fetch('/api/post?slug='+${JSON.stringify(slug)}).then(r=>r.json()); if(post.version) await fetch('/api/delete-post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(slug)},version:post.version})}); })()`).catch(() => {});
  }
  if (ws?.readyState === WebSocket.OPEN) {
    let timer;
    await Promise.race([
      send('Browser.close', {}, true).catch(() => {}),
      new Promise(resolve => { timer = setTimeout(resolve, 3000); })
    ]);
    clearTimeout(timer);
  }
  ws?.close();
  await new Promise(resolve => {
    if (browser.exitCode !== null || browser.signalCode !== null) { resolve(); return; }
    const timer = setTimeout(() => browser.kill(), 3000);
    browser.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
