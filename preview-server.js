const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const root = __dirname;
const postsDir = path.join(root, 'posts');
const snippetsDir = path.join(root, 'snippets');
const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || '127.0.0.1';
const lanEditor = process.env.BLOG_LAN_EDITOR === 'true';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

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

function handleListSnippets(req, res) {
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
    sendJson(res, 200, { ok: true, snippets, warnings });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Failed to load snippets' });
  }
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-post';
}

function uniqueSlug(slug) {
  let candidate = slug;
  let index = 2;
  while (fs.existsSync(path.join(postsDir, `${candidate}.md`))) {
    candidate = `${slug}-${index}`;
    index += 1;
  }
  return candidate;
}

function runGenerators(callback) {
  const env = { ...process.env, INCLUDE_DRAFTS: 'true' };
  execFile('node', ['scripts/generate-posts.js'], { cwd: root, env }, (postsErr) => {
    if (postsErr) {
      callback(postsErr);
      return;
    }
    execFile('node', ['scripts/generate-post-metadata.js'], { cwd: root }, callback);
  });
}

function handleDeletePost(req, res) {
  readRequestBody(req, (bodyErr, body) => {
    if (bodyErr) {
      sendJson(res, 400, { error: 'Failed to read request body' });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    const slug = toSlug(payload.slug);
    const filePath = path.join(postsDir, `${slug}.md`);
    if (!payload.slug || !filePath.startsWith(postsDir)) {
      sendJson(res, 403, { error: 'Forbidden path' });
      return;
    }

    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        sendJson(res, unlinkErr.code === 'ENOENT' ? 404 : 500, {
          error: unlinkErr.code === 'ENOENT' ? 'Post not found' : 'Failed to delete post'
        });
        return;
      }

      runGenerators((generatorErr) => {
        if (generatorErr) {
          sendJson(res, 500, { error: 'Post deleted, but metadata generation failed' });
          return;
        }
        sendJson(res, 200, { ok: true, slug });
      });
    });
  });
}

function readRequestBody(req, callback) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.destroy();
    }
  });
  req.on('end', () => callback(null, body));
  req.on('error', callback);
}

function trimMarkdownWhitespace(markdown) {
  const normalized = String(markdown || '').replace(/\r\n?/g, '\n');
  return `${normalized.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n').replace(/\n*$/g, '')}\n`;
}

function normalizeBlogMarkers(markdown) {
  return String(markdown || '')
    .replace(/\n{0,2}(<!--\s*(?:row|column)\s*-->)\n{0,2}/g, '\n\n$1\n\n')
    .replace(/^\n+/, '')
    .replace(/\n*$/g, '\n');
}

function getClangFilename(language) {
  const lang = String(language || '').trim().toLowerCase();
  if (['cu', 'cuda'].includes(lang)) {
    return 'snippet.cu';
  }
  if (['cpp', 'c++', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'h'].includes(lang)) {
    return ['hpp', 'hh', 'hxx', 'h'].includes(lang) ? 'snippet.hpp' : 'snippet.cpp';
  }
  return '';
}

function clangFormat(code, filename) {
  return new Promise((resolve, reject) => {
    const child = spawn('clang-format', [`--assume-filename=${filename}`], { cwd: root });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.replace(/\n*$/g, '\n'));
        return;
      }
      reject(new Error(stderr || `clang-format exited with ${code}`));
    });
    child.stdin.end(code);
  });
}

async function formatFencedCodeBlocks(markdown) {
  const lines = String(markdown || '').split('\n');
  const output = [];
  const warnings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^(\s*)(`{3,}|~{3,})([^`]*)$/);
    if (!opening) {
      output.push(lines[index]);
      continue;
    }

    const indent = opening[1];
    const fence = opening[2];
    const marker = fence[0];
    const fenceLength = fence.length;
    const info = opening[3] || '';
    const language = info.trim().split(/\s+/)[0] || '';
    const closePattern = new RegExp(`^${indent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${marker}{${fenceLength},}\\s*$`);
    const codeLines = [];
    let closeLine = '';
    let closeIndex = index + 1;

    while (closeIndex < lines.length) {
      if (closePattern.test(lines[closeIndex])) {
        closeLine = lines[closeIndex];
        break;
      }
      codeLines.push(lines[closeIndex]);
      closeIndex += 1;
    }

    if (!closeLine) {
      output.push(lines[index], ...codeLines);
      index = closeIndex - 1;
      continue;
    }

    output.push(lines[index]);
    const filename = getClangFilename(language);
    if (!filename) {
      output.push(...codeLines);
    } else {
      const source = `${codeLines.join('\n').replace(/\n*$/g, '')}\n`;
      try {
        const formatted = await clangFormat(source, filename);
        output.push(...formatted.replace(/\n*$/g, '').split('\n'));
      } catch (error) {
        warnings.push(`Skipped ${language || 'code'} block near line ${index + 1}: ${error.message}`);
        output.push(...codeLines);
      }
    }
    output.push(closeLine);
    index = closeIndex;
  }

  return {
    markdown: output.join('\n'),
    warnings
  };
}

