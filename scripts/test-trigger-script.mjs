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

async function runScript({ eventName, payload, mention, comments = [], commentsError = false }) {
  const outputs = {};
  let failed = null;

  const sandbox = {
    context: { eventName, payload, repo: { owner: "owner", repo: "repo" } },
    github: {
      rest: {
        issues: {
          listComments: async () => {
            if (commentsError) throw new Error("comments unavailable");
            return { data: comments };
          },
        },
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
check("pull_request_target: no prior review by default", target.outputs.priorReview === "");

// The round-trip: the newest response is quoted with the review it answers, not
// with a later review that has not been answered.
const prior = await runScript({
  eventName: "pull_request_target",
  payload: { action: "synchronize", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs2" }, base: { ref: "develop", sha: "bs" } } },
  comments: [
    {
      body: "<!-- he9-reviewer:v1 -->\n## Code Review Summary\n- R-1 still open",
      user: { login: "reviewer-bot" },
      author_association: "NONE",
      created_at: "2026-10-01T10:00:00Z",
      html_url: "https://forge/pr/9#review-1",
    },
    {
      body: "ordinary conversation, not a review",
      user: { login: "someone" },
      created_at: "2026-10-02T10:00:00Z",
    },
    {
      body: "<!-- he9-responder:v1 -->\n## Review Response\nReview: https://forge/pr/9#review-1\n| R-1 | P2 | rejected | spec says X |",
      user: { login: "dev" },
      author_association: "MEMBER",
      created_at: "2026-10-03T10:00:00Z",
      html_url: "https://forge/pr/9#response-1",
    },
    {
      body: "<!-- he9-reviewer:v1 -->\n## Code Review Summary\n- R-1 newer",
      user: { login: "reviewer-bot" },
      created_at: "2026-10-04T10:00:00Z",
      html_url: "https://forge/pr/9#review-2",
    },
  ],
});
check("prior: review paired with the response is quoted", prior.outputs.priorReview.includes("R-1 still open"));
check("prior: unpaired newer review is not quoted", !prior.outputs.priorReview.includes("R-1 newer"));
check("prior: review author recorded", prior.outputs.priorReview.includes("@reviewer-bot"));
check("prior: response extracted", prior.outputs.priorResponse.includes("rejected"));

// No responder comment at all: no prior feedback, so the review stays stateless.
const unanswered = await runScript({
  eventName: "pull_request_target",
  payload: { action: "synchronize", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs4" }, base: { ref: "develop", sha: "bs" } } },
  comments: [
    {
      body: "<!-- he9-reviewer:v1 -->\n## Code Review Summary\n- R-1 still open",
      user: { login: "reviewer-bot" },
      created_at: "2026-10-01T10:00:00Z",
      html_url: "https://forge/pr/9#review-1",
    },
  ],
});
check("prior: a review without a response is not passed", unanswered.outputs.priorReview === "" && unanswered.outputs.priorResponse === "");

// A response posted after the newest review, naming it, is its answer.
const answered = await runScript({
  eventName: "pull_request_target",
  payload: { action: "synchronize", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs3" }, base: { ref: "develop", sha: "bs" } } },
  comments: [
    {
      body: "<!-- he9-reviewer:v1 -->\n## Code Review Summary\n- R-1 newer",
      user: { login: "reviewer-bot" },
      created_at: "2026-10-04T10:00:00Z",
      html_url: "https://forge/pr/9#review-2",
    },
    {
      body: "<!-- he9-responder:v1 -->\n## Review Response\nReview: https://forge/pr/9#review-2\n| R-1 | P2 | rejected | spec says X |",
      user: { login: "dev" },
      author_association: "MEMBER",
      created_at: "2026-10-05T10:00:00Z",
      html_url: "https://forge/pr/9#response-2",
    },
  ],
});
check("prior: response to the newest review extracted", answered.outputs.priorResponse.includes("rejected"));
check("prior: response author and association recorded", answered.outputs.priorResponse.includes("@dev, MEMBER"));

// A long comment is bounded, so it cannot crowd the diff out of the context.
const long = "x".repeat(9000);
const truncated = await runScript({
  eventName: "pull_request_target",
  payload: { action: "synchronize", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs" }, base: { ref: "develop", sha: "bs" } } },
  comments: [
    { body: "<!-- he9-reviewer:v1 -->\nshort", user: { login: "reviewer-bot" }, created_at: "2026-10-01T10:00:00Z", html_url: "https://forge/pr/9#r" },
    { body: `<!-- he9-responder:v1 -->\n${long}`, user: { login: "dev" }, created_at: "2026-10-03T10:00:00Z" },
  ],
});
check("prior: response truncated", truncated.outputs.priorResponse.includes("[truncated at 8000 characters]"));

// A comments API failure degrades to a stateless review instead of killing the run.
const noComments = await runScript({
  eventName: "pull_request_target",
  payload: { action: "synchronize", pull_request: { number: 9, title: "T", body: "B", head: { sha: "hs" }, base: { ref: "develop", sha: "bs" } } },
  commentsError: true,
});
check("prior: fetch failure does not fail the run", noComments.failed === null);
check("prior: fetch failure yields no prior", noComments.outputs.priorReview === "" && noComments.outputs.priorResponse === "");

const failures = checks.filter((c) => !c.condition);
if (failures.length > 0) {
  console.error("trigger-script tests failed:");
  for (const failure of failures) console.error("  - " + failure.name);
  process.exit(1);
}

console.log(`trigger-script tests OK (${checks.length} checks)`);
