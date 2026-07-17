import type { AddressInfo } from "node:net";

import { sessionsResponseSchema } from "@glassbox/api-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGlassBoxServer } from "./server.js";

const openServers: ReturnType<typeof createGlassBoxServer>[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        }),
    ),
  );
});

describe("GET /v1/sessions", () => {
  it("returns discovered Claude Code sessions through the shared contract", async () => {
    const server = createGlassBoxServer({
      discoverSessions: async () => ({
        sessions: [
          {
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
      }),
      now: () => new Date("2026-07-17T04:00:00.000Z"),
      projectsRoot: "/home/person/.claude/projects",
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/sessions`);
    const body = sessionsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
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
    });
  });

  it("returns a generic error and records diagnostics when discovery fails", async () => {
    const error = new Error("synthetic private filesystem detail");
    const logError =
      vi.fn<
        (message: string, error?: unknown, fields?: Readonly<Record<string, unknown>>) => void
      >();
    const server = createGlassBoxServer({
      discoverSessions: async () => Promise.reject(error),
      logger: { error: logError },
      projectsRoot: "/home/person/.claude/projects",
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/sessions`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "session_discovery_failed",
        message: "Claude Code sessions could not be loaded",
      },
    });
    expect(logError).toHaveBeenCalledWith("Claude session discovery failed", error, {
      projectsRoot: "/home/person/.claude/projects",
    });
  });
});
