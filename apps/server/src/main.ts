import { defaultClaudeProjectsRoot, discoverClaudeSessions } from "@glassbox/adapter-claude";
import { createDebugLog } from "@glassbox/logging";

import { createGlassBoxServer } from "./server.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.GLASSBOX_PORT ?? "43110", 10);
const projectsRoot = process.env.GLASSBOX_CLAUDE_PROJECTS_ROOT ?? defaultClaudeProjectsRoot();
const debugLog = createDebugLog({
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
});
const logger = debugLog.forModule("server");
const server = createGlassBoxServer({
  discoverSessions: async () => {
    const discovery = await discoverClaudeSessions({ projectsRoot });

    return {
      adapterId: "claude-code",
      sessions: discovery.sessions,
      warnings: discovery.warnings,
    };
  },
  logger,
  projectsRoot,
});

server.on("error", (error) => {
  logger.error("local server failed", error, { host, port });
});

server.listen(port, host, () => {
  logger.info("local server listening", { host, port, projectsRoot });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info("local server stopping", { signal });
  server.close((error) => {
    if (error) {
      logger.error("local server shutdown failed", error);
      process.exitCode = 1;
    }
    debugLog.close();
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
