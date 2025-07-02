import axios, { AxiosInstance } from "axios";
import {
  FigmaConfig,
  FigmaDesign,
  FigmaFrame,
  FigmaNode,
  ToolResult,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface DesignTokenCache {
  colors: Map<string, string>;
  fonts: Map<string, string>;
  spacing: Map<string, number>;
  borderRadius: Map<string, number>;
}

export class FigmaIntegration {
  private api: AxiosInstance;
  private config: FigmaConfig;
  private logger: Logger;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  private tokenCache: DesignTokenCache = {
    colors: new Map(),
    fonts: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
  };

  constructor(config: FigmaConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.api = axios.create({
      baseURL: "https://api.figma.com/v1",
      headers: {
        "X-Figma-Token": this.config.accessToken,
        "Content-Type": "application/json",
      },
      timeout: 30000,
      // Connection pooling
      maxRedirects: 3,
    });

    // Add response interceptor for caching
    this.api.interceptors.response.use(
      (response) => {
        // Cache successful responses
        if (response.config.url) {
          this.setCache(response.config.url, response.data);
        }
        return response;
      },
      (error) => {
        this.logger.error("Figma API request failed", {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  private setCache<T>(key: string, data: T, ttl = this.cacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  async getFile(fileId: string): Promise<ToolResult> {
    try {
      const cacheKey = `/files/${fileId}`;
      const cached = this.getCache(cacheKey);

      if (cached) {
        this.logger.debug(`Using cached Figma file: ${fileId}`);
        return { success: true, data: cached };
      }

      this.logger.info(`Fetching Figma file: ${fileId}`);
      const response = await this.api.get(cacheKey);
      const fileData = response.data;

      const figmaDesign: FigmaDesign = {
        id: fileId,
        name: fileData.name,
        lastModified: fileData.lastModified,
        thumbnailUrl: fileData.thumbnailUrl || "",
        version: fileData.version,
      };

      const result = {
        design: figmaDesign,
        document: fileData.document,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Figma file: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFrame(fileId: string, nodeId: string): Promise<ToolResult> {
    try {
      this.logger.info(`Fetching Figma frame: ${fileId}/${nodeId}`);

      const fileResult = await this.getFile(fileId);
      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const frameNode = this.findNodeById(document, nodeId);

      if (!frameNode) {
        return {
          success: false,
          error: `Frame with ID ${nodeId} not found`,
        };
      }

      const frame: FigmaFrame = {
        id: frameNode.id,
        name: frameNode.name,
        width: frameNode.absoluteBoundingBox?.width || 0,
        height: frameNode.absoluteBoundingBox?.height || 0,
        x: frameNode.absoluteBoundingBox?.x || 0,
        y: frameNode.absoluteBoundingBox?.y || 0,
        backgroundColor: this.extractBackgroundColor(frameNode),
        children: frameNode.children
          ? frameNode.children.map((child: any) =>
            this.convertToFigmaNode(child),
          )
          : [],
      };

      return {
        success: true,
        data: frame,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch Figma frame: ${fileId}/${nodeId}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getImages(fileId: string, nodeIds: string[]): Promise<ToolResult> {
    try {
      this.logger.info(`Fetching Figma images: ${fileId}`);

      const params = new URLSearchParams({
        ids: nodeIds.join(","),
        format: "png",
        scale: "2",
      });

      const response = await this.api.get(`/images/${fileId}?${params}`);
      const imageData = response.data;

      if (imageData.err) {
        return {
          success: false,
          error: imageData.err,
        };
      }

      return {
        success: true,
        data: imageData.images,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Figma images: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async analyzeDesignTokens(fileId: string): Promise<ToolResult> {
    try {
      const cacheKey = `tokens:${fileId}`;
      const cached = this.getCache(cacheKey);

      if (cached) {
        this.logger.debug(`Using cached design tokens: ${fileId}`);
        return { success: true, data: cached };
      }

      this.logger.info(`Analyzing design tokens for file: ${fileId}`);
      const fileResult = await this.getFile(fileId);

      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const designTokens = this.extractDesignTokensOptimized(document);

      // Cache the result with longer TTL for design tokens
      this.setCache(cacheKey, designTokens, this.cacheTTL * 2);

      return {
        success: true,
        data: designTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze design tokens: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async extractComponents(fileId: string): Promise<ToolResult> {
    try {
      const cacheKey = `components:${fileId}`;
      const cached = this.getCache(cacheKey);

      if (cached) {
        this.logger.debug(`Using cached components: ${fileId}`);
        return { success: true, data: cached };
      }

      this.logger.info(`Extracting components from file: ${fileId}`);
      const fileResult = await this.getFile(fileId);

      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const components = this.findComponentsOptimized(document);

      this.setCache(cacheKey, components, this.cacheTTL * 2);

      return {
        success: true,
        data: components,
      };
    } catch (error) {
      this.logger.error(`Failed to extract components: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private findNodeById(node: any, id: string): any {
    if (node.id === id) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeById(child, id);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private extractBackgroundColor(node: any): string {
    if (node.fills && node.fills.length > 0) {
      const solidFill = node.fills.find((fill: any) => fill.type === "SOLID");
      if (solidFill && solidFill.color) {
        const { r, g, b, a = 1 } = solidFill.color;
        return `rgba(${Math.round(r * 255)}, ${Math.round(
          g * 255,
        )}, ${Math.round(b * 255)}, ${a})`;
      }
    }
    return "#ffffff";
  }

  private extractDesignTokensOptimized(document: any): any {
    // Reset cache for new extraction
    this.tokenCache = {
      colors: new Map(),
      fonts: new Map(),
      spacing: new Map(),
      borderRadius: new Map(),
    };

    // Use iterative approach instead of recursive for better performance
    const nodesToProcess = [document];

    while (nodesToProcess.length > 0) {
      const node = nodesToProcess.pop()!;
      this.processNodeForTokens(node);

      if (node.children) {
        nodesToProcess.push(...node.children);
      }
    }

    return {
      colors: Array.from(this.tokenCache.colors.values()),
      fonts: Array.from(this.tokenCache.fonts.values()),
      spacing: Array.from(this.tokenCache.spacing.values()).sort(
        (a, b) => a - b,
      ),
      borderRadius: Array.from(this.tokenCache.borderRadius.values()).sort(
        (a, b) => a - b,
      ),
    };
  }

  private processNodeForTokens(node: any): void {
    // Extract colors
    if (node.fills) {
      node.fills.forEach((fill: any) => {
        if (fill.type === "SOLID" && fill.color) {
          const { r, g, b, a = 1 } = fill.color;
          const colorKey = `${r}-${g}-${b}-${a}`;
          const colorValue = `rgba(${Math.round(r * 255)}, ${Math.round(
            g * 255,
          )}, ${Math.round(b * 255)}, ${a})`;
          this.tokenCache.colors.set(colorKey, colorValue);
        }
      });
    }

    // Extract fonts
    if (node.style?.fontFamily) {
      this.tokenCache.fonts.set(node.style.fontFamily, node.style.fontFamily);
    }

    // Extract spacing and dimensions
    if (node.absoluteBoundingBox) {
      const width = Math.round(node.absoluteBoundingBox.width);
      const height = Math.round(node.absoluteBoundingBox.height);

      if (width > 0) this.tokenCache.spacing.set(`w-${width}`, width);
      if (height > 0) this.tokenCache.spacing.set(`h-${height}`, height);
    }

    // Extract border radius
    if (typeof node.cornerRadius === "number") {
      this.tokenCache.borderRadius.set(
        `br-${node.cornerRadius}`,
        node.cornerRadius,
      );
    }
  }

  private findComponentsOptimized(document: any): FigmaNode[] {
    const components: FigmaNode[] = [];
    const nodesToProcess = [document];

    while (nodesToProcess.length > 0) {
      const node = nodesToProcess.pop()!;

      if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
        components.push(this.convertToFigmaNode(node));
      }

      if (node.children) {
        nodesToProcess.push(...node.children);
      }
    }

    return components;
  }

  private convertToFigmaNode(node: any): FigmaNode {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      width: node.absoluteBoundingBox?.width || 0,
      height: node.absoluteBoundingBox?.height || 0,
      x: node.absoluteBoundingBox?.x || 0,
      y: node.absoluteBoundingBox?.y || 0,
      fills: node.fills,
      strokes: node.strokes,
      effects: node.effects,
      cornerRadius: node.cornerRadius,
      children: node.children
        ? node.children.map((child: any) => this.convertToFigmaNode(child))
        : undefined,
    };
  }

  // Clear cache (useful for testing or memory management)
  clearCache(): void {
    this.cache.clear();
    this.tokenCache = {
      colors: new Map(),
      fonts: new Map(),
      spacing: new Map(),
      borderRadius: new Map(),
    };
  }
}
