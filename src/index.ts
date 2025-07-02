#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { Config } from "./config";
import { Logger } from "./utils/logger";
import { FigmaUrlParser } from "./utils/figma-parser";
import { GitHubIntegration } from "./integrations/github";
import { FigmaIntegration } from "./integrations/figma";
import { PlaywrightIntegration } from "./integrations/playwright";
import { WorkflowService } from "./services/workflow";

class FrontendDevMCPServer {
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
    this.server = new Server(
      {
        name: this.config.server.name,
        version: this.config.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

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

      return { fileId, nodeId: nodeId || undefined };
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
            { type: "text", text: JSON.stringify(fileResult, null, 2) },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `No specific frame selected. Please select a frame or component from the Figma file and provide the URL with node-id parameter.\n\nAvailable frames and components will be analyzed... (Implementation would show frame list here)`,
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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
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

    this.logger.info("Frontend Dev MCP Server ready! 🎨➡️💻");
    this.logger.info(
      "Available tools: design_to_code, test_design_implementation, create_design_pr, analyze_figma_design, setup_project_branch"
    );

    // Handle graceful shutdown
    const shutdown = async () => {
      this.logger.info("Shutting down Frontend Dev MCP Server...");
      await this.playwright.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

// Start the server
async function main() {
  try {
    const server = new FrontendDevMCPServer();
    await server.run();
  } catch (error) {
    console.error("Failed to start Frontend Dev MCP Server:", error);
    console.error(
      "\nPlease ensure you have set up your environment variables:"
    );
    console.error("- GITHUB_TOKEN: Your GitHub personal access token");
    console.error("- FIGMA_ACCESS_TOKEN: Your Figma access token");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
