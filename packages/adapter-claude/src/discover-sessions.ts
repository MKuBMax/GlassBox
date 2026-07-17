import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const MAX_METADATA_BYTES = 256 * 1024;
const INTERNAL_PROMPT_PREFIXES = [
  "<command-args>",
  "<command-message>",
  "<command-name>",
  "<ide_opened_file>",
  "<local-command-caveat>",
  "<local-command-stdout>",
  "<system-reminder>",
];

export interface ClaudeSessionSummary {
  readonly identityOrigin: "native" | "inferred";
  readonly modifiedAt: string;
  readonly nativeSessionId: string;
  readonly projectPath: string | null;
  readonly sizeBytes: number;
  readonly sourcePath: string;
  readonly title: string | null;
}

export interface ClaudeDiscoveryWarning {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface ClaudeDiscoveryResult {
  readonly sessions: readonly ClaudeSessionSummary[];
  readonly warnings: readonly ClaudeDiscoveryWarning[];
}

export interface DiscoverClaudeSessionsOptions {
  readonly projectsRoot: string;
}

interface ClaudeMetadata {
  readonly malformedRecordCount: number;
  readonly nativeSessionId: string | null;
  readonly projectPath: string | null;
  readonly title: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function displayText(value: string): string | null {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return null;
  }

  const characters = Array.from(normalized);
  return characters.length <= 160 ? normalized : `${characters.slice(0, 159).join("")}…`;
}

function messageText(content: unknown): string | null {
  if (typeof content === "string") {
    return displayText(content);
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .filter(isRecord)
    .map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join(" ");

  return displayText(text);
}

function userPromptText(content: unknown): string | null {
  const text = messageText(content);
  if (text === null || INTERNAL_PROMPT_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return null;
  }
  return text;
}

function parseMetadata(text: string): ClaudeMetadata {
  let malformedRecordCount = 0;
  let nativeSessionId: string | null = null;
  let projectPath: string | null = null;
  let generatedTitle: string | null = null;
  let firstPrompt: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      malformedRecordCount += 1;
      continue;
    }

    if (!isRecord(value)) {
      continue;
    }

    if (nativeSessionId === null && typeof value.sessionId === "string") {
      nativeSessionId = value.sessionId;
    }
    if (projectPath === null && typeof value.cwd === "string") {
      projectPath = value.cwd;
    }
    if (value.type === "ai-title" && typeof value.aiTitle === "string") {
      generatedTitle = displayText(value.aiTitle);
    }
    if (firstPrompt === null && value.type === "user" && isRecord(value.message)) {
      firstPrompt = userPromptText(value.message.content);
    }
  }

  return {
    malformedRecordCount,
    nativeSessionId,
    projectPath,
    title: generatedTitle ?? firstPrompt,
  };
}

async function readMetadata(sourcePath: string): Promise<ClaudeMetadata> {
  const file = await open(sourcePath, "r");

  try {
    const buffer = Buffer.allocUnsafe(MAX_METADATA_BYTES);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    let text = buffer.toString("utf8", 0, bytesRead);

    if (bytesRead === buffer.length && !text.endsWith("\n")) {
      text = text.slice(0, Math.max(0, text.lastIndexOf("\n") + 1));
    }

    return parseMetadata(text);
  } finally {
    await file.close();
  }
}

function warning(code: string, path: string, error: unknown): ClaudeDiscoveryWarning {
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
    path,
  };
}

export function defaultClaudeProjectsRoot(homeDirectory = homedir()): string {
  return join(homeDirectory, ".claude", "projects");
}

export async function discoverClaudeSessions(
  options: DiscoverClaudeSessionsOptions,
): Promise<ClaudeDiscoveryResult> {
  const sessions: ClaudeSessionSummary[] = [];
  const warnings: ClaudeDiscoveryWarning[] = [];

  let projectEntries;
  try {
    projectEntries = await readdir(options.projectsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { sessions, warnings };
    }
    return {
      sessions,
      warnings: [warning("projects_root_unreadable", options.projectsRoot, error)],
    };
  }

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) {
      continue;
    }

    const projectDirectory = join(options.projectsRoot, projectEntry.name);
    let candidateEntries;
    try {
      candidateEntries = await readdir(projectDirectory, { withFileTypes: true });
    } catch (error) {
      warnings.push(warning("project_directory_unreadable", projectDirectory, error));
      continue;
    }

    for (const candidateEntry of candidateEntries) {
      if (!candidateEntry.isFile() || !candidateEntry.name.endsWith(".jsonl")) {
        continue;
      }

      const sourcePath = join(projectDirectory, candidateEntry.name);
      try {
        const [sourceStat, metadata] = await Promise.all([
          stat(sourcePath),
          readMetadata(sourcePath),
        ]);
        const inferredId = basename(candidateEntry.name, ".jsonl");

        sessions.push({
          identityOrigin: metadata.nativeSessionId === null ? "inferred" : "native",
          modifiedAt: sourceStat.mtime.toISOString(),
          nativeSessionId: metadata.nativeSessionId ?? inferredId,
          projectPath: metadata.projectPath,
          sizeBytes: sourceStat.size,
          sourcePath,
          title: metadata.title,
        });
        if (metadata.malformedRecordCount > 0) {
          warnings.push({
            code: "session_metadata_malformed",
            message: `Ignored ${metadata.malformedRecordCount} malformed JSONL record${metadata.malformedRecordCount === 1 ? "" : "s"} while reading session metadata`,
            path: sourcePath,
          });
        }
      } catch (error) {
        warnings.push(warning("session_unreadable", sourcePath, error));
      }
    }
  }

  sessions.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

  return { sessions, warnings };
}
