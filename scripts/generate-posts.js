const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "posts");
const outputPath = path.join(root, "data", "posts.json");

const overrides = {
  "resume-profile": {
    tab: "resume",
    title: "个人简历",
    date: "2026-03-29",
    summary: "",
    tags: []
  },
  "first-post": {
    title: "把个人博客搭成一个长期写作入口",
    date: "2026-03-28",
    summary: "从结构、样式和部署方式出发，建立一个能长期维护的静态博客。文章归档页先显示标题和预览，点进去再阅读完整内容。",
    tags: ["博客", "GitHub Pages", "Markdown"]
  },
  "writing-workflow": {
    title: "给持续写作保留一点轻量流程",
    date: "2026-03-12",
    summary: "文章越容易落地，博客越容易持续更新。流程轻一点，内容反而更稳定，也更适合放进个人文章归档。",
    tags: ["写作", "流程"]
  },
  "code-snippet-demo": {
    title: "Markdown 与代码高亮的展示示例",
    date: "2026-03-20",
    summary: "这篇文章用来验证标题、列表、引用、表格和代码块等常见内容的展示效果，也适合演示分享型文章的归档样式。",
    tags: ["Markdown", "代码", "示例"]
  },
  "Hillis-Steele_scan": {
    title: "Hillis-Steele scan",
    date: "2026-06-12",
    summary: "用区间不变量理解 Hillis-Steele scan 中 offset 按 1、2、4、8 翻倍时，为什么每个 scratch 元素仍然能得到正确处理。",
    tags: ["CUDA", "并行算法", "Scan"]
  },
  "layout_features_demo": {
    title: "博客文章效果与语法演示",
    date: "2026-06-14",
    summary: "集中展示两列对照布局、代码块折叠、行内高亮、术语提示和表格等文章写法。",
    tags: ["Markdown", "语法", "示例"],
    layout: "two-column"
  },
  "why_tree_reduction_and_scan_work": {
    title: "为什么 reduce 和 scan 能刚好处理数组",
    date: "2026-06-12",
    summary: "从结合律、区间合并和循环不变量出发，解释 tree reduction 与 parallel scan 为什么能改变计算顺序但保持结果正确。",
    tags: ["并行算法", "Reduction", "Scan"]
  },
  "project-blueprint": {
    tab: "projects",
    title: "个人项目页应该像一个实时项目档案",
    date: "2026-03-24",
    summary: "项目不仅展示结果，也展示阶段、状态和下一步。归档页先看简介，点开后再看完整项目笔记，更符合 dashboard 的浏览节奏。",
    tags: ["项目", "Dashboard", "设计"]
  },
  "parallel_primitives": {
    title: "cuda常用parallel primitives操作",
    date: "2026-06-14",
    summary: "整理 CUDA 中常见的 parallel primitives：reduce、scan、stencil、gather、scatter、sort、map、partition、compact 等操作。",
    tags: ["CUDA", "并行算法"]
  },
  "segmented_op": {
    title: "segmented operation",
    date: "2026-06-14",
    summary: "用 inclusive segmented scan 的 CUDA 示例理解 head flag 如何传播，以及为什么每个线程能在不跨段的情况下累计前缀和。",
    tags: ["CUDA", "并行算法", "Scan"]
  }
};

function stripMarkdown(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(markdown, slug) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1];
  return stripMarkdown(heading) || slug.replaceAll("_", " ");
}

function getSummary(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "\n");
  const lines = withoutCode
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const summary = stripMarkdown(lines.slice(0, 3).join(" "));
  return summary.length > 100 ? `${summary.slice(0, 100)}...` : summary;
}

const posts = fs.readdirSync(postsDir)
  .filter((fileName) => fileName.endsWith(".md"))
  .sort()
  .map((fileName) => {
    const slug = path.basename(fileName, ".md");
    const file = path.posix.join("posts", fileName);
    const markdown = fs.readFileSync(path.join(postsDir, fileName), "utf8");
    const override = overrides[slug] || {};

    return {
      slug,
      tab: override.tab || "articles",
      title: override.title || getTitle(markdown, slug),
      date: override.date || new Date().toISOString().slice(0, 10),
      summary: override.summary ?? getSummary(markdown),
      tags: override.tags || [],
      layout: override.layout || "single",
      file,
      ...(override.draft ? { draft: true } : {}),
      ...(override.hidden ? { hidden: true } : {}),
      ...(override.visible === false ? { visible: false } : {})
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(posts, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outputPath)} with ${posts.length} posts`);
