#!/usr/bin/env node
// Validates ai-powers content. Dependency-free; run from the repo root:
//   node scripts/validate.mjs
//
// Checks each skill's frontmatter against the rules opencode enforces, that
// every shipped body carries a description, that the adapter keys agree across
// the places they are written down, that the pinned CLI version and the
// workflow's use of it match, and that no shipped skill points at a file the
// install does not include. This is what stops a broken skill
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
// Every markdown body ai-powers ships, whether it ships as a skill
// (skills/*/SKILL.md) or as a server-only agent (ci/agents/*.md). The
// `SKILL.md` filter must not apply to the agent dir: an agent file is named
// for its agent id, so collecting only SKILL.md there silently skipped the
// server agent and every rule below with it.
const contentFiles = [];
{
  const walkSkills = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walkSkills(path);
      else if (entry === "SKILL.md") contentFiles.push(path);
    }
  };
  if (existsSync(join(root, "skills"))) walkSkills(join(root, "skills"));

  const agentDir = join(root, "ci", "agents");
  if (existsSync(agentDir)) {
    for (const entry of readdirSync(agentDir)) {
      if (entry.endsWith(".md")) contentFiles.push(join(agentDir, entry));
    }
  }
}
if (!contentFiles.some((path) => rel(path).startsWith("ci/agents/"))) {
  errors.push("ci/agents/ has no .md file — the server-only review agent is missing");
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
  //
  // Since V2 there is no command: `opencode run --command` is gone and the
  // server review is an agent, whose input arrives as the user message. So the
  // exemption is keyed on the agent dir, and an agent body that still reaches
  // for `$ARGUMENTS` is an error — nothing substitutes it any more.
  const isAgent = rel(path).startsWith("ci/agents/");
  if (isAgent && text.includes("$ARGUMENTS")) {
    errors.push(`${rel(path)}: uses $ARGUMENTS — V2 agents receive input as the user message; nothing substitutes it`);
  }
  if (!isAgent) {
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
  if (!/npm i -g "@opencode\/cli@/.test(workflow)) {
    errors.push(
      'ci/pull-request-review.yml: does not install @opencode/cli — the V2 CLI package (1.x shipped as opencode-ai)',
    );
  }

  // The review run must resolve config and skills only from what this workflow
  // copies under ~/.config/opencode. V2 removed OPENCODE_DISABLE_EXTERNAL_SKILLS
  // (verified: it is ignored while .agents/skills stays visible), so isolation
  // is two things instead of two flags — and dropping either is silent, because
  // the review still runs, just with whatever the checkout carried.
  //
  // 1. The removal step deletes the trees a PR could hide a same-id skill in.
  //    Nothing to impersonate with.
  // 2. The skill allowlist denies every skill not named, which covers any
  //    discovery source we have not enumerated.
  if (!/OPENCODE_DISABLE_PROJECT_CONFIG:\s*"1"/.test(workflow)) {
    errors.push("ci/pull-request-review.yml: the review run does not set OPENCODE_DISABLE_PROJECT_CONFIG=1");
  }
  if (!/rm -rf \.agents \.claude \.opencode/.test(workflow)) {
    errors.push(
      "ci/pull-request-review.yml: does not remove .agents/.claude/.opencode from the checkout — V2 walks .agents/skills unconditionally, so a PR can ship a same-id skill that shadows the reviewer",
    );
  }
  if (!/"action":\s*"skill",\s*"resource":\s*"\*",\s*"effect":\s*"deny"/.test(workflow)) {
    errors.push(
      'ci/pull-request-review.yml: no skill allowlist — expected a permissions rule denying skill "*"',
    );
  }

  const copiesSkillsToExternal = /cp -R "\$powers\/skills\/\." "\$HOME\/\.agents\/skills\/"/.test(workflow);
  if (copiesSkillsToExternal) {
    errors.push(
      "ci/pull-request-review.yml: copies skills into ~/.agents/skills, a global discovery scope V2 always scans and the removal step cannot reach — put them in ~/.config/opencode/skills",
    );
  }
  if (!/cp -R "\$powers\/skills\/\." "\$HOME\/\.config\/opencode\/skills\/"/.test(workflow)) {
    errors.push(
      "ci/pull-request-review.yml: does not copy the review skills into ~/.config/opencode/skills, the global scope V2 discovers unconditionally",
    );
  }
}

// The tracker resolution procedure must live in a *shipped skill*, not only in
// docs/: `npx skills` installs skills/, so a rule kept in docs/ is invisible to
// the model and every workflow improvises its own forge. The contract is the one
// skill all four workflows already load, so that is where it belongs.
const contractPath = join(skillsDir, "he9-review-contract", "SKILL.md");
if (existsSync(contractPath)) {
  const contract = readFileSync(contractPath, "utf8");
  const section = contract.match(/## Resolving the tracker([\s\S]*?)(?=\n---)/);
  if (!section) {
    errors.push(
      'skills/he9-review-contract/SKILL.md: no "## Resolving the tracker" section — the forge → CLI procedure must ship with the skills',
    );
  } else {
    // Match the table cell, not the whole document: `gh` also appears in the
    // auth column, so a plain substring check would never fail.
    const table = section[1].match(/\| Forge \| CLI \| Auth \|([\s\S]*?)(?=\n\n)/);
    if (!table) {
      errors.push(
        "skills/he9-review-contract: the tracker section has no forge → CLI table, so `tracker` cannot be resolved to a tool",
      );
    } else {
      for (const cli of ["gh", "tea", "glab"]) {
        if (!new RegExp("^\\|[^|]+\\|\\s*`" + cli + "`\\s*\\|", "m").test(table[1])) {
          errors.push(`skills/he9-review-contract: the tracker table maps no forge to \`${cli}\``);
        }
      }
    }
    // Anchor on the sentence, not the words "forge name": they appear in the
    // section body too, so a looser match survives deleting the explanation.
    // Tolerate the bold markers the sentence is written with.
    if (!/tracker is a \*{0,2}forge\*{0,2}, not a tool/i.test(section[1])) {
      errors.push("skills/he9-review-contract: does not state that a tracker is a forge name rather than a tool");
    }
  }
}

// Each workflow that reads the key must point at that section, or it resolves a
// tracker without knowing the procedure exists.
for (const name of ["he9-start", "he9-push-pr", "he9-review", "he9-debt"]) {
  const path = join(skillsDir, name, "SKILL.md");
  if (!existsSync(path)) continue;
  if (!/Resolving the tracker/.test(readFileSync(path, "utf8"))) {
    errors.push(
      `skills/${name}: reads the \`tracker\` key but does not point at the contract's "Resolving the tracker"`,
    );
  }
}

// A skill that declares the `contract` input is claiming to grade with the
// shared rubric, so the declaration itself must name that skill. Checking the
// whole file instead is vacuous: he9-debt names the contract in six places, so
// dropping the declaration still passes.
for (const path of contentFiles) {
  const text = readFileSync(path, "utf8");
  const usage = text.match(/This (?:command|skill) uses:([\s\S]*?)(?:\.\s|\.$)/);
  if (!usage) continue;
  const declares = usage[1].match(/`contract`\s*\(([^)]*)\)/);
  if (!declares) continue;
  if (!/he9-review-contract/.test(declares[1])) {
    errors.push(
      `${rel(path)}: declares the \`contract\` input as (${declares[1].trim()}) — name the he9-review-contract skill so the declaration resolves`,
    );
  }
}

// Only skills/ is installed, so a shipped skill that points at docs/, examples/
// or ci/ hands the model a reference it cannot open. This is the same defect the
// tracker rule above fixes, and it is silent: the skill still reads fine, it
// just cannot tell the user where to look.
const shippedOnly = /(?<![\w.])(?:docs|examples|ci|scripts|install)\//;
for (const path of contentFiles) {
  if (!rel(path).startsWith("skills/")) continue;
  for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
    const match = line.match(shippedOnly);
    if (!match) continue;
    // `docs` is also an adapter key naming the project's own docs glob, which
    // legitimately reads as docs/*.md. Only flag paths that look like a file or
    // a directory reference rather than that glob.
    const after = line.slice(match.index + match[0].length);
    if (/^\*\./.test(after)) continue;
    errors.push(
      `${rel(path)}:${index + 1}: points at ${match[0]} — only skills/ is installed, so the model cannot open it`,
    );
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
// `he9_pr_review` is dispatched by name from CI (`opencode run --agent`), so
// it must stay an agent under ci/agents/. It must therefore not exist as a
// skill, where that lookup cannot find it — the same trap as the 1.x `--command`
// version of this rule, which went unsound when commands became agents.
const serverSkill = join(root, "skills", "he9-pr-review", "SKILL.md");
if (existsSync(serverSkill)) {
  errors.push(
    "skills/he9-pr-review: the server-only review agent is dispatched via `opencode run --agent` and must not be a skill",
  );
}
if (!/opencode run[\s\S]{0,200}--agent he9_pr_review/.test(readFileSync(join(root, "ci", "pull-request-review.yml"), "utf8"))) {
  errors.push(
    "ci/pull-request-review.yml: does not dispatch the review with `opencode run --agent he9_pr_review`",
  );
}

if (errors.length > 0) {
  console.error("ai-powers validation failed:");
  for (const error of errors) console.error("  - " + error);
  process.exit(1);
}

console.log("ai-powers validation OK");
