// Reads `opencode run --format json` event lines from stdin and prints the
// concatenated assistant text parts to stdout. Used by the AI PR Reviewer
// workflow to turn the raw event stream into a clean review comment.
//
// Generic and forge-agnostic; ships with ai-powers so consuming projects do
// not have to carry their own copy.
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
const parts = [];

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line);
    if (event.type === "text" && event.part && typeof event.part.text === "string") {
      parts.push(event.part.text);
    }
  } catch {
    // ignore malformed lines
  }
});

rl.on("close", () => {
  process.stdout.write(parts.join("\n").trim());
});
