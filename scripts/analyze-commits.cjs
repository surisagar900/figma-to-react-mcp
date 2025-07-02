#!/usr/bin/env node

const { execSync } = require("child_process");

/**
 * Analyze recent commits to suggest version bump type
 * Based on conventional commit messages
 */

function getRecentCommits(count = 10) {
  try {
    const output = execSync(`git log --oneline -${count}`, {
      encoding: "utf8",
    });
    return output.split("\n").filter((line) => line.trim());
  } catch (error) {
    console.error("Could not fetch git commits:", error.message);
    return [];
  }
}

function analyzeCommitType(message) {
  const lowerMessage = message.toLowerCase();

  // Check for breaking changes
  if (
    lowerMessage.includes("breaking change") ||
    lowerMessage.includes("breaking:") ||
    message.includes("!:")
  ) {
    return "major";
  }

  // Check for features
  if (
    lowerMessage.startsWith("feat:") ||
    lowerMessage.startsWith("feature:") ||
    lowerMessage.includes("add ") ||
    lowerMessage.includes("new ")
  ) {
    return "minor";
  }

  // Check for fixes
  if (
    lowerMessage.startsWith("fix:") ||
    lowerMessage.startsWith("bug:") ||
    lowerMessage.includes("fix ") ||
    lowerMessage.includes("repair ")
  ) {
    return "patch";
  }

  // Check for docs/chores (patch)
  if (
    lowerMessage.startsWith("docs:") ||
    lowerMessage.startsWith("chore:") ||
    lowerMessage.startsWith("style:") ||
    lowerMessage.startsWith("refactor:") ||
    lowerMessage.startsWith("test:")
  ) {
    return "patch";
  }

  // Default to patch for unclear commits
  return "patch";
}

function suggestVersionBump(commits) {
  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  const analysis = commits.map((commit) => {
    const type = analyzeCommitType(commit);

    if (type === "major") hasMajor = true;
    if (type === "minor") hasMinor = true;
    if (type === "patch") hasPatch = true;

    return { commit, type };
  });

  let suggestion = "patch";
  if (hasMajor) suggestion = "major";
  else if (hasMinor) suggestion = "minor";

  return { suggestion, analysis };
}

function main() {
  console.log("🔍 Analyzing recent commits for version bump suggestion...\n");

  const commits = getRecentCommits();
  if (commits.length === 0) {
    console.log("❌ No commits found");
    return;
  }

  const { suggestion, analysis } = suggestVersionBump(commits);

  console.log("📋 Recent commits analysis:");
  console.log("═".repeat(60));

  analysis.forEach(({ commit, type }) => {
    const icon = type === "major" ? "💥" : type === "minor" ? "✨" : "🐛";
    const typeStr = type.toUpperCase().padEnd(6);
    console.log(`${icon} ${typeStr} │ ${commit}`);
  });

  console.log("═".repeat(60));

  const suggestionIcon =
    suggestion === "major" ? "💥" : suggestion === "minor" ? "✨" : "🐛";
  console.log(
    `\n🎯 Suggested version bump: ${suggestionIcon} ${suggestion.toUpperCase()}`
  );

  console.log("\n📖 Reasoning:");
  if (suggestion === "major") {
    console.log("- Found breaking changes or major refactors");
  } else if (suggestion === "minor") {
    console.log("- Found new features but no breaking changes");
  } else {
    console.log("- Only bug fixes, docs, or maintenance changes");
  }

  console.log("\n💡 Next steps:");
  console.log(`   npm run release:${suggestion}`);
  console.log("   # Or use interactive release:");
  console.log("   npm run release");
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCommitType, suggestVersionBump };
