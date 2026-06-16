const tabs = {
  resume: "个人简历",
  articles: "分享文章",
  projects: "项目"
};

const tabDescriptions = {
  resume: "",
  articles: "更偏向分享型内容，可以是教程、摘录、整理和技术文章。",
  projects: "适合持续更新中的项目记录、状态变化和阶段性总结。"
};

const tooltipGlossaryPath = "posts/tooltips.json";
const skillsPath = "data/skills.json";
const siteConfigPath = "data/site-config.json";
const postsPath = "data/posts.json";
const postMetadataPath = "data/post-metadata.json";
const tagStylesPath = "data/tag-styles.json";
const highlightStylesPath = "data/highlight-styles.json";
const archivePostsPerPage = 10;
const archiveSiblingPageCount = 2;
const isLocalPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const projectVisuals = {
  async_io_frame: {
    eyebrow: "C++ coroutine async I/O runtime",
    repoLabel: "GitHub",
    sections: {
      architecture: "Coroutine、operation 与内核事件的分层",
      capabilities: "框架当前承接的异步能力",
      flow: "一次 async operation 的生命周期",
      boundaries: "运行时设计边界"
    },
    architecture: [
      {
        title: "Coroutine API",
        nodes: [
          { title: "User Coroutine", detail: "以 co_await 组织异步读写流程" },
          { title: "async_* Awaiter", detail: "connect / accept / read / write / timer" }
        ]
      },
      {
        title: "Runtime Core",
        nodes: [
          { title: "Operation State", detail: "仲裁 ready、timeout、cancel 的完成权" },
          { title: "Scheduler", detail: "维护 fd 到 pending operation 的映射" },
          { title: "Buffer View", detail: "管理读写偏移和剩余容量" }
        ]
      },
      {
        title: "Kernel Events",
        nodes: [
          { title: "epoll", detail: "分发 socket readiness" },
          { title: "timerfd", detail: "驱动 wait_for 和 timeout" },
          { title: "eventfd", detail: "主动唤醒取消路径" }
        ]
      }
    ],
    capabilities: [
      { title: "Socket I/O", items: ["async_connect", "async_accept", "async_read", "async_write", "async_read_some"] },
      { title: "Timer", items: ["wait_for", "read timeout", "write timeout", "timer queue"] },
      { title: "Cancellation", items: ["cancel_token", "eventfd wakeup", "operation_state arbitration"] },
      { title: "Scheduling", items: ["fd readiness", "read slot", "write slot", "epoll dispatch"] },
      { title: "Buffer", items: ["StaticBuffer", "DynamicBuffer", "Buffer_View", "offset tracking"] }
    ],
    flow: [
      { title: "Await", detail: "coroutine 提交 async operation" },
      { title: "Register", detail: "Scheduler 注册 fd / timer / cancel interest" },
      { title: "Suspend", detail: "operation 挂起 coroutine" },
      { title: "Wake", detail: "epoll_wait 返回 socket、timer 或 cancel 事件" },
      { title: "Arbitrate", detail: "operation_state 决定完成结果" },
      { title: "Resume", detail: "coroutine 恢复并清理注册项" }
    ],
    boundaries: [
      { title: "Thin Runtime", detail: "只包装 readiness，不隐藏底层事件模型" },
      { title: "Single Waiter", detail: "同一 socket fd 保持单读槽、单写槽" },
      { title: "Active Cancel", detail: "取消会唤醒 epoll，而不是等待下一次 socket ready" },
      { title: "Timer Dispatch", detail: "timerfd 当前按调度器事件推进，不是批量 dispatcher 模型" }
    ]
  },
  gdb_cli_tools: {
    eyebrow: "Vibe-coded GDB/MI evidence runtime",
    repoLabel: "GitHub",
    sections: {
      architecture: "vibe-coding loop、session、action 与 evidence 的分层",
      capabilities: "调试会话暴露给 Agent 的操作面",
      flow: "一次调试动作的执行链路",
      boundaries: "GDB 执行层与 Agent 推理层的职责边界"
    },
    architecture: [
      {
        title: "Agent Layer",
        nodes: [
          { title: "Vibe Coding Loop", detail: "用 Agent 快速提出假设、补动作、看证据" },
          { title: "Hypothesis", detail: "把直觉式探索沉淀成可追踪的问题链" }
        ]
      },
      {
        title: "Runtime Layer",
        nodes: [
          { title: "Task File", detail: "描述 target、参数、工作目录、core" },
          { title: "Session", detail: "维护 live debugging 上下文" },
          { title: "Action Dispatcher", detail: "执行高层调试动作" }
        ]
      },
      {
        title: "Execution Layer",
        nodes: [
          { title: "GDB/MI", detail: "稳定执行 debugger 指令" },
          { title: "Evidence Store", detail: "保存 raw、summary、index、hash" },
          { title: "Report Assets", detail: "输出可审计报告素材" }
        ]
      }
    ],
    capabilities: [
      { title: "Session runtime", items: ["daemon", "create", "action", "status", "finish", "close"] },
      { title: "Debug actions", items: ["backtrace", "locals", "registers", "threads", "evaluate", "frame_select"] },
      { title: "Probe control", items: ["breakpoint", "watchpoint", "catchpoint", "probe enable", "probe delete"] },
      { title: "Evidence flow", items: ["raw MI", "summary", "index", "raw hash", "snapshot"] },
      { title: "Agent workflow", items: ["hypothesis", "replay", "report", "raw_mi escape hatch"] }
    ],
    flow: [
      { title: "Describe", detail: "Task file 定义被调试目标" },
      { title: "Create", detail: "建立 live session" },
      { title: "Act", detail: "Agent 选择高层 action" },
      { title: "Observe", detail: "GDB/MI 返回 raw evidence" },
      { title: "Record", detail: "写入 evidence store" },
      { title: "Report", detail: "引用证据生成报告" }
    ],
    boundaries: [
      { title: "No PTY", detail: "通过 GDB/MI 执行，不提供交互式终端会话" },
      { title: "No interactive stdin", detail: "inferior stdin 默认不是交互入口" },
      { title: "Replay scope", detail: "重放高层 action，不恢复旧 GDB 进程" },
      { title: "Raw MI", detail: "作为显式 escape hatch，而不是默认入口" }
    ]
  }
};

let posts = [
  {
    slug: "resume-profile",
    tab: "resume",
    title: "个人简历",
    date: "2026-03-29",
    summary: "",
    tags: [],
    file: "posts/resume-profile.md"
  },
  {
    slug: "first-post",
    tab: "articles",
    title: "把个人博客搭成一个长期写作入口",
    date: "2026-03-28",
    summary: "从结构、样式和部署方式出发，建立一个能长期维护的静态博客。文章归档页先显示标题和预览，点进去再阅读完整内容。",
    tags: ["博客", "GitHub Pages", "Markdown"],
    file: "posts/first-post.md"
  },
  {
    slug: "writing-workflow",
    tab: "articles",
    title: "给持续写作保留一点轻量流程",
    date: "2026-03-12",
    summary: "文章越容易落地，博客越容易持续更新。流程轻一点，内容反而更稳定，也更适合放进个人文章归档。",
    tags: ["写作", "流程"],
    file: "posts/writing-workflow.md"
  },
  {
    slug: "code-snippet-demo",
    tab: "articles",
    title: "Markdown 与代码高亮的展示示例",
    date: "2026-03-20",
    summary: "这篇文章用来验证标题、列表、引用、表格和代码块等常见内容的展示效果，也适合演示分享型文章的归档样式。",
    tags: ["Markdown", "代码", "示例"],
    file: "posts/code-snippet-demo.md"
  },
  {
    slug: "Hillis-Steele_scan",
    tab: "articles",
    title: "Hillis-Steele scan",
    date: "2026-06-12",
    summary: "用区间不变量理解 Hillis-Steele scan 中 offset 按 1、2、4、8 翻倍时，为什么每个 scratch 元素仍然能得到正确处理。",
    tags: ["CUDA", "并行算法", "Scan"],
    file: "posts/Hillis-Steele_scan.md"
  },
  {
    slug: "why_tree_reduction_and_scan_work",
    tab: "articles",
    title: "为什么 reduce 和 scan 能刚好处理数组",
    date: "2026-06-12",
    summary: "从结合律、区间合并和循环不变量出发，解释 tree reduction 与 parallel scan 为什么能改变计算顺序但保持结果正确。",
    tags: ["并行算法", "Reduction", "Scan"],
    file: "posts/why_tree_reduction_and_scan_work.md"
  },
  {
    slug: "project-blueprint",
    tab: "projects",
    title: "个人项目页应该像一个实时项目档案",
    date: "2026-03-24",
    summary: "项目不仅展示结果，也展示阶段、状态和下一步。归档页先看简介，点开后再看完整项目笔记，更符合 dashboard 的浏览节奏。",
    tags: ["项目", "Dashboard", "设计"],
    file: "posts/project-blueprint.md"
  }
].sort((a, b) => b.date.localeCompare(a.date));

