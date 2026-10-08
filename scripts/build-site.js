const path = require('node:path');
import('./lib/build-site.mjs').then(async ({ buildSite }) => {
  const catalog = await buildSite(path.resolve(__dirname, '..'), process.argv[2]);
  console.log(`Built public site with ${catalog.posts.length} posts at ${process.argv[2]}`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
