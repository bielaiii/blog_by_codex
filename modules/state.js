export function createAppState(tabs) {
  return {
    lastState: { tab: "welcome", slug: "" }, pendingRestoreTab: "", syncViewRun: 0,
    tagFilterTouched: false, activeArticleTags: new Set(), articleSearchQuery: "",
    listScrollPositions: Object.fromEntries(Object.keys(tabs).map(tab => [tab, 0])),
    archivePageByTab: Object.fromEntries(Object.keys(tabs).map(tab => [tab, 1]))
  };
}
