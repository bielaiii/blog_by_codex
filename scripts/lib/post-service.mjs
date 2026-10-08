import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseFrontmatter, toSlug, setPostMetadata } from "../../shared/post-model.mjs";
import { withContentLock, safeFile, atomicWrite, buildCatalog, writeCatalog, outputs, versionOf } from "./content.mjs";

export class PostError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createPostService(root, { includeDrafts = true, beforeCommit } = {}) {
  function findPost(slug) {
    // Match the exact identity, including old uppercase and underscore filenames.
    if (typeof slug !== "string" || !fs.readdirSync(path.join(root, "posts")).includes(`${slug}.md`)) throw new PostError(404, "Post not found");
    const file = `posts/${slug}.md`;
    const markdown = fs.readFileSync(safeFile(root, file), "utf8");
    return { slug, file, markdown, version: versionOf(markdown) };
  }

  function checkVersion(post, version) {
    if (!version) throw new PostError(428, "缺少文章版本，请重新打开编辑器");
    if (version !== post.version) throw new PostError(409, "文章已被其他窗口修改，请重新打开后合并改动");
  }

  async function commit(slug, markdown) {
    const name = `${slug}.md`;
    const relative = `posts/${name}`;
    const id = crypto.randomUUID();
    // Validate the entire next catalog before changing anything on disk.
    const catalog = buildCatalog(root, { includeDrafts, sources: new Map([[name, markdown]]), operationId: id });
    const originals = Object.fromEntries([relative, ...outputs].map(file => {
      const full = safeFile(root, file);
      return [file, fs.existsSync(full) ? fs.readFileSync(full).toString("base64") : null];
    }));
    const journal = path.join(root, ".local/content-transaction.json");
    atomicWrite(journal, JSON.stringify({ id, originals }));
    try {
      if (markdown === null) fs.unlinkSync(safeFile(root, relative));
      else atomicWrite(safeFile(root, relative), markdown);
      await beforeCommit?.();
      writeCatalog(root, catalog);
    } catch (error) {
      for (const [file, content] of Object.entries(originals)) {
        if (content === null) fs.rmSync(safeFile(root, file), { force: true });
        else atomicWrite(safeFile(root, file), Buffer.from(content, "base64"));
      }
      fs.rmSync(journal, { force: true });
      throw error;
    }
    // The catalog operation id makes recovery safe if cleanup is interrupted.
    fs.rmSync(journal, { force: true });
    return { ok: true, slug, file: relative, version: markdown === null ? undefined : versionOf(markdown), markdown: markdown ?? undefined, catalog };
  }

  return {
    read: slug => withContentLock(root, () => findPost(slug)),
    save: payload => withContentLock(root, async () => {
      if (!payload || !["create", "update"].includes(payload.mode)) throw new PostError(400, "mode 必须是 create 或 update");
      if (typeof payload.markdown !== "string" || !payload.markdown.trim()) throw new PostError(400, "Markdown is empty");
      let metadata;
      try { ({ metadata } = parseFrontmatter(payload.markdown)); } catch (error) { throw new PostError(400, error.message); }
      let slug, markdown = payload.markdown;
      if (payload.mode === "update") {
        const post = findPost(payload.slug);
        checkVersion(post, payload.version);
        slug = post.slug;
        if (metadata.slug && metadata.slug !== slug) throw new PostError(400, "不能通过编辑 slug 改变文章身份");
      } else {
        if (typeof metadata.draft !== "boolean") throw new PostError(400, "新文章必须显式设置 draft: true 或 false");
        const requested = toSlug(payload.slug || metadata.slug || metadata.title || payload.title);
        slug = requested;
        let index = 2;
        while (fs.existsSync(path.join(root, "posts", `${slug}.md`))) slug = `${requested}-${index++}`;
        if (metadata.slug && metadata.slug !== slug) markdown = setPostMetadata(markdown, { slug });
      }
      return commit(slug, markdown);
    }),
    delete: payload => withContentLock(root, () => {
      const post = findPost(payload?.slug);
      checkVersion(post, payload.version);
      return commit(post.slug, null);
    })
  };
}
