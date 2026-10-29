// Trigger evaluation and PR data extraction for the AI PR Reviewer workflow.
// Runs via actions/github-script, which injects `github` (octokit), `context`
// and `core` as globals. `payload`, `repo` and `eventName` are NOT injected --
// they are destructured from `context` below.
//
// The octokit calls used here are available on both Gitea Actions and GitHub
// Actions. The mention that triggers a manual review is configurable via the
// AI_REVIEW_MENTION repo variable (default "@ai-reviewer").
const { payload, repo, eventName } = context;

const REVIEW_MENTION = (process.env.AI_REVIEW_MENTION || "@ai-reviewer").trim().toLowerCase();

// Stable markers. The reviewer stamps every posted review with REVIEW_MARKER;
// the responder stamps its answer with RESPONSE_MARKER (he9-review respond).
// Both are matched on the raw comment body, never on a list renderer, which is
// allowed to truncate (measured on `tea comments list`, 2026-10-17).
const REVIEW_MARKER = "<!-- he9-reviewer:v1 -->";
const RESPONSE_MARKER = "<!-- he9-responder:v1 -->";

// Enough to carry every finding and its disposition, bounded so an
// adversarial comment cannot crowd the diff out of the model's context.
const PRIOR_REVIEW_LIMIT = 12000;
const PRIOR_RESPONSE_LIMIT = 8000;

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

function truncate(text, limit) {
    if (typeof text !== "string") return "";
    if (text.length <= limit) return text;
    return text.slice(0, limit) + `\n...[truncated at ${limit} characters]`;
}

// Prefix a body with who wrote it and when. The reviewer is told to treat a
// response as a claim; the author and association are what let it weigh one.
function describeComment(comment, body) {
    const who = comment.user?.login ? `@${comment.user.login}` : "unknown author";
    const association = comment.author_association ? `, ${comment.author_association}` : "";
    const when = comment.created_at ? `, ${comment.created_at}` : "";
    const url = comment.html_url ? `\n${comment.html_url}` : "";
    return `(${who}${association}${when})${url}\n${body}`;
}

// Fetch the thread once per run and pair the newest response with the review it
// answers. With no response there is no prior feedback at all, so a project that
// has not adopted the responder side behaves exactly as it did before: the
// review is stateless. That is deliberate — reconciliation without a recorded
// decision has nothing to reconcile against.
async function fetchPriorFeedback(prNumber) {
    const comments = [];
    // Gitea caps the page size below GitHub's 100, so page at 50 and stop early.
    for (let page = 1; page <= 10; page += 1) {
        const { data } = await github.rest.issues.listComments({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: prNumber,
            per_page: 50,
            page,
        });
        if (!Array.isArray(data) || data.length === 0) break;
        comments.push(...data);
        if (data.length < 50) break;
    }

    const withMarker = (marker) => comments.filter((c) => (c.body || "").includes(marker));
    const newestOf = (list) =>
        list.reduce((newest, c) =>
            String(c.created_at || "") >= String(newest.created_at || "") ? c : newest
        );

    const reviews = withMarker(REVIEW_MARKER);
    const responses = withMarker(RESPONSE_MARKER);

    if (responses.length === 0) {
        return { priorReview: "", priorResponse: "" };
    }

    const response = newestOf(responses);

    // Prefer the review the response names in its `Review:` line; otherwise the
    // newest review posted no later than the response. A response from an
    // earlier round is then quoted with *its* review, not with a later one.
    let review = null;
    if (response.html_url) {
        const linked = reviews.filter(
            (r) => r.html_url && (response.body || "").includes(r.html_url)
        );
        if (linked.length > 0) review = newestOf(linked);
    }
    if (!review) {
        const before = reviews.filter(
            (r) => String(r.created_at || "") <= String(response.created_at || "")
        );
        if (before.length > 0) review = newestOf(before);
    }

    return {
        priorReview: review
            ? describeComment(review, truncate(review.body, PRIOR_REVIEW_LIMIT))
            : "",
        priorResponse: describeComment(response, truncate(response.body, PRIOR_RESPONSE_LIMIT)),
    };
}

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
} else if (eventName === "workflow_dispatch") {
    // 3. Triggered manually with a PR number, so the pipeline can be exercised
    //    on demand instead of waiting for a PR event.
    const raw = context.payload.inputs?.pr_number || "";
    const number = Number(raw);

    if (!Number.isInteger(number) || number <= 0) {
        core.setFailed(`workflow_dispatch requires a positive integer pr_number (got "${raw}")`);
    } else {
        try {
            const { data: prData } = await github.rest.pulls.get({
                owner: repo.owner,
                repo: repo.repo,
                pull_number: number,
            });

            hit = true;
            commentBody = `A manual review was requested for pull request #${number}. Please provide a complete code review.`;
            entityNumber = number;
            entityTitle = prData.title;
            entityBody = prData.body;
            prHeadSha = prData.head?.sha;
            prBaseRef = prData.base?.ref;
            prBaseSha = prData.base?.sha;
            prHeadRef = "refs/pull/" + number + "/head";

            const { data: commitsData } = await github.rest.pulls.listCommits({
                owner: repo.owner,
                repo: repo.repo,
                pull_number: number,
                per_page: 100
            });
            prCommitsShas = JSON.stringify(commitsData.map(c => c.sha));
        } catch (error) {
            core.setFailed(`Failed to fetch PR #${number}: ${error.message}`);
        }
    }
}

// The round-trip: feed the previous review and the answer to it into this run,
// so a finding the team rejected or deferred is not re-raised blind. A failed
// fetch is not fatal — it degrades to the old stateless review, and the prompt
// then says so, rather than pretending there was no prior feedback.
let priorReview = "";
let priorResponse = "";
if (hit && entityNumber) {
    try {
        ({ priorReview, priorResponse } = await fetchPriorFeedback(entityNumber));
    } catch (error) {
        console.error("Failed to fetch prior review feedback:", error.message);
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
core.setOutput("priorReview", priorReview);
core.setOutput("priorResponse", priorResponse);

// Checkout the PR head so the AI reviews the post-PR code state.
core.setOutput("checkoutRef", prHeadSha);
