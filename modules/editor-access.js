export function setupEditorAccess(capabilities, onUnlocked) {
  if (capabilities.localEditor || !capabilities.canUnlock) return;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "editor-access-trigger";
  trigger.setAttribute("aria-label", "进入编辑模式");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "editor-access-dialog");
  trigger.title = "进入编辑模式";
  trigger.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15Z"></path></svg>`;
  const dialog = document.createElement("dialog");
  dialog.id = "editor-access-dialog";
  dialog.className = "editor-access-dialog";
  dialog.setAttribute("aria-labelledby", "editor-access-title");
  dialog.setAttribute("aria-describedby", "editor-access-description");
  const form = document.createElement("form");
  form.className = "editor-access";
  form.innerHTML = `<button class="editor-access-close" type="button" aria-label="关闭"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
    <p class="section-kicker">Write</p>
    <h2 id="editor-access-title">进入编辑模式</h2>
    <p id="editor-access-description">验证后，即可创建和修改文章。</p>
    <label for="editor-access-token">编辑口令</label>
    <input id="editor-access-token" type="password" required autocomplete="current-password" placeholder="输入编辑口令" autofocus aria-describedby="editor-access-status">
    <p id="editor-access-status" role="status"></p>
    <button class="editor-access-submit" type="submit">开始编辑</button>`;
  dialog.append(form);
  document.querySelector(".topbar").append(trigger);
  document.body.append(dialog);
  document.body.classList.add("has-editor-access");
  const status = form.querySelector("[role=status]");
  const submit = form.querySelector("[type=submit]");
  trigger.addEventListener("click", () => dialog.showModal());
  form.querySelector(".editor-access-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    form.reset();
    status.textContent = "";
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    submit.textContent = "正在验证…";
    status.textContent = "";
    try {
      const response = await fetch("/api/editor-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.querySelector("input").value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      await onUnlocked();
      dialog.close();
      trigger.remove();
      dialog.remove();
      document.body.classList.remove("has-editor-access");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = "开始编辑";
    }
  });
}
