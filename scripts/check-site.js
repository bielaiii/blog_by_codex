const path = require('node:path');
import('./lib/check-content.mjs').then(({ checkContent }) => {
  const catalog = checkContent(path.resolve(__dirname, '..'));
  console.log(`Checked ${catalog.posts.length} posts and their local resources`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
