import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPostTemplate, parseFrontmatter, createPostRecord, serializePost, setPostMetadata, splitMarkdownByMarker } from '../shared/post-model.mjs';
import { createPostService } from '../scripts/lib/post-service.mjs';
import { generateCatalog, readJson, outputs, atomicWrite, withContentLock } from '../scripts/lib/content.mjs';
import { buildSite } from '../scripts/lib/build-site.mjs';
import { checkContent } from '../scripts/lib/check-content.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-regression-'));
  const root = path.join(parent, 'repo');
  fs.mkdirSync(root);
  for (const item of ['preview-server.js', 'index.html', 'app.js', 'styles.css', 'server', 'modules', 'shared', 'scripts', 'vendor', 'data', 'posts', 'snippets']) fs.cpSync(path.join(project, item), path.join(root, item), { recursive: true });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return root;
}
const source = title => serializePost({ title, date: '2026-10-08', tags: [], tab: 'articles', draft: true }, `# ${title}\n\n正文\n`);

async function startServer(t, root, env = {}) {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['preview-server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '0.0.0.0', BLOG_EDITOR_ENABLED: 'true', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server start timed out: ${output}`)), 10000);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('Preview server running')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return { port, base: `http://127.0.0.1:${port}` };
}
function request(port, route, { method = 'GET', body, headers = {}, remote = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: encodeURI(route), method, localAddress: remote ? '127.0.0.2' : '127.0.0.1', headers: { Host: remote ? `192.0.2.10:${port}` : `127.0.0.1:${port}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => { let value; try { value = JSON.parse(text); } catch { value = text; } resolve({ status: res.statusCode, value, headers: res.headers }); });
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('shared metadata preserves draft, project tab, indentation, quotes and arrays', () => {
  for (const tab of ['articles', 'projects']) {
    const template = createPostTemplate(tab, '2026-10-08');
    const parsed = parseFrontmatter(template);
    assert.equal(parsed.metadata.tab, tab); assert.equal(parsed.metadata.draft, true);
    assert.match(parsed.body, /^# /m);
    assert.equal(parseFrontmatter(setPostMetadata(template, { draft: false })).metadata.draft, false);
  }
  const parsed = parseFrontmatter('---\r\n  title: "a \\"quote\\""\r\n  tags: ["a,b", \'c\']\r\n  draft: true\r\n  ---\r\n# title\r\n');
  assert.equal(parsed.metadata.title, 'a "quote"'); assert.deepEqual(parsed.metadata.tags, ['a,b', 'c']);
  for (const invalid of ['---\ndraft: "false"\n---\n', '---\ndraft: true\n', '---\ntab: unknown\n---\n', '---\ndraft: true\ndraft: false\n---\n', '---\ndate: 2026-02-30\n---\n']) assert.throws(() => parseFrontmatter(invalid));
  assert.deepEqual(parseFrontmatter('---\ntags: ["a,b", " spaced ", \'it\'\'s\']\n---\n').metadata.tags, ['a,b', ' spaced ', "it's"]);
  for (const invalid of ['["a",, "b"]', '["a" "b"]', '["a",]', '["a]', '[[a]]']) assert.throws(() => parseFrontmatter(`---\ntags: ${invalid}\n---\n`));
  assert.equal(createPostRecord({}, '# Heading', { slug: 'original' }).layout, 'single');
});

test('layout markers inside long or mixed fences stay literal', () => {
  const markdown = 'intro\n````md\n```\n<!-- row -->\n~~~\n````\n<!-- row -->\nleft\n<!-- column -->\nright';
  assert.equal(splitMarkdownByMarker(markdown, 'row').length, 2);
});

test('existing mixed-case and underscore identities update/delete their exact files', async t => {
  const root = fixture(t), service = createPostService(root);
  const originalNeighbor = fs.readFileSync(path.join(root, 'posts/segmented-op.md'), 'utf8');
  for (const slug of ['Hillis-Steele_scan', 'segmented_op']) {
    const original = await service.read(slug);
    const markdown = setPostMetadata(original.markdown, { title: '修改的标题', summary: '修改的摘要' });
    const saved = await service.save({ mode: 'update', slug, version: original.version, markdown });
    assert.equal(saved.slug, slug); assert.equal(fs.readFileSync(path.join(root, saved.file), 'utf8'), markdown);
    assert.equal(saved.catalog.posts.find(post => post.slug === slug).title, '修改的标题');
    if (slug === 'Hillis-Steele_scan') assert(!fs.existsSync(path.join(root, 'posts/hillis-steele-scan.md')));
    await service.delete({ slug, version: saved.version }); assert(!fs.existsSync(path.join(root, saved.file)));
  }
  assert.equal(fs.readFileSync(path.join(root, 'posts/segmented-op.md'), 'utf8'), originalNeighbor);
});

test('new template saves as a draft project and malformed publication state is rejected', async t => {
  const root = fixture(t), service = createPostService(root);
  const result = await service.save({ mode: 'create', markdown: createPostTemplate('projects', '2026-10-08') });
  const post = result.catalog.posts.find(item => item.slug === result.slug);
  assert.equal(post.tab, 'projects'); assert.equal(post.draft, true); assert.equal(post.title, '新项目');
  await assert.rejects(service.save({ mode: 'create', markdown: '# 没有发布状态' }), error => error.status === 400);
  await assert.rejects(service.save({ mode: 'create', markdown: '---\ndraft: "false"\n---\nbody' }), error => error.status === 400);
});

test('optimistic versions reject stale updates/deletes and identity changes', async t => {
  const root = fixture(t), service = createPostService(root);
  const first = await service.read('first-post');
  const saved = await service.save({ mode: 'update', slug: first.slug, version: first.version, markdown: setPostMetadata(first.markdown, { title: 'new' }) });
  await assert.rejects(service.save({ mode: 'update', slug: first.slug, version: first.version, markdown: first.markdown }), error => error.status === 409);
  await assert.rejects(service.delete({ slug: first.slug, version: first.version }), error => error.status === 409);
  await assert.rejects(service.save({ mode: 'update', slug: first.slug, markdown: first.markdown }), error => error.status === 428);
  await assert.rejects(service.save({ mode: 'update', slug: first.slug, version: saved.version, markdown: setPostMetadata(saved.markdown, { slug: 'different' }) }), error => error.status === 400);
  assert.equal((await service.read(first.slug)).markdown, saved.markdown);
});

test('parallel creates reserve unique names and return coherent catalogs', async t => {
  const root = fixture(t), service = createPostService(root);
  const saved = await Promise.all(Array.from({ length: 4 }, () => service.save({ mode: 'create', slug: 'parallel', markdown: source('parallel') })));
  assert.equal(new Set(saved.map(post => post.slug)).size, 4);
  const catalog = readJson(path.join(root, 'data/catalog.json'));
  for (const item of saved) assert(catalog.posts.some(post => post.slug === item.slug && post.version === catalog.postMetadata[item.slug].version));
});

test('generator and CLI creation share a cross-process content lock', async t => {
  const root = fixture(t);
  const run = args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, INCLUDE_DRAFTS: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = ''; child.stderr.on('data', data => { error += data; }); child.once('exit', code => code === 0 ? resolve() : reject(new Error(error))); child.on('error', reject);
  });
  await Promise.all([run(['scripts/new-post.js', '多进程测试', '--slug', 'process-test', '--draft']), run(['scripts/new-post.js', '多进程测试', '--slug', 'process-test', '--draft']), run(['scripts/generate-posts.js'])]);
  const catalog = readJson(path.join(root, 'data/catalog.json'));
  assert(catalog.posts.some(post => post.slug === 'process-test'));
  assert(catalog.posts.some(post => post.slug === 'process-test-2'));
});

