#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

import { Config } from "./config/index.js";
import { Logger } from "./utils/logger.js";
import { FigmaUrlParser } from "./utils/figma-parser.js";
import { GitHubIntegration } from "./integrations/github.js";
import { FigmaIntegration } from "./integrations/figma.js";
import { PlaywrightIntegration } from "./integrations/playwright.js";
import { WorkflowService } from "./services/workflow.js";

// Read version from package.json
function getPackageVersion(): string {
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    const packageContent = fs.readFileSync(packagePath, "utf-8");
    const packageJson = JSON.parse(packageContent);
    return packageJson.version;
  } catch (error) {
    return "2.0.3"; // fallback version
  }
}

class FigmaToReactMCPServer {
  private server: Server;
  private config: Config;
  private logger: Logger;
  private github: GitHubIntegration;
  private figma: FigmaIntegration;
  private playwright: PlaywrightIntegration;
  private workflow: WorkflowService;

  constructor() {
    // Initialize configuration
    this.config = Config.getInstance();
    this.logger = Logger.getInstance(this.config.server.logLevel);

    // Initialize integrations
    this.github = new GitHubIntegration(this.config.github);
    this.figma = new FigmaIntegration(this.config.figma);
    this.playwright = new PlaywrightIntegration(this.config.playwright);
    this.workflow = new WorkflowService(
      this.github,
      this.figma,
      this.playwright
    );

    // Initialize MCP server
    this.server = new Server({
      name: this.config.server.name,
      version: this.config.server.version,
      capabilities: {
        tools: {},
      },
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "design_to_code",
            description:
              "Convert Figma design to React component and create GitHub PR. Accepts Figma URLs or file IDs.",
            inputSchema: {
              type: "object",
              properties: {
                figmaInput: {
                  type: "string",
                  description:
                    "Figma URL (with node selection) or file ID. Example: https://www.figma.com/file/abc123/Design?node-id=1%3A2",
                },
                componentName: {
                  type: "string",
                  description:
                    'Name for the generated React component (e.g., "HeroButton")',
                },
                outputPath: {
                  type: "string",
                  description:
                    'Output directory for component files (default: "./src/components")',
                  default: "./src/components",
                },
                githubBranch: {
                  type: "string",
                  description:
                    "GitHub branch name for the changes (default: auto-generated)",
                  default: "auto-generated",
                },
              },
              required: ["figmaInput", "componentName"],
            },
          },
          {
            name: "test_design_implementation",
            description:
              "Test generated component against Figma design with visual regression testing.",
            inputSchema: {
              type: "object",
              properties: {
                figmaInput: {
                  type: "string",
                  description: "Figma URL or file ID for comparison",
                },
                componentUrl: {
                  type: "string",
                  description: "URL of the implemented component to test",
                },
                componentName: {
                  type: "string",
                  description: "Name of the component being tested",
                },
              },
              required: ["figmaInput", "componentUrl", "componentName"],
            },
          },
          {
            name: "create_design_pr",
            description:
              "Create GitHub PR with generated component and test results.",
            inputSchema: {
              type: "object",
              properties: {
                figmaInput: {
                  type: "string",
                  description: "Figma URL or file ID",
                },
                componentName: {
                  type: "string",
                  description: "Component name",
                },
                githubBranch: {
                  type: "string",
                  description: "GitHub branch name",
                },
                testResults: {
                  type: "array",
                  description: "Test results to include (optional)",
                  items: { type: "object" },
                },
              },
              required: ["figmaInput", "componentName", "githubBranch"],
            },
          },
          {
            name: "analyze_figma_design",
            description:
              "Analyze Figma design and extract design tokens, components, and structure.",
            inputSchema: {
              type: "object",
              properties: {
                figmaInput: {
                  type: "string",
                  description: "Figma URL or file ID to analyze",
                },
              },
              required: ["figmaInput"],
            },
          },
          {
            name: "setup_project_branch",
            description: "Create a new GitHub branch for feature development.",
            inputSchema: {
              type: "object",
              properties: {
                branchName: {
                  type: "string",
                  description:
                    'Name for the new branch (e.g., "feature/hero-section")',
                },
                baseBranch: {
                  type: "string",
                  description: "Base branch (default: main)",
                  default: "main",
                },
              },
              required: ["branchName"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info(`Executing tool: ${name}`, args);

      try {
        switch (name) {
          case "design_to_code":
            return await this.handleDesignToCode(args);
          case "test_design_implementation":
            return await this.handleTestDesignImplementation(args);
          case "create_design_pr":
            return await this.handleCreateDesignPR(args);
          case "analyze_figma_design":
            return await this.handleAnalyzeFigmaDesign(args);
          case "setup_project_branch":
            return await this.handleSetupProjectBranch(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    });
  }

  private parseFigmaInput(figmaInput: string): {
    fileId: string;
    nodeId?: string;
  } {
    try {
      const fileId = FigmaUrlParser.extractFileId(figmaInput);
      const nodeId = FigmaUrlParser.extractNodeId(figmaInput);

      const result: { fileId: string; nodeId?: string } = { fileId };
      if (nodeId) {
        result.nodeId = nodeId;
      }
      return result;
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid Figma input: ${
          error instanceof Error ? error.message : "Unknown error"
        }\n\n${FigmaUrlParser.getInputHelpMessage()}`
      );
    }
  }

  private generateBranchName(
    componentName: string,
    githubBranch?: string
  ): string {
    if (githubBranch && githubBranch !== "auto-generated") {
      return githubBranch;
    }

    const sanitized = componentName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `feature/${sanitized}-${timestamp}`;
  }

  // Tool Handlers
  private async handleDesignToCode(args: any) {
    try {
      const { fileId, nodeId } = this.parseFigmaInput(args.figmaInput);
      const branchName = this.generateBranchName(
        args.componentName,
        args.githubBranch
      );
      const outputPath = args.outputPath || "./src/components";

      if (!nodeId) {
        // If no specific node is selected, analyze the file and show available frames
        const fileResult = await this.figma.getFile(fileId);
        if (!fileResult.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch Figma file: ${fileResult.error}\n\nPlease check:\n1. Your Figma access token is valid\n2. The file ID is correct\n3. You have access to the file`,
              },
            ],
          };
        }

        // Extract available frames from the file
        const frames = this.extractAvailableFrames(fileResult.data.document);
        const frameList = frames
          .map((frame) => `- ${frame.name} (ID: ${frame.id})`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `🎨 Figma file loaded successfully!\n\nAvailable frames and components:\n${frameList}\n\nTo generate a component, please select a specific frame and provide the URL with node-id parameter.\n\nExample: https://www.figma.com/file/${fileId}/Design?node-id=1%3A2`,
            },
          ],
        };
      }

