import { Octokit } from "@octokit/rest";
import {
  BranchInfo,
  GitHubConfig,
  PullRequestData,
  ToolResult,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";

export class GitHubIntegration {
  private octokit: Octokit;
  private config: GitHubConfig;
  private logger: Logger;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
    this.logger = Logger.getInstance();
  }

  async createBranch(
    branchName: string,
    baseBranch: string = "main",
  ): Promise<ToolResult> {
    try {
      this.logger.info(`Creating branch: ${branchName} from ${baseBranch}`);

      // Get the base branch reference
      const { data: baseRef } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo || "",
        ref: `heads/${baseBranch}`,
      });

      // Create new branch
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo || "",
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      this.logger.info(`Branch ${branchName} created successfully`);
      return {
        success: true,
        data: { branchName, sha: baseRef.object.sha },
      };
    } catch (error) {
      this.logger.error(`Failed to create branch: ${branchName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async createCommit(
    branchName: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<ToolResult> {
    try {
      this.logger.info(`Creating commit on branch: ${branchName}`);

      // Get the current branch reference
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo || "",
        ref: `heads/${branchName}`,
      });

      // Get the current commit
      const { data: commit } = await this.octokit.rest.git.getCommit({
        owner: this.config.owner,
        repo: this.config.repo || "",
        commit_sha: ref.object.sha,
      });

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await this.octokit.rest.git.createBlob({
            owner: this.config.owner,
            repo: this.config.repo || "",
            content: Buffer.from(file.content).toString("base64"),
            encoding: "base64",
          });
          return { path: file.path, sha: blob.sha };
        }),
      );

      // Create tree
      const { data: tree } = await this.octokit.rest.git.createTree({
        owner: this.config.owner,
        repo: this.config.repo || "",
        base_tree: commit.tree.sha,
        tree: blobs.map((blob) => ({
          path: blob.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        })),
      });

      // Create commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner: this.config.owner,
        repo: this.config.repo || "",
        message,
        tree: tree.sha,
        parents: [ref.object.sha],
      });

      // Update branch reference
      await this.octokit.rest.git.updateRef({
        owner: this.config.owner,
        repo: this.config.repo || "",
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
      });

      this.logger.info(`Commit created successfully: ${newCommit.sha}`);
      return {
        success: true,
        data: { commitSha: newCommit.sha, message },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create commit on branch: ${branchName}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async createPullRequest(prData: PullRequestData): Promise<ToolResult> {
    try {
      this.logger.info(`Creating pull request: ${prData.title}`);

      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo || "",
        title: prData.title,
        body: prData.body,
        head: prData.head,
        base: prData.base,
        draft: prData.draft || false,
      });

      this.logger.info(`Pull request created: #${pr.number}`);
      return {
        success: true,
        data: {
          number: pr.number,
          url: pr.html_url,
          title: pr.title,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to create pull request: ${prData.title}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listBranches(): Promise<ToolResult> {
    try {
      this.logger.info("Fetching repository branches");

      const { data: branches } = await this.octokit.rest.repos.listBranches({
        owner: this.config.owner,
        repo: this.config.repo || "",
      });

      const branchInfo: BranchInfo[] = branches.map((branch) => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected,
      }));

      return {
        success: true,
        data: branchInfo,
      };
    } catch (error) {
      this.logger.error("Failed to fetch branches", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getRepository(): Promise<ToolResult> {
    try {
      this.logger.info(
        `Fetching repository: ${this.config.owner}/${this.config.repo}`,
      );

      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo || "",
      });

      return {
        success: true,
        data: {
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          defaultBranch: repo.default_branch,
          private: repo.private,
          url: repo.html_url,
        },
      };
    } catch (error) {
      this.logger.error("Failed to fetch repository", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
