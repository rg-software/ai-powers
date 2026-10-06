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

// --- content rules ----------------------------------------------------------
// These apply to every markdown body ai-powers ships, whether it ships as a
// skill (skills/) or as a server-only command (ci/commands/). The local
// workflows are skills; `he9_pr_review` stays a command because CI dispatches
// it by name through `opencode run --command`.
const contentFiles = [];
for (const dir of [join(root, "skills"), join(root, "ci", "commands")]) {
  if (!existsSync(dir)) continue;
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "SKILL.md") contentFiles.push(path);
    }
  };
  walk(dir);
}

for (const path of contentFiles) {
  const text = readFileSync(path, "utf8");

  const fm = frontmatter(text);
  if (!fm || !field(fm, "description")) {
    errors.push(`${rel(path)}: missing "description" frontmatter`);
  }

  if (text.includes("{{")) {
    errors.push(`${rel(path)}: contains a {{...}} placeholder — not an opencode template variable; use a plain reference`);
  }

  // A skill body is injected as a prompt, so it cannot rely on `$ARGUMENTS`
  // substitution the way a command template can. Every skill must therefore
  // carry an **Invocation.** note saying where its input comes from — the
  // invocation text when it has a target, or the repository state when it does
  // not. `$ARGUMENTS` is legitimate only in a command, where opencode
  // substitutes it for real.
  const isCommand = rel(path).startsWith("ci/commands/");
  if (!isCommand) {
    // A skill that advertises an invocation target in its description is a
    // workflow: it takes input from the text following the skill name, so it
    // must say so in the body. A reference skill (contract, checklists) has no
    // input and is exempt.
    const description = (frontmatter(text)?.match(/^description:\s*(.+)$/m)?.[1] ?? "").toLowerCase();
    const isWorkflow = /invocation text|invocation target/.test(description);
    if (isWorkflow && !/^\*\*Invocation\.\*\*/m.test(text)) {
      errors.push(`${rel(path)}: advertises an invocation target but has no "**Invocation.**" note`);
    }
    if (text.includes("$ARGUMENTS")) {
      errors.push(
        `${rel(path)}: uses $ARGUMENTS in a skill body — opencode does not substitute it there; read the invocation text instead`,
      );
    }
  }

  // Content lists only the project inputs it uses. Verify both that the key is
  // known and that the body actually references it outside the preamble --
  // otherwise the list is an unverified claim. Keys are written as `key`
  // (default), so require the parenthetical to avoid matching defaults like `main`.
  const usage = text.match(/This (?:command|skill) uses:([\s\S]*?)(?:\.\s|\.$)/);
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

// Content that invokes the local reviewer subagent depends on a prerequisite
// living in the consuming project, so this repo must document it.
const referencesReviewer = contentFiles.some((path) => readFileSync(path, "utf8").includes("reviewer` subagent"));
if (referencesReviewer) {
  const adapterDoc = join(root, "docs", "adapter.md");
  const documented = existsSync(adapterDoc) && readFileSync(adapterDoc, "utf8").includes("Local reviewer agent");
  if (!documented) {
    errors.push(
      'content references the "reviewer" subagent but docs/adapter.md has no "Local reviewer agent" section',
    );
  }
}

// In a skill body `reviewer` is prose the model acts on, not a dispatch the
// harness resolves, so a missing subagent silently becomes a self-review. Any
// content that invokes it must therefore (a) stop rather than degrade when the
// subagent is unavailable, and (b) name the party it actually used, so a
// single-mind review can never be passed off as a doubly-checked one.
for (const path of contentFiles) {
  const text = readFileSync(path, "utf8");
  // Only workflows actually invoke the subagent. A reference skill may merely
  // discuss reviewer output as evidence (receiving-code-review does), which
  // needs neither a party nor a stop rule.
  if (!/invoke the `reviewer` subagent/i.test(text)) continue;

  const haltsOnMissing = /\*\*stop/i.test(text) || /stop before scanning/i.test(text);
  if (!haltsOnMissing) {
    errors.push(
      `${rel(path)}: invokes the "reviewer" subagent but never says to stop when it is unavailable — a skill-body mention cannot fail loudly on its own`,
    );
  }

  const declaresParty = /REVIEWING_PARTY/.test(text);
  if (!declaresParty) {
    errors.push(
      `${rel(path)}: invokes the "reviewer" subagent but never sets REVIEWING_PARTY — the reviewing party must be named in the output`,
    );
  }
}

// --- pinned CI config -------------------------------------------------------
const opencodeVersionPath = join(root, "ci", "opencode-version");
const opencodeVersion = existsSync(opencodeVersionPath)
  ? readFileSync(opencodeVersionPath, "utf8").trim()
  : undefined;
if (!opencodeVersion) {
  errors.push("ci/opencode-version is missing");
} else if (!/^\d+\.\d+\.\d+$/.test(opencodeVersion)) {
  errors.push(`ci/opencode-version does not look like a version: "${opencodeVersion}"`);
}

// The workflow carries its own fallback literal for when the pinned file is
// unreadable. That duplicate silently rots, so require the two to agree — and
// require the fallback to name the 1.x npm package, since the CLI that installs
// this pin also has to exist on the registry.
const workflowPath = join(root, "ci", "pull-request-review.yml");
if (existsSync(workflowPath) && opencodeVersion) {
  const workflow = readFileSync(workflowPath, "utf8");
  const fallback = workflow.match(/opencode-version[^|\n]*\|\| echo ([\d.]+)/);
  if (!fallback) {
    errors.push("ci/pull-request-review.yml: no fallback literal beside the ci/opencode-version read");
  } else if (fallback[1] !== opencodeVersion) {
    errors.push(
      `ci/pull-request-review.yml: fallback pins opencode ${fallback[1]} but ci/opencode-version says ${opencodeVersion}`,
    );
  }
  if (!/npm i -g "opencode-ai@/.test(workflow)) {
    errors.push(
      'ci/pull-request-review.yml: does not install opencode-ai — the 1.x CLI package (2.x ships as @opencode/cli)',
    );
  }

  // The review run must resolve config and skills only from what this workflow
  // copies under ~/.config/opencode. Each flag covers a different tree, and
  // dropping one is silent: the review still runs, just with whatever the
  // checkout carried. They are coupled — disabling external skills also hides
  // ~/.agents/skills, so the copy destination has to move with it.
  const requiredEnv = ["OPENCODE_DISABLE_PROJECT_CONFIG", "OPENCODE_DISABLE_EXTERNAL_SKILLS"];
  for (const name of requiredEnv) {
    if (!new RegExp(`${name}:\\s*"1"`).test(workflow)) {
      errors.push(`ci/pull-request-review.yml: the review run does not set ${name}=1`);
    }
  }

  const copiesSkillsToExternal = /cp -R "\$powers\/skills\/\." "\$HOME\/\.agents\/skills\/"/.test(workflow);
  if (copiesSkillsToExternal) {
    errors.push(
      "ci/pull-request-review.yml: copies skills into ~/.agents/skills, which OPENCODE_DISABLE_EXTERNAL_SKILLS hides — put them in ~/.config/opencode/skills",
    );
  }
  if (!/cp -R "\$powers\/skills\/\." "\$HOME\/\.config\/opencode\/skills\/"/.test(workflow)) {
    errors.push(
      "ci/pull-request-review.yml: does not copy the review skills into ~/.config/opencode/skills, the only location still discovered once external skills are disabled",
    );
  }
}

// `tracker` is documented as a forge name that resolves to a CLI. A skill that
// reads the key must therefore be able to answer "which CLI", or the example a
// user copies documents a value the workflows cannot act on.
const trackerDoc = join(root, "docs", "adapter.md");
if (existsSync(trackerDoc)) {
  const adapterText = readFileSync(trackerDoc, "utf8");
  const cliTable = adapterText.match(/\| Forge \| Tool \| Auth \|([\s\S]*?)(?=\n\n)/);
  if (!cliTable) {
    errors.push('docs/adapter.md: no forge → CLI table, so `tracker` cannot be resolved to a tool');
  } else {
    // Match the table cell, not the whole document: `gh` also appears in the
    // auth column and the example, so a plain substring check never fails.
    for (const cli of ["gh", "tea", "glab"]) {
      if (!new RegExp("^\\|[^|]+\\|\\s*`" + cli + "`\\s*\\|", "m").test(cliTable[1])) {
        errors.push(`docs/adapter.md: the forge → CLI table has no row mapping a forge to \`${cli}\``);
      }
    }
  }
  // Anchor on the sentence, not the words "forge name": the key table also uses
// that phrase, so a looser match stays satisfied when the explanation is gone.
if (!/tracker is a \*?forge\*?, not a tool/i.test(adapterText)) {
    errors.push('docs/adapter.md: does not state that `tracker` is a forge name rather than a tool');
  }
}

// --- project input keys -----------------------------------------------------
// The set of adapter keys is stated in three places: KNOWN_INPUT_KEYS above,
// the table code-review-expert documents for the model, and the annotated
// example a human copies from. A key that exists in one and not the others is
// an unverified claim in whichever place is missing it, so require all three
// to agree.
const documentedInputKey = (text) => {
  const table = text.match(/### Resolving project inputs([\s\S]*?)(?=\n#{2,3} )/);
  if (!table) return null;
  const keys = new Set();
  for (const [, key] of table[1].matchAll(/^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|/gm)) keys.add(key);
  return keys;
};

const expertPath = join(skillsDir, "code-review-expert", "SKILL.md");
if (existsSync(expertPath)) {
  const documented = documentedInputKey(readFileSync(expertPath, "utf8"));
  if (!documented) {
    errors.push(
      'skills/code-review-expert/SKILL.md: no "### Resolving project inputs" table — the model-facing input contract must be documented',
    );
  } else {
    for (const key of documented) {
      if (!KNOWN_INPUT_KEYS.has(key)) {
        errors.push(`skills/code-review-expert: documents input "${key}" which is not a known key`);
      }
    }
    for (const key of KNOWN_INPUT_KEYS) {
      if (!documented.has(key)) {
        errors.push(
          `skills/code-review-expert: does not document the "${key}" input, which KNOWN_INPUT_KEYS treats as valid`,
        );
      }
    }
  }
}

// The example is what a human copies, so a key commented out there but missing
// from the model-facing table (or vice versa) sends them to the wrong file.
const examplePath = join(root, "examples", "powers.jsonc");
if (existsSync(examplePath)) {
  const example = readFileSync(examplePath, "utf8");
  for (const [, key] of example.matchAll(/^\s*\/\/\s*"([A-Za-z][A-Za-z0-9]*)"\s*:/gm)) {
    if (!KNOWN_INPUT_KEYS.has(key)) {
      errors.push(`examples/powers.jsonc: shows override "${key}" which is not a known key`);
    }
  }
  for (const key of KNOWN_INPUT_KEYS) {
    if (!new RegExp(`"${key}"\\s*:`).test(example)) {
      errors.push(`examples/powers.jsonc: does not show an override for the "${key}" input`);
    }
  }
}

// --- layout -----------------------------------------------------------------
// `he9_pr_review` is dispatched by name from CI (`opencode run --command`), so
// it must stay a command. It must therefore not exist as a skill, where that
// lookup cannot find it.
const serverSkill = join(root, "skills", "he9-pr-review", "SKILL.md");
if (existsSync(serverSkill)) {
  errors.push(
    "skills/he9-pr-review: the server-only review command is invoked via `opencode run --command` and must not be a skill",
  );
}

if (errors.length > 0) {
  console.error("ai-powers validation failed:");
  for (const error of errors) console.error("  - " + error);
  process.exit(1);
}

console.log("ai-powers validation OK");
