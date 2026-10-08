import { renderMarkdownBody, renderLatex } from "./markdown.js";
import { renderProjectVisualBody } from "./project-view.js";
import { parseFrontmatter, createPostRecord, validateProjectVisual } from "../shared/post-model.mjs";

let mermaidSequence = 0;
let mermaidQueue = Promise.resolve();
export function createArticleRenderer({ getHighlightStyles, getTooltipGlossary }) {
function applyHighlightStyle(node, key) {
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const style = getHighlightStyles()[key]?.[theme] || getHighlightStyles().default?.[theme] || getHighlightStyles().default?.light;

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

async function renderMermaidNow(root, signal) {
  if (signal?.aborted || !root.isConnected) return;
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
    if (signal?.aborted || !root.contains(codeBlock)) return;
    const pre = codeBlock.closest("pre");
    if (!pre) {
      continue;
    }

    const container = document.createElement("div");
    container.className = "mermaid-diagram";
    try {
      const { svg } = await window.mermaid.render(`mermaid-${++mermaidSequence}-${index}`, codeBlock.textContent);
      if (signal?.aborted || !root.contains(pre)) return;
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
    if (signal?.aborted || !root.contains(pre)) return;
    pre.replaceWith(container);
    centerMermaidLabels(container);
  }
}

function renderMermaidBlocks(root, signal) {
  const task = mermaidQueue.then(() => renderMermaidNow(root, signal));
  mermaidQueue = task.catch(() => {});
  return task;
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


  async function render(root, markdown, post = {}, { signal } = {}) {
    const { metadata, body } = parseFrontmatter(markdown);
    const nextPost = createPostRecord(metadata, body, { slug: post.slug, file: post.file, date: post.date });
    let visual = null;
    if (metadata.visual) {
      if (metadata.visual === post.visual && post.visualData) visual = post.visualData;
      else {
        if (!/^posts\/projects\/[^/]+\.json$/.test(metadata.visual)) throw new Error("项目展示路径必须位于 posts/projects/*.json");
        const response = await fetch(metadata.visual, { signal });
        if (!response.ok) throw new Error("无法加载项目展示数据");
        visual = validateProjectVisual(await response.json());
      }
    }
    const glossary = await getTooltipGlossary();
    if (signal?.aborted || !root.isConnected) return false;
    root.classList.remove("project-visual-body");
    renderMarkdownBody(root, body, nextPost);
    // Preserve the project diagrams and keep the Markdown body visible/editable.
    if (visual) {
      const project = document.createElement("section");
      renderProjectVisualBody(project, { ...nextPost, visualData: visual });
      root.prepend(project);
    }
    rewriteContentLinks(root, nextPost.file);
    applyInlineHighlights(root);
    applyInlineTooltips(root, glossary);
    renderLatex(root);
    root.querySelectorAll("pre code").forEach(block => {
      if (!block.classList.contains("language-mermaid")) window.hljs?.highlightElement(block);
    });
    decorateCodeBlocks(root);
    await renderMermaidBlocks(root, signal);
    return !signal?.aborted && root.isConnected;
  }
  return { render, applyHighlightStyle };
}

function rewriteContentLinks(root, file) {
  if (!file) return;
  const base = new URL(file, document.baseURI);
  function resolve(value) {
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return value;
    return value.startsWith("/") ? new URL(value.slice(1), document.baseURI).href : new URL(value, base).href;
  }
  root.querySelectorAll("[src], [href], [poster], [srcset]").forEach(node => {
    for (const attribute of ["src", "href", "poster"]) {
      const value = node.getAttribute(attribute);
      if (value) node.setAttribute(attribute, resolve(value));
    }
    const srcset = node.getAttribute("srcset");
    if (srcset && !srcset.includes("data:")) node.setAttribute("srcset", srcset.split(",").map(entry => {
      const [url, ...descriptor] = entry.trim().split(/\s+/);
      return [resolve(url), ...descriptor].join(" ");
    }).join(", "));
  });
}
