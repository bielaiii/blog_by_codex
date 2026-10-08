import { createDataStore } from "./modules/data.js";
import { createEditor } from "./modules/editor.js";
import { escapeHtml } from "./modules/markdown.js";
import { tabs, isPostVisible as visiblePost } from "./shared/post-model.mjs";
import { createArticleRenderer } from "./modules/article-renderer.js";
import { createRenderScope } from "./modules/lifecycle.js";
import { createAppState } from "./modules/state.js";
import { createRouter } from "./modules/router.js";
import { createArchiveView } from "./modules/archive-view.js";
import { createWelcomeView } from "./modules/welcome-view.js";
import { createTocView } from "./modules/toc-view.js";

const state = createAppState(tabs);
const readingScope = createRenderScope();

async function hasPreviewEditor() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch("/api/preview-config", { cache: "no-store", signal: controller.signal });
    return response.ok ? await response.json() : { localEditor: false };
  } catch {
    return { localEditor: false };
  } finally {
    clearTimeout(timeout);
  }
}
const isLocalPreview = (await hasPreviewEditor()).localEditor === true;


let posts = [];
let searchText = {};

let postMetadata = {};
let tagStyles = {};
let highlightStyles = {};
let siteConfig = {
  showArticleDates: false,
  showTimelineDates: true,
  dateSource: "generated",
  generatedDateField: "createdAt",
  publishDrafts: false
};
const {
  getTooltipGlossary,
  getSkillsConfig,
  getSiteConfig,
  getCatalog,
  getTagStyles,
  getHighlightStyles,
  reloadPosts
} = createDataStore(() => siteConfig);

const articleRenderer = createArticleRenderer({ getHighlightStyles: () => highlightStyles, getTooltipGlossary });
const { applyHighlightStyle } = articleRenderer;

let timelineScrollFrame = 0;

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

async function initializeSiteConfig() {
  const [config, catalog, tags, highlights] = await Promise.all([
    getSiteConfig(), getCatalog(), getTagStyles(), getHighlightStyles()
  ]);
  siteConfig = { ...siteConfig, ...config };
  posts = catalog.posts;
  postMetadata = catalog.postMetadata;
  searchText = catalog.searchText;
  tagStyles = tags;
  highlightStyles = highlights;
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
  return visiblePost(post, { includeDrafts: isLocalPreview, publishDrafts: siteConfig.publishDrafts === true });
}

const { renderActivityGrid, renderSkillDiamond } = createWelcomeView({
  elements: { activityGridEl, activitySummaryEl, skillDiamondEl }, getPosts: () => posts,
  getPostUpdatedDate, visiblePost: isPostVisible, getSkillsConfig, getRunId: () => state.syncViewRun
});

