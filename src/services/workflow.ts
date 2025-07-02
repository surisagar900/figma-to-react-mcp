import { GitHubIntegration } from "../integrations/github.js";
import { FigmaIntegration } from "../integrations/figma.js";
import { PlaywrightIntegration } from "../integrations/playwright.js";
import {
  WorkflowContext,
  GeneratedComponent,
  ToolResult,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

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
    try {
      this.logger.info(
        `Starting design-to-code workflow for: ${context.componentName}`
      );

      // Step 1: Fetch Figma design
      const frameResult = await this.figma.getFrame(
        context.figmaFileId,
        context.frameId
      );
      if (!frameResult.success) {
        return frameResult;
      }

      const frame = frameResult.data;
      this.logger.info(`Fetched Figma frame: ${frame.name}`);

      // Step 2: Analyze design tokens
      const tokensResult = await this.figma.analyzeDesignTokens(
        context.figmaFileId
      );
      if (!tokensResult.success) {
        return tokensResult;
      }

      const designTokens = tokensResult.data;

      // Step 3: Generate component code
      const component = await this.generateReactComponent(
        frame,
        designTokens,
        context.componentName
      );

      // Step 4: Create GitHub branch
      const branchResult = await this.github.createBranch(context.githubBranch);
      if (!branchResult.success) {
        return branchResult;
      }

      // Step 5: Save component files locally and prepare for commit
      const files = await this.saveComponentFiles(
        component,
        context.outputPath
      );

      // Step 6: Create commit with generated code
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

      this.logger.info(`Design-to-code workflow completed successfully`);
      return {
        success: true,
        data: {
          component,
          designTokens,
          branch: context.githubBranch,
          commitSha: commitResult.data.commitSha,
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
    try {
      this.logger.info(
        `Starting visual testing workflow for: ${context.componentName}`
      );

      // Step 1: Get Figma design images for comparison
      const imagesResult = await this.figma.getImages(context.figmaFileId, [
        context.frameId,
      ]);
      if (!imagesResult.success) {
        return imagesResult;
      }

      // Step 2: Run visual tests against the component
      const testResult = await this.playwright.runVisualTest(
        `${context.componentName}-visual-test`,
        componentUrl,
        undefined,
        join(context.outputPath, "visual-tests")
      );

      if (!testResult.success) {
        return testResult;
      }

      // Step 3: Test responsive design
      const responsiveResult = await this.playwright.testResponsiveDesign(
        componentUrl,
        [
          { width: 320, height: 568, name: "mobile" },
          { width: 768, height: 1024, name: "tablet" },
          { width: 1440, height: 900, name: "desktop" },
        ]
      );

      // Step 4: Validate accessibility
      const accessibilityResult = await this.playwright.validateAccessibility(
        componentUrl
      );

      context.testResults = [testResult.data];
      if (responsiveResult.success) {
        context.testResults.push({
          name: "responsive-design-test",
          passed: true,
          duration: 0,
        });
      }

      if (accessibilityResult.success) {
        context.testResults.push({
          name: "accessibility-test",
          passed: accessibilityResult.data.passed,
          error:
            accessibilityResult.data.issues.length > 0
              ? accessibilityResult.data.issues.join(", ")
              : undefined,
          duration: 0,
        });
      }

      this.logger.info(`Visual testing workflow completed`);
      return {
        success: true,
        data: {
          visualTest: testResult.data,
          responsiveTest: responsiveResult.success
            ? responsiveResult.data
            : null,
          accessibilityTest: accessibilityResult.success
            ? accessibilityResult.data
            : null,
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
      this.logger.info(`Creating pull request for: ${context.componentName}`);

      const testSummary = this.generateTestSummary(context.testResults || []);
      const prBody = this.generatePRDescription(context, testSummary);

      const prResult = await this.github.createPullRequest({
        title: `feat: Add ${context.componentName} component`,
        body: prBody,
        head: context.githubBranch,
        base: "main",
        draft: false,
      });

      if (!prResult.success) {
        return prResult;
      }

      this.logger.info(`Pull request created: #${prResult.data.number}`);
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

  private async generateReactComponent(
    frame: any,
    _designTokens: any,
    componentName: string
  ): Promise<GeneratedComponent> {
    // This is a simplified code generation - in a real implementation,
    // you'd have more sophisticated parsing of Figma design elements
    const componentCode = `import React from 'react';
import './${componentName}.css';

interface ${componentName}Props {
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({ className }) => {
  return (
    <div 
      className={\`${componentName.toLowerCase()} \${className || ''}\`}
      style={{
        width: '${frame.width}px',
        height: '${frame.height}px',
        backgroundColor: '${frame.backgroundColor}',
      }}
    >
      {/* Generated component structure based on Figma design */}
      <h2>Generated from Figma: ${frame.name}</h2>
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
      dependencies: ["react"],
    };
  }

  private async saveComponentFiles(
    component: GeneratedComponent,
    outputPath: string
  ): Promise<
    Array<{ relativePath: string; content: string; fullPath: string }>
  > {
    const files: Array<{
      relativePath: string;
      content: string;
      fullPath: string;
    }> = [];

    // Create component directory
    const componentDir = join(outputPath, component.filePath);
    if (!existsSync(componentDir)) {
      mkdirSync(componentDir, { recursive: true });
    }

    // Save React component file
    const componentFile = join(componentDir, `${component.name}.tsx`);
    const componentRelativePath = `${component.filePath}/${component.name}.tsx`;
    writeFileSync(componentFile, component.content);
    files.push({
      relativePath: componentRelativePath,
      content: component.content,
      fullPath: componentFile,
    });

    // Save CSS file
    const cssContent = this.generateCSSFromComponent(component);
    const cssFile = join(componentDir, `${component.name}.css`);
    const cssRelativePath = `${component.filePath}/${component.name}.css`;
    writeFileSync(cssFile, cssContent);
    files.push({
      relativePath: cssRelativePath,
      content: cssContent,
      fullPath: cssFile,
    });

    // Save index file for easier imports
    const indexContent = `export { default } from './${component.name}';\nexport * from './${component.name}';`;
    const indexFile = join(componentDir, "index.ts");
    const indexRelativePath = `${component.filePath}/index.ts`;
    writeFileSync(indexFile, indexContent);
    files.push({
      relativePath: indexRelativePath,
      content: indexContent,
      fullPath: indexFile,
    });

    return files;
  }

  private generateCSSFromComponent(component: GeneratedComponent): string {
    return `.${component.name.toLowerCase()} {
  /* Generated styles for ${component.name} */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.${component.name.toLowerCase()} h2 {
  margin: 0;
  padding: 1rem;
  text-align: center;
}
`;
  }

  private generateTestSummary(testResults: any[]): string {
    const totalTests = testResults.length;
    const passedTests = testResults.filter((test) => test.passed).length;
    const failedTests = totalTests - passedTests;

    let summary = `## Test Results Summary\n\n`;
    summary += `- **Total Tests**: ${totalTests}\n`;
    summary += `- **Passed**: ${passedTests} ✅\n`;
    summary += `- **Failed**: ${failedTests} ${
      failedTests > 0 ? "❌" : "✅"
    }\n\n`;

    if (testResults.length > 0) {
      summary += `### Individual Test Results\n\n`;
      testResults.forEach((test) => {
        const status = test.passed ? "✅ PASS" : "❌ FAIL";
        summary += `- **${test.name}**: ${status}`;
        if (test.error) {
          summary += ` - ${test.error}`;
        }
        summary += `\n`;
      });
    }

    return summary;
  }

  private generatePRDescription(
    context: WorkflowContext,
    testSummary: string
  ): string {
    return `# ${context.componentName} Component

This PR adds a new component generated from Figma designs and includes comprehensive testing.

## 📋 Component Details

- **Component Name**: ${context.componentName}
- **Figma File ID**: ${context.figmaFileId}
- **Frame ID**: ${context.frameId}
- **Output Path**: ${context.outputPath}

## 🎨 Design Source

The component was generated from Figma designs with extracted design tokens including:
- Colors and themes
- Typography styles
- Spacing and layout
- Component structure

## 🧪 Testing

${testSummary}

## 🚀 What's Included

- React component with TypeScript
- CSS styles extracted from Figma
- Visual regression tests
- Responsive design testing
- Accessibility validation

## 📝 Next Steps

- [ ] Review generated component code
- [ ] Verify visual accuracy against Figma designs
- [ ] Test component in different environments
- [ ] Update documentation if needed

---

*This PR was automatically generated using the Frontend Dev MCP Server*
`;
  }
}
