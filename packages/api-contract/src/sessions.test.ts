import { describe, expect, it } from "vitest";

import { sessionsResponseSchema } from "./sessions.js";

const validResponse = {
  projectsRoot: "/home/person/.claude/projects",
  scannedAt: "2026-07-17T04:00:00.000Z",
  sessions: [
    {
      adapterId: "claude-code",
      id: '["claude-code","session-123"]',
      identityOrigin: "native",
      modifiedAt: "2026-07-17T03:00:00.000Z",
      nativeSessionId: "session-123",
      projectPath: "/workspace/project",
      sizeBytes: 1024,
      sourcePath: "/home/person/.claude/projects/project/session-123.jsonl",
      title: "Synthetic session",
    },
  ],
  warnings: [],
};

describe("sessionsResponseSchema", () => {
  it("accepts a complete session discovery response", () => {
    expect(sessionsResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it("rejects impossible file sizes", () => {
    const invalidResponse = {
      ...validResponse,
      sessions: [{ ...validResponse.sessions[0]!, sizeBytes: -1 }],
    };

    expect(() => sessionsResponseSchema.parse(invalidResponse)).toThrow(/Too small/);
  });
});