const listScrollPositions = Object.fromEntries(Object.keys(tabs).map((tab) => [tab, 0]));
let lastState = { tab: "resume", slug: "" };
let pendingRestoreTab = "";
let tooltipGlossaryPromise;
let skillsPromise;
let siteConfigPromise;
let postsPromise;
let postMetadataPromise;
let tagStylesPromise;
let highlightStylesPromise;
let postMetadata = {};
let tagStyles = {};
let highlightStyles = {};
let siteConfig = {
  showArticleDates: false,
  showTimelineDates: true,
  dateSource: "generated",
  generatedDateField: "createdAt"
};
let tagFilterTouched = false;
let activeArticleTags = new Set();
let articleSearchQuery = "";
let syncViewRun = 0;
let timelineScrollFrame = 0;
const postSearchTextCache = new Map();
const archivePageByTab = Object.fromEntries(Object.keys(tabs).map((tab) => [tab, 1]));

const tabsEls = [...document.querySelectorAll(".tab")];
const welcomeViewEl = document.querySelector("#welcome-view");
const skillDiamondEl = document.querySelector("#skill-diamond");
const activityGridEl = document.querySelector("#activity-grid");
const activitySummaryEl = document.querySelector("#activity-summary");
const workspaceEl = document.querySelector(".workspace");
const timelinePanelEl = document.querySelector(".timeline-panel");
const tagFilterPanelEl = document.querySelector("#tag-filter-panel");
const tagFilterListEl = document.querySelector("#tag-filter-list");
const articleSearchEl = document.querySelector("#article-search");
const timelineEl = document.querySelector("#timeline");
const timelineHeadingEl = document.querySelector("#timeline-heading");
const listTitleEl = document.querySelector("#list-title");
const listDescriptionEl = document.querySelector("#list-description");
const articleListEl = document.querySelector("#article-list");
const archivePaginationEl = document.querySelector("#archive-pagination");
const articleEmptyEl = document.querySelector("#article-empty");
const articleListViewEl = document.querySelector("#article-list-view");
const articleDetailViewEl = document.querySelector("#article-detail-view");
const articleLoadingEl = document.querySelector("#article-loading");
const articleCategoryEl = document.querySelector("#article-category");
const articleDateEl = document.querySelector("#article-date");
const articleTitleEl = document.querySelector("#article-title");
const articleSummaryEl = document.querySelector("#article-summary");
const articleTagsEl = document.querySelector("#article-tags");
const articleContentEl = document.querySelector("#article-content");
const articleTocEl = document.querySelector("#article-toc");
const articleTocListEl = document.querySelector("#article-toc-list");
const backButtonEl = document.querySelector("#back-button");
const edgeBackButtonEl = document.querySelector("#edge-back-button");
const contentMetaEl = document.querySelector(".content-meta");
const themeToggleEl = document.querySelector("#theme-toggle");
const colorSchemeQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function getStoredTheme() {
  try {
    return localStorage.getItem("preferred-theme");
  } catch (error) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem("preferred-theme", theme);
  } catch (error) {
    // Ignore storage failures so theme switching still works in restricted browsers.
  }
}

function getSystemTheme() {
  return colorSchemeQuery?.matches ? "dark" : "light";
}

function updateThemeToggle(theme) {
  if (!themeToggleEl) {
    return;
  }

  const isDark = theme === "dark";
  themeToggleEl.setAttribute("aria-pressed", String(isDark));
  themeToggleEl.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
}

function applyTheme(theme, shouldStore = false) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  updateThemeToggle(theme);

  if (shouldStore) {
    setStoredTheme(theme);
  }
}

function initializeTheme() {
  applyTheme(getStoredTheme() || getSystemTheme());

  if (themeToggleEl) {
    themeToggleEl.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme || "light";
      applyTheme(currentTheme === "dark" ? "light" : "dark", true);
      refreshThemeBoundStyles();
    });
  }

  colorSchemeQuery?.addEventListener("change", (event) => {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? "dark" : "light");
      refreshThemeBoundStyles();
    }
  });
}

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

function formatDate(dateString) {
  const [year, month, day] = String(dateString || "").slice(0, 10).split("-");
  return `${year}-${month}-${day}`;
}

async function getTooltipGlossary() {
  if (!tooltipGlossaryPromise) {
    tooltipGlossaryPromise = (async () => {
      try {
        const response = await fetch(tooltipGlossaryPath);
        return response.ok ? await response.json() : {};
      } catch (error) {
        return {};
      }
    })();
  }

  return tooltipGlossaryPromise;
}

async function getSkillsConfig() {
  if (!skillsPromise) {
    skillsPromise = (async () => {
      try {
        const response = await fetch(skillsPath);
        return response.ok ? await response.json() : { weightRange: { min: 1, max: 10 }, skills: [] };
      } catch (error) {
        return { weightRange: { min: 1, max: 10 }, skills: [] };
      }
    })();
  }

  return skillsPromise;
}

async function getSiteConfig() {
  if (!siteConfigPromise) {
    siteConfigPromise = (async () => {
      try {
        const response = await fetch(siteConfigPath);
        return response.ok ? await response.json() : siteConfig;
      } catch (error) {
        return siteConfig;
      }
    })();
  }

  return siteConfigPromise;
}

async function getPostsConfig() {
  if (!postsPromise) {
    postsPromise = (async () => {
      try {
        const response = await fetch(postsPath);
        return response.ok ? await response.json() : posts;
      } catch (error) {
        return posts;
      }
    })();
  }

  return postsPromise;
}

async function getPostMetadata() {
  if (!postMetadataPromise) {
    postMetadataPromise = (async () => {
      try {
        const response = await fetch(postMetadataPath);
        return response.ok ? await response.json() : {};
      } catch (error) {
        return {};
      }
    })();
  }

  return postMetadataPromise;
}

async function getTagStyles() {
  if (!tagStylesPromise) {
    tagStylesPromise = (async () => {
      try {
        const response = await fetch(tagStylesPath);
        return response.ok ? await response.json() : {};
      } catch (error) {
        return {};
      }
    })();
  }

  return tagStylesPromise;
}

async function getHighlightStyles() {
  if (!highlightStylesPromise) {
    highlightStylesPromise = (async () => {
      try {
        const response = await fetch(highlightStylesPath);
        return response.ok ? await response.json() : {};
      } catch (error) {
        return {};
      }
    })();
  }

  return highlightStylesPromise;
}

async function initializeSiteConfig() {
  siteConfig = {
    ...siteConfig,
    ...(await getSiteConfig())
  };
  posts = await getPostsConfig();

  if (siteConfig.dateSource === "generated") {
    postMetadata = await getPostMetadata();
  }

  tagStyles = await getTagStyles();
  highlightStyles = await getHighlightStyles();
}

function shouldShowArticleDates() {
  return Boolean(siteConfig.showArticleDates);
}

function shouldShowTimelineDates() {
  return siteConfig.showTimelineDates !== false;
}

function getPostDate(post) {
  if (siteConfig.dateSource === "generated") {
    const field = siteConfig.generatedDateField || "createdAt";
    return postMetadata[post.slug]?.[field] || post.date;
  }

  return post.date;
}

function isPostVisible(post) {
  return (!post.draft || isLocalPreview) && !post.hidden && post.visible !== false;
}

