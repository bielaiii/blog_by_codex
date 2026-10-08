import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { safeFile } from "./content.mjs";
import { parseFrontmatter } from "../../shared/post-model.mjs";
const require = createRequire(import.meta.url);
const marked = require("../../vendor/marked/marked.min.js");

export function resolveAsset(root, referringFile, href) {
  const value = String(href || "").trim().replaceAll("&amp;", "&");
  if (!value || value.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  let decoded;
  try { decoded = decodeURIComponent(value.split(/[?#]/)[0]); }
  catch { throw new Error(`${referringFile}: 无效资源路径 ${value}`); }
  const relative = path.posix.normalize(decoded.startsWith("/") ? decoded.slice(1) : path.posix.join(path.posix.dirname(referringFile), decoded));
  if (!/^(assets|posts)\//.test(relative)) throw new Error(`${referringFile}: 本地资源必须位于 assets/ 或 posts/，收到 ${value}`);
  const full = safeFile(root, relative);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error(`${referringFile}: 本地资源不存在 ${value}`);
  return relative;
}

function htmlReferences(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  const references = [];
  for (const match of source.matchAll(/\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) references.push(match[1] ?? match[2] ?? match[3]);
  for (const match of source.matchAll(/\bsrcset\s*=\s*["']([^"']*)["']/gi)) {
    for (const entry of match[1].split(",")) references.push(entry.trim().split(/\s+/)[0]);
  }
  return references;
}

export function collectAssets(root, posts) {
  const files = new Set();
  const publicMarkdown = new Set(posts.map(post => post.file));
  function add(from, href) {
    const relative = resolveAsset(root, from, href);
    if (!relative || files.has(relative)) return;
    if (relative.endsWith(".md") && !publicMarkdown.has(relative)) throw new Error(`${from}: 引用了未发布的文章 ${relative}`);
    files.add(relative);
    const extension = path.extname(relative).toLowerCase();
    if ([".css", ".svg", ".html"].includes(extension)) {
      const source = fs.readFileSync(safeFile(root, relative), "utf8");
      for (const reference of htmlReferences(source)) add(relative, reference);
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g)) add(relative, match[1] || match[2]);
    }
  }
  for (const post of posts) {
    const { body } = parseFrontmatter(fs.readFileSync(safeFile(root, post.file), "utf8"));
    marked.walkTokens(marked.lexer(body), token => {
      if (token.type === "image" || token.type === "link") add(post.file, token.href);
      if (token.type === "html") for (const reference of htmlReferences(token.text)) add(post.file, reference);
    });
    if (post.visual) add("index.html", post.visual);
  }
  return files;
}
