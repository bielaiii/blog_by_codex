export function setupEditorAccess(capabilities, onUnlocked) {
  if (capabilities.localEditor || !capabilities.canUnlock) return;
  const form = document.createElement("form");
  form.className = "editor-access";
  form.innerHTML = `<label>编辑口令 <input type="password" required autocomplete="current-password" aria-label="编辑口令"></label>
    <button type="submit">解锁编辑</button><span role="status"></span>`;
  document.querySelector(".tabs-wrap").append(form);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const status = form.querySelector("[role=status]");
    try {
      const response = await fetch("/api/editor-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.querySelector("input").value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      await onUnlocked();
      form.remove();
    } catch (error) { status.textContent = error.message; }
  });
}
