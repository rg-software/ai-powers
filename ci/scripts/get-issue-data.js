// Trigger evaluation and PR data extraction for the AI PR Reviewer workflow.
// Runs via actions/github-script, so `context`, `repo`, `payload`, `eventName`,
// `github` (octokit) and `core` are injected. The octokit calls used here are
// available on both Gitea Actions and GitHub Actions.
//
// The mention that triggers a manual review is configurable via the
// AI_REVIEW_MENTION repo variable (default "@ai-reviewer").
const REVIEW_MENTION = (process.env.AI_REVIEW_MENTION || "@ai-reviewer").trim().toLowerCase();

let hit = false;
let commentBody = "";
let entityNumber = "";
let entityTitle = "";
let entityBody = "";

let prHeadRef = "";
let prHeadSha = "";
let prBaseRef = "";
let prBaseSha = "";
let prCommitsShas = "[]";

if (eventName === "issue_comment" && payload.issue?.pull_request) {
    // 1. Triggered by a comment SPECIFICALLY on a Pull Request
    commentBody = payload.comment?.body || "";
    hit = commentBody.toLowerCase().includes(REVIEW_MENTION);

    entityNumber = payload.issue.number;
    entityTitle = payload.issue.title;
    entityBody = payload.issue.body;

    try {
        const { data: prData } = await github.rest.pulls.get({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: entityNumber,
        });
        prHeadSha = prData.head?.sha;
        prBaseRef = prData.base?.ref;
        prBaseSha = prData.base?.sha;
        // Use the forge's internal PR ref (fixed safe format) instead of the PR
        // branch name: the branch name is attacker-controlled and would be
        // interpolated into a shell command downstream.
        prHeadRef = "refs/pull/" + entityNumber + "/head";

        const { data: commitsData } = await github.rest.pulls.listCommits({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: entityNumber,
            per_page: 100
        });
        prCommitsShas = JSON.stringify(commitsData.map(c => c.sha));
    } catch (error) {
        console.error("Failed to fetch PR details:", error.message);
    }
} else if (eventName === "pull_request_target") {
    // 2. Triggered automatically on new PRs or PR pushes (workflow runs in the
    //    base branch context, so this script is the trusted base-branch copy)
    hit = true;

    // Auto-generate the user command for the AI
    commentBody = payload.action === "opened"
        ? "A new pull request has been opened. Please provide a complete code review."
        : "New commits have been pushed to this pull request. Please review the latest changes.";

    entityNumber = payload.pull_request.number;
    entityTitle = payload.pull_request.title;
    entityBody = payload.pull_request.body;

    prHeadSha = payload.pull_request.head?.sha;
    prBaseRef = payload.pull_request.base?.ref;
    prBaseSha = payload.pull_request.base?.sha;
    prHeadRef = "refs/pull/" + entityNumber + "/head";

    try {
        const { data: commitsData } = await github.rest.pulls.listCommits({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: entityNumber,
            per_page: 100
        });
        prCommitsShas = JSON.stringify(commitsData.map(c => c.sha));
    } catch (error) {
        console.error("Failed to fetch PR commits:", error.message);
    }
}

// Export variables to the workflow
core.setOutput("hit", hit);
core.setOutput("commentBody", commentBody);
core.setOutput("entityNumber", entityNumber);
core.setOutput("entityTitle", entityTitle);
core.setOutput("entityBody", entityBody);
core.setOutput("prHeadRef", prHeadRef);
core.setOutput("prHeadSha", prHeadSha);
core.setOutput("prBaseRef", prBaseRef);
core.setOutput("prBaseSha", prBaseSha);
core.setOutput("prCommitsShas", prCommitsShas);

// Checkout the PR head so the AI reviews the post-PR code state.
core.setOutput("checkoutRef", prHeadSha);