function getPostUpdatedDate(post) {
  return postMetadata[post.slug]?.updatedAt || post.date;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateValue) {
  const [year, month, day] = String(dateValue || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }

  return toDateKey(new Date(year, month - 1, day));
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function getActivityClass(entry) {
  if (!entry.total) {
    return "is-empty";
  }

  const level = Math.min(4, entry.total);
  if (entry.articles && entry.projects) {
    return `activity-level-${level} is-mixed`;
  }

  return `activity-level-${level} ${entry.articles ? "is-article" : "is-project"}`;
}

function getActivityLabel(dateKey, entry) {
  if (!entry.total) {
    return `${dateKey} 没有更新`;
  }

  const pieces = [];
  if (entry.articles) {
    pieces.push(`${entry.articles} 篇文章`);
  }
  if (entry.projects) {
    pieces.push(`${entry.projects} 个项目`);
  }

  return `${dateKey} 更新 ${pieces.join("，")}`;
}

function renderActivityGrid() {
  if (!activityGridEl || !activitySummaryEl) {
    return;
  }

  const trackedPosts = posts.filter((post) => isPostVisible(post) && (post.tab === "articles" || post.tab === "projects"));
  const updatesByDate = new Map();

  trackedPosts.forEach((post) => {
    const dateKey = parseDateKey(getPostUpdatedDate(post));
    if (!dateKey) {
      return;
    }

    const entry = updatesByDate.get(dateKey) || { articles: 0, projects: 0, total: 0 };
    if (post.tab === "articles") {
      entry.articles += 1;
    } else {
      entry.projects += 1;
    }
    entry.total += 1;
    updatesByDate.set(dateKey, entry);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sixMonthsAgo = addMonths(today, -6);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const startDate = addDays(sixMonthsAgo, -sixMonthsAgo.getDay());
  const endDate = addDays(today, 6 - today.getDay());
  const totalDays = Math.round((endDate - startDate) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const cells = [];
  const monthLabels = [];
  let lastMonth = "";

  for (let dayIndex = 0; dayIndex < weeks * 7; dayIndex += 1) {
    const date = addDays(startDate, dayIndex);
    const dateKey = toDateKey(date);
    const entry = updatesByDate.get(dateKey) || { articles: 0, projects: 0, total: 0 };
    const week = Math.floor(dayIndex / 7) + 1;
    const day = date.getDay() + 1;
    const isOutsideRange = date < sixMonthsAgo || date > today;

    if (day === 1 && date >= startDate && date <= today) {
      const month = `${date.getMonth() + 1}月`;
      if (month !== lastMonth) {
        monthLabels.push(`<span class="activity-month" style="--week: ${week};">${month}</span>`);
        lastMonth = month;
      }
    }

    cells.push(`
      <span
        class="activity-cell ${getActivityClass(entry)} ${isOutsideRange ? "is-outside-range" : ""}"
        style="--week: ${week}; --day: ${day};"
        title="${escapeHtml(getActivityLabel(dateKey, entry))}"
        aria-label="${escapeHtml(getActivityLabel(dateKey, entry))}"
      ></span>
    `);
  }

  const articleUpdates = [...updatesByDate.values()].reduce((total, entry) => total + entry.articles, 0);
  const projectUpdates = [...updatesByDate.values()].reduce((total, entry) => total + entry.projects, 0);
  activitySummaryEl.innerHTML = `
    <span>文章 ${articleUpdates} 次更新</span>
    <span>项目 ${projectUpdates} 次更新</span>
  `;
  activityGridEl.style.setProperty("--weeks", weeks);
  activityGridEl.innerHTML = `
    <div class="activity-months" aria-hidden="true">${monthLabels.join("")}</div>
    <div class="activity-weekdays" aria-hidden="true">
      <span style="--day: 2;">周一</span>
      <span style="--day: 4;">周三</span>
      <span style="--day: 6;">周五</span>
    </div>
    <div class="activity-cells">${cells.join("")}</div>
  `;
}

function mapSkillSize(weight, minWeight, maxWeight) {
  const normalized = maxWeight === minWeight ? 0.5 : (weight - minWeight) / (maxWeight - minWeight);
  return 0.76 + Math.max(0, Math.min(1, normalized)) * 1.22;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripFrontmatter(markdown) {
  return String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function stripMarkdownForSearch(markdown) {
  return stripFrontmatter(markdown)
    .replace(/==(?:(default|[a-zA-Z0-9_-]+):)?([^=\n][\s\S]*?[^=\n])==/g, "$2")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z0-9_-]*|```/g, " "))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s-]*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFallbackSearchText(post) {
  return [
    post.title,
    post.summary,
    ...(post.tags || [])
  ]
    .filter(Boolean)
    .join(" ");
}

async function getPostSearchText(post) {
  if (postSearchTextCache.has(post.slug)) {
    return postSearchTextCache.get(post.slug);
  }

  const fallbackText = getFallbackSearchText(post);

  try {
    const response = await fetch(post.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${post.file}`);
    }

    const markdown = stripFrontmatter(await response.text());
    const searchText = `${fallbackText} ${stripMarkdownForSearch(markdown)}`.replace(/\s+/g, " ").trim();
    postSearchTextCache.set(post.slug, searchText);
    return searchText;
  } catch (error) {
    postSearchTextCache.set(post.slug, fallbackText);
    return fallbackText;
  }
}

function highlightSearchText(text, query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return escapeHtml(text);
  }

  const pattern = new RegExp(escapeRegExp(trimmedQuery), "gi");
  let cursor = 0;
  let highlighted = "";
  let match;

  while ((match = pattern.exec(text)) !== null) {
    highlighted += escapeHtml(text.slice(cursor, match.index));
    highlighted += `<mark class="search-highlight">${escapeHtml(match[0])}</mark>`;
    cursor = match.index + match[0].length;
  }

  return highlighted + escapeHtml(text.slice(cursor));
}

function buildSearchSnippet(post) {
  const query = articleSearchQuery.trim();
  if (!query) {
    return "";
  }

  const source = postSearchTextCache.get(post.slug) || getFallbackSearchText(post);
  const matchIndex = source.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex < 0) {
    return "";
  }

  const contextLength = 46;
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(source.length, matchIndex + query.length + contextLength);
  const snippet = `${start > 0 ? "..." : ""}${source.slice(start, end).trim()}${end < source.length ? "..." : ""}`;

  return highlightSearchText(snippet, query);
}

function getTagStyleAttribute(tag) {
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const style = tagStyles[tag]?.[theme] || tagStyles[tag]?.light;

  if (!style) {
    return "";
  }

  const declarations = [
    ["--tag-text", style.text],
    ["--tag-bg", style.background],
    ["--tag-border", style.border],
    ["--tag-glow", style.glow],
    ["--tag-active-text", style.activeText],
    ["--tag-active-bg", style.activeBackground],
    ["--tag-active-border", style.activeBorder],
    ["--tag-active-glow", style.activeGlow]
  ]
    .filter(([, value]) => value)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

  return declarations ? ` style="${escapeHtml(declarations)}"` : "";
}

function applyHighlightStyle(node, key) {
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const style = highlightStyles[key]?.[theme] || highlightStyles.default?.[theme] || highlightStyles.default?.light;

  if (!style) {
    return;
  }

  if (style.text) {
    node.style.setProperty("--highlight-text", style.text);
  }
  if (style.background) {
    node.style.setProperty("--highlight-bg", style.background);
  }
  if (style.border) {
    node.style.setProperty("--highlight-border", style.border);
  }
}

function refreshThemeBoundStyles() {
  document.querySelectorAll(".inline-highlight").forEach((node) => {
    applyHighlightStyle(node, node.dataset.highlight || "default");
  });

  document.querySelectorAll(".tag-filter").forEach((button) => {
    button.setAttribute("style", getTagStyleAttribute(button.dataset.tag || ""));
  });
}

function getDiamondPosition(index, total) {
  if (index === 0) {
    return { x: 50, y: 50 };
  }

  const ringIndex = index - 1;
  const ring = Math.floor((Math.sqrt(ringIndex + 1) - 1) / 2) + 1;
  const ringStart = (2 * ring - 1) ** 2 - 1;
  const ringSlots = Math.max(4, ring * 8);
  const slot = (ringIndex - ringStart + ringSlots) % ringSlots;
  const angle = -Math.PI / 2 + (slot / ringSlots) * Math.PI * 2;
  const maxRing = Math.max(1, Math.ceil((Math.sqrt(Math.max(total - 1, 1)) - 1) / 2) + 1);
  const radius = 8 + (ring / maxRing) * 34;
  const diamondScale = 1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));

  return {
    x: 50 + Math.cos(angle) * radius * diamondScale,
    y: 50 + Math.sin(angle) * radius * diamondScale
  };
}

async function renderSkillDiamond(expectedRunId = syncViewRun) {
  if (!skillDiamondEl) {
    return;
  }

  const config = await getSkillsConfig();
  if (expectedRunId !== syncViewRun) {
    return;
  }

  const skills = [...(config.skills || [])].sort((a, b) => (b.weight || 1) - (a.weight || 1));
  const minWeight = config.weightRange?.min ?? Math.min(...skills.map((skill) => skill.weight || 1), 1);
  const maxWeight = config.weightRange?.max ?? Math.max(...skills.map((skill) => skill.weight || 1), 10);

  skillDiamondEl.innerHTML = skills.map((skill, index) => {
    const position = getDiamondPosition(index, skills.length);
    const size = mapSkillSize(skill.weight || minWeight, minWeight, maxWeight);
    return `
      <span class="skill-token" style="--x: ${position.x}%; --y: ${position.y}%; --skill-size: ${size}rem;">
        ${escapeHtml(skill.label)}
      </span>
    `;
  }).join("");
}

function getStateFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) {
    return {
      tab: "welcome",
      slug: ""
    };
  }

  const params = new URLSearchParams(hash);
  const tab = params.get("tab") || "welcome";
  const slug = params.get("post") || "";
  if (tab === "editor" && isLocalPreview) {
    return {
      tab,
      slug
    };
  }

  return {
    tab: tabs[tab] ? tab : "welcome",
    slug
  };
}

