import { z } from "zod";

// Common types
export interface ServerConfig {
  name: string;
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

// GitHub types
export const GitHubConfigSchema = z.object({
  token: z.string(),
  owner: z.string(),
  repo: z.string().optional(),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export interface PullRequestData {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
}

// Figma types
export const FigmaConfigSchema = z.object({
  accessToken: z.string(),
});

export type FigmaConfig = z.infer<typeof FigmaConfigSchema>;

export interface FigmaDesign {
  id: string;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  children: FigmaNode[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  fills?: Array<{
    type: string;
    color: { r: number; g: number; b: number; a: number };
  }>;
  strokes?: Array<{
    type: string;
    color: { r: number; g: number; b: number; a: number };
  }>;
  effects?: Array<{
    type: string;
    visible: boolean;
    radius?: number;
    color?: { r: number; g: number; b: number; a: number };
  }>;
  cornerRadius?: number;
  children?: FigmaNode[];
}

// Playwright types
export const PlaywrightConfigSchema = z.object({
  headless: z.boolean().default(true),
  timeout: z.number().default(30000),
});

export type PlaywrightConfig = z.infer<typeof PlaywrightConfigSchema>;

export interface ScreenshotComparison {
  baseImagePath: string;
  currentImagePath: string;
  diffImagePath: string;
  similarity: number;
  pixelDifference: number;
  passed: boolean;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string | undefined;
  screenshots?: ScreenshotComparison[];
  duration: number;
}

// Workflow types
export interface WorkflowContext {
  figmaFileId: string;
  frameId: string;
  componentName: string;
  outputPath: string;
  githubBranch: string;
  testResults?: TestResult[];
}

export interface GeneratedComponent {
  name: string;
  filePath: string;
  content: string;
  framework: "react" | "vue" | "angular";
  dependencies: string[];
}

// MCP Tool types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}
