#!/usr/bin/env node

const { execSync } = require("child_process");
const { readFileSync, writeFileSync } = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

function getVersionInfo() {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const current = packageJson.version;
  const [major, minor, patch] = current.split(".").map(Number);

  return {
    current,
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`,
  };
}

function showRecentChanges() {
  try {
    console.log("📋 Recent changes:");
    const changes = execSync("git log --oneline -10", { encoding: "utf8" });
    console.log(changes);
  } catch (error) {
    console.log("📋 Could not fetch recent changes");
  }
}

async function promptVersionType(versionInfo) {
  console.log("🎯 Select version bump type:\n");
  console.log(`1. 🐛 Patch (${versionInfo.current} → ${versionInfo.patch})`);
  console.log("   - Bug fixes, documentation updates");
  console.log("   - No new features or breaking changes\n");

  console.log(`2. ✨ Minor (${versionInfo.current} → ${versionInfo.minor})`);
  console.log("   - New features, enhancements");
  console.log("   - Backwards compatible changes\n");

  console.log(`3. 💥 Major (${versionInfo.current} → ${versionInfo.major})`);
  console.log("   - Breaking changes");
  console.log("   - API changes, major refactors\n");

  const choice = await question("Enter your choice (1/2/3): ");

  switch (choice.trim()) {
    case "1":
      return "patch";
    case "2":
      return "minor";
    case "3":
      return "major";
    default:
      console.log("❌ Invalid choice. Please select 1, 2, or 3.");
      return promptVersionType(versionInfo);
  }
}

async function confirmRelease(versionType, versionInfo) {
  const newVersion = versionInfo[versionType];
  console.log(`\n🔄 About to release version ${newVersion}`);
  console.log("This will:");
  console.log("- Run tests and linting");
  console.log("- Build the project");
  console.log("- Update package.json");
  console.log("- Create git tag");
  console.log("- Publish to npm");
  console.log("- Push to GitHub\n");

  const answer = await question("Continue with release? (y/N): ");
  return answer.toLowerCase().startsWith("y");
}

function executeRelease(versionType) {
  console.log("\n🔨 Starting release process...\n");

  try {
    // Run tests
    console.log("1️⃣ Running tests...");
    execSync("npm test", { stdio: "inherit" });

    // Run linting
    console.log("2️⃣ Running linter...");
    execSync("npm run lint", { stdio: "inherit" });

    // Build project
    console.log("3️⃣ Building project...");
    execSync("npm run build", { stdio: "inherit" });

    // Update version
    console.log(`4️⃣ Updating version (${versionType})...`);
    const output = execSync(`npm version ${versionType} --no-git-tag-version`, {
      encoding: "utf8",
    });
    const newVersion = output.trim().replace("v", "");

    // Update CLI version reference
    console.log("5️⃣ Updating CLI version references...");
    updateCLIVersion(newVersion);

    // Create commit
    console.log("6️⃣ Creating git commit...");
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "chore: release v${newVersion}"`, {
      stdio: "inherit",
    });

    // Create git tag
    console.log("7️⃣ Creating git tag...");
    execSync(`git tag v${newVersion}`, { stdio: "inherit" });

    // Publish to npm
    console.log("8️⃣ Publishing to npm...");
    execSync("npm publish", { stdio: "inherit" });

    // Push to GitHub
    console.log("9️⃣ Pushing to GitHub...");
    execSync("git push && git push --tags", { stdio: "inherit" });

    console.log("✅ Release completed successfully!");
  } catch (error) {
    console.error("❌ Release failed:", error.message);
    process.exit(1);
  }
}

function updateCLIVersion(version) {
  const indexPath = "src/index.ts";
  let content = readFileSync(indexPath, "utf8");
  content = content.replace(
    /figma-to-react-mcp v[\d.]+/g,
    `figma-to-react-mcp v${version}`
  );
  writeFileSync(indexPath, content);
}

async function main() {
  console.log("🚀 Figma to React MCP Release Manager\n");

  try {
    // Get current version and calculate bumps
    const versionInfo = getVersionInfo();
    console.log(`Current version: ${versionInfo.current}\n`);

    // Show changes since last release
    showRecentChanges();

    // Prompt for version type
    const versionType = await promptVersionType(versionInfo);

    // Confirm release
    const confirmed = await confirmRelease(versionType, versionInfo);
    if (!confirmed) {
      console.log("❌ Release cancelled");
      process.exit(0);
    }

    // Execute release
    executeRelease(versionType);
  } catch (error) {
    console.error("❌ Release failed:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