function setHash(tab, slug = "") {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (slug) {
    params.set("post", slug);
  }
  const nextHash = params.toString();
  if (window.location.hash.replace(/^#/, "") !== nextHash) {
    window.location.hash = nextHash;
  }
}

function getPostsByTab(tab) {
  return posts.filter((post) => post.tab === tab && isPostVisible(post));
}

function getArticleTags() {
  return [...new Set(getPostsByTab("articles").flatMap((post) => post.tags || []))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function syncDefaultArticleTags(tags) {
  if (!tagFilterTouched) {
    activeArticleTags = new Set(tags);
  }
}

async function postMatchesSearch(post) {
  const query = articleSearchQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const searchText = await getPostSearchText(post);
  return searchText.toLowerCase().includes(query);
}

async function getFilteredPostsByTab(tab) {
  const tabPosts = getPostsByTab(tab);
  if (tab !== "articles") {
    return tabPosts;
  }

  const tags = getArticleTags();
  syncDefaultArticleTags(tags);

  const tagFilteredPosts = (!tagFilterTouched || activeArticleTags.size === tags.length)
    ? tabPosts
    : tabPosts.filter((post) => (post.tags || []).some((tag) => activeArticleTags.has(tag)));

  const matchedPosts = await Promise.all(
    tagFilteredPosts.map(async (post) => ((await postMatchesSearch(post)) ? post : null))
  );

  return matchedPosts.filter(Boolean);
}

function rememberListScroll(tab) {
  listScrollPositions[tab] = window.scrollY;
}

function restoreListScroll(tab) {
  const top = listScrollPositions[tab] || 0;
  requestAnimationFrame(() => {
    window.scrollTo({ top, behavior: "auto" });
  });
}

function renderTabs(currentTab) {
  tabsEls.forEach((tabEl) => {
    tabEl.classList.toggle("is-active", tabEl.dataset.tab === currentTab);
  });
}

function collapseTopbar() {
  document.body.classList.add("is-topbar-collapsed");
}

function expandTopbar() {
  document.body.classList.remove("is-topbar-collapsed");
}

function handleTopEdgeScroll(event) {
  const isScrollingUp = event.deltaY < 0;
  const isScrollingDown = event.deltaY > 0;
  const isAtPageTop = window.scrollY <= 0;
  const isTopbarCollapsed = document.body.classList.contains("is-topbar-collapsed");

  if (isScrollingDown && !isTopbarCollapsed) {
    collapseTopbar();
    return;
  }

  if (isScrollingUp && isAtPageTop && isTopbarCollapsed) {
    expandTopbar();
  }
}

function updateReadingLayout(tab, slug) {
  if (tab === "welcome" || tab === "editor") {
    document.body.classList.remove("is-reading-mode");
    workspaceEl.classList.add("is-single-column");
    workspaceEl.classList.remove("is-reading-detail");
    workspaceEl.classList.toggle("is-editor-workspace", tab === "editor");
    timelinePanelEl.hidden = true;
    if (tagFilterPanelEl) { tagFilterPanelEl.hidden = true; }

    if (edgeBackButtonEl) {
      edgeBackButtonEl.hidden = true;
    }
    return;
  }

  workspaceEl.classList.remove("is-editor-workspace");
  const isReadingDetail = Boolean(slug) && tab !== "resume";
  const showTimeline = tab === "articles" && !isReadingDetail;
  const isSingleColumn = tab !== "articles";

  document.body.classList.toggle("is-reading-mode", isReadingDetail);
  workspaceEl.classList.toggle("is-reading-detail", isReadingDetail);
  workspaceEl.classList.toggle("is-single-column", isSingleColumn);
  workspaceEl.classList.toggle("is-article-list", showTimeline);
  timelinePanelEl.hidden = !showTimeline;
  if (tagFilterPanelEl) {
    tagFilterPanelEl.hidden = !showTimeline;
  }

  if (edgeBackButtonEl) {
    edgeBackButtonEl.hidden = !isReadingDetail;
  }
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(Number(page) || 1, 1), Math.max(totalPages, 1));
}

function getPageForPost(postsToPage, slug) {
  const index = postsToPage.findIndex((post) => post.slug === slug);
  if (index < 0) {
    return 1;
  }

  return Math.floor(index / archivePostsPerPage) + 1;
}

function getArchivePageItems(currentPage, totalPages) {
  const visiblePages = new Set([1, totalPages]);
  const startPage = Math.max(1, currentPage - archiveSiblingPageCount);
  const endPage = Math.min(totalPages, currentPage + archiveSiblingPageCount);

  for (let page = startPage; page <= endPage; page += 1) {
    visiblePages.add(page);
  }

  const pages = [...visiblePages].sort((a, b) => a - b);
  return pages.flatMap((page, index) => {
    const previousPage = pages[index - 1];
    if (index > 0 && page - previousPage > 1) {
      return ["ellipsis", page];
    }
    return [page];
  });
}

function renderArchivePagination(currentTab, currentPage, totalPages) {
  if (!archivePaginationEl) {
    return;
  }

  if (totalPages <= 1) {
    archivePaginationEl.hidden = true;
    archivePaginationEl.innerHTML = "";
    return;
  }

  const pageButtons = getArchivePageItems(currentPage, totalPages)
    .map((item) => {
      if (item === "ellipsis") {
        return '<span class="archive-page-ellipsis" aria-hidden="true">...</span>';
      }

      const page = item;
      return `
      <button
        class="archive-page-button ${page === currentPage ? "is-active" : ""}"
        type="button"
        data-page="${page}"
        aria-label="第 ${page} 页"
        aria-current="${page === currentPage ? "page" : "false"}"
      >${page}</button>
    `;
    })
    .join("");

  archivePaginationEl.hidden = false;
  archivePaginationEl.innerHTML = `
    <button class="archive-page-button archive-page-direction" type="button" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>上一页</button>
    <div class="archive-page-numbers">${pageButtons}</div>
    <button class="archive-page-button archive-page-direction" type="button" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>下一页</button>
  `;

  archivePaginationEl.querySelectorAll(".archive-page-button[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = clampPage(button.dataset.page, totalPages);
      if (nextPage === archivePageByTab[currentTab]) {
        return;
      }

      archivePageByTab[currentTab] = nextPage;
      const { tab } = getStateFromHash();
      setHash(tab);
      syncView();
      articleListViewEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function attachLocalEditorButtons() {
  if (!isLocalPreview) {
    return;
  }

  document.querySelectorAll("[data-edit-slug]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setHash("editor", button.dataset.editSlug || "");
    }, { once: true });
  });

  document.querySelectorAll("[data-editor-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.setItem("editorDefaultTab", button.dataset.editorTab || "articles");
      setHash("editor");
    }, { once: true });
  });
}

function renderProjectCard(post, currentTab, currentSlug) {
  const stack = Array.isArray(post.stack) && post.stack.length ? post.stack : post.tags;
  const metrics = Array.isArray(post.metrics) ? post.metrics : [];
  const links = [
    post.demo ? { label: "Demo", href: post.demo } : null,
    post.repo ? { label: "Code", href: post.repo } : null
  ].filter(Boolean);

  return `
    <a class="archive-card project-card ${post.slug === currentSlug ? "is-active" : ""}" href="#tab=${currentTab}&post=${post.slug}">
      <span class="archive-anchor" data-slug="${escapeHtml(post.slug)}"></span>
      <h3 class="archive-title project-card-title">${escapeHtml(post.title)}</h3>
      <p class="archive-preview project-card-summary">${escapeHtml(post.summary)}</p>
      ${post.stage ? `<p class="project-card-stage">${escapeHtml(post.stage)}</p>` : ""}
      ${stack.length
        ? `<div class="project-card-stack">${stack.slice(0, 5).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : ""}
      ${metrics.length
        ? `<div class="project-card-metrics">${metrics.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : ""}
      ${links.length
        ? `<div class="project-card-links">${links.map((link) => `<span>${escapeHtml(link.label)}</span>`).join("")}</div>`
        : ""}
    </a>
  `;
}

function renderList(currentTab, filteredPosts, currentSlug) {
  listTitleEl.textContent = `${tabs[currentTab]}归档`;
  listDescriptionEl.textContent = tabDescriptions[currentTab];
  articleListEl.classList.toggle("is-project-grid", currentTab === "projects");
  const localCreateButton = isLocalPreview && (currentTab === "articles" || currentTab === "projects")
    ? `
      <button
        class="local-editor-button local-editor-create"
        type="button"
        data-editor-tab="${escapeHtml(currentTab)}"
        aria-label="新建${currentTab === "projects" ? "项目" : "文章"}"
        title="新建${currentTab === "projects" ? "项目" : "文章"}"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
      </button>
    `
    : "";

  if (!filteredPosts.length) {
    articleListEl.innerHTML = `${localCreateButton}<p class="archive-empty-state">${articleSearchQuery.trim() ? "没有匹配当前搜索和标签的文章。" : "没有匹配当前标签的文章。"}</p>`;
    attachLocalEditorButtons();
    renderArchivePagination(currentTab, 1, 1);
    if (articleEmptyEl) { articleEmptyEl.hidden = false; }
    articleListViewEl.hidden = false;
    articleDetailViewEl.hidden = true;
    return;
  }

  if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  articleListViewEl.hidden = false;

  const totalPages = Math.ceil(filteredPosts.length / archivePostsPerPage);
  const currentPage = clampPage(archivePageByTab[currentTab], totalPages);
  archivePageByTab[currentTab] = currentPage;
  const pageStart = (currentPage - 1) * archivePostsPerPage;
  const pagePosts = filteredPosts.slice(pageStart, pageStart + archivePostsPerPage);

  const cardsHtml = pagePosts
    .map((post) => {
      if (currentTab === "projects") {
        return renderProjectCard(post, currentTab, currentSlug);
      }

      const searchSnippet = currentTab === "articles" ? buildSearchSnippet(post) : "";
      return `
        <a class="archive-card ${post.slug === currentSlug ? "is-active" : ""}" href="#tab=${currentTab}&post=${post.slug}">
          <span class="archive-anchor" data-slug="${escapeHtml(post.slug)}"></span>
          ${shouldShowArticleDates() ? `<p class="archive-date">${formatDate(getPostDate(post))}</p>` : ""}
          <h3 class="archive-title">${escapeHtml(post.title)}</h3>
          ${searchSnippet
            ? `<p class="archive-snippet">${searchSnippet}</p>`
            : `<p class="archive-preview">${escapeHtml(post.summary)}</p>`}
        </a>
      `;
    })
    .join("");
  articleListEl.innerHTML = currentTab === "projects"
    ? `${localCreateButton}${cardsHtml}`
    : `${localCreateButton}${cardsHtml}`;
  attachLocalEditorButtons();
  renderArchivePagination(currentTab, currentPage, totalPages);
}

function playArchiveReturnAnimation() {
  articleListViewEl.classList.remove("is-returning");
  workspaceEl.classList.remove("is-archive-returning");
  void articleListViewEl.offsetWidth;
  articleListViewEl.classList.add("is-returning");
  workspaceEl.classList.add("is-archive-returning");

  window.setTimeout(() => {
    articleListViewEl.classList.remove("is-returning");
    workspaceEl.classList.remove("is-archive-returning");
  }, 1800);
}

function renderTimeline(currentTab, currentSlug, visiblePosts = getPostsByTab(currentTab)) {
  const filteredPosts = visiblePosts;
  const showTimelineTitles = currentTab !== "articles";
  timelinePanelEl.classList.toggle("is-article-timeline", currentTab === "articles");
  timelineHeadingEl.textContent = tabs[currentTab];
  timelineHeadingEl.hidden = !showTimelineTitles;

  if (!filteredPosts.length) {
    timelineEl.innerHTML = '<p class="timeline-empty">这里还没有条目。</p>';
    return;
  }

  const activeIndex = Math.max(filteredPosts.findIndex((post) => post.slug === currentSlug), 0);

  timelineEl.innerHTML = filteredPosts
    .map((post, index) => {
      const content = `
        ${shouldShowTimelineDates() ? `<span class="timeline-entry-date">${formatDate(currentTab === "articles" ? post.date : getPostDate(post))}</span>` : ""}
        ${showTimelineTitles ? `<span class="timeline-entry-title">${escapeHtml(post.title)}</span>` : ""}
      `;

      if (currentTab === "articles") {
        return `
          <button class="timeline-entry" type="button" data-slug="${escapeHtml(post.slug)}">
            ${content}
          </button>
        `;
      }

      return `
        <a class="timeline-entry" href="#tab=${currentTab}&post=${post.slug}">
          ${content}
        </a>
      `;
    })
    .join("");

  if (currentTab === "articles") {
    initializeScrollableTimeline(activeIndex);
  } else {
    updateTimelineEmphasis(activeIndex);
  }
}

function updateTimelineEmphasis(activeIndex = 0) {
  [...timelineEl.querySelectorAll(".timeline-entry")].forEach((entry, index) => {
    const distance = Math.abs(index - activeIndex);
    entry.classList.toggle("is-current", distance === 0);
    entry.classList.toggle("is-near", distance === 1);
    entry.classList.toggle("is-far", distance === 2);
    entry.classList.toggle("is-faded", distance > 2);
  });
}

function updateScrollableTimelineEmphasis() {
  const entries = [...timelineEl.querySelectorAll(".timeline-entry")];
  if (!entries.length) {
    return;
  }

  const timelineRect = timelineEl.getBoundingClientRect();
  if (timelineEl.scrollTop <= 1) {
    updateTimelineEmphasis(0);
    return;
  }

  const centerY = timelineRect.top + timelineRect.height / 2;
  let activeIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  entries.forEach((entry, index) => {
    const rect = entry.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - centerY);
    if (distance < closestDistance) {
      activeIndex = index;
      closestDistance = distance;
    }
  });

  updateTimelineEmphasis(activeIndex);
}

