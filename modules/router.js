export function createRouter({ canEdit, beforeNavigate = () => true }) {
  function read() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const tab = params.get("tab") || "welcome";
    return { tab: ["resume", "articles", "projects", "welcome"].includes(tab) || (tab === "editor" && canEdit()) ? tab : "welcome", slug: params.get("post") || "" };
  }
  function navigate(tab, slug = "") {
    const params = new URLSearchParams({ tab });
    if (slug) params.set("post", slug);
    const next = params.toString();
    if (location.hash.slice(1) !== next && beforeNavigate()) location.hash = next;
  }
  return { read, navigate };
}
