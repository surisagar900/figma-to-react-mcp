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

interface WorkflowStep {
  name: string;
  execute: () => Promise<any>;
  dependencies?: string[];
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
      if (visualResult.status === "fulfilled" && visualResult.value.success) {
        testResults.push(visualResult.value.data);
      }

      // Process responsive test result
      if (
        responsiveResult.status === "fulfilled" &&
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
        accessibilityResult.status === "fulfilled" &&
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
            visualResult.status === "fulfilled"
              ? visualResult.value.data
              : null,
          responsiveTest:
            responsiveResult.status === "fulfilled"
              ? responsiveResult.value.data
              : null,
          accessibilityTest:
            accessibilityResult.status === "fulfilled"
              ? accessibilityResult.value.data
              : null,
          figmaImages:
            imagesResult.status === "fulfilled"
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
  ): Promise<GeneratedComponent> {
    // Generate optimized React component with TypeScript
    const backgroundColor =
      designTokens?.colors?.[0] || frame.backgroundColor || "#ffffff";

    // Extract useful styling from design tokens
    const primaryFont = designTokens?.fonts?.[0] || "Inter, sans-serif";
    const borderRadius = designTokens?.borderRadius?.[0] || 8;
    const spacing =
      designTokens?.spacing?.filter((s: number) => s > 0 && s < 100)?.[0] || 16;

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
  backgroundColor = '${backgroundColor}',
  width = '${frame.width}px',
  height = '${frame.height}px',
}) => {
  const componentStyle: React.CSSProperties = {
    width,
    height,
    backgroundColor,
    fontFamily: '${primaryFont}',
    borderRadius: '${borderRadius}px',
    padding: '${spacing}px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };

  return (
    <div 
      className={\`${componentName.toLowerCase()}-component \${className}\`}
      style={componentStyle}
      role="region"
      aria-label="${componentName} component"
    >
      {children || (
        <div className="${componentName.toLowerCase()}-content">
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            ${frame.name}
          </h2>
          <p style={{ margin: '${
            spacing / 2
          }px 0 0', fontSize: '0.875rem', opacity: 0.7 }}>
            Generated from Figma design
          </p>
        </div>
      )}
    </div>
  );
};

export default ${componentName};
`;

    // Generate optimized CSS
    const cssContent = `/* ${componentName} Component Styles */
.${componentName.toLowerCase()}-component {
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;
}

.${componentName.toLowerCase()}-component:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.${componentName.toLowerCase()}-content {
  text-align: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .${componentName.toLowerCase()}-component {
    padding: ${spacing * 0.75}px;
  }
}

@media (max-width: 480px) {
  .${componentName.toLowerCase()}-component {
    padding: ${spacing * 0.5}px;
  }
  
  .${componentName.toLowerCase()}-content h2 {
    font-size: 1rem !important;
  }
  
  .${componentName.toLowerCase()}-content p {
    font-size: 0.75rem !important;
  }
}
`;

    return {
      name: componentName,
      filePath: `src/components/${componentName}`,
      content: componentCode,
      cssContent,
      framework: "react",
      dependencies: ["react", "@types/react"],
    };
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
- \`${context.outputPath}/${context.componentName}/${context.componentName}.tsx\` - Main component file
- \`${context.outputPath}/${context.componentName}/${context.componentName}.css\` - Component styles
- \`${context.outputPath}/${context.componentName}/index.ts\` - Export definitions

## 🚀 Usage
\`\`\`tsx
import { ${context.componentName} } from './${context.outputPath}/${context.componentName}';

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
*Generated by Figma to React MCP v2.0.0*`;
  }
}
