const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = process.argv[2] && path.resolve(process.argv[2]);

if (!output || output === root || output.startsWith(`${root}${path.sep}`)) {
  throw new Error("Provide an output directory outside the repository");
}
if (fs.existsSync(output) && fs.readdirSync(output).length) {
  throw new Error(`Output directory is not empty: ${output}`);
}

function copy(relativePath) {
  const source = path.resolve(root, relativePath);
  if (!source.startsWith(`${root}${path.sep}`) || !fs.statSync(source).isFile()) {
    throw new Error(`Invalid site file: ${relativePath}`);
  }
  const destination = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const posts = JSON.parse(fs.readFileSync(path.join(root, "data/posts.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(root, "data/post-metadata.json"), "utf8"));
const siteConfig = JSON.parse(fs.readFileSync(path.join(root, "data/site-config.json"), "utf8"));
const publishDrafts = siteConfig.publishDrafts === true;

for (const post of posts) {
  if ((post.draft && !publishDrafts) || post.hidden || post.visible === false || !post.file?.startsWith("posts/")) {
    throw new Error(`Cannot publish post: ${post.slug}`);
  }
}

[
  "index.html",
  "styles.css",
  "app.js",
  "modules/data.js",
  "modules/editor.js",
  "modules/markdown.js",
  "data/posts.json",
  "data/site-config.json",
  "data/skills.json",
  "data/tag-styles.json",
  "data/highlight-styles.json",
  "posts/tooltips.json"
].forEach(copy);

function copyVendorFiles(directory = "vendor") {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      copyVendorFiles(relativePath);
    } else if (entry.isFile()) {
      copy(relativePath);
    }
  }
}

copyVendorFiles();

for (const post of posts) {
  copy(post.file);
}

const publicMetadata = Object.fromEntries(
  posts.filter((post) => Object.hasOwn(metadata, post.slug)).map((post) => [post.slug, metadata[post.slug]])
);
fs.writeFileSync(path.join(output, "data/post-metadata.json"), `${JSON.stringify(publicMetadata, null, 2)}\n`);

console.log(`Built public site with ${posts.length} posts at ${output}`);
