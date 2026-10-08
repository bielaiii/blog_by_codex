export const tabs = { resume: "个人简历", articles: "分享文章", projects: "项目" };

function scalar(source) {
  const value = source.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch { throw new Error(`无效的引号字符串: ${value}`); }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) throw new Error("字符串引号未闭合");
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) throw new Error("数组未闭合");
    const source = value.slice(1, -1);
    if (!source.trim()) return [];
    const entries = [];
    let part = "", quote = "", escaped = false;
    for (let index = 0; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        part += character;
        if (quote === '"' && character === "\\" && !escaped) { escaped = true; continue; }
        if (character === quote && !escaped) {
          if (quote === "'" && source[index + 1] === "'") { part += source[++index]; continue; }
          quote = "";
        }
        escaped = false;
      } else if (character === '"' || character === "'") {
        if (part.trim()) throw new Error("数组字符串格式错误");
        quote = character; part += character;
      } else if (character === ",") {
        if (!part.trim()) throw new Error("数组包含空条目");
        entries.push(scalar(part)); part = "";
      } else {
        if (/[\[\]{}]/.test(character)) throw new Error("不支持嵌套数组或对象");
        part += character;
      }
    }
    if (quote || !part.trim()) throw new Error("数组格式错误");
    entries.push(scalar(part));
    return entries;
  }
  if (/^[\[\]{}]|["']$/.test(value)) throw new Error(`不支持的元数据值: ${value}`);
  return value;
}

// A deliberately small frontmatter format: scalar fields and inline arrays.
// Invalid metadata is an error; it must never silently change publication state.
export function parseFrontmatter(markdown) {
  const source = String(markdown || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!/^---[ \t]*\n/.test(source)) return { metadata: {}, body: source };
  const match = source.match(/^---[ \t]*\n([\s\S]*?)\n[ \t]*---[ \t]*(?:\n|$)/);
  if (!match) throw new Error("Frontmatter 缺少结束分隔符 ---");
  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const pair = line.match(/^[ \t]*([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (!pair) throw new Error(`不支持的 frontmatter 行: ${line}`);
    if (Object.hasOwn(metadata, pair[1])) throw new Error(`重复元数据字段: ${pair[1]}`);
    metadata[pair[1]] = scalar(pair[2]);
  }
  validateMetadata(metadata);
  return { metadata, body: source.slice(match[0].length) };
}

export function validateMetadata(metadata) {
  for (const key of ["draft", "hidden", "visible"]) {
    if (key in metadata && typeof metadata[key] !== "boolean") throw new Error(`${key} 必须是 true 或 false`);
  }
  for (const key of ["title", "summary", "tab", "layout", "slug", "date", "visual", "status", "stage", "repo", "demo"]) {
    if (key in metadata && typeof metadata[key] !== "string") throw new Error(`${key} 必须是字符串`);
  }
  if (metadata.tab && !Object.hasOwn(tabs, metadata.tab)) throw new Error(`未知栏目: ${metadata.tab}`);
  if (metadata.layout && !["single", "two-column"].includes(metadata.layout)) throw new Error(`未知布局: ${metadata.layout}`);
  if (metadata.date) {
    const date = new Date(`${metadata.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== metadata.date) throw new Error("date 必须是有效的 YYYY-MM-DD 日期");
  }
  for (const key of ["tags", "stack", "metrics"]) {
    if (key in metadata && (!Array.isArray(metadata[key]) || metadata[key].some(item => typeof item !== "string"))) throw new Error(`${key} 必须是字符串数组`);
  }
}

export function serializePost(metadata, body) {
  validateMetadata(metadata);
  return `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n${String(body).replace(/^\n+/, "")}`;
}

export function setPostMetadata(markdown, changes) {
  const { metadata, body } = parseFrontmatter(markdown);
  return serializePost({ ...metadata, ...changes }, body);
}

export function createPostTemplate(tab = "articles", date = new Date().toISOString().slice(0, 10)) {
  const title = tab === "projects" ? "新项目" : "新文章";
  return serializePost({ title, date, summary: "", tags: [], tab, layout: "single", draft: true }, `# ${title}\n\n`);
}

export function toSlug(title) {
  return String(title || "").trim().toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "new-post";
}

export function isPostVisible(post, { includeDrafts = false, publishDrafts = false } = {}) {
  return !post.hidden && post.visible !== false && (!post.draft || includeDrafts || publishDrafts);
}

export function stripMarkdown(markdown) {
  return String(markdown).replace(/==(?:[\w-]+:)?([\s\S]*?)==/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/[`*_~>#|]/g, " ").replace(/\s+/g, " ").trim();
}

export function createPostRecord(metadata, body, { slug = "new-post", file = "posts/new-post.md", date = "" } = {}) {
  const title = metadata.title || stripMarkdown(body.match(/^#\s+(.+)$/m)?.[1] || slug.replaceAll("_", " "));
  const summary = stripMarkdown(body.replace(/```[\s\S]*?```/g, "").split("\n").filter(line => line.trim() && !line.startsWith("#")).slice(0, 3).join(" ")).slice(0, 100);
  return { ...metadata, slug, file, title, date: metadata.date || date, summary: metadata.summary ?? summary, tags: metadata.tags || [], tab: metadata.tab || "articles", layout: metadata.layout || "single" };
}

export function splitMarkdownByMarker(markdown, marker) {
  const chunks = [];
  let current = [], fence = null;
  const pattern = new RegExp(`^\\s*<!--\\s*${marker}\\s*-->\\s*$`, "i");
  for (const line of String(markdown).split(/\r?\n/)) {
    const opening = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (opening) {
      if (!fence) fence = { marker: opening[1][0], length: opening[1].length };
      else if (opening[1][0] === fence.marker && opening[1].length >= fence.length && !opening[2].trim()) fence = null;
      current.push(line);
    } else if (!fence && pattern.test(line)) {
      chunks.push(current.join("\n")); current = [];
    } else current.push(line);
  }
  chunks.push(current.join("\n"));
  return chunks;
}

export function validateProjectVisual(visual) {
  for (const [key, fields] of Object.entries({ architecture: ["title", "nodes"], capabilities: ["title", "items"], flow: ["title", "detail"], boundaries: ["title", "detail"] })) {
    if (!Array.isArray(visual[key])) throw new Error(`项目展示缺少 ${key} 数组`);
    for (const item of visual[key]) {
      for (const field of fields) {
        if (["nodes", "items"].includes(field) ? !Array.isArray(item[field]) : typeof item[field] !== "string") throw new Error(`无效的项目展示字段 ${key}.${field}`);
      }
      if (key === "architecture" && item.nodes.some(node => typeof node.title !== "string" || typeof node.detail !== "string")) throw new Error("无效的项目节点");
      if (key === "capabilities" && item.items.some(value => typeof value !== "string")) throw new Error("无效的项目能力");
    }
  }
  return visual;
}
