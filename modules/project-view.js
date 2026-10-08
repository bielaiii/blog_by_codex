import { escapeHtml } from "./markdown.js";

export function renderProjectVisualBody(articleContentEl, post) {
  const visual = post.visualData;
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
