const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "posts");
const outputPath = path.join(root, "data", "post-metadata.json");

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch (error) {
    return "";
  }
}

function getPostDates(relativePath) {
  const log = runGit(["log", "--follow", "--format=%aI", "--", relativePath]);
  const dates = log.split(/\r?\n/).filter(Boolean);
  const fallback = new Date().toISOString();

  return {
    createdAt: dates.at(-1) || fallback,
    updatedAt: dates[0] || fallback
  };
}

const metadata = {};

for (const fileName of fs.readdirSync(postsDir).sort()) {
  if (!fileName.endsWith(".md")) {
    continue;
  }

  const slug = path.basename(fileName, ".md");
  const relativePath = path.posix.join("posts", fileName);
  metadata[slug] = {
    file: relativePath,
    ...getPostDates(relativePath)
  };
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outputPath)}`);
