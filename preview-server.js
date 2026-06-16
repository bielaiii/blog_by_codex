const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const root = __dirname;
const postsDir = path.join(root, 'posts');
const port = Number(process.env.PORT) || 8000;
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
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
  execFile('node', ['scripts/generate-posts.js'], { cwd: root }, (postsErr) => {
    if (postsErr) {
      callback(postsErr);
      return;
    }
    execFile('node', ['scripts/generate-post-metadata.js'], { cwd: root }, callback);
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
  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/format-post') {
    handleFormatPost(req, res);
    return;
  }

  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/api/save-post') {
    handleSavePost(req, res);
    return;
  }

  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
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
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Preview server running at http://127.0.0.1:${port}`);
});
