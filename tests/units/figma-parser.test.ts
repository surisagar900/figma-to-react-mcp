import { FigmaUrlParser } from "../../src/utils/figma-parser";

describe("FigmaUrlParser", () => {
  describe("parseFigmaUrl", () => {
    it("should parse standard Figma file URL", () => {
      const url = "https://www.figma.com/file/abc123def456/My-Design";
      const result = FigmaUrlParser.parseFigmaUrl(url);

      expect(result).toEqual({
        fileId: "abc123def456",
        fileName: "My Design",
        nodeId: undefined,
      });
    });

    it("should parse Figma URL with node selection", () => {
      const url =
        "https://www.figma.com/file/abc123def456/My-Design?node-id=1%3A2";
      const result = FigmaUrlParser.parseFigmaUrl(url);

      expect(result).toEqual({
        fileId: "abc123def456",
        fileName: "My Design",
        nodeId: "1:2",
      });
    });

    it("should parse Figma design URL", () => {
      const url =
        "https://www.figma.com/design/abc123def456/My-Design?node-id=1%3A2";
      const result = FigmaUrlParser.parseFigmaUrl(url);

      expect(result).toEqual({
        fileId: "abc123def456",
        fileName: "My Design",
        nodeId: "1:2",
      });
    });

    it("should return null for invalid URL", () => {
      const url = "https://example.com/not-figma";
      const result = FigmaUrlParser.parseFigmaUrl(url);

      expect(result).toBeNull();
    });

    it("should handle URL without www", () => {
      const url = "https://figma.com/file/abc123def456/Test";
      const result = FigmaUrlParser.parseFigmaUrl(url);

      expect(result).toEqual({
        fileId: "abc123def456",
        fileName: "Test",
        nodeId: undefined,
      });
    });
  });

  describe("extractFileId", () => {
    it("should extract file ID from URL", () => {
      const url = "https://www.figma.com/file/abc123def456/Design";
      const fileId = FigmaUrlParser.extractFileId(url);

      expect(fileId).toBe("abc123def456");
    });

    it("should return file ID if already provided", () => {
      const fileId = "abc123def456ghi789";
      const result = FigmaUrlParser.extractFileId(fileId);

      expect(result).toBe(fileId);
    });

    it("should throw error for invalid input", () => {
      expect(() => {
        FigmaUrlParser.extractFileId("invalid");
      }).toThrow("Invalid Figma file ID or URL format");
    });
  });

  describe("extractNodeId", () => {
    it("should extract node ID from URL", () => {
      const url = "https://www.figma.com/file/abc123/test?node-id=1%3A2";
      const nodeId = FigmaUrlParser.extractNodeId(url);

      expect(nodeId).toBe("1:2");
    });

    it("should return node ID if already in correct format", () => {
      const nodeId = FigmaUrlParser.extractNodeId("1:2");
      expect(nodeId).toBe("1:2");
    });

    it("should convert dash format to colon format", () => {
      const nodeId = FigmaUrlParser.extractNodeId("1-2");
      expect(nodeId).toBe("1:2");
    });

    it("should return null for input without node ID", () => {
      const nodeId = FigmaUrlParser.extractNodeId("just-text");
      expect(nodeId).toBeNull();
    });
  });

  describe("isValidFileId", () => {
    it("should validate correct file ID", () => {
      expect(FigmaUrlParser.isValidFileId("abc123def456ghi789jkl012")).toBe(
        true
      );
    });

    it("should reject short file ID", () => {
      expect(FigmaUrlParser.isValidFileId("short")).toBe(false);
    });

    it("should reject file ID with special characters", () => {
      expect(FigmaUrlParser.isValidFileId("abc123-def456")).toBe(false);
    });
  });

  describe("isValidNodeId", () => {
    it("should validate correct node ID", () => {
      expect(FigmaUrlParser.isValidNodeId("1:2")).toBe(true);
      expect(FigmaUrlParser.isValidNodeId("123:456")).toBe(true);
    });

    it("should reject incorrect node ID format", () => {
      expect(FigmaUrlParser.isValidNodeId("1-2")).toBe(false);
      expect(FigmaUrlParser.isValidNodeId("abc:def")).toBe(false);
      expect(FigmaUrlParser.isValidNodeId("1:2:3")).toBe(false);
    });
  });

  describe("createFigmaUrl", () => {
    it("should create URL without node ID", () => {
      const url = FigmaUrlParser.createFigmaUrl(
        "abc123",
        undefined,
        "Test Design"
      );
      expect(url).toBe("https://www.figma.com/file/abc123/Test Design");
    });

    it("should create URL with node ID", () => {
      const url = FigmaUrlParser.createFigmaUrl("abc123", "1:2", "Test Design");
      expect(url).toBe(
        "https://www.figma.com/file/abc123/Test Design?node-id=1%3A2"
      );
    });

    it("should use default file name if not provided", () => {
      const url = FigmaUrlParser.createFigmaUrl("abc123");
      expect(url).toBe("https://www.figma.com/file/abc123/design");
    });
  });

  describe("getInputHelpMessage", () => {
    it("should return helpful message", () => {
      const message = FigmaUrlParser.getInputHelpMessage();
      expect(message).toContain("Figma input can be");
      expect(message).toContain("https://www.figma.com/file/");
      expect(message).toContain("node-id");
    });
  });
});
