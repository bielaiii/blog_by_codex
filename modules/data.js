const paths = {
  tooltipGlossary: "posts/tooltips.json",
  skills: "data/skills.json",
  siteConfig: "data/site-config.json",
  posts: "data/posts.json",
  postMetadata: "data/post-metadata.json",
  tagStyles: "data/tag-styles.json",
  highlightStyles: "data/highlight-styles.json"
};

export function createDataStore(getFallbackPosts, getFallbackSiteConfig) {
  const cache = new Map();
  const fallbacks = {
    tooltipGlossary: () => ({}),
    skills: () => ({ weightRange: { min: 1, max: 10 }, skills: [] }),
    siteConfig: getFallbackSiteConfig,
    posts: getFallbackPosts,
    postMetadata: () => ({}),
    tagStyles: () => ({}),
    highlightStyles: () => ({})
  };

  function load(key) {
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        try {
          const response = await fetch(paths[key]);
          return response.ok ? await response.json() : fallbacks[key]();
        } catch (error) {
          return fallbacks[key]();
        }
      })());
    }
    return cache.get(key);
  }

  async function reloadPosts() {
    cache.delete("posts");
    cache.delete("postMetadata");
    const cacheBuster = Date.now();
    const [postsResponse, metadataResponse] = await Promise.all([
      fetch(`${paths.posts}?v=${cacheBuster}`, { cache: "no-store" }),
      fetch(`${paths.postMetadata}?v=${cacheBuster}`, { cache: "no-store" })
    ]);
    if (!postsResponse.ok || !metadataResponse.ok) {
      throw new Error("文章已写入，但列表数据刷新失败");
    }
    return {
      posts: await postsResponse.json(),
      postMetadata: await metadataResponse.json()
    };
  }

  return {
    getTooltipGlossary: () => load("tooltipGlossary"),
    getSkillsConfig: () => load("skills"),
    getSiteConfig: () => load("siteConfig"),
    getPostsConfig: () => load("posts"),
    getPostMetadata: () => load("postMetadata"),
    getTagStyles: () => load("tagStyles"),
    getHighlightStyles: () => load("highlightStyles"),
    reloadPosts
  };
}
