import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";

interface VersionInfo {
  current: string;
  patch: string;
  minor: string;
  major: string;
}

export class ReleaseManager {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async run(): Promise<void> {
    try {
      console.log("🚀 Figma to React MCP Release Manager\n");

      // Get current version and calculate bumps
      const versionInfo = this.getVersionInfo();
      console.log(`Current version: ${versionInfo.current}\n`);

      // Show changes since last release
      await this.showRecentChanges();

      // Prompt for version type
      const versionType = await this.promptVersionType(versionInfo);

      // Confirm release
      const confirmed = await this.confirmRelease(versionType, versionInfo);
      if (!confirmed) {
        console.log("❌ Release cancelled");
        return;
      }

      // Execute release
      await this.executeRelease(versionType);

      console.log("✅ Release completed successfully!");
    } catch (error) {
      console.error("❌ Release failed:", error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  private getVersionInfo(): VersionInfo {
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

  private async showRecentChanges(): Promise<void> {
    try {
      const changes = execSync("git log --oneline -10", { encoding: "utf8" });
      console.log("📋 Recent changes:");
      console.log(changes);
    } catch (error) {
      console.log("📋 Could not fetch recent changes");
    }
  }

  private async promptVersionType(versionInfo: VersionInfo): Promise<string> {
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

    return new Promise((resolve) => {
      this.rl.question("Enter your choice (1/2/3): ", (answer) => {
        const choice = answer.trim();
        switch (choice) {
          case "1":
            resolve("patch");
            break;
          case "2":
            resolve("minor");
            break;
          case "3":
            resolve("major");
            break;
          default:
            console.log("❌ Invalid choice. Please select 1, 2, or 3.");
            this.promptVersionType(versionInfo).then(resolve);
        }
      });
    });
  }

  private async confirmRelease(
    versionType: string,
    versionInfo: VersionInfo
  ): Promise<boolean> {
    const newVersion = versionInfo[versionType as keyof VersionInfo];
    console.log(`\n🔄 About to release version ${newVersion}`);
    console.log("This will:");
    console.log("- Run tests and linting");
    console.log("- Build the project");
    console.log("- Update package.json");
    console.log("- Create git tag");
    console.log("- Publish to npm");
    console.log("- Push to GitHub\n");

    return new Promise((resolve) => {
      this.rl.question("Continue with release? (y/N): ", (answer) => {
        resolve(answer.toLowerCase().startsWith("y"));
      });
    });
  }

  private async executeRelease(versionType: string): Promise<void> {
    console.log("\n🔨 Starting release process...\n");

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
    this.updateCLIVersion(newVersion);

    // Create commit
    console.log("5️⃣ Creating git commit...");
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "chore: release v${newVersion}"`, {
      stdio: "inherit",
    });

    // Create git tag
    console.log("6️⃣ Creating git tag...");
    execSync(`git tag v${newVersion}`, { stdio: "inherit" });

    // Publish to npm
    console.log("7️⃣ Publishing to npm...");
    execSync("npm publish", { stdio: "inherit" });

    // Push to GitHub
    console.log("8️⃣ Pushing to GitHub...");
    execSync("git push && git push --tags", { stdio: "inherit" });
  }

  private updateCLIVersion(version: string): void {
    // Update version references in CLI files
    const indexPath = "src/index.ts";
    let content = readFileSync(indexPath, "utf8");
    content = content.replace(
      /figma-to-react-mcp v[\d.]+/g,
      `figma-to-react-mcp v${version}`
    );
    writeFileSync(indexPath, content);
  }
}

// CLI runner
if (import.meta.url === new URL(process.argv[1] || "", "file:").href) {
  const releaseManager = new ReleaseManager();
  releaseManager.run().catch(console.error);
}
