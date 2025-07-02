#!/usr/bin/env node

const readline = require("readline");
const { execSync } = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

const commitTypes = [
  { value: "feat", name: "✨ feat:     A new feature", bump: "minor" },
  { value: "fix", name: "🐛 fix:      A bug fix", bump: "patch" },
  {
    value: "docs",
    name: "📚 docs:     Documentation only changes",
    bump: "patch",
  },
  {
    value: "style",
    name: "💎 style:    Changes that do not affect the meaning of the code",
    bump: "patch",
  },
  {
    value: "refactor",
    name: "📦 refactor: A code change that neither fixes a bug nor adds a feature",
    bump: "patch",
  },
  {
    value: "test",
    name: "🚨 test:     Adding missing tests or correcting existing tests",
    bump: "patch",
  },
  {
    value: "chore",
    name: "🔧 chore:    Changes to the build process or auxiliary tools",
    bump: "patch",
  },
  {
    value: "perf",
    name: "⚡ perf:     A code change that improves performance",
    bump: "patch",
  },
  {
    value: "ci",
    name: "👷 ci:       Changes to our CI configuration files and scripts",
    bump: "patch",
  },
  {
    value: "build",
    name: "🏗️ build:    Changes that affect the build system or external dependencies",
    bump: "patch",
  },
  {
    value: "revert",
    name: "⏪ revert:   Reverts a previous commit",
    bump: "patch",
  },
];

async function selectCommitType() {
  console.log("\n📝 Select the type of change you're committing:\n");

  commitTypes.forEach((type, index) => {
    const bumpColor = type.bump === "minor" ? "\x1b[33m" : "\x1b[32m"; // yellow for minor, green for patch
    console.log(
      `${index + 1}. ${type.name} \x1b[90m(${bumpColor}${
        type.bump
      }\x1b[90m bump)\x1b[0m`
    );
  });

  console.log(
    '\n💥 For BREAKING CHANGES: Add "!" after type (e.g., "feat!") for major bump'
  );

  const choice = await question("\nEnter your choice (1-11): ");
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= commitTypes.length) {
    console.log("❌ Invalid choice. Please try again.");
    return selectCommitType();
  }

  return commitTypes[index];
}

async function getScope() {
  console.log("\n🎯 Scope (optional):");
  console.log("   Examples: api, cli, components, docs, tests");
  const scope = await question("Enter scope (press Enter to skip): ");
  return scope.trim();
}

async function getDescription() {
  console.log("\n📄 Description:");
  console.log("   Write a short, imperative tense description of the change");
  console.log(
    '   Examples: "add user authentication", "fix component rendering bug"'
  );
  const description = await question("Enter description: ");

  if (!description.trim()) {
    console.log("❌ Description is required. Please try again.");
    return getDescription();
  }

  return description.trim();
}

async function getBreakingChange() {
  const hasBreaking = await question(
    "\n💥 Does this include breaking changes? (y/N): "
  );
  if (hasBreaking.toLowerCase().startsWith("y")) {
    const description = await question("Describe the breaking change: ");
    return description.trim();
  }
  return null;
}

async function getBody() {
  const hasBody = await question("\n📋 Add a longer description? (y/N): ");
  if (hasBody.toLowerCase().startsWith("y")) {
    const body = await question("Enter body: ");
    return body.trim();
  }
  return null;
}

function buildCommitMessage(type, scope, description, body, breakingChange) {
  let message = type.value;

  if (scope) {
    message += `(${scope})`;
  }

  if (breakingChange) {
    message += "!";
  }

  message += `: ${description}`;

  if (body || breakingChange) {
    message += "\n";
    if (body) {
      message += `\n${body}`;
    }
    if (breakingChange) {
      message += `\nBREAKING CHANGE: ${breakingChange}`;
    }
  }

  return message;
}

function getVersionBumpType(type, hasBreaking) {
  if (hasBreaking) return "major";
  return type.bump;
}

async function confirmCommit(message, bumpType) {
  console.log("\n📜 Commit message preview:");
  console.log("═".repeat(50));
  console.log(message);
  console.log("═".repeat(50));

  const bumpIcon =
    bumpType === "major" ? "💥" : bumpType === "minor" ? "✨" : "🐛";
  console.log(
    `\n🔄 This will suggest a ${bumpIcon} ${bumpType.toUpperCase()} version bump`
  );

  const confirmed = await question("\nCommit this message? (Y/n): ");
  return !confirmed.toLowerCase().startsWith("n");
}

async function executeCommit(message) {
  try {
    // Stage all changes
    execSync("git add .", { stdio: "inherit" });

    // Create commit with message
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      stdio: "inherit",
    });

    console.log("\n✅ Commit created successfully!");

    // Show the commit
    const commitHash = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
    }).trim();
    console.log(`📝 Commit: ${commitHash}`);
  } catch (error) {
    console.error("\n❌ Failed to create commit:", error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 Figma to React MCP - Commit Helper\n");
  console.log(
    "This tool helps you create conventional commit messages for proper version bumping.\n"
  );

  try {
    const type = await selectCommitType();
    const scope = await getScope();
    const description = await getDescription();
    const body = await getBody();
    const breakingChange = await getBreakingChange();

    const message = buildCommitMessage(
      type,
      scope,
      description,
      body,
      breakingChange
    );
    const bumpType = getVersionBumpType(type, !!breakingChange);

    const confirmed = await confirmCommit(message, bumpType);
    if (!confirmed) {
      console.log("❌ Commit cancelled");
      process.exit(0);
    }

    await executeCommit(message);

    console.log("\n💡 Next steps:");
    console.log("   npm run release:analyze  # Check suggested version bump");
    console.log("   npm run release          # Interactive release");
    console.log(
      `   npm run release:${bumpType}   # Direct ${bumpType} release`
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildCommitMessage, getVersionBumpType };
