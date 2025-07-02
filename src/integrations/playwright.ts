import { Browser, BrowserContext, chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { promises as fs } from "fs";
import { join } from "path";
import {
  PlaywrightConfig,
  ScreenshotComparison,
  TestResult,
  ToolResult,
} from "../types/index.js";
import { Logger } from "../utils/logger.js";

interface BrowserPool {
  browser: Browser;
  contexts: BrowserContext[];
  activeContexts: number;
}

export class PlaywrightIntegration {
  private config: PlaywrightConfig;
  private browserPool: BrowserPool | null = null;
  private logger: Logger;
  private readonly maxContexts = 5;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: PlaywrightConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    if (this.browserPool) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.createBrowserPool();
    return this.initializationPromise;
  }

  private async createBrowserPool(): Promise<void> {
    this.logger.info("Initializing Playwright browser pool");
    const browser = await chromium.launch({
      headless: this.config.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.browserPool = {
      browser,
      contexts: [],
      activeContexts: 0,
    };
  }

  private async getContext(): Promise<BrowserContext> {
    await this.initialize();

    if (!this.browserPool) {
      throw new Error("Browser pool not initialized");
    }

    // Reuse existing context if available
    if (this.browserPool.contexts.length > 0) {
      const context = this.browserPool.contexts.pop()!;
      this.browserPool.activeContexts++;
      return context;
    }

    // Create new context if under limit
    if (this.browserPool.activeContexts < this.maxContexts) {
      const context = await this.browserPool.browser.newContext();
      this.browserPool.activeContexts++;
      return context;
    }

    // Wait for a context to become available
    while (this.browserPool.contexts.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return this.getContext();
  }

  private releaseContext(context: BrowserContext): void {
    if (!this.browserPool) return;

    this.browserPool.contexts.push(context);
    this.browserPool.activeContexts--;
  }

  async captureScreenshot(
    url: string,
    selector?: string,
    outputPath?: string,
  ): Promise<ToolResult> {
    const context = await this.getContext();

    try {
      this.logger.info(`Capturing screenshot for URL: ${url}`);
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

      await page.close();
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
    } finally {
      this.releaseContext(context);
    }
  }

  async compareScreenshots(
    baseImagePath: string,
    currentImagePath: string,
    threshold: number = 0.1,
  ): Promise<ToolResult> {
    try {
      this.logger.info(
        `Comparing screenshots: ${baseImagePath} vs ${currentImagePath}`,
      );

      // Use async file checks
      const [baseExists, currentExists] = await Promise.all([
        fs
          .access(baseImagePath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(currentImagePath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (!baseExists || !currentExists) {
        return {
          success: false,
          error: "One or both image files do not exist",
        };
      }

      // Read images in parallel
      const [baseImageBuffer, currentImageBuffer] = await Promise.all([
        fs.readFile(baseImagePath),
        fs.readFile(currentImagePath),
      ]);

      const baseImage = PNG.sync.read(baseImageBuffer);
      const currentImage = PNG.sync.read(currentImageBuffer);

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
        { threshold },
      );

      const totalPixels = baseImage.width * baseImage.height;
      const similarity = ((totalPixels - pixelDifference) / totalPixels) * 100;
      const passed = similarity >= 100 - threshold * 100;

      const diffImagePath = currentImagePath.replace(".png", "-diff.png");
      await fs.writeFile(diffImagePath, PNG.sync.write(diff));

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
          2,
        )}%`,
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
    baselineDir: string = "./baselines",
  ): Promise<ToolResult> {
    try {
      this.logger.info(`Running visual test: ${testName}`);
      const startTime = Date.now();

      // Ensure baseline directory exists
      await fs.mkdir(baselineDir, { recursive: true });

      // Capture current screenshot
      const currentImagePath = join(baselineDir, `${testName}-current.png`);
      const screenshotResult = await this.captureScreenshot(
        url,
        selector,
        currentImagePath,
      );

      if (!screenshotResult.success) {
        return screenshotResult;
      }

      const baseImagePath = join(baselineDir, `${testName}-baseline.png`);
      let comparison: ScreenshotComparison | undefined;
      let passed = true;
      let error: string | undefined;

      // Check if baseline exists
      const baselineExists = await fs
        .access(baseImagePath)
        .then(() => true)
        .catch(() => false);

      if (baselineExists) {
        const comparisonResult = await this.compareScreenshots(
          baseImagePath,
          currentImagePath,
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
        await fs.copyFile(currentImagePath, baseImagePath);
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
        `Visual test completed: ${testName} - ${passed ? "PASSED" : "FAILED"}`,
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

  async testResponsiveDesign(
    url: string,
    viewports: Array<{ width: number; height: number; name: string }>,
  ): Promise<ToolResult> {
    const context = await this.getContext();

    try {
      this.logger.info(`Testing responsive design for: ${url}`);
      const page = await context.newPage();

      // Parallel screenshot capture
      const screenshotPromises = viewports.map(async (viewport) => {
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

        return {
          viewport: `${viewport.name} (${viewport.width}x${viewport.height})`,
          path: screenshotPath,
        };
      });

      const screenshots = await Promise.all(screenshotPromises);
      await page.close();

      this.logger.info(
        `Responsive design test completed - ${screenshots.length} screenshots`,
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
    } finally {
      this.releaseContext(context);
    }
  }

  async validateAccessibility(url: string): Promise<ToolResult> {
    const context = await this.getContext();

    try {
      this.logger.info(`Validating accessibility for: ${url}`);
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: this.config.timeout,
      });

      // Basic accessibility checks
      const issues = await page.evaluate(() => {
        const problems: string[] = [];

        // Check for missing alt attributes
        const images = (globalThis as any).document.querySelectorAll("img");
        images.forEach((img: any, index: number) => {
          if (!img.alt) {
            problems.push(`Image ${index + 1} is missing alt text`);
          }
        });

        // Check for heading hierarchy
        const headings = (globalThis as any).document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6",
        );
        if (headings.length > 0) {
          const firstHeading = headings[0];
          if (firstHeading && firstHeading.tagName !== "H1") {
            problems.push("Page should start with an H1 heading");
          }
        }

        // Check for form labels
        const inputs = (globalThis as any).document.querySelectorAll(
          "input, textarea, select",
        );
        inputs.forEach((input: any, index: number) => {
          const id = input.getAttribute("id");
          if (id) {
            const label = (globalThis as any).document.querySelector(
              `label[for="${id}"]`,
            );
            if (!label) {
              problems.push(`Form field ${index + 1} is missing a label`);
            }
          }
        });

        return problems;
      });

      await page.close();

      this.logger.info(
        `Accessibility validation completed - ${issues.length} issues found`,
      );

      return {
        success: true,
        data: {
          passed: issues.length === 0,
          issues,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to validate accessibility: ${url}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      this.releaseContext(context);
    }
  }

  async close(): Promise<void> {
    if (this.browserPool) {
      this.logger.info("Closing Playwright browser pool");

      // Close all contexts
      await Promise.all(
        this.browserPool.contexts.map((context) => context.close()),
      );

      // Close browser
      await this.browserPool.browser.close();
      this.browserPool = null;
    }

    this.initializationPromise = null;
  }
}
