import { config } from "dotenv";
import { z } from "zod";
import { execSync } from "child_process";
import {
  GitHubConfigSchema,
  FigmaConfigSchema,
  PlaywrightConfigSchema,
} from "../types";

// Load environment variables
config();

const EnvSchema = z.object({
  // Required tokens only
  GITHUB_TOKEN: z.string(),
  FIGMA_ACCESS_TOKEN: z.string(),

  // Optional with auto-detection
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),

  // Optional with defaults
  PLAYWRIGHT_HEADLESS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  PLAYWRIGHT_TIMEOUT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("30000"),
  MCP_SERVER_NAME: z.string().default("frontend-dev-mcp-server"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export class Config {
  private static instance: Config;
  private env: z.infer<typeof EnvSchema>;
  private detectedOwner?: string;
  private detectedRepo?: string;

  private constructor() {
    try {
      this.env = EnvSchema.parse(process.env);
      this.autoDetectRepository();
    } catch (error) {
      console.error("Configuration validation failed:", error);
      throw new Error(
        "Invalid environment configuration. Please ensure GITHUB_TOKEN and FIGMA_ACCESS_TOKEN are set."
      );
    }
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private autoDetectRepository(): void {
    try {
      // Try to get repository info from git remote
      if (!this.env.GITHUB_OWNER || !this.env.GITHUB_REPO) {
        const remoteUrl = execSync("git remote get-url origin", {
          encoding: "utf8",
        }).trim();
        const match = remoteUrl.match(
          /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/
        );

        if (match) {
          this.detectedOwner = match[1];
          this.detectedRepo = match[2];
          console.log(
            `Auto-detected GitHub repository: ${this.detectedOwner}/${this.detectedRepo}`
          );
        }
      }
    } catch (error) {
      // Git detection failed, will require manual configuration
      console.warn(
        "Could not auto-detect GitHub repository. Please set GITHUB_OWNER and GITHUB_REPO in .env file if needed."
      );
    }
  }

  get github() {
    const owner = this.env.GITHUB_OWNER || this.detectedOwner;
    const repo = this.env.GITHUB_REPO || this.detectedRepo;

    if (!owner) {
      throw new Error(
        "GitHub owner not provided and could not be auto-detected. Please set GITHUB_OWNER in .env file."
      );
    }

    return GitHubConfigSchema.parse({
      token: this.env.GITHUB_TOKEN,
      owner,
      repo,
    });
  }

  get figma() {
    return FigmaConfigSchema.parse({
      accessToken: this.env.FIGMA_ACCESS_TOKEN,
    });
  }

  get playwright() {
    return PlaywrightConfigSchema.parse({
      headless: this.env.PLAYWRIGHT_HEADLESS,
      timeout: this.env.PLAYWRIGHT_TIMEOUT,
    });
  }

  get server() {
    return {
      name: this.env.MCP_SERVER_NAME,
      version: "1.0.0",
      logLevel: this.env.LOG_LEVEL,
    };
  }

  validate(): boolean {
    try {
      EnvSchema.parse(process.env);
      this.github; // This will throw if GitHub config is invalid
      return true;
    } catch {
      return false;
    }
  }
}
