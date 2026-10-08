import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCatalog } from "./content.mjs";

export async function generate() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const catalog = await generateCatalog(root, { includeDrafts: process.env.INCLUDE_DRAFTS === "true" });
  console.log(`Generated content catalog with ${catalog.posts.length} posts`);
}
