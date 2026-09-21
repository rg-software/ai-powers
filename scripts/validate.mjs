#!/usr/bin/env node
// Validates ai-powers content. Dependency-free; run from the repo root:
//   node scripts/validate.mjs
//
// Checks every skill's frontmatter against the rules opencode enforces, and
// that every command carries a description. This is what stops a broken skill
// from reaching `main` and, from there, every consuming project's CI.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const errors = [];

function frontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  return text.slice(3, end);
}

function field(fm, key) {
  const match = fm.match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  return match ? match[1].trim() : undefined;
}

function rel(p) {
  return relative(root, p).split("\\").join("/");
}

// --- skills -----------------------------------------------------------------
const skillsDir = join(root, "skills");
if (!existsSync(skillsDir)) {
  errors.push("skills/ directory is missing");
} else {
  for (const entry of readdirSync(skillsDir)) {
    const dir = join(skillsDir, entry);
    if (!statSync(dir).isDirectory()) continue;

    const file = join(dir, "SKILL.md");
    if (!existsSync(file)) {
      errors.push(`skills/${entry}: missing SKILL.md`);
      continue;
    }

    const fm = frontmatter(readFileSync(file, "utf8"));
    if (!fm) {
      errors.push(`skills/${entry}/SKILL.md: missing YAML frontmatter`);
      continue;
    }

    const name = field(fm, "name");
    const description = field(fm, "description");

    if (!name) {
      errors.push(`skills/${entry}: missing "name"`);
    } else {
      if (name !== entry) errors.push(`skills/${entry}: name "${name}" does not match the directory`);
      if (!NAME_RE.test(name)) errors.push(`skills/${entry}: name "${name}" must be lowercase-hyphenated`);
      if (name.length > 64) errors.push(`skills/${entry}: name exceeds 64 characters`);
    }

    if (!description) {
      errors.push(`skills/${entry}: missing "description"`);
    } else if (description.length > 1024) {
      errors.push(`skills/${entry}: description exceeds 1024 characters (${description.length})`);
    }
  }
}

// --- commands ---------------------------------------------------------------
for (const dir of [join(root, "commands"), join(root, "ci", "commands")]) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const path = join(dir, file);
    const fm = frontmatter(readFileSync(path, "utf8"));
    if (!fm || !field(fm, "description")) {
      errors.push(`${rel(path)}: missing "description" frontmatter`);
    }
  }
}

if (errors.length > 0) {
  console.error("ai-powers validation failed:");
  for (const error of errors) console.error("  - " + error);
  process.exit(1);
}

console.log("ai-powers validation OK");