test('failed commits restore Markdown and every generated file', async t => {
  const root = fixture(t);
  await generateCatalog(root, { includeDrafts: true });
  const service = createPostService(root, { beforeCommit: () => { throw new Error('injected commit failure'); } });
  const post = await service.read('first-post');
  const before = outputs.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  await assert.rejects(service.save({ mode: 'update', slug: post.slug, version: post.version, markdown: setPostMetadata(post.markdown, { title: 'failed' }) }), /injected/);
  assert.equal((await service.read(post.slug)).markdown, post.markdown);
  assert.deepEqual(outputs.map(file => fs.readFileSync(path.join(root, file), 'utf8')), before);
  await assert.rejects(service.delete({ slug: post.slug, version: post.version }), /injected/);
  assert.equal((await service.read(post.slug)).markdown, post.markdown);
});

test('failure between index exports rolls back the entire save', async t => {
  const root = fixture(t);
  await generateCatalog(root, { includeDrafts: true });
  const service = createPostService(root);
  const post = await service.read('first-post');
  const before = outputs.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  const rename = fs.renameSync;
  let injected = false;
  fs.renameSync = (from, to) => {
    if (!injected && to === path.join(root, 'data/post-metadata.json')) { injected = true; throw new Error('index write failure'); }
    return rename(from, to);
  };
  try {
    await assert.rejects(service.save({ mode: 'update', slug: post.slug, version: post.version, markdown: setPostMetadata(post.markdown, { title: 'must roll back' }) }), /index write failure/);
  } finally { fs.renameSync = rename; }
  assert(injected);
  assert.equal((await service.read(post.slug)).markdown, post.markdown);
  assert.deepEqual(outputs.map(file => fs.readFileSync(path.join(root, file), 'utf8')), before);
});

