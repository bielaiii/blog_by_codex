import { escapeHtml, stripFrontmatter, renderLatex, parseMarkdownWithMath } from "./markdown.js";

export function createEditor({
  tabs,
  isLocalPreview,
  elements,
  getPosts,
  reloadEditorPostData,
  getTooltipGlossary,
  setHash,
  collapseTopbar,
  applyInlineHighlights,
  applyInlineTooltips,
  decorateCodeBlocks,
  renderMermaidBlocks
}) {
  const {
    welcomeViewEl,
    articleListViewEl,
    articleDetailViewEl,
    articleLoadingEl,
    articleContentEl,
    articleTocEl,
    articleTocListEl,
    backButtonEl,
    contentMetaEl
  } = elements;
  let editorSaveInProgress = false;
  let activeEditorSnippetSession = null;

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

  function getDraftFromEditor(markdown) {
    const frontmatter = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return frontmatter?.[1].match(/^draft:\s*(true|false)\s*$/m)?.[1] === "true";
  }

  function setEditorDraft(markdown, isDraft) {
    const source = String(markdown || "");
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const value = `draft: ${isDraft ? "true" : "false"}`;

    if (!frontmatter) {
      return `---\n${value}\n---\n\n${source}`;
    }

    const nextFrontmatter = /^draft:\s*(?:true|false)\s*$/m.test(frontmatter[1])
      ? frontmatter[1].replace(/^draft:\s*(?:true|false)\s*$/m, value)
      : `${frontmatter[1]}\n${value}`;
    return source.replace(frontmatter[0], `---\n${nextFrontmatter}\n---`);
  }

  function isEditorCharacterEscaped(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    return slashCount % 2 === 1;
  }

  function countUnescapedToken(source, token) {
    let count = 0;
    let offset = 0;
    while (offset < source.length) {
      const index = source.indexOf(token, offset);
      if (index < 0) {
        break;
      }
      if (!isEditorCharacterEscaped(source, index)) {
        count += 1;
      }
      offset = index + token.length;
    }
    return count;
  }

  function isEditorLiteralContext(source, index) {
    const beforeCursor = source.slice(0, index);
    let activeFence = "";
    beforeCursor.split("\n").forEach((line) => {
      const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (!match) {
        return;
      }
      const marker = match[1][0];
      if (!activeFence) {
        activeFence = marker;
      } else if (activeFence === marker) {
        activeFence = "";
      }
    });
    if (activeFence || countUnescapedToken(beforeCursor, "$$") % 2 === 1) {
      return true;
    }

    let mathEnvironmentDepth = 0;
    const mathEnvironmentPattern = /\\(begin|end)\{(?:equation\*?|align\*?|alignat\*?|gather\*?)\}/g;
    for (const match of beforeCursor.matchAll(mathEnvironmentPattern)) {
      mathEnvironmentDepth += match[1] === "begin" ? 1 : -1;
    }
    if (mathEnvironmentDepth > 0) {
      return true;
    }

    const currentLine = beforeCursor.slice(beforeCursor.lastIndexOf("\n") + 1);
    if (countUnescapedToken(currentLine, "`") % 2 === 1) {
      return true;
    }
    let inlineDollarCount = 0;
    for (let cursor = 0; cursor < currentLine.length; cursor += 1) {
      if (currentLine[cursor] !== "$" || isEditorCharacterEscaped(currentLine, cursor)) {
        continue;
      }
      if (currentLine[cursor + 1] === "$") {
        cursor += 1;
      } else {
        inlineDollarCount += 1;
      }
    }
    return inlineDollarCount % 2 === 1;
  }

  function shouldOpenSnippetWithSlash(textarea) {
    const start = textarea.selectionStart;
    if (start !== textarea.selectionEnd || isEditorCharacterEscaped(textarea.value, start)) {
      return false;
    }
    const previous = textarea.value[start - 1] || "";
    return (!previous || /\s/.test(previous)) && !isEditorLiteralContext(textarea.value, start);
  }

  function setupEditorPairCompletion(textarea) {
    const pairs = {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
      "\"": "\"",
      "'": "'",
      "`": "`",
      "$": "$"
    };
    const closingCharacters = new Set(Object.values(pairs));

    textarea.addEventListener("keydown", (event) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const source = textarea.value;

      if (event.key === "Backspace" && start === end && start > 0) {
        const opening = source[start - 1];
        const closing = source[start];
        if (pairs[opening] === closing && !isEditorCharacterEscaped(source, start - 1)) {
          event.preventDefault();
          textarea.setRangeText("", start - 1, start + 1, "end");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }

      if (start === end && closingCharacters.has(event.key) && source[start] === event.key && !isEditorCharacterEscaped(source, start)) {
        event.preventDefault();
        textarea.setSelectionRange(start + 1, start + 1);
        return;
      }

      const closing = pairs[event.key];
      if (!closing || isEditorCharacterEscaped(source, start)) {
        return;
      }
      if (event.key === "'" && /[\p{L}\p{N}_]/u.test(source[start - 1] || "")) {
        return;
      }

      event.preventDefault();
      const selectedText = source.slice(start, end);
      textarea.setRangeText(`${event.key}${selectedText}${closing}`, start, end, "start");
      if (selectedText) {
        textarea.setSelectionRange(start + 1, start + 1 + selectedText.length);
      } else {
        textarea.setSelectionRange(start + 1, start + 1);
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function loadEditorSnippets() {
    const response = await fetch(`/api/snippets?v=${Date.now()}`, { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error("Snippet 接口不可用，请重启 node preview-server.js");
    }
    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || "Snippet 加载失败");
    }
    return Array.isArray(result.snippets) ? result.snippets : [];
  }

  function parseSnippetTemplate(template) {
    const fields = [];
    let text = "";
    let cursor = 0;
    const source = String(template || "");
    const placeholderPattern = /\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g;

    source.replace(placeholderPattern, (match, bracedIndex, defaultValue, shortIndex, offset) => {
      text += source.slice(cursor, offset);
      const value = defaultValue || "";
      const start = text.length;
      text += value;
      fields.push({
        order: Number(bracedIndex ?? shortIndex),
        start,
        end: start + value.length
      });
      cursor = offset + match.length;
      return match;
    });
    text += source.slice(cursor);
    fields.sort((left, right) => {
      const leftOrder = left.order === 0 ? Number.MAX_SAFE_INTEGER : left.order;
      const rightOrder = right.order === 0 ? Number.MAX_SAFE_INTEGER : right.order;
      return leftOrder - rightOrder || left.start - right.start;
    });
    return { text, fields };
  }

  function selectEditorSnippetField(session, index) {
    const field = session.fields[index];
    if (!field) {
      activeEditorSnippetSession = null;
      return;
    }
    session.index = index;
    session.textarea.focus();
    session.textarea.setSelectionRange(field.start, field.end);
  }

  function advanceEditorSnippetField(backward = false) {
    const session = activeEditorSnippetSession;
    if (!session?.textarea?.isConnected) {
      activeEditorSnippetSession = null;
      return false;
    }

    const current = session.fields[session.index];
    if (current && session.textarea.selectionStart === session.textarea.selectionEnd) {
      const nextEnd = session.textarea.selectionStart;
      const delta = nextEnd - current.end;
      current.end = nextEnd;
      if (delta) {
        session.fields.forEach((field, index) => {
          if (index > session.index) {
            field.start += delta;
            field.end += delta;
          }
        });
      }
    }

    const nextIndex = session.index + (backward ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= session.fields.length) {
      activeEditorSnippetSession = null;
      return true;
    }
    selectEditorSnippetField(session, nextIndex);
    return true;
  }

  function insertEditorSnippet(textarea, snippet, start = textarea.selectionStart, end = textarea.selectionEnd) {
    const lineStart = textarea.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const indentation = textarea.value.slice(lineStart, start).match(/^\s*/)?.[0] || "";
    const indentedBody = String(snippet.body || "").replace(/\n/g, `\n${indentation}`);
    const parsed = parseSnippetTemplate(indentedBody);
    textarea.setRangeText(parsed.text, start, end, "start");

    const fields = parsed.fields.map((field) => ({
      ...field,
      start: start + field.start,
      end: start + field.end
    }));
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#markdown-editor-status").textContent = `已插入 Snippet：${snippet.name}`;

    if (fields.length) {
      activeEditorSnippetSession = { textarea, fields, index: 0 };
      selectEditorSnippetField(activeEditorSnippetSession, 0);
    } else {
      activeEditorSnippetSession = null;
      const cursor = start + parsed.text.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    }
  }

  function getSnippetPrefixAtCursor(textarea, snippets) {
    if (textarea.selectionStart !== textarea.selectionEnd) {
      return null;
    }
    const beforeCursor = textarea.value.slice(0, textarea.selectionStart);
    const match = beforeCursor.match(/;?[A-Za-z][\w-]*$/);
    if (!match) {
      return null;
    }
    const prefix = match[0].replace(/^;/, "").toLowerCase();
    const snippet = snippets.find((item) => item.prefixes.some((value) => value.toLowerCase() === prefix));
    return snippet ? { snippet, start: textarea.selectionStart - match[0].length } : null;
  }

  function getTextareaCaretRect(textarea, position = textarea.selectionStart) {
    const textareaRect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    const trailingText = document.createTextNode(textarea.value.slice(position) || " ");
    const copiedProperties = [
      "boxSizing",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "fontFamily", "fontSize", "fontStyle", "fontWeight", "letterSpacing",
      "lineHeight", "textAlign", "textIndent", "textTransform", "tabSize",
      "wordBreak", "wordSpacing", "overflowWrap", "direction", "writingMode",
      "scrollbarGutter"
    ];

    mirror.style.position = "fixed";
    mirror.style.left = `${textareaRect.left}px`;
    mirror.style.top = `${textareaRect.top}px`;
    mirror.style.width = `${textareaRect.width}px`;
    mirror.style.height = `${textareaRect.height}px`;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowX = computed.overflowX;
    mirror.style.overflowY = computed.overflowY;
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.style.zIndex = "-1";
    copiedProperties.forEach((property) => {
      mirror.style[property] = computed[property];
    });
    mirror.textContent = textarea.value.slice(0, position);
    marker.textContent = "\u2060";
    mirror.append(marker, trailingText);
    document.body.append(mirror);
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
    const markerRect = marker.getBoundingClientRect();
    const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.5;
    mirror.remove();
    return {
      left: markerRect.left,
      top: markerRect.top,
      bottom: markerRect.top + lineHeight
    };
  }

  function positionEditorSnippetPicker(textarea, picker) {
    if (picker.hidden) {
      return;
    }
    const caret = getTextareaCaretRect(textarea);
    const viewportMargin = 8;
    const preferredWidth = picker.classList.contains("is-inline") ? 340 : 400;
    const popupWidth = Math.min(preferredWidth, window.innerWidth - viewportMargin * 2);
    picker.style.width = `${popupWidth}px`;
    const popupHeight = Math.min(picker.offsetHeight || 320, window.innerHeight - viewportMargin * 2);
    const left = Math.min(
      Math.max(viewportMargin, caret.left),
      Math.max(viewportMargin, window.innerWidth - popupWidth - viewportMargin)
    );
    const below = caret.bottom + 7;
    const top = below + popupHeight <= window.innerHeight - viewportMargin
      ? below
      : Math.max(viewportMargin, caret.top - popupHeight - 7);
    picker.style.left = `${Math.round(left)}px`;
    picker.style.top = `${Math.round(top)}px`;
  }

  function getEditorSnippetScore(snippet, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return 0;
    }
    const prefixes = snippet.prefixes.map((value) => String(value).toLowerCase());
    if (prefixes.includes(normalizedQuery)) {
      return 0;
    }
    if (prefixes.some((value) => value.startsWith(normalizedQuery))) {
      return 1;
    }
    const name = String(snippet.name || "").toLowerCase();
    if (name.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) {
      return 2;
    }
    const metadata = [snippet.kind, snippet.name, snippet.description, ...snippet.prefixes].join(" ").toLowerCase();
    if (metadata.includes(normalizedQuery)) {
      return 3;
    }
    const body = String(snippet.body || "").replace(/\\/g, "").toLowerCase();
    if (body.includes(normalizedQuery)) {
      return 4;
    }
    const fuzzySource = `${metadata} ${body}`;
    let queryIndex = 0;
    for (const character of fuzzySource) {
      if (character === normalizedQuery[queryIndex]) {
        queryIndex += 1;
        if (queryIndex === normalizedQuery.length) {
          return 5;
        }
      }
    }
    return -1;
  }

  function setupEditorSnippets(textarea) {
    const button = document.querySelector("#markdown-editor-snippets");
    const picker = document.querySelector("#markdown-editor-snippet-picker");
    const searchInput = document.querySelector("#markdown-editor-snippet-search");
    const list = document.querySelector("#markdown-editor-snippet-list");
    let snippets = [];
    let filteredSnippets = [];
    let selectedIndex = 0;
    let insertionStart = textarea.selectionStart;
    let insertionEnd = textarea.selectionEnd;
    let loadingPromise = null;
    let inlineTrigger = false;

    const ensureLoaded = () => {
      if (!loadingPromise) {
        loadingPromise = loadEditorSnippets().then((items) => {
          snippets = items;
          return items;
        }).catch((error) => {
          loadingPromise = null;
          throw error;
        });
      }
      return loadingPromise;
    };

    const renderList = (query = "") => {
      filteredSnippets = snippets
        .map((snippet) => ({ snippet, score: getEditorSnippetScore(snippet, query) }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => left.score - right.score || left.snippet.name.localeCompare(right.snippet.name, "zh-CN"))
        .map((entry) => entry.snippet);
      if (inlineTrigger) {
        filteredSnippets = filteredSnippets.slice(0, 8);
      }
      selectedIndex = Math.min(selectedIndex, Math.max(0, filteredSnippets.length - 1));
      list.innerHTML = filteredSnippets.length
        ? filteredSnippets.map((snippet, index) => `
          <button class="markdown-editor-snippet-item${index === selectedIndex ? " is-active" : ""}" type="button" role="option" aria-selected="${String(index === selectedIndex)}" data-snippet-index="${index}">
            <span>
              <strong>${escapeHtml(snippet.name)}</strong>
              <small>${escapeHtml(snippet.description || snippet.source)}</small>
            </span>
            <code>${escapeHtml(snippet.kind || "Snippet")} · ${escapeHtml(snippet.prefixes.join(" / "))}</code>
          </button>
        `).join("")
        : '<p class="markdown-editor-snippet-empty">没有匹配的 Snippet</p>';
      requestAnimationFrame(() => positionEditorSnippetPicker(textarea, picker));
    };

    const closePicker = ({ focusEditor = true } = {}) => {
      picker.hidden = true;
      picker.classList.remove("is-inline");
      inlineTrigger = false;
      searchInput.value = "";
      if (focusEditor) {
        textarea.focus();
      }
    };

    const chooseSnippet = (index = selectedIndex) => {
      const snippet = filteredSnippets[index];
      if (!snippet) {
        return;
      }
      closePicker({ focusEditor: false });
      insertEditorSnippet(textarea, snippet, insertionStart, insertionEnd);
    };

    const openPicker = async (options = {}) => {
      insertionStart = options.start ?? textarea.selectionStart;
      insertionEnd = options.end ?? textarea.selectionEnd;
      inlineTrigger = Boolean(options.inline);
      selectedIndex = 0;
      searchInput.value = options.query || "";
      picker.hidden = false;
      picker.classList.toggle("is-inline", inlineTrigger);
      list.innerHTML = '<p class="markdown-editor-snippet-empty">正在加载 Snippet...</p>';
      positionEditorSnippetPicker(textarea, picker);
      if (inlineTrigger) {
        textarea.focus();
      } else {
        searchInput.focus();
      }
      try {
        await ensureLoaded();
        const currentQuery = inlineTrigger
          ? textarea.value.slice(insertionStart + 1, textarea.selectionStart)
          : searchInput.value;
        renderList(currentQuery);
      } catch (error) {
        list.innerHTML = `<p class="markdown-editor-snippet-empty is-error">${escapeHtml(error.message)}</p>`;
      }
    };

    button.addEventListener("click", () => openPicker());
    picker.querySelectorAll("[data-snippet-close]").forEach((element) => {
      element.addEventListener("click", () => closePicker());
    });
    searchInput.addEventListener("input", () => {
      selectedIndex = 0;
      renderList(searchInput.value);
    });
    list.addEventListener("click", (event) => {
      const item = event.target.closest("[data-snippet-index]");
      if (item) {
        chooseSnippet(Number(item.dataset.snippetIndex));
      }
    });
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        selectedIndex = (selectedIndex + direction + filteredSnippets.length) % Math.max(1, filteredSnippets.length);
        renderList(searchInput.value);
        list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        chooseSnippet();
      }
    });
    textarea.addEventListener("keydown", (event) => {
      if (!picker.hidden && inlineTrigger) {
        if (event.key === "Escape") {
          event.preventDefault();
          closePicker();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          selectedIndex = (selectedIndex + direction + filteredSnippets.length) % Math.max(1, filteredSnippets.length);
          renderList(textarea.value.slice(insertionStart + 1, textarea.selectionStart));
          list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
          return;
        }
        if ((event.key === "Enter" || event.key === "Tab") && filteredSnippets.length) {
          event.preventDefault();
          chooseSnippet();
          return;
        }
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && shouldOpenSnippetWithSlash(textarea)) {
        event.preventDefault();
        const triggerStart = textarea.selectionStart;
        textarea.setRangeText("/", triggerStart, textarea.selectionEnd, "end");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        openPicker({ start: triggerStart, end: triggerStart + 1, inline: true });
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      if (activeEditorSnippetSession?.textarea === textarea) {
        event.preventDefault();
        advanceEditorSnippetField(event.shiftKey);
        return;
      }
      const match = getSnippetPrefixAtCursor(textarea, snippets);
      if (match) {
        event.preventDefault();
        insertEditorSnippet(textarea, match.snippet, match.start, textarea.selectionStart);
      }
    });
    textarea.addEventListener("input", () => {
      const status = document.querySelector("#markdown-editor-status");
      if (!picker.hidden && inlineTrigger) {
        const cursor = textarea.selectionStart;
        const query = textarea.value.slice(insertionStart + 1, cursor);
        if (cursor < insertionStart + 1 || textarea.selectionStart !== textarea.selectionEnd || /[^A-Za-z0-9_-]/.test(query)) {
          closePicker({ focusEditor: false });
        } else {
          insertionEnd = cursor;
          selectedIndex = 0;
          renderList(query);
        }
      }
      const match = getSnippetPrefixAtCursor(textarea, snippets);
      if (match && !activeEditorSnippetSession) {
        status.textContent = `按 Tab 展开：${match.snippet.name}`;
      } else if (status.textContent.startsWith("按 Tab 展开：")) {
        status.textContent = "";
      }
    });
    textarea.addEventListener("scroll", () => positionEditorSnippetPicker(textarea, picker), { passive: true });
    textarea.addEventListener("pointerdown", () => {
      if (!picker.hidden && !inlineTrigger) {
        closePicker({ focusEditor: false });
      }
    });

    ensureLoaded().catch(() => {});
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

  function setupEditorResize(grid, divider, textarea) {
    const applyRatio = (ratio) => {
      const rect = grid.getBoundingClientRect();
      const dividerWidth = divider.offsetWidth;
      const availableWidth = Math.max(1, rect.width - dividerWidth);
      const minPaneWidth = Math.min(320, availableWidth / 2);
      const nextWidth = Math.min(
        Math.min(availableWidth - minPaneWidth, availableWidth * 0.8),
        Math.max(Math.max(minPaneWidth, availableWidth * 0.2), availableWidth * ratio)
      );
      grid.style.setProperty("--editor-input-size", `${nextWidth}px`);
      grid.dataset.editorRatio = String(nextWidth / availableWidth);
      divider.setAttribute("aria-valuenow", String(Math.round(nextWidth / availableWidth * 100)));
    };

    const updateWidth = (clientX) => {
      const rect = grid.getBoundingClientRect();
      const availableWidth = Math.max(1, rect.width - divider.offsetWidth);
      applyRatio((clientX - rect.left) / availableWidth);
    };

    const stopDragging = (event) => {
      document.body.classList.remove("is-resizing-editor");
      if (divider.hasPointerCapture?.(event.pointerId)) {
        divider.releasePointerCapture(event.pointerId);
      }
    };

    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      divider.setPointerCapture(event.pointerId);
      document.body.classList.add("is-resizing-editor");
      updateWidth(event.clientX);
    });
    divider.addEventListener("pointermove", (event) => {
      if (divider.hasPointerCapture?.(event.pointerId)) {
        updateWidth(event.clientX);
      }
    });
    divider.addEventListener("pointerup", stopDragging);
    divider.addEventListener("pointercancel", stopDragging);
    divider.addEventListener("dblclick", () => {
      grid.style.removeProperty("--editor-input-size");
      delete grid.dataset.editorRatio;
      divider.setAttribute("aria-valuenow", "50");
    });
    divider.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const currentEdge = textarea.getBoundingClientRect().right;
      updateWidth(currentEdge + (event.key === "ArrowLeft" ? -24 : 24));
    });

    if (typeof ResizeObserver === "function") {
      const resizeObserver = new ResizeObserver(() => {
        const ratio = Number(grid.dataset.editorRatio);
        if (ratio > 0 && grid.isConnected) {
          applyRatio(ratio);
        }
      });
      resizeObserver.observe(grid);
    }
  }

  async function renderEditorPreview(markdown) {
    const preview = document.querySelector("#markdown-editor-preview");
    if (!preview) {
      return;
    }

    preview.innerHTML = parseMarkdownWithMath(stripFrontmatter(markdown));
    applyInlineHighlights(preview);
    applyInlineTooltips(preview, await getTooltipGlossary());
    renderLatex(preview);
    preview.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
    decorateCodeBlocks(preview);
    await renderMermaidBlocks(preview);
  }

  async function readEditorApiResponse(response, fallbackMessage) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("当前预览服务不支持编辑接口，请使用 node preview-server.js 启动并重试");
    }

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || fallbackMessage);
    }
    return result;
  }

  async function saveEditorPost({ navigate = false } = {}) {
    const textarea = document.querySelector("#markdown-editor-input");
    const statusEl = document.querySelector("#markdown-editor-status");
    if (!textarea || !isLocalPreview || editorSaveInProgress) {
      return null;
    }

    editorSaveInProgress = true;
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
      const result = await readEditorApiResponse(response, "保存失败");

      statusEl.textContent = `已保存到 ${result.file}`;
      await reloadEditorPostData();
      const tab = tabs[getTabFromEditor(markdown)] ? getTabFromEditor(markdown) : "articles";
      textarea.dataset.savedValue = markdown;
      textarea.dataset.slug = result.slug;
      textarea.dataset.mode = "update";
      const deleteButton = document.querySelector("#markdown-editor-delete");
      if (deleteButton) {
        deleteButton.hidden = false;
      }
      if (navigate) {
        setHash(tab, result.slug);
      }
      return result;
    } catch (error) {
      statusEl.textContent = error.message || "保存失败";
      return null;
    } finally {
      editorSaveInProgress = false;
    }
  }

  async function deleteEditorPost() {
    const textarea = document.querySelector("#markdown-editor-input");
    const statusEl = document.querySelector("#markdown-editor-status");
    if (!textarea || textarea.dataset.mode !== "update" || editorSaveInProgress) {
      return;
    }

    const slug = textarea.dataset.slug;
    const title = getTitleFromMarkdown(textarea.value);
    if (!window.confirm(`确定删除“${title}”吗？此操作无法撤销。`)) {
      return;
    }

    editorSaveInProgress = true;
    statusEl.textContent = "删除中...";
    try {
      const response = await fetch("/api/delete-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });
      await readEditorApiResponse(response, "删除失败");
      await reloadEditorPostData();
      textarea.dataset.savedValue = textarea.value;
      const returnTab = tabs[getTabFromEditor(textarea.value)] ? getTabFromEditor(textarea.value) : "articles";
      setHash(returnTab);
    } catch (error) {
      statusEl.textContent = error.message || "删除失败";
    } finally {
      editorSaveInProgress = false;
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
      const result = await readEditorApiResponse(response, "格式化失败");

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

  async function openEditorReadingView() {
    const textarea = document.querySelector("#markdown-editor-input");
    if (!textarea) {
      return;
    }

    const needsSave = textarea.dataset.mode === "create" || textarea.value !== textarea.dataset.savedValue;
    if (needsSave) {
      const shouldSave = window.confirm("进入阅读模式前需要保存当前内容。是否保存并继续？");
      if (!shouldSave) {
        return;
      }
      const result = await saveEditorPost();
      if (!result) {
        return;
      }
    }

    const tab = tabs[getTabFromEditor(textarea.value)] ? getTabFromEditor(textarea.value) : "articles";
    setHash(tab, textarea.dataset.slug);
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

    const post = slug ? getPosts().find((item) => item.slug === slug) : null;
    let markdown = getEditorTemplate();
    if (post) {
      const response = await fetch(post.file);
      if (response.ok) {
        markdown = await response.text();
      }
    }
    backButtonEl.dataset.editorReturnTab = post?.tab || getTabFromEditor(markdown);
    const isDraft = getDraftFromEditor(markdown);

    articleContentEl.innerHTML = `
      <section class="markdown-editor">
        <div class="markdown-editor-toolbar">
          <div>
            <p class="section-kicker">Local Editor</p>
            <h2>${post ? `编辑：${escapeHtml(post.title)}` : "新建 Markdown"}</h2>
          </div>
          <div class="markdown-editor-actions">
            <span id="markdown-editor-status" aria-live="polite"></span>
            <div class="markdown-editor-draft-control">
              <span>发布状态</span>
              <div class="markdown-editor-draft-options" role="group" aria-label="发布状态">
                <button class="markdown-editor-draft-option${isDraft ? "" : " is-active"}" type="button" data-draft-value="false" aria-pressed="${String(!isDraft)}">公开</button>
                <button class="markdown-editor-draft-option${isDraft ? " is-active" : ""}" type="button" data-draft-value="true" aria-pressed="${String(isDraft)}">草稿</button>
              </div>
            </div>
            <button id="markdown-editor-format" class="markdown-editor-icon-button" type="button" aria-label="格式化" title="格式化">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 7h10"></path>
                <path d="M4 12h16"></path>
                <path d="M4 17h8"></path>
                <path d="m17 6 3 3-3 3"></path>
              </svg>
            </button>
            <button id="markdown-editor-snippets" class="markdown-editor-secondary-button" type="button" title="Snippet（Ctrl/Command + Shift + P）">Snippet</button>
            <button id="markdown-editor-preview-toggle" class="markdown-editor-secondary-button" type="button" aria-pressed="true">隐藏预览</button>
            <button id="markdown-editor-read" class="markdown-editor-secondary-button" type="button">阅读模式</button>
            <button id="markdown-editor-exit" class="markdown-editor-secondary-button" type="button">返回归档列表</button>
            <button id="markdown-editor-delete" class="markdown-editor-danger-button" type="button"${post ? "" : " hidden"}>删除</button>
            <button id="markdown-editor-save" type="button">保存</button>
          </div>
        </div>
        <div id="markdown-editor-snippet-picker" class="markdown-editor-snippet-picker" hidden>
          <section class="markdown-editor-snippet-dialog" role="dialog" aria-labelledby="markdown-editor-snippet-title">
            <header>
              <div>
                <p class="section-kicker">Insert</p>
                <h3 id="markdown-editor-snippet-title">选择 Snippet</h3>
              </div>
              <button class="markdown-editor-snippet-close" type="button" aria-label="关闭" data-snippet-close>×</button>
            </header>
            <input id="markdown-editor-snippet-search" type="search" placeholder="搜索名称或前缀，例如 align" autocomplete="off">
            <div id="markdown-editor-snippet-list" class="markdown-editor-snippet-list" role="listbox"></div>
            <footer><span>↑↓ 选择 · Enter 插入 · Esc 关闭</span><kbd>Ctrl/⌘ Shift P</kbd></footer>
          </section>
        </div>
        <div class="markdown-editor-grid is-preview-visible">
          <textarea id="markdown-editor-input" spellcheck="false"></textarea>
          <div id="markdown-editor-resizer" class="markdown-editor-resizer" role="separator" aria-label="调整编辑区和预览区宽度" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" tabindex="0"></div>
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
    const editorGrid = document.querySelector(".markdown-editor-grid");
    const editorResizer = document.querySelector("#markdown-editor-resizer");
    setupEditorScrollSync(textarea, preview);
    setupEditorResize(editorGrid, editorResizer, textarea);
    setupEditorPairCompletion(textarea);
    setupEditorSnippets(textarea);

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
    document.querySelectorAll("[data-draft-value]").forEach((button) => {
      button.addEventListener("click", async () => {
        const nextIsDraft = button.dataset.draftValue === "true";
        if (nextIsDraft === getDraftFromEditor(textarea.value)) {
          return;
        }
        textarea.value = setEditorDraft(textarea.value, nextIsDraft);
        document.querySelectorAll("[data-draft-value]").forEach((option) => {
          const isActive = option === button;
          option.classList.toggle("is-active", isActive);
          option.setAttribute("aria-pressed", String(isActive));
        });
        document.querySelector("#markdown-editor-status").textContent = nextIsDraft ? "已设为草稿，尚未保存" : "已设为公开，尚未保存";
        await renderEditorPreview(textarea.value);
      });
    });
    document.querySelector("#markdown-editor-preview-toggle").addEventListener("click", (event) => {
      const grid = document.querySelector(".markdown-editor-grid");
      const isVisible = grid.classList.toggle("is-preview-visible");
      event.currentTarget.setAttribute("aria-pressed", String(isVisible));
      event.currentTarget.textContent = isVisible ? "隐藏预览" : "显示预览";
    });
    document.querySelector("#markdown-editor-save").addEventListener("click", saveEditorPost);
    document.querySelector("#markdown-editor-delete").addEventListener("click", deleteEditorPost);
    document.querySelector("#markdown-editor-read").addEventListener("click", openEditorReadingView);
    document.querySelector("#markdown-editor-exit").addEventListener("click", exitMarkdownEditor);
    await renderEditorPreview(markdown);
  }

  return { showMarkdownEditor, exitMarkdownEditor, saveEditorPost };
}