function initializeScrollableTimeline(activeIndex = 0) {
  const entries = [...timelineEl.querySelectorAll(".timeline-entry")];
  if (!entries.length) {
    return;
  }

  updateTimelineEmphasis(0);
  requestAnimationFrame(() => {
    timelineEl.scrollTop = 0;
    updateScrollableTimelineEmphasis();
  });
}

function scrollArchiveToPost(slug) {
  if (!slug) {
    return;
  }

  const target = articleListEl.querySelector(`.archive-anchor[data-slug="${CSS.escape(slug)}"]`)?.closest(".archive-card");
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  articleListEl.querySelectorAll(".archive-card.is-timeline-target").forEach((card) => {
    card.classList.remove("is-timeline-target");
  });
  target.classList.add("is-timeline-target");
  window.setTimeout(() => target.classList.remove("is-timeline-target"), 1200);
}

function renderTagFilters() {
  if (!tagFilterListEl) {
    return;
  }

  if (articleSearchEl && articleSearchEl.value !== articleSearchQuery) {
    articleSearchEl.value = articleSearchQuery;
  }

  const tags = getArticleTags();
  syncDefaultArticleTags(tags);

  if (!tags.length) {
    tagFilterListEl.innerHTML = '<p class="tag-filter-empty">还没有标签。</p>';
    return;
  }

  tagFilterListEl.innerHTML = tags
    .map((tag) => `
      <button class="tag-filter ${activeArticleTags.has(tag) ? "is-active" : ""}" type="button" data-tag="${escapeHtml(tag)}"${getTagStyleAttribute(tag)}>
        ${escapeHtml(tag)}
      </button>
    `)
    .join("");

  tagFilterListEl.querySelectorAll(".tag-filter").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.tag;

      if (!tagFilterTouched) {
        activeArticleTags = new Set([tag]);
        tagFilterTouched = true;
      } else if (activeArticleTags.has(tag)) {
        activeArticleTags.delete(tag);
      } else {
        activeArticleTags.add(tag);
      }

      if (!activeArticleTags.size) {
        tagFilterTouched = false;
      }

      archivePageByTab.articles = 1;
      const { tab } = getStateFromHash();
      setHash(tab);
      syncView();
    });
  });
}

function renderArticleMeta(post) {
  articleCategoryEl.textContent = tabs[post.tab];
  articleDateEl.textContent = formatDate(getPostDate(post));
  articleDateEl.hidden = !shouldShowArticleDates();
  articleTitleEl.textContent = post.title;
  articleSummaryEl.textContent = post.summary;
  articleTagsEl.innerHTML = post.tags.map((tag) => `<span class="tag"${getTagStyleAttribute(tag)}>${escapeHtml(tag)}</span>`).join("");
  articleDateEl.parentElement?.querySelector(".article-edit-action")?.remove();
  if (isLocalPreview && post.tab !== "resume") {
    articleDateEl.parentElement?.insertAdjacentHTML("beforeend", `
      <button class="local-editor-icon-button article-edit-action" type="button" data-edit-slug="${escapeHtml(post.slug)}" aria-label="编辑 Markdown" title="编辑 Markdown">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
        </svg>
      </button>
    `);
  }
  attachLocalEditorButtons();
}

function getHeadingId(text, usedIds) {
  const base = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  let index = 2;

  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  usedIds.add(id);
  return id;
}