test('startup recovers interrupted transactions and preserves committed ones', async t => {
  const root = fixture(t);
  await generateCatalog(root, { includeDrafts: true });
  const relative = 'posts/first-post.md'; const file = path.join(root, relative); const original = fs.readFileSync(file);
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  atomicWrite(path.join(root, '.local/content-transaction.json'), JSON.stringify({ id: 'interrupted', originals: { [relative]: original.toString('base64') } }));
  fs.writeFileSync(file, 'incomplete');
  await withContentLock(root, () => {}); assert.equal(fs.readFileSync(file, 'utf8'), original.toString());
  const catalog = readJson(path.join(root, 'data/catalog.json')); catalog.operationId = 'committed';
  atomicWrite(path.join(root, 'data/catalog.json'), JSON.stringify(catalog));
  atomicWrite(path.join(root, '.local/content-transaction.json'), JSON.stringify({ id: 'committed', originals: { [relative]: null } }));
  await withContentLock(root, () => {}); assert(fs.existsSync(file));
});

test('frontmatter changes control the index and missing dates are stable across builds', async t => {
  const root = fixture(t), service = createPostService(root);
  const post = await service.read('first-post');
  await service.save({ mode: 'update', slug: post.slug, version: post.version, markdown: setPostMetadata(post.markdown, { title: '权威标题', tab: 'projects', tags: ['新标签'], date: '2026-10-01' }) });
  const one = await generateCatalog(root, { includeDrafts: true }); const two = await generateCatalog(root, { includeDrafts: true });
  assert.deepEqual(one, two);
  const changed = two.posts.find(item => item.slug === post.slug);
  assert.equal(changed.title, '权威标题'); assert.equal(changed.tab, 'projects'); assert.deepEqual(changed.tags, ['新标签']);
});

test('publishing copies Markdown/HTML/reference assets and excludes drafts/private files', async t => {
  const root = fixture(t), service = createPostService(root);
  fs.mkdirSync(path.join(root, 'assets/nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/nested/image.png'), 'image');
  fs.writeFileSync(path.join(root, 'assets/document.pdf'), 'pdf');
  fs.writeFileSync(path.join(root, 'assets/style.css'), 'body{background:url(nested/image.png)}');
  const markdown = serializePost({ title: '资源', date: '2026-10-08', draft: false }, '# 资源\n\n![图](../assets/nested/image.png)\n\n[附件][pdf]\n\n[pdf]: ../assets/document.pdf\n\n<img src="../assets/nested/image.png">\n<link href="../assets/style.css">\n');
  await service.save({ mode: 'create', slug: 'resources', markdown });
  const output = path.join(root, '..', 'site'); const catalog = await buildSite(root, output);
  for (const file of ['assets/nested/image.png', 'assets/document.pdf', 'assets/style.css', 'posts/projects/async_io_frame.json', 'modules/article-renderer.js', 'shared/post-model.mjs']) assert(fs.existsSync(path.join(output, file)), file);
  assert(!catalog.posts.some(post => post.draft)); assert(!fs.existsSync(path.join(output, 'posts/计算最接近的2次幂.md')));
  for (const file of ['.local', 'preview-server.js', 'server', 'scripts']) assert(!fs.existsSync(path.join(output, file)));
  assert(!Object.hasOwn(catalog.searchText, '计算最接近的2次幂'));
});