async function formatMarkdown(markdown) {
  const trimmed = normalizeBlogMarkers(trimMarkdownWhitespace(markdown));
  const result = await formatFencedCodeBlocks(trimmed);
  return {
    markdown: normalizeBlogMarkers(trimMarkdownWhitespace(result.markdown)),
    warnings: result.warnings
  };
}

function handleFormatPost(req, res) {
  readRequestBody(req, async (bodyErr, body) => {
    if (bodyErr) {
      sendJson(res, 400, { error: 'Failed to read request body' });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    try {
      const result = await formatMarkdown(String(payload.markdown || ''));
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Failed to format markdown' });
    }
  });
}

function handleSavePost(req, res) {
  readRequestBody(req, (bodyErr, body) => {
    if (bodyErr) {
      sendJson(res, 400, { error: 'Failed to read request body' });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
      return;
    }

    const markdown = String(payload.markdown || '');
    if (!markdown.trim()) {
      sendJson(res, 400, { error: 'Markdown is empty' });
      return;
    }

    const requestedSlug = toSlug(payload.slug || payload.title || 'new-post');
    const slug = payload.mode === 'create' ? uniqueSlug(requestedSlug) : requestedSlug;
    const filePath = path.join(postsDir, `${slug}.md`);
    if (!filePath.startsWith(postsDir)) {
      sendJson(res, 403, { error: 'Forbidden path' });
      return;
    }

    fs.mkdir(postsDir, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) {
        sendJson(res, 500, { error: 'Failed to create posts directory' });
        return;
      }

      fs.writeFile(filePath, markdown, 'utf8', (writeErr) => {
        if (writeErr) {
          sendJson(res, 500, { error: 'Failed to write post file' });
          return;
        }

        runGenerators((generatorErr) => {
          if (generatorErr) {
            sendJson(res, 500, { error: 'Post saved, but metadata generation failed' });
            return;
          }
          sendJson(res, 200, { ok: true, slug, file: `posts/${slug}.md` });
        });
      });
    });
  });
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && route === '/api/preview-config') {
    sendJson(res, 200, { localEditor: lanEditor });
    return;
  }
  if (req.method === 'POST' && route.startsWith('/api/')) {
    if (req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      sendJson(res, 403, { error: 'Cross-origin editing is not allowed' });
      return;
    }
  }
  if (req.method === 'GET' && (req.url || '').split('?')[0] === '/api/snippets') {
    handleListSnippets(req, res);
    return;
  }

  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/format-post') {
    handleFormatPost(req, res);
    return;
  }

  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/save-post') {
    handleSavePost(req, res);
    return;
  }

  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/delete-post') {
    handleDeletePost(req, res);
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(route);
  } catch {
    sendJson(res, 400, { error: 'Invalid URL' });
    return;
  }
  if (requestPath.split(/[\\/]/).some(segment => segment.startsWith('.'))) {
    sendJson(res, 403, { error: 'Private project files are not served' });
    return;
  }
  const normalized = path.normalize(requestPath).replace(/^([.][.][\\/])+/, '');
  let filePath = path.join(root, normalized === '\\' || normalized === '/' ? 'index.html' : normalized);
  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (statErr, stat) => {
    if (!statErr && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      });
      res.end(data);
    });
  });
});
runGenerators((generatorErr) => {
  if (generatorErr) {
    console.error(`Failed to prepare local post list: ${generatorErr.message}`);
    process.exitCode = 1;
    return;
  }

  server.listen(port, host, () => {
    console.log(`Preview server running at http://${host}:${port}`);
  });
});
