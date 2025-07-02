#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createInterface } from "readline";

interface SetupConfig {
  githubToken: string;
  figmaToken: string;
}

class CLISetup {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  private async promptSecret(question: string): Promise<string> {
    return new Promise((resolve) => {
      // Hide input for secrets
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let input = "";
      process.stdin.on("data", (buffer: Buffer) => {
        const char = buffer.toString();

        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.exit();
        } else if (char === "\u0008" || char === "\u007f") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      });
    });
  }

  private getCursorConfigPath(): string {
    const platform = os.platform();
    let configDir: string;

    switch (platform) {
      case "darwin":
        configDir = path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Cursor",
          "User"
        );
        break;
      case "win32":
        configDir = path.join(
          os.homedir(),
          "AppData",
          "Roaming",
          "Cursor",
          "User"
        );
        break;
      default:
        configDir = path.join(os.homedir(), ".config", "Cursor", "User");
    }

    return path.join(
      configDir,
      "globalStorage",
      "rooveterinaryinc.roo-cline",
      "settings",
      "cline_mcp_settings.json"
    );
  }

  private async updateCursorConfig(config: SetupConfig): Promise<void> {
    const configPath = this.getCursorConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const mcpConfig = {
      mcpServers: {
        "figma-to-react-mcp": {
          command: "npx",
          args: ["figma-to-react-mcp"],
          env: {
            GITHUB_TOKEN: config.githubToken,
            FIGMA_ACCESS_TOKEN: config.figmaToken,
          },
        },
      },
    };

    // Read existing config if it exists
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        existingConfig = JSON.parse(content);
      } catch (error) {
        console.log(
          "⚠️  Could not read existing Cursor config, creating new one"
        );
      }
    }

    // Merge configurations
    const finalConfig = {
      ...existingConfig,
      mcpServers: {
        ...(existingConfig as any).mcpServers,
        ...mcpConfig.mcpServers,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
    console.log("✅ Cursor configuration updated successfully!");
  }

  private async createEnvFile(config: SetupConfig): Promise<void> {
    const envContent = `# Figma to React MCP Configuration
GITHUB_TOKEN=${config.githubToken}
FIGMA_ACCESS_TOKEN=${config.figmaToken}

# Optional settings
LOG_LEVEL=info
PLAYWRIGHT_BROWSER=chromium
`;

    fs.writeFileSync(".env", envContent);
    console.log("✅ .env file created successfully!");
  }

  async run(): Promise<void> {
    console.log(`
🎨 Figma to React MCP Setup
================================

This setup will configure your MCP server with GitHub and Figma integrations.
You'll need:
• GitHub Personal Access Token with repo permissions
• Figma Access Token from your Figma account settings

Let's get started!
`);

    try {
      const githubToken = await this.promptSecret(
        "Enter your GitHub Personal Access Token: "
      );
      if (!githubToken) {
        throw new Error("GitHub token is required");
      }

      const figmaToken = await this.promptSecret(
        "Enter your Figma Access Token: "
      );
      if (!figmaToken) {
        throw new Error("Figma token is required");
      }

      const config: SetupConfig = {
        githubToken,
        figmaToken,
      };

      console.log("\n📝 Setting up configuration...");

      // Create .env file
      await this.createEnvFile(config);

      // Update Cursor configuration
      await this.updateCursorConfig(config);

      console.log(`
✨ Setup completed successfully!

Next steps:
1. Restart Cursor to load the new MCP configuration
2. Open a project and look for the MCP tools in the sidebar
3. Try running: npx figma-to-react-mcp --help

Available tools:
• design_to_code - Convert Figma designs to React components
• test_design_implementation - Test components against designs
• analyze_figma_design - Extract design tokens and structure
• create_design_pr - Create GitHub PRs with generated code

Happy coding! 🚀
`);
    } catch (error) {
      console.error("❌ Setup failed:", error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

export { CLISetup };

// Run setup if called directly
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  const setup = new CLISetup();
  setup.run().catch(console.error);
}