test('missing or private resources fail verification and leave no partial public site', async t => {
  const root = fixture(t), service = createPostService(root);
  await service.save({ mode: 'create', slug: 'bad-resource', markdown: serializePost({ draft: false }, '# 缺失\n![图片](../assets/missing.png)\n') });
  const output = path.join(root, '..', 'site');
  assert.throws(() => checkContent(root), /资源不存在/);
  await assert.rejects(buildSite(root, output), /资源不存在/); assert(!fs.existsSync(output));
  fs.mkdirSync(path.join(root, 'assets')); fs.symlinkSync(path.join(root, '..'), path.join(root, 'assets/escape'));
  const post = await service.read('bad-resource');
  await service.save({ mode: 'update', slug: post.slug, version: post.version, markdown: serializePost({ draft: false }, '# 越界\n![图片](../assets/escape/private.png)\n') });
  await assert.rejects(buildSite(root, output), /symlink escapes|资源不存在/);
});

test('LAN clients read drafts and create, update, format and delete without credentials', async t => {
  const root = fixture(t);
  const { port } = await startServer(t, root);
  const config = await request(port, '/api/preview-config', { remote: true });
  assert.deepEqual(config.value, { localEditor: true });
  assert.equal(config.headers['set-cookie'], undefined);
  assert.equal(fs.existsSync(path.join(root, '.local/editor-token')), false);
  const created = await request(port, '/api/save-post', { method: 'POST', remote: true, body: { mode: 'create', markdown: source('remote') } });
  assert.equal(created.status, 200);
  const catalog = await request(port, '/data/catalog.json', { remote: true });
  assert(catalog.value.posts.some(post => post.slug === created.value.slug && post.draft));
  assert.equal((await request(port, `/posts/${created.value.slug}.md`, { remote: true })).status, 200);
  assert.equal((await request(port, `/api/post?slug=${created.value.slug}`, { remote: true })).value.version, created.value.version);
  const updated = await request(port, '/api/save-post', { method: 'POST', remote: true, body: { mode: 'update', slug: created.value.slug, version: created.value.version, markdown: source('remote updated') } });
  assert.equal(updated.status, 200);
  assert.equal((await request(port, '/api/format-post', { method: 'POST', remote: true, body: { markdown: source('remote') } })).status, 200);
  assert.equal((await request(port, '/api/delete-post', { method: 'POST', remote: true, body: { slug: created.value.slug } })).status, 428);
  assert.equal((await request(port, '/api/delete-post', { method: 'POST', remote: true, body: { slug: created.value.slug, version: created.value.version } })).status, 409);
  assert.equal((await request(port, '/api/delete-post', { method: 'POST', remote: true, body: { slug: created.value.slug, version: updated.value.version } })).status, 200);
  assert.equal((await request(port, '/.local/editor-token')).status, 403);
  assert.equal((await request(port, '/scripts/new-post.js')).status, 403);
});

test('disabled editor blocks local and LAN writes and hides drafts', async t => {
  const root = fixture(t);
  const { port } = await startServer(t, root, { BLOG_EDITOR_ENABLED: 'false' });
  for (const remote of [false, true]) {
    assert.deepEqual((await request(port, '/api/preview-config', { remote })).value, { localEditor: false });
    for (const route of ['/api/save-post', '/api/delete-post', '/api/format-post']) assert.equal((await request(port, route, { method: 'POST', remote, body: { mode: 'create', markdown: source('blocked') } })).status, 403);
    assert(!(await request(port, '/data/catalog.json', { remote })).value.posts.some(post => post.draft));
    assert.equal((await request(port, '/posts/计算最接近的2次幂.md', { remote })).status, 404);
  }
});

test('credential-free editing still rejects cross-site requests and private file access', async t => {
  const root = fixture(t);
  const { port } = await startServer(t, root);
  for (const remote of [false, true]) {
    for (const headers of [{ Origin: 'https://unrelated.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      assert.equal((await request(port, '/api/save-post', { method: 'POST', remote, headers, body: { mode: 'create', markdown: source('blocked') } })).status, 403);
    }
    assert.equal((await request(port, '/.git/config', { remote })).status, 403);
    assert.equal((await request(port, '/api/editor-session', { method: 'POST', remote, body: {} })).status, 404);
  }
  assert.equal((await request(port, '/api/preview-config', { headers: { Host: 'unrelated.example' } })).status, 403);
});
