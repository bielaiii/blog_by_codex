const path = require('node:path');
(async () => {
  const { serializePost } = await import('../shared/post-model.mjs');
  const { createPostService } = await import('./lib/post-service.mjs');
  const args = { title: '', tab: 'articles', tags: [], layout: 'single', draft: false };
  const words = [];
  const input = process.argv.slice(2);
  for (let index = 0; index < input.length; index++) {
    const flag = input[index];
    if (flag === '--draft') args.draft = true;
    else if (['--tab', '--tags', '--layout', '--slug'].includes(flag)) {
      const value = input[++index];
      if (!value) throw new Error(`Missing value for ${flag}`);
      args[flag.slice(2)] = flag === '--tags' ? value.split(',').map(tag => tag.trim()).filter(Boolean) : value;
    } else if (flag.startsWith('--')) throw new Error(`Unknown option: ${flag}`);
    else words.push(flag);
  }
  args.title = words.join(' ').trim();
  if (!args.title) throw new Error('Usage: node scripts/new-post.js "文章标题" [--draft] [--tags CUDA,Scan] [--layout single|two-column] [--tab articles|projects]');
  const { slug, ...metadata } = args;
  const markdown = serializePost({ ...metadata, date: new Date().toISOString().slice(0, 10), summary: '' }, `# ${args.title}\n\n`);
  const result = await createPostService(path.resolve(__dirname, '..'), { includeDrafts: args.draft || process.env.INCLUDE_DRAFTS === 'true' }).save({ mode: 'create', slug, markdown });
  console.log(`Created ${result.file}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
