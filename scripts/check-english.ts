import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRECTORIES = new Set([".git", "dist", "node_modules"]);
const TEXT_FILE_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".txt",
  ".yml",
  ".yaml",
  ".gitignore",
]);
const CJK_PATTERN = /[\p{Script=Han}]/u;

const violations: string[] = [];

walk(ROOT);

if (violations.length > 0) {
  console.error("English-only check failed. Remove CJK characters from the files below:");

  for (const violation of violations) {
    console.error(`- ${violation}`);
  }

  process.exit(1);
}

console.log("English-only check passed.");

function walk(directory: string): void {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry)) {
        walk(absolutePath);
      }

      continue;
    }

    if (!shouldScan(entry)) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (CJK_PATTERN.test(line)) {
        violations.push(`${relative(ROOT, absolutePath)}:${index + 1}`);
      }
    }
  }
}

function shouldScan(filename: string): boolean {
  if (filename === ".gitignore") {
    return true;
  }

  return Array.from(TEXT_FILE_EXTENSIONS).some((extension) => filename.endsWith(extension));
}
