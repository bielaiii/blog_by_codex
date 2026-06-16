const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "posts");
const postsDataPath = path.join(root, "data", "posts.json");
const errors = [];
const warnings = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`无法读取 JSON: ${path.relative(root, filePath)} (${error.message})`);
    return null;
  }
}

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function splitMarkdownByMarker(markdown, marker) {
  const lines = String(markdown || "").split(/\r?\n/);
  const chunks = [];
  let current = [];
  let inFence = false;
  const markerPattern = new RegExp(`^\\s*<!--\\s*${marker}\\s*-->\\s*$`, "i");

  lines.forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    }

    if (!inFence && markerPattern.test(line)) {
      chunks.push(current.join("\n"));
      current = [];
      return;
    }

    current.push(line);
  });

  chunks.push(current.join("\n"));
  return chunks;
}

const posts = readJson(postsDataPath) || [];
const slugs = new Set();
const files = new Set();

posts.forEach((post) => {
  if (!post.slug) {
    addError("存在缺少 slug 的文章配置");
  }
  if (slugs.has(post.slug)) {
    addError(`重复 slug: ${post.slug}`);
  }
  slugs.add(post.slug);

  if (!post.file) {
    addError(`${post.slug} 缺少 file 字段`);
    return;
  }

  const filePath = path.join(root, post.file);
  files.add(path.normalize(post.file));
  if (!fs.existsSync(filePath)) {
    addError(`${post.slug} 指向不存在的文件: ${post.file}`);
    return;
  }

  const markdown = fs.readFileSync(filePath, "utf8");
  if (post.layout === "two-column") {
    const rows = splitMarkdownByMarker(markdown, "row").slice(1);
    if (!rows.length) {
      addError(`${post.slug} 是 two-column，但没有 <!-- row -->`);
    }
    rows.forEach((row, index) => {
      if (splitMarkdownByMarker(row, "column").length < 2) {
        addError(`${post.slug} 的第 ${index + 1} 个 row 缺少 <!-- column -->`);
      }
    });
  }

  const imageMatches = markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g);
  for (const match of imageMatches) {
    const imagePath = match[1];
    if (/^(https?:)?\/\//.test(imagePath) || imagePath.startsWith("#")) {
      continue;
    }
    const resolved = path.resolve(path.dirname(filePath), imagePath);
    if (!fs.existsSync(resolved)) {
      addWarning(`${post.slug} 引用的图片不存在: ${imagePath}`);
    }
  }

  const mermaidBlocks = [...markdown.matchAll(/```mermaid[\s\S]*?```/g)];
  mermaidBlocks.forEach((block, index) => {
    const body = block[0].replace(/^```mermaid\s*/, "").replace(/```$/, "").trim();
    if (!body) {
      addError(`${post.slug} 的第 ${index + 1} 个 mermaid 代码块为空`);
    }
  });
});

fs.readdirSync(postsDir)
  .filter((fileName) => fileName.endsWith(".md"))
  .forEach((fileName) => {
    const relativePath = path.normalize(path.posix.join("posts", fileName));
    if (!files.has(relativePath)) {
      addWarning(`Markdown 文件未出现在 data/posts.json: ${relativePath}`);
    }
  });

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

if (errors.length) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

console.log(`Checked ${posts.length} posts`);
