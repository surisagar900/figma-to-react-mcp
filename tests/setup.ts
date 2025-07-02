// Jest setup file
import "jest";

// Mock environment variables for testing
process.env.GITHUB_TOKEN = "test-github-token";
process.env.GITHUB_OWNER = "test-owner";
process.env.GITHUB_REPO = "test-repo";
process.env.FIGMA_ACCESS_TOKEN = "test-figma-token";
process.env.PLAYWRIGHT_HEADLESS = "true";
process.env.PLAYWRIGHT_TIMEOUT = "30000";
process.env.MCP_SERVER_NAME = "test-mcp-server";
process.env.LOG_LEVEL = "error"; // Reduce log noise during tests

// Global test setup
beforeAll(() => {
  // Any global setup needed for tests
});

afterAll(() => {
  // Any global cleanup needed after tests
});
