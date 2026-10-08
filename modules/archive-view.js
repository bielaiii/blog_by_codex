import { escapeHtml } from "./markdown.js";
import { tabs } from "../shared/post-model.mjs";
const archivePostsPerPage = 10;
const archiveSiblingPageCount = 2;
const tabDescriptions = {
  resume: "", articles: "更偏向分享型内容，可以是教程、摘录、整理和技术文章。",
  projects: "适合持续更新中的项目记录、状态变化和阶段性总结。"
};
export function createArchiveView({ elements, state, canEdit, router, onRefresh, getPostsByTab, getTagStyleAttribute, buildSearchSnippet, shouldShowArticleDates, getPostDate, formatDate }) {
    const { archivePaginationEl, articleListEl, articleListViewEl, articleDetailViewEl, articleEmptyEl,
      listTitleEl, listDescriptionEl, tagFilterListEl, articleSearchEl } = elements;
    const { read: getStateFromHash, navigate: setHash } = router;
    const syncView = onRefresh;
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
        if (nextPage === state.archivePageByTab[currentTab]) {
          return;
        }

        state.archivePageByTab[currentTab] = nextPage;
        const { tab } = getStateFromHash();
        setHash(tab);
        syncView();
        articleListViewEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function attachLocalEditorButtons() {
    if (!canEdit()) {
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
      <a class="archive-card project-card ${post.draft ? "is-draft" : ""} ${post.slug === currentSlug ? "is-active" : ""}" href="#tab=${currentTab}&post=${post.slug}">
        <span class="archive-anchor" data-slug="${escapeHtml(post.slug)}"></span>
        ${post.draft ? '<span class="draft-badge">草稿</span>' : ""}
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
    const localCreateButton = canEdit() && (currentTab === "articles" || currentTab === "projects")
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
      articleListEl.innerHTML = `${localCreateButton}<p class="archive-empty-state">${state.articleSearchQuery.trim() ? "没有匹配当前搜索和标签的文章。" : "没有匹配当前标签的文章。"}</p>`;
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
    const currentPage = clampPage(state.archivePageByTab[currentTab], totalPages);
    state.archivePageByTab[currentTab] = currentPage;
    const pageStart = (currentPage - 1) * archivePostsPerPage;
    const pagePosts = filteredPosts.slice(pageStart, pageStart + archivePostsPerPage);

    const cardsHtml = pagePosts
      .map((post) => {
        if (currentTab === "projects") {
          return renderProjectCard(post, currentTab, currentSlug);
        }

        const searchSnippet = currentTab === "articles" ? buildSearchSnippet(post) : "";
        return `
          <a class="archive-card ${post.draft ? "is-draft" : ""} ${post.slug === currentSlug ? "is-active" : ""}" href="#tab=${currentTab}&post=${post.slug}">
            <span class="archive-anchor" data-slug="${escapeHtml(post.slug)}"></span>
            ${post.draft ? '<span class="draft-badge">草稿</span>' : ""}
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

  function renderTagFilters() {
    if (!tagFilterListEl) {
      return;
    }

    if (articleSearchEl && articleSearchEl.value !== state.articleSearchQuery) {
      articleSearchEl.value = state.articleSearchQuery;
    }

    const tags = getArticleTags();
    syncDefaultArticleTags(tags);

    if (!tags.length) {
      tagFilterListEl.innerHTML = '<p class="tag-filter-empty">还没有标签。</p>';
      return;
    }

    tagFilterListEl.innerHTML = tags
      .map((tag) => `
        <button class="tag-filter ${state.activeArticleTags.has(tag) ? "is-active" : ""}" type="button" data-tag="${escapeHtml(tag)}"${getTagStyleAttribute(tag)}>
          ${escapeHtml(tag)}
        </button>
      `)
      .join("");

    tagFilterListEl.querySelectorAll(".tag-filter").forEach((button) => {
      button.addEventListener("click", () => {
        const tag = button.dataset.tag;

        if (!state.tagFilterTouched) {
          state.activeArticleTags = new Set([tag]);
          state.tagFilterTouched = true;
        } else if (state.activeArticleTags.has(tag)) {
          state.activeArticleTags.delete(tag);
        } else {
          state.activeArticleTags.add(tag);
        }

        if (!state.activeArticleTags.size) {
          state.tagFilterTouched = false;
        }

        state.archivePageByTab.articles = 1;
        const { tab } = getStateFromHash();
        setHash(tab);
        syncView();
      });
    });
  }

  function getArticleTags() {
    return [...new Set(getPostsByTab("articles").flatMap((post) => post.tags || []))]
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function syncDefaultArticleTags(tags) {
    if (!state.tagFilterTouched) {
      state.activeArticleTags = new Set(tags);
    }
  }

  return { renderList, renderTagFilters, attachLocalEditorButtons, getPageForPost, getArticleTags, syncDefaultArticleTags };
}
