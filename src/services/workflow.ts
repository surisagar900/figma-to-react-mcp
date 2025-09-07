import { GitHubIntegration } from "../integrations/github.js";
import { FigmaIntegration } from "../integrations/figma.js";
import { PlaywrightIntegration } from "../integrations/playwright.js";
import {
  GeneratedComponent,
  ToolResult,
  WorkflowContext,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";
import { promises as fs } from "fs";
import { join } from "path";
import * as fsSync from "fs";
import * as path from "path";

// Read version from package.json
function getPackageVersion(): string {
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    const packageContent = fsSync.readFileSync(packagePath, "utf-8");
    const packageJson = JSON.parse(packageContent);
    return packageJson.version;
  } catch (error) {
    return "2.0.3"; // fallback version
  }
}

export class WorkflowService {
  private github: GitHubIntegration;
  private figma: FigmaIntegration;
  private playwright: PlaywrightIntegration;
  private logger: Logger;

  constructor(
    github: GitHubIntegration,
    figma: FigmaIntegration,
    playwright: PlaywrightIntegration
  ) {
    this.github = github;
    this.figma = figma;
    this.playwright = playwright;
    this.logger = Logger.getInstance();
  }

  async executeDesignToCodeWorkflow(
    context: WorkflowContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info(
        `Starting design-to-code workflow for: ${context.componentName}`
      );

      // Parallel execution of independent operations
      const [frameResult, tokensResult, branchResult] =
        await Promise.allSettled([
          this.figma.getFrame(context.figmaFileId, context.frameId),
          this.figma.analyzeDesignTokens(context.figmaFileId),
          this.github.createBranch(context.githubBranch),
        ]);

      // Check frame result
      if (frameResult.status === "rejected" || !frameResult.value.success) {
        return this.handleError("Failed to fetch Figma frame", frameResult);
      }

      // Check tokens result
      if (tokensResult.status === "rejected" || !tokensResult.value.success) {
        return this.handleError(
          "Failed to analyze design tokens",
          tokensResult
        );
      }

      // Check branch result
      if (branchResult.status === "rejected" || !branchResult.value.success) {
        return this.handleError("Failed to create GitHub branch", branchResult);
      }

      const frame = frameResult.value.data;
      const designTokens = tokensResult.value.data;

      this.logger.info(`Fetched Figma frame: ${frame.name}`);

      // Generate component code
      const component = await this.generateReactComponent(
        frame,
        designTokens,
        context.componentName
      );

      // Save component files and prepare for commit
      const files = await this.saveComponentFiles(
        component,
        context.outputPath
      );

      // Create commit with generated code
      const commitResult = await this.github.createCommit(
        context.githubBranch,
        files.map((file) => ({
          path: file.relativePath,
          content: file.content,
        })),
        `feat: Add ${context.componentName} component from Figma design\n\nGenerated from Figma frame: ${frame.name}\nFrame ID: ${context.frameId}`
      );

      if (!commitResult.success) {
        return commitResult;
      }

      const duration = Date.now() - startTime;
      this.logger.success(`Design-to-code workflow completed in ${duration}ms`);

      return {
        success: true,
        data: {
          component,
          designTokens,
          branch: context.githubBranch,
          commitSha: commitResult.data.commitSha,
          duration,
        },
      };
    } catch (error) {
      this.logger.error("Design-to-code workflow failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async executeVisualTestingWorkflow(
    context: WorkflowContext,
    componentUrl: string
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info(
        `Starting visual testing workflow for: ${context.componentName}`
      );

      // Parallel execution of test operations
      const testPromises = [
        this.playwright.runVisualTest(
          `${context.componentName}-visual-test`,
          componentUrl,
          undefined,
          join(context.outputPath, "visual-tests")
        ),
        this.playwright.testResponsiveDesign(componentUrl, [
          { width: 320, height: 568, name: "mobile" },
          { width: 768, height: 1024, name: "tablet" },
          { width: 1440, height: 900, name: "desktop" },
        ]),
        this.playwright.validateAccessibility(componentUrl),
        this.figma.getImages(context.figmaFileId, [context.frameId]),
      ];

      const [
        visualResult,
        responsiveResult,
        accessibilityResult,
        imagesResult,
      ] = await Promise.allSettled(testPromises);

      const testResults = [];

      // Process visual test result
      if (visualResult?.status === "fulfilled" && visualResult.value.success) {
        testResults.push(visualResult.value.data);
      }

      // Process responsive test result
      if (
        responsiveResult?.status === "fulfilled" &&
        responsiveResult.value.success
      ) {
        testResults.push({
          name: "responsive-design-test",
          passed: true,
          duration: 0,
        });
      }

      // Process accessibility test result
      if (
        accessibilityResult?.status === "fulfilled" &&
        accessibilityResult.value.success
      ) {
        testResults.push({
          name: "accessibility-test",
          passed: accessibilityResult.value.data.passed,
          error:
            accessibilityResult.value.data.issues.length > 0
              ? accessibilityResult.value.data.issues.join(", ")
              : undefined,
          duration: 0,
        });
      }

      context.testResults = testResults;
      const duration = Date.now() - startTime;

      this.logger.success(`Visual testing workflow completed in ${duration}ms`);

      return {
        success: true,
        data: {
          visualTest:
            visualResult?.status === "fulfilled"
              ? visualResult.value.data
              : null,
          responsiveTest:
            responsiveResult?.status === "fulfilled"
              ? responsiveResult.value.data
              : null,
          accessibilityTest:
            accessibilityResult?.status === "fulfilled"
              ? accessibilityResult.value.data
              : null,
          figmaImages:
            imagesResult?.status === "fulfilled"
              ? imagesResult.value.data
              : null,
          duration,
        },
      };
    } catch (error) {
      this.logger.error("Visual testing workflow failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async createPullRequestWithResults(
    context: WorkflowContext
  ): Promise<ToolResult> {
    try {
      const testSummary = this.generateTestSummary(context.testResults || []);
      const prDescription = this.generatePRDescription(context, testSummary);

      const prResult = await this.github.createPullRequest({
        title: `feat: Add ${context.componentName} component`,
        body: prDescription,
        head: context.githubBranch,
        base: "main",
        draft: false,
      });

      if (!prResult.success) {
        return prResult;
      }

      this.logger.success(`Pull request created: ${prResult.data.url}`);

      return {
        success: true,
        data: {
          pullRequest: prResult.data,
          testSummary,
        },
      };
    } catch (error) {
      this.logger.error("Failed to create pull request", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private handleError(message: string, result: any): ToolResult {
    const error =
      result.status === "rejected"
        ? result.reason
        : result.value?.error || "Unknown error";

    this.logger.error(message, error);
    return {
      success: false,
      error: `${message}: ${error}`,
    };
  }

  private async generateReactComponent(
    frame: any,
    designTokens: any,
    componentName: string
  ): Promise<GeneratedComponent & { cssContent: string }> {
    // Generate CSS content
    const cssContent = this.generateCSS(componentName, designTokens, frame);

    const componentCode = `import React from 'react';
import './${componentName}.css';

interface ${componentName}Props {
  className?: string;
  children?: React.ReactNode;
  /** Override background color */
  backgroundColor?: string;
  /** Override width */
  width?: string | number;
  /** Override height */
  height?: string | number;
  /** Override text content */
  text?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * ${componentName} - Generated from Figma Design
 * 
 * This React component was automatically generated from a Figma design.
 * Frame: ${frame.name}
 * Dimensions: ${frame.width}x${frame.height}px
 * 
 * @component
 */
export const ${componentName}: React.FC<${componentName}Props> = ({ 
  className = '',
  children,
  backgroundColor,
  width = '${frame.width}px',
  height = '${frame.height}px',
  text = '${frame.name}',
  onClick,
}) => {
  const componentStyle: React.CSSProperties = {
    width,
    height,
    backgroundColor,
  };

  return (
    <div 
      className={\`${componentName.toLowerCase()}-component \${className}\`}
      style={componentStyle}
      role="region"
      aria-label="${componentName} component"
      onClick={onClick}
    >
      {children || (
        <div className="${componentName.toLowerCase()}-content">
          <h2 className="${componentName.toLowerCase()}-title">
            {text}
          </h2>
          <p className="${componentName.toLowerCase()}-description">
            Generated from Figma design
          </p>
        </div>
      )}
    </div>
  );
};

export default ${componentName};
`;

    return {
      name: componentName,
      filePath: `src/components/${componentName}`,
      content: componentCode,
      framework: "react",
      dependencies: ["react", "@types/react"],
      cssContent,
    };
  }

  private generateCSS(
    componentName: string,
    designTokens: any,
    frame: any
  ): string {
    const baseClass = componentName.toLowerCase();
    const backgroundColor =
      designTokens?.colors?.[0] || frame.backgroundColor || "#ffffff";
    const primaryFont = designTokens?.fonts?.[0] || "Inter, sans-serif";
    const borderRadius = designTokens?.borderRadius?.[0] || 8;
    const spacing =
      designTokens?.spacing?.filter((s: number) => s > 0 && s < 100)?.[0] || 16;

    return `.${baseClass}-component {
  background-color: ${backgroundColor};
  font-family: ${primaryFont};
  border-radius: ${borderRadius}px;
  padding: ${spacing}px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
}

.${baseClass}-component:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.${baseClass}-content {
  text-align: center;
  max-width: 100%;
}

.${baseClass}-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: inherit;
  line-height: 1.2;
}

.${baseClass}-description {
  margin: ${spacing / 2}px 0 0;
  font-size: 0.875rem;
  opacity: 0.7;
  line-height: 1.4;
}

/* Responsive design */
@media (max-width: 768px) {
  .${baseClass}-component {
    padding: ${spacing * 0.75}px;
  }
  
  .${baseClass}-title {
    font-size: 1.125rem;
  }
  
  .${baseClass}-description {
    font-size: 0.8rem;
  }
}

/* Focus states for accessibility */
.${baseClass}-component:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

.${baseClass}-component:focus:not(:focus-visible) {
  outline: none;
}
`;
  }

  private async saveComponentFiles(
    component: GeneratedComponent & { cssContent?: string },
    outputPath: string
  ): Promise<
    Array<{ relativePath: string; content: string; fullPath: string }>
  > {
    const componentDir = join(outputPath, component.name);

    // Ensure directory exists
    await fs.mkdir(componentDir, { recursive: true });

    const files = [];

    // Save TypeScript component file
    const componentFile = join(componentDir, `${component.name}.tsx`);
    const componentRelativePath = `${component.filePath}/${component.name}.tsx`;
    await fs.writeFile(componentFile, component.content, "utf8");

    files.push({
      relativePath: componentRelativePath,
      content: component.content,
      fullPath: componentFile,
    });

    // Save CSS file if provided
    if (component.cssContent) {
      const cssFile = join(componentDir, `${component.name}.css`);
      const cssRelativePath = `${component.filePath}/${component.name}.css`;
      await fs.writeFile(cssFile, component.cssContent, "utf8");

      files.push({
        relativePath: cssRelativePath,
        content: component.cssContent,
        fullPath: cssFile,
      });
    }

    // Save index file for easier imports
    const indexContent = `export { default } from './${component.name}';\nexport * from './${component.name}';`;
    const indexFile = join(componentDir, "index.ts");
    const indexRelativePath = `${component.filePath}/index.ts`;
    await fs.writeFile(indexFile, indexContent, "utf8");

    files.push({
      relativePath: indexRelativePath,
      content: indexContent,
      fullPath: indexFile,
    });

    return files;
  }

  private generateTestSummary(testResults: any[]): string {
    if (!testResults || testResults.length === 0) {
      return "## Test Results\n\nNo tests were executed.";
    }

    const totalTests = testResults.length;
    const passedTests = testResults.filter((test) => test.passed).length;
    const failedTests = totalTests - passedTests;

    let summary = "## Test Results Summary\n\n";
    summary += `- **Total Tests**: ${totalTests}\n`;
    summary += `- **Passed**: ${passedTests} ✅\n`;
    summary += `- **Failed**: ${failedTests} ${
      failedTests > 0 ? "❌" : "✅"
    }\n\n`;

    if (testResults.length > 0) {
      summary += "### Individual Test Results\n\n";
      testResults.forEach((test) => {
        const status = test.passed ? "✅ PASS" : "❌ FAIL";
        summary += `- **${test.name}**: ${status}`;
        if (test.error) {
          summary += ` - ${test.error}`;
        }
        summary += "\n";
      });
    }

    return summary;
  }

  private generatePRDescription(
    context: WorkflowContext,
    testSummary: string
  ): string {
    return `# ${context.componentName} Component

## 🎨 Design Source
- **Figma File**: ${context.figmaFileId}
- **Frame ID**: ${context.frameId}
- **Component Name**: ${context.componentName}

## 📝 Description
This React component was automatically generated from a Figma design using the Figma to React MCP workflow.

## 🧪 Testing
${testSummary}

## 📁 Files Added
- \`${context.outputPath}/${context.componentName}/${
      context.componentName
    }.tsx\` - Main component file
- \`${context.outputPath}/${context.componentName}/${
      context.componentName
    }.css\` - Component styles
- \`${context.outputPath}/${
      context.componentName
    }/index.ts\` - Export definitions

## 🚀 Usage
\`\`\`tsx
import { ${context.componentName} } from './${context.outputPath}/${
      context.componentName
    }';

function App() {
  return (
    <${context.componentName}>
      Your content here
    </${context.componentName}>
  );
}
\`\`\`

## ✨ Features
- ✅ TypeScript support
- ✅ Responsive design
- ✅ Accessibility features
- ✅ Customizable props
- ✅ CSS transitions and hover effects

---
*Generated by Figma to React MCP v${getPackageVersion()}*`;
  }
}
