const tabs = {
  resume: "个人简历",
  articles: "分享文章",
  projects: "项目"
};

const tabDescriptions = {
  resume: "这里是你的个人简历入口。建议从现有 LaTeX 简历同步内容与版式。",
  articles: "更偏向分享型内容，可以是教程、摘录、整理和技术文章。",
  projects: "适合持续更新中的项目记录、状态变化和阶段性总结。"
};

const posts = [
  {
    slug: "resume-profile",
    tab: "resume",
    title: "个人简历（Web 版本）",
    date: "2026-03-29",
    summary: "该页面用于承载你的在线简历内容。当前为占位版本，后续会按你的 LaTeX 简历逐段迁移并对齐布局。",
    tags: ["Resume", "LaTeX", "Profile"],
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

const tabsEls = [...document.querySelectorAll(".tab")];
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

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
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

function getStateFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  const params = new URLSearchParams(hash);
  const tab = params.get("tab") || "resume";
  const slug = params.get("post") || "";
  return {
    tab: tabs[tab] ? tab : "resume",
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

function renderList(currentTab, filteredPosts, currentSlug) {
  listTitleEl.textContent = `${tabs[currentTab]}归档`;
  listDescriptionEl.textContent = tabDescriptions[currentTab];

  if (!filteredPosts.length) {
    articleListEl.innerHTML = "";
    articleEmptyEl.hidden = false;
    articleListViewEl.hidden = true;
    articleDetailViewEl.hidden = true;
    return;
  }

  articleEmptyEl.hidden = true;
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

async function loadArticle(post) {
  articleListViewEl.hidden = true;
  articleDetailViewEl.hidden = false;
  articleLoadingEl.hidden = false;
  articleContentEl.innerHTML = "";
  window.scrollTo({ top: 0, behavior: "auto" });

  try {
    const response = await fetch(post.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${post.file}`);
    }

    const markdown = await response.text();
    renderArticleMeta(post);
    articleContentEl.innerHTML = marked.parse(markdown);
    articleContentEl.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
    articleLoadingEl.hidden = true;
  } catch (error) {
    articleLoadingEl.hidden = true;
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
  renderList(currentTab, filteredPosts, "");
  articleDetailViewEl.hidden = true;
  if (pendingRestoreTab === currentTab) {
    restoreListScroll(currentTab);
    pendingRestoreTab = "";
  }
}

function syncView() {
  const currentState = getStateFromHash();
  const { tab, slug } = currentState;
  const filteredPosts = getPostsByTab(tab);
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

  if (!filteredPosts.length) {
    showArchiveOnly(tab, filteredPosts);
    lastState = currentState;
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

  renderList(tab, filteredPosts, activePost.slug);
  loadArticle(activePost);
  lastState = currentState;
}

tabsEls.forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    const nextTab = tabEl.dataset.tab;
    const currentState = getStateFromHash();
    if (!currentState.slug) {
      rememberListScroll(currentState.tab);
    }
    setHash(nextTab);
  });
});

backButtonEl.addEventListener("click", () => {
  const { tab } = getStateFromHash();
  setHash(tab);
});

window.addEventListener("hashchange", syncView);
syncView();
