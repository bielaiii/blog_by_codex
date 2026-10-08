const fs = require('node:fs');
const path = require('node:path');
module.exports = function listSnippets(snippetsDir) {
function collectSnippetFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSnippetFiles(entryPath);
    }
    return entry.isFile() && path.extname(entry.name).toLowerCase() === '.json' ? [entryPath] : [];
  });
}

function load() {
  const snippets = [];
  const warnings = [];

  try {
    for (const filePath of collectSnippetFiles(snippetsDir)) {
      const source = path.relative(snippetsDir, filePath).split(path.sep).join('/');
      let definitions;
      try {
        definitions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        warnings.push(`${source}: ${error.message}`);
        continue;
      }

      for (const [name, definition] of Object.entries(definitions || {})) {
        const prefixes = (Array.isArray(definition?.prefix) ? definition.prefix : [definition?.prefix])
          .map((prefix) => String(prefix || '').trim())
          .filter(Boolean);
        const body = Array.isArray(definition?.body)
          ? definition.body.map((line) => String(line)).join('\n')
          : String(definition?.body || '');
        if (!prefixes.length || !body) {
          warnings.push(`${source}: “${name}” 缺少 prefix 或 body`);
          continue;
        }
        snippets.push({
          id: `${source}:${name}`,
          name,
          kind: String(definition?.kind || 'Snippet'),
          prefixes,
          description: String(definition?.description || ''),
          body,
          source
        });
      }
    }

    snippets.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    return { ok: true, snippets, warnings };
  } catch (error) {
    throw error;
  }
}

return load();
};
