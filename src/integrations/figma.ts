import axios, { AxiosInstance } from 'axios';
import {
  FigmaConfig,
  FigmaDesign,
  FigmaFrame,
  FigmaNode,
  ToolResult,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class FigmaIntegration {
  private api: AxiosInstance;
  private config: FigmaConfig;
  private logger: Logger;

  constructor(config: FigmaConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.api = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        'X-Figma-Token': this.config.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async getFile(fileId: string): Promise<ToolResult> {
    try {
      this.logger.info(`Fetching Figma file: ${fileId}`);

      const response = await this.api.get(`/files/${fileId}`);
      const fileData = response.data;

      const figmaDesign: FigmaDesign = {
        id: fileId,
        name: fileData.name,
        lastModified: fileData.lastModified,
        thumbnailUrl: fileData.thumbnailUrl || '',
        version: fileData.version,
      };

      return {
        success: true,
        data: {
          design: figmaDesign,
          document: fileData.document,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Figma file: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getFrame(fileId: string, frameId: string): Promise<ToolResult> {
    try {
      this.logger.info(`Fetching Figma frame: ${frameId} from file: ${fileId}`);

      const fileResult = await this.getFile(fileId);
      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const frame = this.findNodeById(document, frameId);

      if (!frame) {
        return {
          success: false,
          error: `Frame with ID ${frameId} not found`,
        };
      }

      const figmaFrame: FigmaFrame = {
        id: frame.id,
        name: frame.name,
        width: frame.absoluteBoundingBox.width,
        height: frame.absoluteBoundingBox.height,
        backgroundColor: this.extractBackgroundColor(frame),
        children: frame.children || [],
      };

      return {
        success: true,
        data: figmaFrame,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Figma frame: ${frameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getImages(fileId: string, nodeIds: string[]): Promise<ToolResult> {
    try {
      this.logger.info(`Fetching images for nodes: ${nodeIds.join(', ')}`);

      const response = await this.api.get(`/images/${fileId}`, {
        params: {
          ids: nodeIds.join(','),
          format: 'png',
          scale: 2,
        },
      });

      return {
        success: true,
        data: response.data.images,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Figma images', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async analyzeDesignTokens(fileId: string): Promise<ToolResult> {
    try {
      this.logger.info(`Analyzing design tokens for file: ${fileId}`);

      const fileResult = await this.getFile(fileId);
      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const designTokens = this.extractDesignTokens(document);

      return {
        success: true,
        data: designTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze design tokens: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async extractComponents(fileId: string): Promise<ToolResult> {
    try {
      this.logger.info(`Extracting components from file: ${fileId}`);

      const fileResult = await this.getFile(fileId);
      if (!fileResult.success) {
        return fileResult;
      }

      const document = fileResult.data.document;
      const components = this.findComponents(document);

      return {
        success: true,
        data: components,
      };
    } catch (error) {
      this.logger.error(`Failed to extract components: ${fileId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    if (node.backgroundColor) {
      const { r, g, b, a = 1 } = node.backgroundColor;
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
        b * 255,
      )}, ${a})`;
    }

    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const { r, g, b, a = 1 } = fill.color;
        return `rgba(${Math.round(r * 255)}, ${Math.round(
          g * 255,
        )}, ${Math.round(b * 255)}, ${a})`;
      }
    }

    return 'transparent';
  }

  private extractDesignTokens(document: any): any {
    const tokens = {
      colors: new Set<string>(),
      fonts: new Set<string>(),
      spacing: new Set<number>(),
      borderRadius: new Set<number>(),
    };

    this.traverseNode(document, (node: any) => {
      // Extract colors
      if (node.fills) {
        node.fills.forEach((fill: any) => {
          if (fill.type === 'SOLID' && fill.color) {
            const { r, g, b, a = 1 } = fill.color;
            tokens.colors.add(
              `rgba(${Math.round(r * 255)}, ${Math.round(
                g * 255,
              )}, ${Math.round(b * 255)}, ${a})`,
            );
          }
        });
      }

      // Extract fonts
      if (node.style) {
        if (node.style.fontFamily) {
          tokens.fonts.add(node.style.fontFamily);
        }
      }

      // Extract spacing and dimensions
      if (node.absoluteBoundingBox) {
        tokens.spacing.add(node.absoluteBoundingBox.width);
        tokens.spacing.add(node.absoluteBoundingBox.height);
      }

      // Extract border radius
      if (node.cornerRadius !== undefined) {
        tokens.borderRadius.add(node.cornerRadius);
      }
    });

    return {
      colors: Array.from(tokens.colors),
      fonts: Array.from(tokens.fonts),
      spacing: Array.from(tokens.spacing).sort((a, b) => a - b),
      borderRadius: Array.from(tokens.borderRadius).sort((a, b) => a - b),
    };
  }

  private findComponents(document: any): FigmaNode[] {
    const components: FigmaNode[] = [];

    this.traverseNode(document, (node: any) => {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        components.push(this.convertToFigmaNode(node));
      }
    });

    return components;
  }

  private traverseNode(node: any, callback: (node: any) => void): void {
    callback(node);

    if (node.children) {
      for (const child of node.children) {
        this.traverseNode(child, callback);
      }
    }
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
}
