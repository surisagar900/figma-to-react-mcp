import { Logger } from "../../src/utils/logger";

describe("Logger", () => {
  let logger: Logger;

  beforeEach(() => {
    // Reset singleton instance
    (Logger as any).instance = null;
    logger = Logger.getInstance("debug");

    // Mock console methods
    jest.spyOn(console, "debug").mockImplementation();
    jest.spyOn(console, "info").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should initialize with provided log level", () => {
      const debugLogger = Logger.getInstance("debug");
      expect(debugLogger).toBeDefined();
    });
  });

  describe("setLogLevel", () => {
    it("should update the log level", () => {
      logger.setLogLevel("warn");
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("logging methods", () => {
    beforeEach(() => {
      logger.setLogLevel("debug");
    });

    it("should log debug messages", () => {
      logger.debug("test debug message");
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[DEBUG\] test debug message/)
      );
    });

    it("should log info messages", () => {
      logger.info("test info message");
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] test info message/)
      );
    });

    it("should log warn messages", () => {
      logger.warn("test warn message");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] test warn message/)
      );
    });

    it("should log error messages", () => {
      logger.error("test error message");
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] test error message/)
      );
    });

    it("should include metadata in log messages", () => {
      const metadata = { key: "value", number: 42 };
      logger.info("test message with metadata", metadata);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[.*\] \[INFO\] test message with metadata {"key":"value","number":42}/
        )
      );
    });
  });

  describe("log level filtering", () => {
    it("should not log messages below the current level", () => {
      logger.setLogLevel("warn");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("should log all messages when level is debug", () => {
      logger.setLogLevel("debug");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