function scrollToArticleHeading(headingId) {
  const heading = document.getElementById(headingId);
  if (!heading) {
    return;
  }

  const topbarOffset = document.body.classList.contains("is-topbar-collapsed") ? 82 : 150;
  const top = heading.getBoundingClientRect().top + window.scrollY - topbarOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function getTocLabel(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const maxLength = 24;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function renderArticleToc(post) {
  if (!articleTocEl || !articleTocListEl) {
    return;
  }

  if (post.tab === "resume" || post.layout === "two-column") {
    articleDetailViewEl.classList.remove("has-toc");
    articleTocEl.hidden = true;
    articleTocListEl.innerHTML = "";
    return;
  }

  const usedIds = new Set();
  const headings = [...articleContentEl.querySelectorAll("h2, h3")];
  const tocItems = headings.map((heading) => {
    if (!heading.id) {
      heading.id = getHeadingId(heading.textContent, usedIds);
    } else {
      usedIds.add(heading.id);
    }

    return {
      id: heading.id,
      text: getTocLabel(heading.textContent),
      level: heading.tagName === "H3" ? 3 : 2
    };
  }).filter((item) => item.text);

  const hasToc = tocItems.length >= 2;
  articleDetailViewEl.classList.toggle("has-toc", hasToc);
  articleTocEl.hidden = !hasToc;
  articleTocListEl.innerHTML = tocItems
    .map((item) => `
      <button class="article-toc-link ${item.level === 3 ? "is-sub" : ""}" type="button" data-heading-id="${escapeHtml(item.id)}">
        ${escapeHtml(item.text)}
      </button>
    `)
    .join("");

  articleTocListEl.querySelectorAll(".article-toc-link").forEach((button) => {
    button.addEventListener("click", () => {
      scrollToArticleHeading(button.dataset.headingId);
    });
  });
}

function createTooltipNode(label, tooltip) {
  const node = document.createElement("span");
  node.className = "inline-tooltip";
  node.tabIndex = 0;
  node.textContent = label;
  node.dataset.tooltip = tooltip;
  node.setAttribute("aria-label", `${label}：${tooltip}`);
  return node;
}

function createHighlightNode(label, styleKey) {
  const node = document.createElement("mark");
  node.className = "inline-highlight";
  node.textContent = label;
  node.dataset.highlight = styleKey;
  applyHighlightStyle(node, styleKey);
  return node;
}

function applyInlineHighlights(root) {
  const ignoredParents = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE"]);
  const highlightPattern = /==(?:(default|[a-zA-Z0-9_-]+):)?([^=\n][\s\S]*?[^=\n])==/g;
  const hasHighlightPattern = /==(?:(default|[a-zA-Z0-9_-]+):)?([^=\n][\s\S]*?[^=\n])==/;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;
      if (!parentElement || ignoredParents.has(parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return hasHighlightPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const markedTextNodes = [];

  while (walker.nextNode()) {
    markedTextNodes.push(walker.currentNode);
  }

  markedTextNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    const text = textNode.nodeValue;
    let cursor = 0;

    text.replace(highlightPattern, (match, keyValue, labelValue, offset) => {
      const label = labelValue.trim();
      const styleKey = (keyValue || "default").trim();

      fragment.append(document.createTextNode(text.slice(cursor, offset)));
      fragment.append(label ? createHighlightNode(label, styleKey) : document.createTextNode(match));
      cursor = offset + match.length;
      return match;
    });

    fragment.append(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(fragment);
  });
}

function applyInlineTooltips(root, glossary) {
  const ignoredParents = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE"]);
  const tooltipPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const hasTooltipPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;
      if (!parentElement || ignoredParents.has(parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return hasTooltipPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const markedTextNodes = [];

  while (walker.nextNode()) {
    markedTextNodes.push(walker.currentNode);
  }

  markedTextNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    const text = textNode.nodeValue;
    let cursor = 0;

    text.replace(tooltipPattern, (match, labelValue, keyValue, offset) => {
      const label = labelValue.trim();
      const key = (keyValue || labelValue).trim();
      const tooltip = glossary[key];

      fragment.append(document.createTextNode(text.slice(cursor, offset)));

      if (label && tooltip) {
        fragment.append(createTooltipNode(label, tooltip));
      } else {
        fragment.append(document.createTextNode(label || match));
      }

      cursor = offset + match.length;
      return match;
    });

    fragment.append(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(fragment);
  });
}

function highlightArticleSearchHits(root) {
  const query = articleSearchQuery.trim();
  if (!query) {
    return;
  }

  const ignoredParents = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE", "MARK"]);
  const pattern = new RegExp(escapeRegExp(query), "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;
      if (!parentElement || ignoredParents.has(parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      pattern.lastIndex = 0;
      return pattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    const text = textNode.nodeValue;
    let cursor = 0;

    text.replace(pattern, (match, offset) => {
      fragment.append(document.createTextNode(text.slice(cursor, offset)));
      const mark = document.createElement("mark");
      mark.className = "article-search-hit";
      mark.textContent = match;
      fragment.append(mark);
      cursor = offset + match.length;
      return match;
    });

    fragment.append(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(fragment);
  });

  const firstHit = root.querySelector(".article-search-hit");
  if (firstHit) {
    requestAnimationFrame(() => {
      firstHit.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => firstHit.classList.add("is-settled"), 900);
    });
  }

  window.setTimeout(() => {
    root.querySelectorAll(".article-search-hit").forEach((hit) => {
      hit.classList.add("is-fading");
      window.setTimeout(() => {
        hit.replaceWith(document.createTextNode(hit.textContent || ""));
        root.normalize();
      }, 650);
    });
  }, 5000);
}

function getCodeLanguageLabel(codeBlock) {
  const languageClass = [...codeBlock.classList].find((className) => className.startsWith("language-"));
  if (!languageClass) {
    return "";
  }

  return languageClass.replace("language-", "").trim().toUpperCase();
}

function decorateCodeBlocks(root) {
  root.querySelectorAll("pre code").forEach((codeBlock) => {
    const language = getCodeLanguageLabel(codeBlock);
    const pre = codeBlock.closest("pre");
    if (!pre || pre.classList.contains("code-block")) {
      return;
    }

    pre.classList.add("code-block");

    if (language) {
      const label = document.createElement("span");
      label.className = "code-language-label";
      label.textContent = language;
      pre.append(label);
    }

    const toggle = document.createElement("button");
    toggle.className = "code-collapse-button";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "折叠代码块");
    toggle.title = "折叠代码块";
    toggle.textContent = "⌃";
    toggle.addEventListener("click", () => {
      const isCollapsed = pre.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
      toggle.setAttribute("aria-label", isCollapsed ? "展开代码块" : "折叠代码块");
      toggle.title = isCollapsed ? "展开代码块" : "折叠代码块";
      toggle.textContent = isCollapsed ? "⌄" : "⌃";
    });
    pre.append(toggle);
  });
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

async function renderMermaidBlocks(root) {
  if (!window.mermaid) {
    return;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
    flowchart: {
      htmlLabels: false
    }
  });

  const blocks = [...root.querySelectorAll("pre code.language-mermaid")];
  for (const [index, codeBlock] of blocks.entries()) {
    const pre = codeBlock.closest("pre");
    if (!pre) {
      continue;
    }

    const container = document.createElement("div");
    container.className = "mermaid-diagram";
    try {
      const { svg } = await window.mermaid.render(`mermaid-${Date.now()}-${index}`, codeBlock.textContent);
      container.innerHTML = svg;
      const renderedSvg = container.querySelector("svg");
      if (renderedSvg) {
        renderedSvg.style.overflow = "visible";
        const viewBox = renderedSvg.getAttribute("viewBox");
        if (viewBox) {
          const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
          if ([x, y, width, height].every(Number.isFinite)) {
            renderedSvg.setAttribute("viewBox", `${x} ${y - 4} ${width} ${height + 12}`);
          }
        }
      }
    } catch (error) {
      container.classList.add("is-error");
      container.textContent = codeBlock.textContent;
      console.error(error);
    }
    pre.replaceWith(container);
    centerMermaidLabels(container);
  }
}

function centerMermaidLabels(container) {
  const nodes = [...container.querySelectorAll("svg .node")];
  const svg = container.querySelector("svg");
  const viewBox = svg?.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const svgRect = svg?.getBoundingClientRect();
  const scaleY = viewBox && svgRect && Number.isFinite(viewBox[3]) && viewBox[3] !== 0
    ? svgRect.height / viewBox[3]
    : 1;

  for (const node of nodes) {
    const shape = node.querySelector(".label-container");
    const label = node.querySelector(".label");
    if (!shape || !label || !Number.isFinite(scaleY) || scaleY === 0) {
      continue;
    }

    try {
      const shapeBox = shape.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const shapeMiddle = shapeBox.top + shapeBox.height / 2;
      const labelMiddle = labelBox.top + labelBox.height / 2;
      const offsetY = (shapeMiddle - labelMiddle) / scaleY;
      if (!Number.isFinite(offsetY) || Math.abs(offsetY) < 0.5) {
        continue;
      }

      const transform = label.getAttribute("transform") || "";
      const match = transform.match(/translate\(([-\d.]+)(?:[,\s]+([-\d.]+))?\)/);
      const x = match ? Number(match[1]) : 0;
      const y = match && match[2] ? Number(match[2]) : 0;
      label.setAttribute("transform", `translate(${x}, ${y + offsetY})`);
    } catch (error) {
      console.warn("Unable to center Mermaid label", error);
    }
  }
}

function renderProjectVisualBody(post) {
  const visual = projectVisuals[post.slug];
  if (!visual) {
    return false;
  }

  const repoLink = post.repo
    ? `<a class="project-visual-link" href="${escapeHtml(post.repo)}" target="_blank" rel="noopener">${escapeHtml(visual.repoLabel || "Repo")}</a>`
    : "";
  const stack = Array.isArray(post.stack) ? post.stack : [];
  const metrics = Array.isArray(post.metrics) ? post.metrics : [];
  const sectionTitles = {
    architecture: visual.sections?.architecture || "系统结构",
    capabilities: visual.sections?.capabilities || "功能面",
    flow: visual.sections?.flow || "执行路径",
    boundaries: visual.sections?.boundaries || "设计边界"
  };

  articleContentEl.classList.remove("markdown-body");
  articleContentEl.classList.add("project-visual-body");
  articleContentEl.innerHTML = `
    <section class="project-visual-shell">
      <div class="project-visual-hero">
        <div>
          <p class="project-visual-eyebrow">${escapeHtml(visual.eyebrow || "Project")}</p>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.summary)}</p>
        </div>
        <div class="project-visual-meta">
          ${repoLink}
        </div>
      </div>

      <section class="project-visual-section project-architecture">
        <div class="project-section-heading">
          <p>Architecture</p>
          <h4>${escapeHtml(sectionTitles.architecture)}</h4>
        </div>
        <div class="architecture-board">
          ${visual.architecture.map((lane) => `
            <div class="architecture-lane">
              <span class="architecture-lane-title">${escapeHtml(lane.title)}</span>
              <div class="architecture-node-list">
                ${lane.nodes.map((node) => `
                  <div class="architecture-node">
                    <strong>${escapeHtml(node.title)}</strong>
                    <span>${escapeHtml(node.detail)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="project-visual-section">
        <div class="project-section-heading">
          <p>Capabilities</p>
          <h4>${escapeHtml(sectionTitles.capabilities)}</h4>
        </div>
        <div class="capability-grid">
          ${visual.capabilities.map((group) => `
            <article class="capability-panel">
              <h5>${escapeHtml(group.title)}</h5>
              <div>
                ${group.items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
              </div>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="project-visual-section">
        <div class="project-section-heading">
          <p>Flow</p>
          <h4>${escapeHtml(sectionTitles.flow)}</h4>
        </div>
        <div class="flow-rail">
          ${visual.flow.map((step, index) => `
            <article class="flow-step">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(step.title)}</strong>
              <p>${escapeHtml(step.detail)}</p>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="project-visual-section project-visual-bottom">
        <div class="project-section-heading">
          <p>Boundaries</p>
          <h4>${escapeHtml(sectionTitles.boundaries)}</h4>
        </div>
        <div class="boundary-grid">
          ${visual.boundaries.map((item) => `
            <article>
              <h5>${escapeHtml(item.title)}</h5>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `).join("")}
        </div>
        <div class="project-chip-row">
          ${stack.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          ${metrics.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </section>
    </section>
  `;

  return true;
}

function getEditorTemplate() {
  const date = new Date().toISOString().slice(0, 10);
  const tab = sessionStorage.getItem("editorDefaultTab") || "articles";
  sessionStorage.removeItem("editorDefaultTab");
  const title = tab === "projects" ? "新项目" : "新文章";
  return `---
title: "${title}"
date: ${date}
summary: ""
tags: []
tab: ${tab}
layout: single
draft: true
---

# ${title}

`;
}

function getTitleFromMarkdown(markdown) {
  const body = stripFrontmatter(markdown);
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() || "new-post";
}

function getSlugFromEditor(markdown, fallback = "") {
  const frontmatterSlug = String(markdown || "").match(/^---\r?\n[\s\S]*?\nslug:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
  if (frontmatterSlug) {
    return frontmatterSlug;
  }
  return fallback || getTitleFromMarkdown(markdown)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-post";
}

function getTabFromEditor(markdown) {
  return String(markdown || "").match(/^---\r?\n[\s\S]*?\ntab:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim() || "articles";
}

function syncEditorScroll(source, target) {
  const sourceMax = source.scrollHeight - source.clientHeight;
  const targetMax = target.scrollHeight - target.clientHeight;
  const ratio = sourceMax > 0 ? source.scrollTop / sourceMax : 0;
  target.scrollTop = targetMax > 0 ? targetMax * ratio : 0;
}

function setupEditorScrollSync(textarea, preview) {
  let activeScroller = null;

  const bind = (source, target) => {
    source.addEventListener("scroll", () => {
      if (activeScroller && activeScroller !== source) {
        return;
      }

      activeScroller = source;
      syncEditorScroll(source, target);
      requestAnimationFrame(() => {
        activeScroller = null;
      });
    }, { passive: true });
  };

  bind(textarea, preview);
  bind(preview, textarea);
}

async function renderEditorPreview(markdown) {
  const preview = document.querySelector("#markdown-editor-preview");
  if (!preview) {
    return;
  }

  preview.innerHTML = marked.parse(stripFrontmatter(markdown));
  applyInlineHighlights(preview);
  applyInlineTooltips(preview, await getTooltipGlossary());
  preview.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
  decorateCodeBlocks(preview);
  await renderMermaidBlocks(preview);
}

async function saveEditorPost({ navigate = false } = {}) {
  const textarea = document.querySelector("#markdown-editor-input");
  const statusEl = document.querySelector("#markdown-editor-status");
  if (!textarea || !isLocalPreview) {
    return null;
  }

  const markdown = textarea.value;
  const slug = getSlugFromEditor(markdown, textarea.dataset.slug || "");
  const mode = textarea.dataset.mode || "create";
  statusEl.textContent = "保存中...";

  try {
    const response = await fetch("/api/save-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, markdown, mode })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "保存失败");
    }

    statusEl.textContent = `已保存到 ${result.file}`;
    postsPromise = null;
    postMetadataPromise = null;
    postSearchTextCache.clear();
    const [nextPostsResponse, nextMetadataResponse] = await Promise.all([
      fetch(`${postsPath}?v=${Date.now()}`),
      fetch(`${postMetadataPath}?v=${Date.now()}`)
    ]);
    posts = nextPostsResponse.ok ? await nextPostsResponse.json() : await getPostsConfig();
    postMetadata = nextMetadataResponse.ok ? await nextMetadataResponse.json() : await getPostMetadata();
    const tab = tabs[getTabFromEditor(markdown)] ? getTabFromEditor(markdown) : "articles";
    textarea.dataset.savedValue = markdown;
    textarea.dataset.slug = result.slug;
    textarea.dataset.mode = "update";
    if (navigate) {
      setHash(tab, result.slug);
    }
    return result;
  } catch (error) {
    statusEl.textContent = error.message || "保存失败";
    return null;
  }
}

async function formatEditorPost() {
  const textarea = document.querySelector("#markdown-editor-input");
  const statusEl = document.querySelector("#markdown-editor-status");
  const preview = document.querySelector("#markdown-editor-preview");
  if (!textarea || !statusEl || !isLocalPreview) {
    return;
  }

  const previousValue = textarea.value;
  const ratio = textarea.scrollTop / Math.max(1, textarea.scrollHeight - textarea.clientHeight);
  statusEl.textContent = "格式化中...";

  try {
    const response = await fetch("/api/format-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: previousValue })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "格式化失败");
    }

    textarea.value = result.markdown;
    textarea.scrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight) * ratio;
    await renderEditorPreview(textarea.value);
    if (preview) {
      preview.scrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight) * ratio;
    }
    statusEl.textContent = result.warnings?.length ? `已格式化，${result.warnings.length} 个代码块跳过` : "已格式化，尚未保存";
  } catch (error) {
    textarea.value = previousValue;
    statusEl.textContent = error.message || "格式化失败";
  }
}

async function exitMarkdownEditor() {
  const textarea = document.querySelector("#markdown-editor-input");
  const hasChanges = textarea && textarea.value !== textarea.dataset.savedValue;
  let returnTab = backButtonEl.dataset.editorReturnTab || getTabFromEditor(textarea?.value || "") || "articles";

  if (hasChanges) {
    const shouldSave = window.confirm("有未保存的改动。点击“确定”保存后返回，点击“取消”继续编辑。");
    if (!shouldSave) {
      return;
    }

    const result = await saveEditorPost();
    if (!result) {
      return;
    }

    returnTab = tabs[getTabFromEditor(textarea.value)] ? getTabFromEditor(textarea.value) : returnTab;
  }

  setHash(returnTab);
}

async function showMarkdownEditor(slug = "") {
  if (!isLocalPreview) {
    setHash("welcome");
    return;
  }

  welcomeViewEl.hidden = true;
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = false;
  document.body.classList.add("is-editor-mode");
  collapseTopbar();
  articleDetailViewEl.classList.add("is-editor-view");
  articleDetailViewEl.classList.remove("has-toc", "is-two-column", "is-project-visual");
  articleContentEl.classList.remove("markdown-body", "project-visual-body");
  articleTocEl.hidden = true;
  articleTocListEl.innerHTML = "";
  contentMetaEl.hidden = true;
  backButtonEl.hidden = true;
  if (articleLoadingEl) { articleLoadingEl.hidden = true; }

  const post = slug ? posts.find((item) => item.slug === slug) : null;
  let markdown = getEditorTemplate();
  if (post) {
    const response = await fetch(post.file);
    if (response.ok) {
      markdown = await response.text();
    }
  }
  backButtonEl.dataset.editorReturnTab = post?.tab || getTabFromEditor(markdown);

  articleContentEl.innerHTML = `
    <section class="markdown-editor">
      <div class="markdown-editor-toolbar">
        <div>
          <p class="section-kicker">Local Editor</p>
          <h2>${post ? `编辑：${escapeHtml(post.title)}` : "新建 Markdown"}</h2>
        </div>
        <div class="markdown-editor-actions">
          <span id="markdown-editor-status" aria-live="polite"></span>
          <button id="markdown-editor-format" class="markdown-editor-icon-button" type="button" aria-label="格式化" title="格式化">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7h10"></path>
              <path d="M4 12h16"></path>
              <path d="M4 17h8"></path>
              <path d="m17 6 3 3-3 3"></path>
            </svg>
          </button>
          <button id="markdown-editor-exit" class="markdown-editor-secondary-button" type="button">返回归档列表</button>
          <button id="markdown-editor-save" type="button">保存</button>
        </div>
      </div>
      <div class="markdown-editor-grid">
        <textarea id="markdown-editor-input" spellcheck="false"></textarea>
        <article id="markdown-editor-preview" class="markdown-body"></article>
      </div>
    </section>
  `;

  const textarea = document.querySelector("#markdown-editor-input");
  textarea.value = markdown;
  textarea.dataset.slug = slug;
  textarea.dataset.mode = post ? "update" : "create";
  textarea.dataset.savedValue = markdown;
  const preview = document.querySelector("#markdown-editor-preview");
  setupEditorScrollSync(textarea, preview);

  let previewFrame = 0;
  textarea.addEventListener("input", () => {
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(async () => {
      const ratio = textarea.scrollTop / Math.max(1, textarea.scrollHeight - textarea.clientHeight);
      await renderEditorPreview(textarea.value);
      preview.scrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight) * ratio;
    });
  });
  document.querySelector("#markdown-editor-format").addEventListener("click", formatEditorPost);
  document.querySelector("#markdown-editor-save").addEventListener("click", saveEditorPost);
  document.querySelector("#markdown-editor-exit").addEventListener("click", exitMarkdownEditor);
  await renderEditorPreview(markdown);
}

function renderMarkdownBody(markdown, post) {
  articleContentEl.classList.add("markdown-body");
  articleContentEl.classList.remove("project-visual-body");
  articleContentEl.classList.toggle("is-two-column", post.layout === "two-column");

  if (post.layout !== "two-column") {
    articleContentEl.innerHTML = marked.parse(markdown);
    return;
  }

  const rowParts = splitMarkdownByMarker(markdown, "row");
  const intro = rowParts.shift()?.trim() || "";
  const rowHtml = rowParts
    .map((rowSource) => {
      const [leftSource, ...rightParts] = splitMarkdownByMarker(rowSource, "column");
      const rightSource = rightParts.join("\n<!-- column -->\n");

      if (!leftSource?.trim() || !rightSource.trim()) {
        return `
          <section class="article-row article-row-full">
            ${marked.parse(rowSource.trim())}
          </section>
        `;
      }

      return `
        <section class="article-row article-row-pair">
          <div class="article-column article-column-left">${marked.parse(leftSource.trim())}</div>
          <div class="article-column article-column-right">${marked.parse(rightSource.trim())}</div>
        </section>
      `;
    })
    .join("");

  if (!rowHtml.trim()) {
    articleContentEl.innerHTML = marked.parse(markdown);
    return;
  }

  articleContentEl.innerHTML = `
    ${intro ? `<section class="article-row article-row-full">${marked.parse(intro)}</section>` : ""}
    ${rowHtml}
  `;
}

async function loadArticle(post, expectedRunId = syncViewRun) {
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = false;
  document.body.classList.remove("is-editor-mode");
  if (articleEmptyEl) { articleEmptyEl.hidden = true; }

  const isResume = post.tab === "resume";
  if (articleLoadingEl) { articleLoadingEl.hidden = true; }
  articleContentEl.innerHTML = "";
  articleContentEl.classList.add("markdown-body");
  articleContentEl.classList.remove("project-visual-body");
  articleContentEl.classList.remove("is-two-column");
  articleDetailViewEl.classList.remove("has-toc");
  articleDetailViewEl.classList.remove("is-editor-view");
  articleDetailViewEl.classList.remove("is-project-visual");
  articleDetailViewEl.classList.toggle("is-two-column", post.layout === "two-column");
  if (articleTocEl) { articleTocEl.hidden = true; }
  if (articleTocListEl) { articleTocListEl.innerHTML = ""; }
  contentMetaEl.hidden = isResume;
  backButtonEl.hidden = true;

  window.scrollTo({ top: 0, behavior: "auto" });

  try {
    const response = await fetch(post.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${post.file}`);
    }

    const [markdown, tooltipGlossary] = await Promise.all([
      response.text().then(stripFrontmatter),
      getTooltipGlossary()
    ]);

    if (expectedRunId !== syncViewRun) {
      return;
    }

    renderArticleMeta(post);
    if (renderProjectVisualBody(post)) {
      articleDetailViewEl.classList.add("is-project-visual");
      articleDetailViewEl.classList.remove("has-toc");
      if (articleTocEl) { articleTocEl.hidden = true; }
      if (articleLoadingEl) { articleLoadingEl.hidden = true; }
      return;
    }

    renderMarkdownBody(markdown, post);
    applyInlineHighlights(articleContentEl);
    applyInlineTooltips(articleContentEl, tooltipGlossary);
    articleContentEl.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
    decorateCodeBlocks(articleContentEl);
    await renderMermaidBlocks(articleContentEl);
    highlightArticleSearchHits(articleContentEl);
    renderArticleToc(post);
    if (articleLoadingEl) { articleLoadingEl.hidden = true; }
  } catch (error) {
    if (expectedRunId !== syncViewRun) {
      return;
    }

    if (articleLoadingEl) { articleLoadingEl.hidden = true; }
    if (articleTocEl) { articleTocEl.hidden = true; }
    articleContentEl.innerHTML = `
      <div class="detail-error">
        <h3>内容加载失败</h3>
        <p>请确认 Markdown 文件路径存在，或检查 GitHub Pages 是否已正确发布。</p>
      </div>
    `;
    console.error(error);
  }
}

function showArchiveOnly(currentTab, filteredPosts) {
  if (currentTab === "resume") {
    return;
  }

  const shouldAnimateReturn = lastState.slug && lastState.tab === currentTab;
  document.body.classList.remove("is-editor-mode");
  renderList(currentTab, filteredPosts, "");
  articleDetailViewEl.hidden = true;
  articleDetailViewEl.classList.remove("has-toc");
  articleDetailViewEl.classList.remove("is-two-column");
  articleDetailViewEl.classList.remove("is-project-visual");
  articleDetailViewEl.classList.remove("is-editor-view");
  articleContentEl.classList.add("markdown-body");
  articleContentEl.classList.remove("project-visual-body");
  if (articleTocEl) { articleTocEl.hidden = true; }
  backButtonEl.hidden = true;
  contentMetaEl.hidden = false;

  if (pendingRestoreTab === currentTab) {
    restoreListScroll(currentTab);
    pendingRestoreTab = "";
  }

  if (shouldAnimateReturn) {
    playArchiveReturnAnimation();
  }
}

async function showWelcome(expectedRunId = syncViewRun) {
  document.body.classList.remove("is-editor-mode");
  if (welcomeViewEl) { welcomeViewEl.hidden = false; }
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = true;
  articleDetailViewEl.classList.remove("has-toc");
  articleDetailViewEl.classList.remove("is-editor-view");
  articleDetailViewEl.classList.remove("is-two-column");
  backButtonEl.hidden = true;
  contentMetaEl.hidden = false;
  articleContentEl.innerHTML = "";
  if (articleTocEl) { articleTocEl.hidden = true; }
  if (articleTocListEl) { articleTocListEl.innerHTML = ""; }
  if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  renderActivityGrid();
  await renderSkillDiamond(expectedRunId);
}

async function syncView() {
  const runId = ++syncViewRun;
  const currentState = getStateFromHash();
  const { tab, slug } = currentState;

  if (tab === "welcome") {
    renderTabs(tab);
    updateReadingLayout(tab, slug);
    await showWelcome(runId);
    if (runId !== syncViewRun) {
      return;
    }
    lastState = currentState;
    return;
  }

  if (tab === "editor") {
    renderTabs(tab);
    updateReadingLayout(tab, slug);
    if (welcomeViewEl) { welcomeViewEl.hidden = true; }
    await showMarkdownEditor(slug);
    if (runId !== syncViewRun) {
      return;
    }
    lastState = currentState;
    return;
  }

  const filteredPosts = await getFilteredPostsByTab(tab);

  if (runId !== syncViewRun) {
    return;
  }

  if (welcomeViewEl) { welcomeViewEl.hidden = true; }

  if (tab === "resume") {
    if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  }
  const activePost = filteredPosts.find((post) => post.slug === slug);
  const timelineFocusSlug = activePost?.slug || filteredPosts[0]?.slug || "";

  if (!lastState.slug && slug) {
    rememberListScroll(lastState.tab || tab);
  }
  if (lastState.slug && !slug) {
    pendingRestoreTab = tab;
  }
  if (lastState.tab !== tab && !lastState.slug) {
    rememberListScroll(lastState.tab);
  }

  renderTabs(tab);
  renderTagFilters();
  renderTimeline(tab, timelineFocusSlug, filteredPosts);
  updateReadingLayout(tab, slug);

  if (!filteredPosts.length) {
    showArchiveOnly(tab, filteredPosts);
    lastState = currentState;
    return;
  }

  if (tab === "resume" && !slug) {
    setHash(tab, filteredPosts[0].slug);
    return;
  }

  if (!slug) {
    showArchiveOnly(tab, filteredPosts);
    lastState = currentState;
    return;
  }

  if (!activePost) {
    setHash(tab);
    return;
  }

  if (tab !== "resume") {
    collapseTopbar();
    archivePageByTab[tab] = getPageForPost(filteredPosts, activePost.slug);
    renderList(tab, filteredPosts, activePost.slug);
  }

  await loadArticle(activePost, runId);
  if (runId !== syncViewRun) {
    return;
  }
  lastState = currentState;
}

tabsEls.forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    collapseTopbar();

    const nextTab = tabEl.dataset.tab;
    const currentState = getStateFromHash();

    if (!currentState.slug) {
      rememberListScroll(currentState.tab);
    }

    if (nextTab === "resume") {
      const resumePost = getPostsByTab("resume")[0];
      if (resumePost) {
        setHash("resume", resumePost.slug);
        return;
      }
    }

    setHash(nextTab);
  });
});

backButtonEl.addEventListener("click", () => {
  const { tab } = getStateFromHash();
  if (tab === "editor") {
    exitMarkdownEditor();
    return;
  }
  setHash(tab);
});

if (edgeBackButtonEl) {
  edgeBackButtonEl.addEventListener("click", () => {
    const { tab } = getStateFromHash();
    setHash(tab);
  });
}

timelineEl.addEventListener("scroll", () => {
  if (!timelinePanelEl.classList.contains("is-article-timeline")) {
    return;
  }

  if (timelineScrollFrame) {
    cancelAnimationFrame(timelineScrollFrame);
  }

  timelineScrollFrame = requestAnimationFrame(() => {
    timelineScrollFrame = 0;
    updateScrollableTimelineEmphasis();
  });
}, { passive: true });

timelineEl.addEventListener("click", async (event) => {
  const entry = event.target.closest(".timeline-entry");
  if (!entry || !timelinePanelEl.classList.contains("is-article-timeline")) {
    return;
  }

  const slug = entry.dataset.slug;
  archivePageByTab.articles = getPageForPost(await getFilteredPostsByTab("articles"), slug);
  await syncView();
  scrollArchiveToPost(slug);
});

if (articleSearchEl) {
  articleSearchEl.addEventListener("input", () => {
    articleSearchQuery = articleSearchEl.value;
    archivePageByTab.articles = 1;
    const { tab } = getStateFromHash();
    setHash(tab);
    syncView();
  });
}

window.addEventListener("hashchange", syncView);
window.addEventListener("beforeunload", (event) => {
  const textarea = document.querySelector("#markdown-editor-input");
  if (!document.body.classList.contains("is-editor-mode") || !textarea || textarea.value === textarea.dataset.savedValue) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("wheel", handleTopEdgeScroll, { passive: true });

async function bootstrap() {
  initializeTheme();
  await initializeSiteConfig();
  syncView();
}

bootstrap();
