import { createServer, type ServerResponse } from "node:http";

import type { ClaudeDiscoveryResult } from "@glassbox/adapter-claude";
import { sessionsResponseSchema } from "@glassbox/api-contract";
import { createSession } from "@glassbox/domain";

export interface ServerLogger {
  error(message: string, error?: unknown, fields?: Readonly<Record<string, unknown>>): void;
}

export interface CreateGlassBoxServerOptions {
  readonly discoverSessions: () => Promise<ClaudeDiscoveryResult>;
  readonly logger?: ServerLogger;
  readonly now?: () => Date;
  readonly projectsRoot: string;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function createGlassBoxServer(options: CreateGlassBoxServerOptions) {
  const now = options.now ?? (() => new Date());

  return createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

    if (request.method !== "GET" || pathname !== "/v1/sessions") {
      sendJson(response, 404, {
        error: { code: "not_found", message: "Route not found" },
      });
      return;
    }

    void options
      .discoverSessions()
      .then((discovery) => {
        const body = sessionsResponseSchema.parse({
          projectsRoot: options.projectsRoot,
          scannedAt: now().toISOString(),
          sessions: discovery.sessions.map((summary) => {
            const session = createSession({
              adapterId: "claude-code",
              nativeSessionId: summary.nativeSessionId,
              sources: [{ path: summary.sourcePath, role: "transcript" }],
            });

            return {
              adapterId: session.adapterId,
              id: session.id,
              identityOrigin: summary.identityOrigin,
              modifiedAt: summary.modifiedAt,
              nativeSessionId: session.nativeSessionId,
              projectPath: summary.projectPath,
              sizeBytes: summary.sizeBytes,
              sourcePath: summary.sourcePath,
              title: summary.title,
            };
          }),
          warnings: discovery.warnings,
        });

        sendJson(response, 200, body);
      })
      .catch((error: unknown) => {
        options.logger?.error("Claude session discovery failed", error, {
          projectsRoot: options.projectsRoot,
        });
        sendJson(response, 500, {
          error: {
            code: "session_discovery_failed",
            message: "Claude Code sessions could not be loaded",
          },
        });
      });
  });
}
