import { parseFrontmatter, splitMarkdownByMarker } from "../shared/post-model.mjs";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function stripFrontmatter(markdown) {
  return parseFrontmatter(markdown).body;
}

export function renderLatex(root) {
  if (!root || typeof window.renderMathInElement !== "function") {
    return;
  }

  window.renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\begin{equation}", right: "\\end{equation}", display: true },
      { left: "\\begin{equation*}", right: "\\end{equation*}", display: true },
      { left: "\\begin{align}", right: "\\end{align}", display: true },
      { left: "\\begin{align*}", right: "\\end{align*}", display: true },
      { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
      { left: "\\begin{alignat*}", right: "\\end{alignat*}", display: true },
      { left: "\\begin{gather}", right: "\\end{gather}", display: true },
      { left: "\\begin{gather*}", right: "\\end{gather*}", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false,
    strict: "ignore"
  });
}

export function parseMarkdownWithMath(markdown) {
  const mathSegments = [];
  const protectedMarkdown = String(markdown || "").replace(
    /\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?)\}[\s\S]*?\\end\{\1\}|\$\$[\s\S]*?\$\$|\$(?!\$)(?:\\.|[^\\$\n])+\$/g,
    (source) => {
      const token = `KATEXPROTECTED${mathSegments.length}TOKEN`;
      const normalizedSource = source.startsWith("$$")
        ? source
          .replace(/\\begin\{align\*?\}/g, "\\begin{aligned}")
          .replace(/\\end\{align\*?\}/g, "\\end{aligned}")
        : source;
      mathSegments.push({ token, source: normalizedSource });
      return token;
    }
  );

  return mathSegments.reduce(
    (html, { token, source }) => html.split(token).join(escapeHtml(source)),
    marked.parse(protectedMarkdown, { breaks: true, gfm: true })
  );
}

export function renderMarkdownBody(root, markdown, post) {
  root.classList.add("markdown-body");
  root.classList.remove("project-visual-body");
  root.classList.toggle("is-two-column", post.layout === "two-column");

  if (post.layout !== "two-column") {
    root.innerHTML = parseMarkdownWithMath(markdown);
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
            ${parseMarkdownWithMath(rowSource.trim())}
          </section>
        `;
      }

      return `
        <section class="article-row article-row-pair">
          <div class="article-column article-column-left">${parseMarkdownWithMath(leftSource.trim())}</div>
          <div class="article-column article-column-right">${parseMarkdownWithMath(rightSource.trim())}</div>
        </section>
      `;
    })
    .join("");

  if (!rowHtml.trim()) {
    root.innerHTML = parseMarkdownWithMath(markdown);
    return;
  }

  root.innerHTML = `
    ${intro ? `<section class="article-row article-row-full">${parseMarkdownWithMath(intro)}</section>` : ""}
    ${rowHtml}
  `;
}
