import { chromium, Browser, Page } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  PlaywrightConfig,
  ScreenshotComparison,
  TestResult,
  ToolResult,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";

export class PlaywrightIntegration {
  private config: PlaywrightConfig;
  private browser: Browser | null = null;
  private logger: Logger;

  constructor(config: PlaywrightConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.logger.info("Initializing Playwright browser");
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      this.logger.info("Closing Playwright browser");
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureScreenshot(
    url: string,
    selector?: string,
    outputPath?: string
  ): Promise<ToolResult> {
    try {
      await this.initialize();
      this.logger.info(`Capturing screenshot for URL: ${url}`);

      const context = await this.browser!.newContext();
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: this.config.timeout,
      });

      const screenshotPath = outputPath || `screenshot-${Date.now()}.png`;

      if (selector) {
        const element = await page.locator(selector);
        await element.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });
      }

      await context.close();

      this.logger.info(`Screenshot saved: ${screenshotPath}`);
      return {
        success: true,
        data: { screenshotPath },
      };
    } catch (error) {
      this.logger.error(`Failed to capture screenshot: ${url}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async compareScreenshots(
    baseImagePath: string,
    currentImagePath: string,
    threshold: number = 0.1
  ): Promise<ToolResult> {
    try {
      this.logger.info(
        `Comparing screenshots: ${baseImagePath} vs ${currentImagePath}`
      );

      if (!existsSync(baseImagePath) || !existsSync(currentImagePath)) {
        return {
          success: false,
          error: "One or both image files do not exist",
        };
      }

      const baseImage = PNG.sync.read(readFileSync(baseImagePath));
      const currentImage = PNG.sync.read(readFileSync(currentImagePath));

      if (
        baseImage.width !== currentImage.width ||
        baseImage.height !== currentImage.height
      ) {
        return {
          success: false,
          error: "Images have different dimensions",
        };
      }

      const diff = new PNG({
        width: baseImage.width,
        height: baseImage.height,
      });
      const pixelDifference = pixelmatch(
        baseImage.data,
        currentImage.data,
        diff.data,
        baseImage.width,
        baseImage.height,
        { threshold }
      );

      const totalPixels = baseImage.width * baseImage.height;
      const similarity = ((totalPixels - pixelDifference) / totalPixels) * 100;
      const passed = similarity >= 100 - threshold * 100;

      const diffImagePath = currentImagePath.replace(".png", "-diff.png");
      writeFileSync(diffImagePath, PNG.sync.write(diff));

      const comparison: ScreenshotComparison = {
        baseImagePath,
        currentImagePath,
        diffImagePath,
        similarity,
        pixelDifference,
        passed,
      };

      this.logger.info(
        `Screenshot comparison completed - Similarity: ${similarity.toFixed(
          2
        )}%`
      );
      return {
        success: true,
        data: comparison,
      };
    } catch (error) {
      this.logger.error("Failed to compare screenshots", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async runVisualTest(
    testName: string,
    url: string,
    selector?: string,
    baselineDir: string = "./baselines"
  ): Promise<ToolResult> {
    try {
      this.logger.info(`Running visual test: ${testName}`);
      const startTime = Date.now();

      // Capture current screenshot
      const screenshotResult = await this.captureScreenshot(
        url,
        selector,
        join(baselineDir, `${testName}-current.png`)
      );

      if (!screenshotResult.success) {
        return screenshotResult;
      }

      const currentImagePath = screenshotResult.data.screenshotPath;
      const baseImagePath = join(baselineDir, `${testName}-baseline.png`);

      let comparison: ScreenshotComparison | undefined;
      let passed = true;
      let error: string | undefined;

      // Compare with baseline if it exists
      if (existsSync(baseImagePath)) {
        const comparisonResult = await this.compareScreenshots(
          baseImagePath,
          currentImagePath
        );

        if (comparisonResult.success) {
          comparison = comparisonResult.data;
          passed = comparison?.passed ?? false;
        } else {
          error = comparisonResult.error;
          passed = false;
        }
      } else {
        // Create baseline if it doesn't exist
        this.logger.info(`Creating baseline image: ${baseImagePath}`);
        const baselineData = readFileSync(currentImagePath);
        writeFileSync(baseImagePath, baselineData);
      }

      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        name: testName,
        passed,
        duration,
      };

      if (error) {
        testResult.error = error;
      }

      if (comparison) {
        testResult.screenshots = [comparison];
      }

      this.logger.info(
        `Visual test completed: ${testName} - ${passed ? "PASSED" : "FAILED"}`
      );
      return {
        success: true,
        data: testResult,
      };
    } catch (error) {
      this.logger.error(`Failed to run visual test: ${testName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async runE2ETest(
    testName: string,
    testScript: (page: Page) => Promise<void>
  ): Promise<ToolResult> {
    try {
      await this.initialize();
      this.logger.info(`Running E2E test: ${testName}`);
      const startTime = Date.now();

      const context = await this.browser!.newContext();
      const page = await context.newPage();

      try {
        await testScript(page);

        const duration = Date.now() - startTime;
        const testResult: TestResult = {
          name: testName,
          passed: true,
          duration,
        };

        await context.close();

        this.logger.info(`E2E test completed: ${testName} - PASSED`);
        return {
          success: true,
          data: testResult,
        };
      } catch (testError) {
        await context.close();

        const duration = Date.now() - startTime;
        const testResult: TestResult = {
          name: testName,
          passed: false,
          error:
            testError instanceof Error
              ? testError.message
              : "Unknown test error",
          duration,
        };

        this.logger.error(`E2E test failed: ${testName}`, testError);
        return {
          success: true,
          data: testResult,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to setup E2E test: ${testName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async testResponsiveDesign(
    url: string,
    viewports: Array<{ width: number; height: number; name: string }>
  ): Promise<ToolResult> {
    try {
      await this.initialize();
      this.logger.info(`Testing responsive design for: ${url}`);

      const context = await this.browser!.newContext();
      const page = await context.newPage();

      const screenshots: Array<{ viewport: string; path: string }> = [];

      for (const viewport of viewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: this.config.timeout,
        });

        const screenshotPath = `responsive-${viewport.name}-${Date.now()}.png`;
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        screenshots.push({
          viewport: `${viewport.name} (${viewport.width}x${viewport.height})`,
          path: screenshotPath,
        });
      }

      await context.close();

      this.logger.info(
        `Responsive design test completed - ${screenshots.length} screenshots`
      );
      return {
        success: true,
        data: { screenshots },
      };
    } catch (error) {
      this.logger.error(`Failed to test responsive design: ${url}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async validateAccessibility(url: string): Promise<ToolResult> {
    try {
      await this.initialize();
      this.logger.info(`Validating accessibility for: ${url}`);

      const context = await this.browser!.newContext();
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: this.config.timeout,
      });

      // Basic accessibility checks
      const accessibilityIssues: string[] = [];

      // Check for alt attributes on images
      const imagesWithoutAlt = await page.locator("img:not([alt])").count();
      if (imagesWithoutAlt > 0) {
        accessibilityIssues.push(
          `${imagesWithoutAlt} images without alt attributes`
        );
      }

      // Check for form labels
      const inputsWithoutLabels = await page
        .locator("input:not([aria-label]):not([aria-labelledby])")
        .count();
      if (inputsWithoutLabels > 0) {
        accessibilityIssues.push(
          `${inputsWithoutLabels} form inputs without proper labels`
        );
      }

      // Check for heading hierarchy
      const headings = await page
        .locator("h1, h2, h3, h4, h5, h6")
        .allTextContents();
      const headingLevels = await page
        .locator("h1, h2, h3, h4, h5, h6")
        .evaluateAll((elements) =>
          elements.map((el) => parseInt(el.tagName.charAt(1)))
        );

      let previousLevel = 0;
      let hasHeadingIssues = false;

      for (const level of headingLevels) {
        if (level > previousLevel + 1) {
          hasHeadingIssues = true;
          break;
        }
        previousLevel = level;
      }

      if (hasHeadingIssues) {
        accessibilityIssues.push("Improper heading hierarchy detected");
      }

      await context.close();

      const passed = accessibilityIssues.length === 0;

      this.logger.info(
        `Accessibility validation completed - ${passed ? "PASSED" : "FAILED"}`
      );
      return {
        success: true,
        data: {
          passed,
          issues: accessibilityIssues,
          headings: headings,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to validate accessibility: ${url}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
