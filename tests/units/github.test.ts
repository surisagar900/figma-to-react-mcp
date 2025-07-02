import { GitHubIntegration } from "../../src/integrations/github";

// Mock @octokit/rest at the top level
jest.mock("@octokit/rest");

describe("GitHubIntegration", () => {
  let githubIntegration: GitHubIntegration;
  let mockOctokit: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock octokit instance
    mockOctokit = {
      rest: {
        git: {
          getRef: jest.fn(),
          createRef: jest.fn(),
          getCommit: jest.fn(),
          createBlob: jest.fn(),
          createTree: jest.fn(),
          createCommit: jest.fn(),
          updateRef: jest.fn(),
        },
        pulls: {
          create: jest.fn(),
        },
        repos: {
          listBranches: jest.fn(),
          get: jest.fn(),
        },
      },
    };

    // Mock the Octokit constructor to return our mock
    const { Octokit } = require("@octokit/rest");
    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);

    const mockConfig = {
      token: "test-token",
      owner: "test-owner",
      repo: "test-repo",
    };

    githubIntegration = new GitHubIntegration(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createBranch", () => {
    it("should create a new branch successfully", async () => {
      // Mock successful API responses
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: {
          object: { sha: "base-sha-123" },
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {},
      });

      const result = await githubIntegration.createBranch("feature-branch");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        branchName: "feature-branch",
        sha: "base-sha-123",
      });

      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        ref: "heads/main",
      });

      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        ref: "refs/heads/feature-branch",
        sha: "base-sha-123",
      });
    });

    it("should handle errors when creating branch", async () => {
      mockOctokit.rest.git.getRef.mockRejectedValue(new Error("API Error"));

      const result = await githubIntegration.createBranch("feature-branch");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
    });
  });

  describe("createPullRequest", () => {
    it("should create a pull request successfully", async () => {
      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: "https://github.com/test-owner/test-repo/pull/123",
          title: "Test PR",
        },
      });

      const prData = {
        title: "Test PR",
        body: "Test description",
        head: "feature-branch",
        base: "main",
      };

      const result = await githubIntegration.createPullRequest(prData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        number: 123,
        url: "https://github.com/test-owner/test-repo/pull/123",
        title: "Test PR",
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        title: "Test PR",
        body: "Test description",
        head: "feature-branch",
        base: "main",
        draft: false,
      });
    });

    it("should handle errors when creating pull request", async () => {
      mockOctokit.rest.pulls.create.mockRejectedValue(new Error("PR Error"));

      const prData = {
        title: "Test PR",
        body: "Test description",
        head: "feature-branch",
        base: "main",
      };

      const result = await githubIntegration.createPullRequest(prData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("PR Error");
    });
  });

  describe("listBranches", () => {
    it("should list repository branches successfully", async () => {
      mockOctokit.rest.repos.listBranches.mockResolvedValue({
        data: [
          {
            name: "main",
            commit: { sha: "main-sha" },
            protected: true,
          },
          {
            name: "feature-branch",
            commit: { sha: "feature-sha" },
            protected: false,
          },
        ],
      });

      const result = await githubIntegration.listBranches();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          name: "main",
          sha: "main-sha",
          protected: true,
        },
        {
          name: "feature-branch",
          sha: "feature-sha",
          protected: false,
        },
      ]);
    });

    it("should handle errors when listing branches", async () => {
      mockOctokit.rest.repos.listBranches.mockRejectedValue(
        new Error("List Error")
      );

      const result = await githubIntegration.listBranches();

      expect(result.success).toBe(false);
      expect(result.error).toBe("List Error");
    });
  });

  describe("getRepository", () => {
    it("should get repository information successfully", async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          name: "test-repo",
          full_name: "test-owner/test-repo",
          description: "Test repository",
          default_branch: "main",
          private: false,
          html_url: "https://github.com/test-owner/test-repo",
        },
      });

      const result = await githubIntegration.getRepository();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: "test-repo",
        fullName: "test-owner/test-repo",
        description: "Test repository",
        defaultBranch: "main",
        private: false,
        url: "https://github.com/test-owner/test-repo",
      });
    });

    it("should handle errors when getting repository", async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error("Repo Error"));

      const result = await githubIntegration.getRepository();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Repo Error");
    });
  });
});
