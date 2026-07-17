import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { discoverClaudeSessions } from "./discover-sessions.js";

const fixturePath = fileURLToPath(
  new URL("../test/fixtures/current/basic-session.jsonl", import.meta.url),
);
const malformedFixturePath = fileURLToPath(
  new URL("../test/fixtures/current/malformed-inferred-session.jsonl", import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("discoverClaudeSessions", () => {
  it("discovers direct project sessions and reads bounded display metadata", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "glassbox-claude-projects-"));
    temporaryDirectories.push(projectsRoot);

    const sourcePath = join(projectsRoot, "synthetic-project", "renamed-session.jsonl");
    mkdirSync(dirname(sourcePath), { recursive: true });
    copyFileSync(fixturePath, sourcePath);

    const nestedSubagentPath = join(
      projectsRoot,
      "synthetic-project",
      "session-123",
      "subagents",
      "agent-456.jsonl",
    );
    mkdirSync(dirname(nestedSubagentPath), { recursive: true });
    copyFileSync(fixturePath, nestedSubagentPath);

    const modifiedAt = new Date("2026-07-17T02:03:04.000Z");
    utimesSync(sourcePath, modifiedAt, modifiedAt);

    const result = await discoverClaudeSessions({ projectsRoot });

    expect(result.warnings).toEqual([]);
    expect(result.sessions).toEqual([
      {
        identityOrigin: "native",
        modifiedAt: modifiedAt.toISOString(),
        nativeSessionId: "session-123",
        projectPath: "/workspace/synthetic-project",
        sizeBytes: statSync(sourcePath).size,
        sourcePath,
        title: "Review suspicious install script",
      },
    ]);
  });

  it("keeps a session with inferred identity and reports malformed metadata", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "glassbox-claude-projects-"));
    temporaryDirectories.push(projectsRoot);

    const sourcePath = join(projectsRoot, "inferred-project", "inferred-456.jsonl");
    mkdirSync(dirname(sourcePath), { recursive: true });
    copyFileSync(malformedFixturePath, sourcePath);

    const result = await discoverClaudeSessions({ projectsRoot });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      identityOrigin: "inferred",
      nativeSessionId: "inferred-456",
      projectPath: "/workspace/inferred-project",
      sourcePath,
      title: "Explain this synthetic session.",
    });
    expect(result.warnings).toEqual([
      {
        code: "session_metadata_malformed",
        message: "Ignored 1 malformed JSONL record while reading session metadata",
        path: sourcePath,
      },
    ]);
  });
});
