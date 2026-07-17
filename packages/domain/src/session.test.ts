import { describe, expect, it } from "vitest";

import { createSession } from "./session.js";

describe("createSession", () => {
  it("derives identity from the adapter and native session ID, not the source path", () => {
    const original = createSession({
      adapterId: "claude-code",
      nativeSessionId: "session-123",
      sources: [{ path: "/home/user/.claude/projects/a/session-123.jsonl", role: "transcript" }],
    });
    const moved = createSession({
      adapterId: "claude-code",
      nativeSessionId: "session-123",
      sources: [{ path: "D:\\ClaudeArchive\\session-123.jsonl", role: "transcript" }],
    });
    const sameNativeIdFromAnotherAdapter = createSession({
      adapterId: "future-agent",
      nativeSessionId: "session-123",
      sources: [{ path: "/sessions/session-123.jsonl", role: "transcript" }],
    });
    const anotherNativeSession = createSession({
      adapterId: "claude-code",
      nativeSessionId: "session-456",
      sources: [{ path: "/sessions/session-456.jsonl", role: "transcript" }],
    });

    expect(moved.id).toBe(original.id);
    expect(sameNativeIdFromAnotherAdapter.id).not.toBe(original.id);
    expect(anotherNativeSession.id).not.toBe(original.id);
  });
});
