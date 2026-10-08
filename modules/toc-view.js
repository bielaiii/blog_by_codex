import { escapeHtml } from "./markdown.js";
export function createTocView({ articleTocEl, articleTocListEl, articleContentEl, articleDetailViewEl }) {
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

    if (post.tab === "resume" || post.layout === "two-column" || post.visual) {
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

  return renderArticleToc;
}
