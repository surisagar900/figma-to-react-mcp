import { Config } from "../../src/config";

describe("Config", () => {
  let config: Config;

  beforeEach(() => {
    // Reset singleton instance
    (Config as any).instance = null;
    config = Config.getInstance();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = Config.getInstance();
      const instance2 = Config.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("github configuration", () => {
    it("should return valid GitHub configuration", () => {
      const githubConfig = config.github;

      expect(githubConfig).toHaveProperty("token");
      expect(githubConfig).toHaveProperty("owner");
      expect(githubConfig.token).toBe("test-github-token");
      expect(githubConfig.owner).toBe("test-owner");
    });

    it("should include optional repo if provided", () => {
      const githubConfig = config.github;
      expect(githubConfig.repo).toBe("test-repo");
    });
  });

  describe("figma configuration", () => {
    it("should return valid Figma configuration", () => {
      const figmaConfig = config.figma;

      expect(figmaConfig).toHaveProperty("accessToken");
      expect(figmaConfig.accessToken).toBe("test-figma-token");
    });
  });

  describe("playwright configuration", () => {
    it("should return valid Playwright configuration", () => {
      const playwrightConfig = config.playwright;

      expect(playwrightConfig).toHaveProperty("headless");
      expect(playwrightConfig).toHaveProperty("timeout");
      expect(playwrightConfig.headless).toBe(true);
      expect(playwrightConfig.timeout).toBe(30000);
    });
  });

  describe("server configuration", () => {
    it("should return valid server configuration", () => {
      const serverConfig = config.server;

      expect(serverConfig).toHaveProperty("name");
      expect(serverConfig).toHaveProperty("version");
      expect(serverConfig).toHaveProperty("logLevel");
      expect(serverConfig.name).toBe("test-mcp-server");
      expect(serverConfig.logLevel).toBe("error");
    });
  });

  describe("validate", () => {
    it("should validate configuration successfully", () => {
      expect(config.validate()).toBe(true);
    });

    it("should fail validation with missing required environment variables", () => {
      // Temporarily remove required env var
      const originalToken = process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_TOKEN;

      // Reset singleton to force re-validation
      (Config as any).instance = null;

      expect(() => Config.getInstance()).toThrow(
        "Invalid environment configuration"
      );

      // Restore env var
      process.env.GITHUB_TOKEN = originalToken;
    });
  });
});
