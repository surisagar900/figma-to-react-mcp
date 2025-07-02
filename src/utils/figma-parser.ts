export interface FigmaUrlInfo {
  fileId: string;
  nodeId?: string;
  fileName?: string;
}

export class FigmaUrlParser {
  private static readonly FIGMA_URL_REGEX =
    /https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)\/([^/?]+)(?:\?.*node-id=([^&]+))?/;
  private static readonly FIGMA_NODE_REGEX = /node-id=([^&]+)/;

  /**
   * Parse a Figma URL to extract file ID, node ID, and file name
   */
  static parseFigmaUrl(url: string): FigmaUrlInfo | null {
    try {
      const match = url.match(this.FIGMA_URL_REGEX);

      if (!match) {
        return null;
      }

      const [, fileId, fileName, nodeId] = match;

      if (!fileId) {
        return null;
      }

      const result: FigmaUrlInfo = {
        fileId,
      };

      if (nodeId) {
        result.nodeId = this.decodeNodeId(nodeId);
      }

      if (fileName) {
        result.fileName = decodeURIComponent(fileName.replace(/-/g, " "));
      }

      return result;
    } catch (error) {
      console.error("Failed to parse Figma URL:", error);
      return null;
    }
  }

  /**
   * Extract file ID from various Figma URL formats
   */
  static extractFileId(input: string): string {
    // If it's already a file ID (alphanumeric string)
    if (/^[a-zA-Z0-9]+$/.test(input) && input.length > 10) {
      return input;
    }

    // Try to parse as URL
    const urlInfo = this.parseFigmaUrl(input);
    if (urlInfo) {
      return urlInfo.fileId;
    }

    throw new Error("Invalid Figma file ID or URL format");
  }

  /**
   * Extract node ID from Figma URL or return as-is if already a node ID
   */
  static extractNodeId(input: string): string | null {
    // If it looks like a node ID already (format: 1:2 or 1-2)
    if (/^\d+[-:]\d+$/.test(input)) {
      return input.replace("-", ":");
    }

    // Try to extract from URL
    const nodeMatch = input.match(this.FIGMA_NODE_REGEX);
    if (nodeMatch && nodeMatch[1]) {
      return this.decodeNodeId(nodeMatch[1]);
    }

    return null;
  }

  /**
   * Decode Figma node ID from URL format to API format
   */
  private static decodeNodeId(encodedNodeId: string): string {
    try {
      // Figma URLs encode node IDs like "1%3A2" which should become "1:2"
      const decoded = decodeURIComponent(encodedNodeId);
      return decoded.replace(/%3A/g, ":");
    } catch {
      return encodedNodeId;
    }
  }

  /**
   * Validate if a string is a valid Figma file ID
   */
  static isValidFileId(fileId: string): boolean {
    return /^[a-zA-Z0-9]{22,}$/.test(fileId);
  }

  /**
   * Validate if a string is a valid Figma node ID
   */
  static isValidNodeId(nodeId: string): boolean {
    return /^\d+:\d+$/.test(nodeId);
  }

  /**
   * Create a Figma URL from file ID and optional node ID
   */
  static createFigmaUrl(
    fileId: string,
    nodeId?: string,
    fileName?: string
  ): string {
    const baseUrl = `https://www.figma.com/file/${fileId}/${
      fileName || "design"
    }`;

    if (nodeId) {
      const encodedNodeId = encodeURIComponent(nodeId);
      return `${baseUrl}?node-id=${encodedNodeId}`;
    }

    return baseUrl;
  }

  /**
   * Get helpful error message for invalid Figma input
   */
  static getInputHelpMessage(): string {
    return `
Figma input can be:
1. Full Figma URL: https://www.figma.com/file/abc123/My-Design?node-id=1%3A2
2. File ID only: abc123def456
3. Design share link: https://www.figma.com/design/abc123/My-Design

For specific frames/components, include the node-id parameter in the URL.
    `.trim();
  }
}
