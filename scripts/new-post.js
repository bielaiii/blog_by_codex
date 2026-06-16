const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "posts");

function toSlug(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "new-post";
}

function parseArgs(argv) {
  const args = { title: "", tab: "articles", tags: [], layout: "single", draft: false };
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--draft") {
      args.draft = true;
    } else if (arg === "--tab") {
      args.tab = argv[++index] || args.tab;
    } else if (arg === "--tags") {
      args.tags = (argv[++index] || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    } else if (arg === "--layout") {
      args.layout = argv[++index] || args.layout;
    } else if (arg === "--slug") {
      args.slug = argv[++index] || "";
    } else {
      rest.push(arg);
    }
  }

  args.title = rest.join(" ").trim();
  return args;
}

function uniquePath(slug) {
  let candidate = slug;
  let index = 2;
  while (fs.existsSync(path.join(postsDir, `${candidate}.md`))) {
    candidate = `${slug}-${index}`;
    index += 1;
  }
  return {
    slug: candidate,
    filePath: path.join(postsDir, `${candidate}.md`)
  };
}

const args = parseArgs(process.argv.slice(2));
if (!args.title) {
  console.error('Usage: node scripts/new-post.js "文章标题" [--draft] [--tags CUDA,Scan] [--layout single|two-column] [--tab articles|projects]');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const { slug, filePath } = uniquePath(args.slug || toSlug(args.title));
const tags = `[${args.tags.map((tag) => `"${tag.replaceAll('"', '\\"')}"`).join(", ")}]`;
const content = `---
title: "${args.title.replaceAll('"', '\\"')}"
date: ${date}
summary: ""
tags: ${tags}
tab: ${args.tab}
layout: ${args.layout}
draft: ${args.draft}
---

# ${args.title}

`;

fs.mkdirSync(postsDir, { recursive: true });
fs.writeFileSync(filePath, content);
execFileSync("node", ["scripts/generate-posts.js"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    ...(args.draft ? { INCLUDE_DRAFTS: "true" } : {})
  }
});
execFileSync("node", ["scripts/generate-post-metadata.js"], { cwd: root, stdio: "inherit" });
console.log(`Created posts/${slug}.md`);
