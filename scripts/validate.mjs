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
const KNOWN_INPUT_KEYS = new Set([
  "baseBranch",
  "conventions",
  "specs",
  "debt",
  "docs",
  "reviewDir",
  "tracker",
  "contract",
]);
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
const commandFiles = [];
for (const dir of [join(root, "commands"), join(root, "ci", "commands")]) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".md")) commandFiles.push(join(dir, file));
  }
}

for (const path of commandFiles) {
  const text = readFileSync(path, "utf8");

  const fm = frontmatter(text);
  if (!fm || !field(fm, "description")) {
    errors.push(`${rel(path)}: missing "description" frontmatter`);
  }

  if (text.includes("{{")) {
    errors.push(`${rel(path)}: contains a {{...}} placeholder — not an opencode template variable; use a plain reference`);
  }

  const mentionsArgument = /^##\s+Argument\b/m.test(text) || /determined by the argument/i.test(text);
  if (mentionsArgument && !text.includes("$ARGUMENTS")) {
    errors.push(`${rel(path)}: describes an argument but never uses $ARGUMENTS`);
  }

  // Commands list only the project inputs they use. Verify both that the key is
  // known and that the command actually references it outside the preamble --
  // otherwise the list is an unverified claim. Keys are written as `key`
  // (default), so require the parenthetical to avoid matching defaults like `main`.
  const usage = text.match(/This command uses:([\s\S]*?)(?:\.\s|\.$)/);
  if (usage) {
    const preamble = text.match(/\*\*Project inputs[\s\S]*?(?:\r?\n\s*\r?\n)/);
    const body = preamble ? text.replace(preamble[0], "") : text;
    for (const [, key] of usage[1].matchAll(/`([A-Za-z][A-Za-z0-9]*)`\s*\(/g)) {
      if (!KNOWN_INPUT_KEYS.has(key)) {
        errors.push(`${rel(path)}: listed project input "${key}" is not a known key`);
        continue;
      }
      if (!new RegExp("\\b" + key + "\\b").test(body)) {
        errors.push(`${rel(path)}: lists project input "${key}" but never uses it outside the preamble`);
      }
    }
  }
}

// A command that invokes the local reviewer subagent depends on a prerequisite
// living in the consuming project, so this repo must document it.
const referencesReviewer = commandFiles.some((path) => readFileSync(path, "utf8").includes("@reviewer"));
if (referencesReviewer) {
  const adapterDoc = join(root, "docs", "adapter.md");
  const documented = existsSync(adapterDoc) && readFileSync(adapterDoc, "utf8").includes("Local reviewer agent");
  if (!documented) {
    errors.push('a command references "@reviewer" but docs/adapter.md has no "Local reviewer agent" section');
  }
}

// --- pinned CI config -------------------------------------------------------
const opencodeVersionPath = join(root, "ci", "opencode-version");
if (!existsSync(opencodeVersionPath)) {
  errors.push("ci/opencode-version is missing");
} else {
  const version = readFileSync(opencodeVersionPath, "utf8").trim();
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    errors.push(`ci/opencode-version does not look like a version: "${version}"`);
  }
}

if (errors.length > 0) {
  console.error("ai-powers validation failed:");
  for (const error of errors) console.error("  - " + error);
  process.exit(1);
}

console.log("ai-powers validation OK");
