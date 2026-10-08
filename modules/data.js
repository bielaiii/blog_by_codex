const paths = {
  tooltipGlossary: 'posts/tooltips.json', skills: 'data/skills.json', siteConfig: 'data/site-config.json',
  catalog: 'data/catalog.json', tagStyles: 'data/tag-styles.json', highlightStyles: 'data/highlight-styles.json'
};

export function createDataStore(getFallbackSiteConfig) {
  const cache = new Map();
  const fallbacks = {
    tooltipGlossary: () => ({}), skills: () => ({ weightRange: { min: 1, max: 10 }, skills: [] }),
    siteConfig: getFallbackSiteConfig, tagStyles: () => ({}), highlightStyles: () => ({})
  };
  function load(key) {
    if (!cache.has(key)) {
      const task = (async () => {
        try {
          const response = await fetch(paths[key]);
          if (!response.ok) throw new Error(`无法加载 ${paths[key]}`);
          const value = await response.json();
          if (key === 'catalog' && (!Array.isArray(value.posts) || !value.postMetadata || !value.searchText)) throw new Error('文章索引格式错误');
          return value;
        } catch (error) {
          cache.delete(key);
          if (fallbacks[key]) return fallbacks[key]();
          throw error;
        }
      })();
      cache.set(key, task);
    }
    return cache.get(key);
  }
  function setCatalog(catalog) { cache.set('catalog', Promise.resolve(catalog)); return catalog; }
  async function reloadPosts(catalog) {
    if (catalog) return setCatalog(catalog);
    const response = await fetch(`${paths.catalog}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('文章列表刷新失败');
    return setCatalog(await response.json());
  }
  return {
    getTooltipGlossary: () => load('tooltipGlossary'), getSkillsConfig: () => load('skills'),
    getSiteConfig: () => load('siteConfig'), getCatalog: () => load('catalog'),
    getTagStyles: () => load('tagStyles'), getHighlightStyles: () => load('highlightStyles'), reloadPosts
  };
}
