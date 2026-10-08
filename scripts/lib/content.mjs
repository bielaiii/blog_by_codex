import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parseFrontmatter, stripMarkdown, createPostRecord, isPostVisible, validateProjectVisual } from "../../shared/post-model.mjs";

export const outputs = ["data/posts.json", "data/post-metadata.json", "data/catalog.json"];
export const versionOf = source => crypto.createHash("sha256").update(source).digest("hex");
export const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));

export function safeFile(root, relative) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.split("/").some(part => part.startsWith("."))) throw new Error(`Invalid content path: ${relative}`);
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Invalid content path: ${relative}`);
  let ancestor = resolved;
  while (!fs.existsSync(ancestor) && ancestor !== path.resolve(root)) {
    // A dangling symlink is still a filesystem entry and must not be followed.
    try { if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error(`Content symlink escapes project: ${relative}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    ancestor = path.dirname(ancestor);
  }
  const realRoot = fs.realpathSync(root);
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== realRoot && !realAncestor.startsWith(`${realRoot}${path.sep}`)) throw new Error(`Content symlink escapes project: ${relative}`);
  return resolved;
}

export function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { flag: "wx" });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}

export async function withContentLock(root, action) {
  const lock = path.join(root, ".local/content.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const deadline = Date.now() + 15000;
  while (true) {
    try { fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }), { flag: "wx" }); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const { pid } = readJson(lock);
        try { process.kill(pid, 0); } catch (ownerError) { if (ownerError.code === "ESRCH") { fs.rmSync(lock, { force: true }); continue; } }
      } catch (readError) { if (readError.code === "ENOENT") continue; }
      if (Date.now() >= deadline) throw new Error("Content is busy; retry later");
      await delay(30);
    }
  }
  try { recoverTransaction(root); return await action(); }
  finally { fs.rmSync(lock, { force: true }); }
}

export function recoverTransaction(root) {
  const journalPath = path.join(root, ".local/content-transaction.json");
  if (!fs.existsSync(journalPath)) return;
  const journal = readJson(journalPath);
  let committed = false;
  try { committed = readJson(path.join(root, "data/catalog.json")).operationId === journal.id; } catch { /* Incomplete commit. */ }
  if (!committed) {
    for (const [relative, content] of Object.entries(journal.originals)) {
      const file = safeFile(root, relative);
      if (content === null) fs.rmSync(file, { force: true });
      else atomicWrite(file, Buffer.from(content, "base64"));
    }
  }
  fs.rmSync(journalPath);
}

function gitDates(root, file) {
  try {
    const dates = execFileSync("git", ["log", "--follow", "--format=%aI", "--", file], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/).filter(Boolean);
    return { createdAt: dates.at(-1), updatedAt: dates[0] };
  } catch { return {}; }
}

export function buildCatalog(root, { includeDrafts = false, sources = new Map(), operationId = "" } = {}) {
  const config = readJson(path.join(root, "data/site-config.json"));
  let previous = { postMetadata: {} };
  try { previous = readJson(path.join(root, "data/catalog.json")); } catch { /* First build. */ }
  const names = new Set(fs.readdirSync(path.join(root, "posts")).filter(name => name.endsWith(".md")));
  for (const [name, value] of sources) { if (value === null) names.delete(name); else names.add(name); }
  const posts = [], postMetadata = {}, searchText = {};
  for (const name of [...names].sort()) {
    const slug = path.basename(name, ".md");
    const file = `posts/${name}`;
    const fullPath = safeFile(root, file);
    const source = sources.has(name) ? sources.get(name) : fs.readFileSync(fullPath, "utf8");
    let metadata, body;
    try { ({ metadata, body } = parseFrontmatter(source)); }
    catch (error) { throw new Error(`${file}: ${error.message}`); }
    if (metadata.slug && metadata.slug !== slug) throw new Error(`${file}: slug 必须与文件名一致，文章身份不能通过编辑修改`);
    const stat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
    const history = gitDates(root, file);
    const old = previous.postMetadata?.[slug];
    const version = versionOf(source);
    const createdAt = old?.createdAt || history.createdAt || stat?.birthtime.toISOString() || new Date().toISOString();
    const updatedAt = old?.version === version ? old.updatedAt : sources.has(name) ? new Date().toISOString() : history.updatedAt || stat?.mtime.toISOString() || createdAt;
    const post = { ...createPostRecord(metadata, body, { slug, file, date: createdAt.slice(0, 10) }), version };
    if (!isPostVisible(post, { includeDrafts, publishDrafts: config.publishDrafts === true })) continue;
    if (metadata.visual) {
      if (!/^posts\/projects\/[^/]+\.json$/.test(metadata.visual)) throw new Error(`${file}: visual 必须位于 posts/projects/*.json`);
      post.visualData = validateProjectVisual(readJson(safeFile(root, metadata.visual)));
    }
    posts.push(post);
    postMetadata[slug] = { file, createdAt, updatedAt, version };
    searchText[slug] = stripMarkdown([post.title, post.summary, ...post.tags, body].join(" "));
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const catalog = { posts, postMetadata, searchText };
  catalog.revision = versionOf(JSON.stringify(catalog));
  if (operationId) catalog.operationId = operationId;
  return catalog;
}

export function writeCatalog(root, catalog) {
  // Readers use the single catalog. Commit it last so two indexes cannot be mixed.
  atomicWrite(path.join(root, outputs[0]), `${JSON.stringify(catalog.posts, null, 2)}\n`);
  atomicWrite(path.join(root, outputs[1]), `${JSON.stringify(catalog.postMetadata, null, 2)}\n`);
  atomicWrite(path.join(root, outputs[2]), `${JSON.stringify(catalog, null, 2)}\n`);
}

export async function generateCatalog(root, options = {}) {
  return withContentLock(root, () => { const catalog = buildCatalog(root, options); writeCatalog(root, catalog); return catalog; });
}