function getPostUpdatedDate(post) {
  return postMetadata[post.slug]?.updatedAt || post.date;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFallbackSearchText(post) {
  return [post.title, post.summary, ...(post.tags || [])].filter(Boolean).join(" ");
}
function getPostSearchText(post) {
  return searchText[post.slug] || getFallbackSearchText(post);
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
  const query = state.articleSearchQuery.trim();
  if (!query) {
    return "";
  }

  const source = getPostSearchText(post);
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


function refreshThemeBoundStyles() {
  document.querySelectorAll(".inline-highlight").forEach((node) => {
    applyHighlightStyle(node, node.dataset.highlight || "default");
  });

  document.querySelectorAll(".tag-filter").forEach((button) => {
    button.setAttribute("style", getTagStyleAttribute(button.dataset.tag || ""));
  });
}

const { read: getStateFromHash, navigate: setHash } = createRouter({
  canEdit: () => isLocalPreview,
  beforeNavigate: () => !document.body.classList.contains("is-editor-mode") || editor.canLeave()
});

const { renderList, renderTagFilters, attachLocalEditorButtons, getPageForPost, getArticleTags, syncDefaultArticleTags } = createArchiveView({
  elements: { archivePaginationEl, articleListEl, articleListViewEl, articleDetailViewEl, articleEmptyEl,
    listTitleEl, listDescriptionEl, tagFilterListEl, articleSearchEl },
  state, canEdit: () => isLocalPreview, router: { read: getStateFromHash, navigate: setHash }, onRefresh: syncView,
  getPostsByTab, getTagStyleAttribute, buildSearchSnippet, shouldShowArticleDates, getPostDate, formatDate
});

function getPostsByTab(tab) {
  return posts.filter((post) => post.tab === tab && isPostVisible(post));
}

async function postMatchesSearch(post) {
  const query = state.articleSearchQuery.trim().toLowerCase();
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

  const tagFilteredPosts = (!state.tagFilterTouched || state.activeArticleTags.size === tags.length)
    ? tabPosts
    : tabPosts.filter((post) => (post.tags || []).some((tag) => state.activeArticleTags.has(tag)));

  const matchedPosts = await Promise.all(
    tagFilteredPosts.map(async (post) => ((await postMatchesSearch(post)) ? post : null))
  );

  return matchedPosts.filter(Boolean);
}

function rememberListScroll(tab) {
  state.listScrollPositions[tab] = window.scrollY;
}

function restoreListScroll(tab) {
  const top = state.listScrollPositions[tab] || 0;
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

const renderArticleToc = createTocView({ articleTocEl, articleTocListEl, articleContentEl, articleDetailViewEl });

function highlightArticleSearchHits(root) {
  const query = state.articleSearchQuery.trim();
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


async function loadArticle(post, expectedRunId = state.syncViewRun, signal = readingScope.signal) {
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
    const response = await fetch(post.file, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${post.file}`);
    }

    const markdown = await response.text();
    if (signal.aborted || expectedRunId !== state.syncViewRun) return;
    renderArticleMeta(post);
    articleDetailViewEl.classList.toggle("is-project-visual", Boolean(post.visual));
    const rendered = await articleRenderer.render(articleContentEl, markdown, post, { signal });
    if (!rendered || signal.aborted || expectedRunId !== state.syncViewRun) return;
    highlightArticleSearchHits(articleContentEl);
    renderArticleToc(post);
    if (articleLoadingEl) { articleLoadingEl.hidden = true; }
  } catch (error) {
    if (signal.aborted || expectedRunId !== state.syncViewRun) {
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

  const shouldAnimateReturn = state.lastState.slug && state.lastState.tab === currentTab;
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

  if (state.pendingRestoreTab === currentTab) {
    restoreListScroll(currentTab);
    state.pendingRestoreTab = "";
  }

  if (shouldAnimateReturn) {
    playArchiveReturnAnimation();
  }
}

async function showWelcome(expectedRunId = state.syncViewRun) {
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

let renderedRoute = getStateFromHash();
async function syncView() {
  const requested = getStateFromHash();
  if ((requested.tab !== renderedRoute.tab || requested.slug !== renderedRoute.slug) && !editor.canLeave()) {
    const params = new URLSearchParams({ tab: renderedRoute.tab });
    if (renderedRoute.slug) params.set("post", renderedRoute.slug);
    history.replaceState(null, "", `#${params}`);
    return;
  }
  renderedRoute = requested;
  const signal = readingScope.next();
  editor.dispose();
  const runId = ++state.syncViewRun;
  const currentState = getStateFromHash();
  const { tab, slug } = currentState;

  if (tab === "welcome") {
    renderTabs(tab);
    updateReadingLayout(tab, slug);
    await showWelcome(runId);
    if (runId !== state.syncViewRun) {
      return;
    }
    state.lastState = currentState;
    return;
  }

  if (tab === "editor") {
    renderTabs(tab);
    updateReadingLayout(tab, slug);
    if (welcomeViewEl) { welcomeViewEl.hidden = true; }
    try { await showMarkdownEditor(slug, { signal }); }
    catch (error) {
      if (signal.aborted) return;
      document.body.classList.remove("is-editor-mode");
      articleContentEl.textContent = `编辑器加载失败：${error.message}`;
      return;
    }
    if (runId !== state.syncViewRun) {
      return;
    }
    state.lastState = currentState;
    return;
  }

  const filteredPosts = await getFilteredPostsByTab(tab);

  if (runId !== state.syncViewRun) {
    return;
  }

  if (welcomeViewEl) { welcomeViewEl.hidden = true; }

  if (tab === "resume") {
    if (articleEmptyEl) { articleEmptyEl.hidden = true; }
  }
  const activePost = filteredPosts.find((post) => post.slug === slug);
  const timelineFocusSlug = activePost?.slug || filteredPosts[0]?.slug || "";

  if (!state.lastState.slug && slug) {
    rememberListScroll(state.lastState.tab || tab);
  }
  if (state.lastState.slug && !slug) {
    state.pendingRestoreTab = tab;
  }
  if (state.lastState.tab !== tab && !state.lastState.slug) {
    rememberListScroll(state.lastState.tab);
  }

  renderTabs(tab);
  renderTagFilters();
  renderTimeline(tab, timelineFocusSlug, filteredPosts);
  updateReadingLayout(tab, slug);

  if (!filteredPosts.length) {
    showArchiveOnly(tab, filteredPosts);
    state.lastState = currentState;
    return;
  }

  if (tab === "resume" && !slug) {
    setHash(tab, filteredPosts[0].slug);
    return;
  }

  if (!slug) {
    showArchiveOnly(tab, filteredPosts);
    state.lastState = currentState;
    return;
  }

  if (!activePost) {
    setHash(tab);
    return;
  }

  if (tab !== "resume") {
    collapseTopbar();
    state.archivePageByTab[tab] = getPageForPost(filteredPosts, activePost.slug);
    renderList(tab, filteredPosts, activePost.slug);
  }

  await loadArticle(activePost, runId, signal);
  if (runId !== state.syncViewRun) {
    return;
  }
  state.lastState = currentState;
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

async function reloadEditorPostData(catalog) {
  const refreshed = await reloadPosts(catalog);
  posts = refreshed.posts;
  postMetadata = refreshed.postMetadata;
  searchText = refreshed.searchText;
}

const editor = createEditor({
  tabs,
  canEdit: () => isLocalPreview,
  elements: {
    welcomeViewEl,
    articleListViewEl,
    articleDetailViewEl,
    articleLoadingEl,
    articleContentEl,
    articleTocEl,
    articleTocListEl,
    backButtonEl,
    contentMetaEl
  },
  getPosts: () => posts,
  reloadEditorPostData,
  renderer: articleRenderer,
  setHash,
  collapseTopbar
});
const { showMarkdownEditor, exitMarkdownEditor, saveEditorPost } = editor;

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
  state.archivePageByTab.articles = getPageForPost(await getFilteredPostsByTab("articles"), slug);
  await syncView();
  scrollArchiveToPost(slug);
});

let searchTimer;
if (articleSearchEl) {
  articleSearchEl.addEventListener("input", () => {
    state.articleSearchQuery = articleSearchEl.value;
    state.archivePageByTab.articles = 1;
    const { tab } = getStateFromHash();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { setHash(tab); syncView(); }, 150);
  });
}

window.addEventListener("hashchange", syncView);
window.addEventListener("keydown", (event) => {
  const isSnippetShortcut = (event.ctrlKey || event.metaKey)
    && !event.altKey
    && event.shiftKey
    && event.key.toLowerCase() === "p";
  const isSaveShortcut = (event.ctrlKey || event.metaKey)
    && !event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === "s";
  const textarea = document.querySelector("#markdown-editor-input");

  if (isSnippetShortcut && document.body.classList.contains("is-editor-mode") && textarea) {
    event.preventDefault();
    if (!event.repeat) {
      document.querySelector("#markdown-editor-snippets")?.click();
    }
    return;
  }

  if (!isSaveShortcut || !document.body.classList.contains("is-editor-mode") || !textarea) {
    return;
  }

  event.preventDefault();
  if (!event.repeat) {
    saveEditorPost();
  }
});
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
  await syncView();
}

bootstrap().catch(error => {
  welcomeViewEl.textContent = `站点数据加载失败：${error.message}`;
  console.error(error);
});
