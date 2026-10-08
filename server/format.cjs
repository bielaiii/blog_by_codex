const { spawn } = require('node:child_process');
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
    const child = spawn('clang-format', [`--assume-filename=${filename}`], { timeout: 10000 });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.stdin.on('error', reject);
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

module.exports = { formatMarkdown };