      const context = {
        figmaFileId: fileId,
        frameId: nodeId,
        componentName: args.componentName,
        outputPath,
        githubBranch: branchName,
      };

      const result = await this.workflow.executeDesignToCodeWorkflow(context);

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `✅ Component generated successfully!\n\n📁 Files created:\n- ${result.data.component.name}.tsx\n- ${result.data.component.name}.css\n- index.ts\n\n🌿 Branch: ${result.data.branch}\n📝 Commit: ${result.data.commitSha}\n\n⏱️ Duration: ${result.data.duration}ms`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Component generation failed: ${result.error}\n\nPlease check your configuration and try again.`,
            },
          ],
        };
      }
    } catch (error) {
      this.logger.error("Design to code workflow failed", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Unexpected error: ${
              error instanceof Error ? error.message : "Unknown error"
            }\n\nPlease check your configuration and try again.`,
          },
        ],
      };
    }
  }

  private extractAvailableFrames(
    document: any
  ): Array<{ id: string; name: string; type: string }> {
    const frames: Array<{ id: string; name: string; type: string }> = [];

    const extractFrames = (node: any) => {
      if (
        node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE"
      ) {
        frames.push({
          id: node.id,
          name: node.name,
          type: node.type,
        });
      }

      if (node.children) {
        node.children.forEach(extractFrames);
      }
    };

    extractFrames(document);
    return frames.slice(0, 10); // Limit to first 10 frames for readability
  }

  private async handleTestDesignImplementation(args: any) {
    const { fileId, nodeId } = this.parseFigmaInput(args.figmaInput);

    if (!nodeId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Node ID required for design testing. Please provide a Figma URL with node selection."
      );
    }

    const context = {
      figmaFileId: fileId,
      frameId: nodeId,
      componentName: args.componentName,
      outputPath: "./test-output",
      githubBranch: "test-branch",
    };

    const result = await this.workflow.executeVisualTestingWorkflow(
      context,
      args.componentUrl
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleCreateDesignPR(args: any) {
    const { fileId, nodeId } = this.parseFigmaInput(args.figmaInput);

    const context = {
      figmaFileId: fileId,
      frameId: nodeId || "main",
      componentName: args.componentName,
      outputPath: "./src/components",
      githubBranch: args.githubBranch,
      testResults: args.testResults,
    };

    const result = await this.workflow.createPullRequestWithResults(context);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleAnalyzeFigmaDesign(args: any) {
    const { fileId } = this.parseFigmaInput(args.figmaInput);

    // Get file info and analyze design tokens
    const fileResult = await this.figma.getFile(fileId);
    const tokensResult = await this.figma.analyzeDesignTokens(fileId);
    const componentsResult = await this.figma.extractComponents(fileId);

    const analysis = {
      file: fileResult.success ? fileResult.data : { error: fileResult.error },
      designTokens: tokensResult.success
        ? tokensResult.data
        : { error: tokensResult.error },
      components: componentsResult.success
        ? componentsResult.data
        : { error: componentsResult.error },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
    };
  }

  private async handleSetupProjectBranch(args: any) {
    const result = await this.github.createBranch(
      args.branchName,
      args.baseBranch || "main"
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async run(): Promise<void> {
    this.logger.info(
      `Starting ${this.config.server.name} v${this.config.server.version}`
    );

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info("Figma to React MCP Server ready! 🎨➡️💻");
    this.logger.info(
      "Available tools: design_to_code, test_design_implementation, create_design_pr, analyze_figma_design, setup_project_branch"
    );

    // Handle graceful shutdown
    const shutdown = async () => {
      this.logger.info("Shutting down Figma to React MCP Server...");
      await this.playwright.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

// Start the server
async function main() {
  // Handle CLI arguments
  const args = process.argv.slice(2);

  if (args.includes("--setup")) {
    const { CLISetup } = await import("./cli-setup.js");
    const setup = new CLISetup();
    await setup.run();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`figma-to-react-mcp v${getPackageVersion()}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🎨 Figma to React MCP v${getPackageVersion()}
=================================

A unified MCP server for frontend developers combining GitHub, Figma, and Playwright integrations.

Usage:
  npx figma-to-react-mcp [options]

Options:
  --setup           Interactive setup for tokens and Cursor configuration
  -v, --version     Show version number
  -h, --help        Show help information

Environment Variables Required:
  GITHUB_TOKEN           Your GitHub personal access token
  FIGMA_ACCESS_TOKEN     Your Figma access token

Optional Environment Variables:
  PLAYWRIGHT_BROWSER     Browser to use (default: chromium)
  LOG_LEVEL             Logging level (default: info)

Examples:
  npx figma-to-react-mcp --setup    # Interactive setup
  npx figma-to-react-mcp             # Start MCP server
  GITHUB_TOKEN=xxx FIGMA_ACCESS_TOKEN=yyy npx figma-to-react-mcp

For more information, visit: https://github.com/surisagar900/figma-to-react-mcp
`);
    process.exit(0);
  }

  try {
    const server = new FigmaToReactMCPServer();
    await server.run();
  } catch (error) {
    console.error("❌ Failed to start Figma to React MCP Server:", error);
    console.error(
      "\n🔧 Please ensure you have set up your environment variables:"
    );
    console.error("   • GITHUB_TOKEN: Your GitHub personal access token");
    console.error("   • FIGMA_ACCESS_TOKEN: Your Figma access token");
    console.error(
      "\n💡 Run 'npx figma-to-react-mcp --setup' for interactive setup"
    );
    process.exit(1);
  }
}

// Check if this file is being run directly
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  main().catch(console.error);
}
