import fs from "node:fs";
import path from "node:path";
import { buildCatalog, withContentLock, safeFile, writeCatalog } from "./content.mjs";
import { collectAssets } from "./assets.mjs";

export async function buildSite(root, output) {
  root = path.resolve(root);
  output = output && path.resolve(output);
  if (!output || output === root || output.startsWith(`${root}${path.sep}`)) throw new Error("Provide an output directory outside the repository");
  if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error(`Output directory is not empty: ${output}`);
  return withContentLock(root, () => {
    // Build from source even when the working tree's generated index contains drafts.
    const catalog = buildCatalog(root);
    const resources = collectAssets(root, catalog.posts);
    const files = new Set(["index.html", "styles.css", "app.js", "data/site-config.json", "data/skills.json", "data/tag-styles.json", "data/highlight-styles.json", "posts/tooltips.json", ...catalog.posts.map(post => post.file), ...resources]);
    function walk(directory) {
      for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const relative = `${directory}/${entry.name}`;
        if (entry.isDirectory()) walk(relative);
        else if (entry.isFile()) files.add(relative);
        else throw new Error(`Unsupported site resource: ${relative}`);
      }
    }
    ["modules", "shared", "vendor"].forEach(walk);
    const staged = `${output}.stage-${process.pid}`;
    if (fs.existsSync(staged)) throw new Error(`Staging directory already exists: ${staged}`);
    try {
      fs.mkdirSync(staged, { recursive: true });
      for (const file of files) {
        const destination = path.join(staged, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(safeFile(root, file), destination);
      }
      writeCatalog(staged, catalog);
      if (fs.existsSync(output)) fs.rmdirSync(output);
      fs.renameSync(staged, output);
    } finally { fs.rmSync(staged, { recursive: true, force: true }); }
    return catalog;
  });
}
