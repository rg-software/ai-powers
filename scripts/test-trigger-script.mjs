#!/usr/bin/env node
// Executes ci/scripts/get-issue-data.js in a sandbox with stubbed github-script
// globals, across every event path. Nothing else evaluates that script except
// the CI runner, so a ReferenceError or a logic slip would otherwise ship
// silently and only show up as a red workflow.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "ci", "scripts", "get-issue-data.js"), "utf8");

async function runScript({ eventName, payload, mention }) {
  const outputs = {};
  let failed = null;

  const sandbox = {
    context: { eventName, payload, repo: { owner: "owner", repo: "repo" } },
    github: {
      rest: {
        pulls: {
          get: async () => ({
            data: { title: "T", body: "B", head: { sha: "headsha" }, base: { ref: "develop", sha: "basesha" } },
          }),
          listCommits: async () => ({ data: [{ sha: "c1" }, { sha: "c2" }] }),
        },
      },
    },
    core: {
      setOutput: (key, value) => { outputs[key] = value; },
      setFailed: (message) => { failed = message; },
    },
    process: { env: mention === undefined ? {} : { AI_REVIEW_MENTION: mention } },
    console,
  };

  await new vm.Script(`(async () => {\n${source}\n})()`).runInNewContext(sandbox);
  return { outputs, failed };
}

const checks = [];
const check = (name, condition) => checks.push({ name, condition });

// workflow_dispatch, valid PR number
const dispatch = await runScript({ eventName: "workflow_dispatch", payload: { inputs: { pr_number: "42" } } });
check("dispatch/valid: hit", dispatch.outputs.hit === true);
check("dispatch/valid: entityNumber", dispatch.outputs.entityNumber === 42);
check("dispatch/valid: prHeadRef", dispatch.outputs.prHeadRef === "refs/pull/42/head");
check("dispatch/valid: commits", dispatch.outputs.prCommitsShas === '["c1","c2"]');
check("dispatch/valid: no failure", dispatch.failed === null);

// workflow_dispatch, bad input
const dispatchBad = await runScript({ eventName: "workflow_dispatch", payload: { inputs: { pr_number: "nope" } } });
check("dispatch/bad: setFailed called", typeof dispatchBad.failed === "string");
check("dispatch/bad: not hit", dispatchBad.outputs.hit === false);

// issue_comment with the default mention
const mention = await runScript({
  eventName: "issue_comment",
  payload: { issue: { number: 7, title: "T", body: "B", pull_request: {} }, comment: { body: "please @ai-reviewer take a look" } },
});
check("issue_comment/mention: hit", mention.outputs.hit === true);
check("issue_comment/mention: entityNumber", mention.outputs.entityNumber === 7);

// issue_comment without the mention
const noMention = await runScript({
  eventName: "issue_comment",
  payload: { issue: { number: 7, pull_request: {} }, comment: { body: "just chatting" } },
});
check("issue_comment/no-mention: not hit", noMention.outputs.hit === false);

// issue_comment with a custom mention
const customMention = await runScript({
  eventName: "issue_comment",
  mention: "@bob",
  payload: { issue: { number: 7, pull_request: {} }, comment: { body: "/review @bob please" } },
});
check("issue_comment/custom-mention: hit", customMention.outputs.hit === true);

// pull_request_target on open
const target = await runScript({
  eventName: "pull_request_target",
  payload: { action: "opened", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs" }, base: { ref: "develop", sha: "bs" } } },
});
check("pull_request_target: hit", target.outputs.hit === true);
check("pull_request_target: entityNumber", target.outputs.entityNumber === 9);

const failures = checks.filter((c) => !c.condition);
if (failures.length > 0) {
  console.error("trigger-script tests failed:");
  for (const failure of failures) console.error("  - " + failure.name);
  process.exit(1);
}

console.log(`trigger-script tests OK (${checks.length} checks)`);
