import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import { createDebugLog } from "./debug-log.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("createDebugLog", () => {
  it("replaces stale output with a structured record containing complete debug data", () => {
    const directory = mkdtempSync(join(tmpdir(), "glassbox-logging-"));
    temporaryDirectories.push(directory);

    const logFile = join(directory, "test.log");
    writeFileSync(logFile, "stale log entry\n", "utf8");

    const debugLog = createDebugLog({
      console: false,
      logFile,
      mode: "test",
    });

    debugLog.forModule("adapter-claude").debug("parsed session record", {
      path: "/Users/example/.claude/projects/example/session.jsonl",
      record: {
        content: "complete local debug content",
        type: "assistant",
      },
    });
    debugLog.flush();

    const lines = readFileSync(logFile, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);

    const record = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(record).toMatchObject({
      data: {
        path: "/Users/example/.claude/projects/example/session.jsonl",
        record: {
          content: "complete local debug content",
          type: "assistant",
        },
      },
      level: "debug",
      module: "adapter-claude",
      msg: "parsed session record",
    });
    expect(record.time).toEqual(expect.any(String));

    debugLog.close();
  });

  it("falls back to stderr when the log file cannot be opened", () => {
    const directory = mkdtempSync(join(tmpdir(), "glassbox-logging-"));
    temporaryDirectories.push(directory);

    const blockingFile = join(directory, "not-a-directory");
    writeFileSync(blockingFile, "blocks directory creation", "utf8");

    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(() => {
      const debugLog = createDebugLog({
        console: false,
        logFile: join(blockingFile, "test.log"),
        mode: "test",
      });
      debugLog.forModule("logging-test").debug("fallback remains usable");
      debugLog.flush();
      debugLog.close();
    }).not.toThrow();

    expect(stderrWrite).toHaveBeenCalled();
  });

  it("does not touch the configured log file in production", () => {
    const directory = mkdtempSync(join(tmpdir(), "glassbox-logging-"));
    temporaryDirectories.push(directory);

    const logFile = join(directory, "production.log");
    writeFileSync(logFile, "existing production data\n", "utf8");

    const debugLog = createDebugLog({
      console: true,
      logFile,
      mode: "production",
    });

    debugLog.forModule("server").error("must remain silent", new Error("private"));
    debugLog.close();

    expect(readFileSync(logFile, "utf8")).toBe("existing production data\n");
  });

  it("preserves an Error message and stack for local diagnosis", () => {
    const directory = mkdtempSync(join(tmpdir(), "glassbox-logging-"));
    temporaryDirectories.push(directory);

    const logFile = join(directory, "test.log");
    const debugLog = createDebugLog({
      console: false,
      logFile,
      mode: "test",
    });
    const error = new Error("session record could not be parsed");

    debugLog.forModule("adapter-claude").error("parse failed", error, {
      line: 42,
    });
    debugLog.close();

    const record = JSON.parse(readFileSync(logFile, "utf8")) as {
      data?: unknown;
      err?: { message?: unknown; stack?: unknown };
    };
    expect(record.data).toEqual({ line: 42 });
    expect(record.err?.message).toBe("session record could not be parsed");
    expect(record.err?.stack).toEqual(
      expect.stringContaining("Error: session record could not be parsed"),
    );
  });
});
