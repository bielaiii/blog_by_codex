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

const posts = [
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

const tabsEls = [...document.querySelectorAll(".tab")];
const welcomeViewEl = document.querySelector("#welcome-view");
const skillDiamondEl = document.querySelector("#skill-diamond");
const workspaceEl = document.querySelector(".workspace");
const timelinePanelEl = document.querySelector(".timeline-panel");
const timelineEl = document.querySelector("#timeline");
const timelineHeadingEl = document.querySelector("#timeline-heading");
const listTitleEl = document.querySelector("#list-title");
const listDescriptionEl = document.querySelector("#list-description");
const articleListEl = document.querySelector("#article-list");
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
    });
  }

  colorSchemeQuery?.addEventListener("change", (event) => {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? "dark" : "light");
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
  const [year, month, day] = dateString.split("-");
  return `${year}-${month}-${day}`;
}

async function getTooltipGlossary() {
  if (!tooltipGlossaryPromise) {
    tooltipGlossaryPromise = fetch(tooltipGlossaryPath)
      .then((response) => {
        if (!response.ok) {
          return {};
        }
        return response.json();
      })
      .catch(() => ({}));
  }

  return tooltipGlossaryPromise;
}

async function getSkillsConfig() {
  if (!skillsPromise) {
    skillsPromise = fetch(skillsPath)
      .then((response) => {
        if (!response.ok) {
          return { weightRange: { min: 1, max: 10 }, skills: [] };
        }
        return response.json();
      })
      .catch(() => ({ weightRange: { min: 1, max: 10 }, skills: [] }));
  }

  return skillsPromise;
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

async function renderSkillDiamond() {
  if (!skillDiamondEl) {
    return;
  }

  const config = await getSkillsConfig();
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
  return posts.filter((post) => post.tab === tab);
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
  if (tab === "welcome") {
    workspaceEl.classList.add("is-single-column");
    workspaceEl.classList.remove("is-reading-detail");
    timelinePanelEl.hidden = true;

    if (edgeBackButtonEl) {
      edgeBackButtonEl.hidden = true;
    }
    return;
  }

  const isReadingDetail = Boolean(slug) && tab !== "resume";
  const showTimeline = tab === "articles" && !isReadingDetail;
  const isSingleColumn = tab !== "articles";

  workspaceEl.classList.toggle("is-reading-detail", isReadingDetail);
  workspaceEl.classList.toggle("is-single-column", isSingleColumn);
  timelinePanelEl.hidden = !showTimeline;

  if (edgeBackButtonEl) {
    edgeBackButtonEl.hidden = !isReadingDetail;
  }
}

function renderList(currentTab, filteredPosts, currentSlug) {
  listTitleEl.textContent = `${tabs[currentTab]}归档`;
  listDescriptionEl.textContent = tabDescriptions[currentTab];

  if (!filteredPosts.length) {
    articleListEl.innerHTML = "";
    if (articleEmptyEl) { articleEmptyEl.hidden = false; }
    articleListViewEl.hidden = true;
    articleDetailViewEl.hidden = true;
    return;
  }

  if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  articleListViewEl.hidden = false;

  articleListEl.innerHTML = filteredPosts
    .map((post) => `
      <a class="archive-card ${post.slug === currentSlug ? "is-active" : ""}" href="#tab=${currentTab}&post=${post.slug}">
        <p class="archive-date">${formatDate(post.date)}</p>
        <h3 class="archive-title">${post.title}</h3>
        <p class="archive-preview">${post.summary}</p>
      </a>
    `)
    .join("");
}

function renderTimeline(currentTab, currentSlug) {
  const filteredPosts = getPostsByTab(currentTab);
  timelineHeadingEl.textContent = tabs[currentTab];

  if (!filteredPosts.length) {
    timelineEl.innerHTML = '<p class="timeline-empty">这里还没有条目。</p>';
    return;
  }

  const activeIndex = Math.max(filteredPosts.findIndex((post) => post.slug === currentSlug), 0);

  timelineEl.innerHTML = filteredPosts
    .map((post, index) => {
      const distance = Math.abs(index - activeIndex);
      const emphasisClass = distance === 0
        ? "is-current"
        : distance === 1
          ? "is-near"
          : distance === 2
            ? "is-far"
            : "is-faded";

      return `
        <a class="timeline-entry ${emphasisClass}" href="#tab=${currentTab}&post=${post.slug}">
          <span class="timeline-entry-date">${formatDate(post.date)}</span>
          <span class="timeline-entry-title">${post.title}</span>
        </a>
      `;
    })
    .join("");
}

function renderArticleMeta(post) {
  articleCategoryEl.textContent = tabs[post.tab];
  articleDateEl.textContent = formatDate(post.date);
  articleTitleEl.textContent = post.title;
  articleSummaryEl.textContent = post.summary;
  articleTagsEl.innerHTML = post.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
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

async function loadArticle(post) {
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = false;
  if (articleEmptyEl) { articleEmptyEl.hidden = true; }

  const isResume = post.tab === "resume";
  if (articleLoadingEl) { articleLoadingEl.hidden = true; }
  articleContentEl.innerHTML = "";
  contentMetaEl.hidden = isResume;
  backButtonEl.hidden = true;

  window.scrollTo({ top: 0, behavior: "auto" });

  try {
    const response = await fetch(post.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${post.file}`);
    }

    const [markdown, tooltipGlossary] = await Promise.all([
      response.text(),
      getTooltipGlossary()
    ]);
    renderArticleMeta(post);
    articleContentEl.innerHTML = marked.parse(markdown);
    applyInlineTooltips(articleContentEl, tooltipGlossary);
    articleContentEl.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
    if (articleLoadingEl) { articleLoadingEl.hidden = true; }
  } catch (error) {
    if (articleLoadingEl) { articleLoadingEl.hidden = true; }
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

  renderList(currentTab, filteredPosts, "");
  articleDetailViewEl.hidden = true;
  backButtonEl.hidden = true;
  contentMetaEl.hidden = false;

  if (pendingRestoreTab === currentTab) {
    restoreListScroll(currentTab);
    pendingRestoreTab = "";
  }
}

function showWelcome() {
  if (welcomeViewEl) { welcomeViewEl.hidden = false; }
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = true;
  backButtonEl.hidden = true;
  contentMetaEl.hidden = false;
  articleContentEl.innerHTML = "";
  if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  renderSkillDiamond();
}

function syncView() {
  const currentState = getStateFromHash();
  const { tab, slug } = currentState;
  const filteredPosts = getPostsByTab(tab);

  if (tab === "welcome") {
    renderTabs(tab);
    updateReadingLayout(tab, slug);
    showWelcome();
    lastState = currentState;
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
  renderTimeline(tab, timelineFocusSlug);
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
    renderList(tab, filteredPosts, activePost.slug);
  }

  loadArticle(activePost);
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
  setHash(tab);
});

if (edgeBackButtonEl) {
  edgeBackButtonEl.addEventListener("click", () => {
    const { tab } = getStateFromHash();
    setHash(tab);
  });
}

window.addEventListener("hashchange", syncView);
window.addEventListener("wheel", handleTopEdgeScroll, { passive: true });
initializeTheme();
syncView();
