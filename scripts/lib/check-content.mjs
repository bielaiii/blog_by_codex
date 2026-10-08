import fs from "node:fs";
import path from "node:path";
import { buildCatalog, readJson, versionOf } from "./content.mjs";
import { collectAssets } from "./assets.mjs";
import { parseFrontmatter, splitMarkdownByMarker } from "../../shared/post-model.mjs";

export function checkContent(root) {
  const catalog = buildCatalog(root, { includeDrafts: true });
  const generated = readJson(path.join(root, "data/catalog.json"));
  for (const post of generated.posts) {
    const source = fs.readFileSync(path.join(root, post.file), "utf8");
    if (post.version !== versionOf(source)) throw new Error(`${post.file}: 索引已过期，请重新生成`);
    if (generated.postMetadata[post.slug]?.version !== post.version) throw new Error(`${post.slug}: 日期索引版本不一致`);
  }
  for (const post of catalog.posts) {
    const { body } = parseFrontmatter(fs.readFileSync(path.join(root, post.file), "utf8"));
    if (post.layout === "two-column") {
      const rows = splitMarkdownByMarker(body, "row").slice(1);
      if (!rows.length) throw new Error(`${post.slug}: two-column 缺少 <!-- row -->`);
      rows.forEach((row, index) => {
        const columns = splitMarkdownByMarker(row, "column");
        if (columns.length < 2 || !columns[0].trim() || !columns.slice(1).join("").trim()) throw new Error(`${post.slug}: 第 ${index + 1} 行缺少左右列内容`);
      });
    }
    for (const block of body.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) if (!block[1].trim()) throw new Error(`${post.slug}: Mermaid 块为空`);
  }
  collectAssets(root, catalog.posts);
  return catalog;
}
