import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import pino, { type DestinationStream, type Logger as PinoLogger } from "pino";

type FileDestination = ReturnType<typeof pino.destination>;

export type DebugLogMode = "development" | "test" | "production";

export type LogFields = Readonly<Record<string, unknown>>;

export interface ModuleLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, error?: unknown, fields?: LogFields): void;
}

export interface DebugLog {
  forModule(module: string): ModuleLogger;
  flush(): void;
  close(): void;
}

export interface CreateDebugLogOptions {
  mode: DebugLogMode;
  logFile?: string;
  console?: boolean;
}

class PinoModuleLogger implements ModuleLogger {
  readonly #logger: PinoLogger;

  constructor(logger: PinoLogger) {
    this.#logger = logger;
  }

  debug(message: string, fields?: LogFields): void {
    this.#logger.debug(fields === undefined ? {} : { data: fields }, message);
  }

  info(message: string, fields?: LogFields): void {
    this.#logger.info(fields === undefined ? {} : { data: fields }, message);
  }

  warn(message: string, fields?: LogFields): void {
    this.#logger.warn(fields === undefined ? {} : { data: fields }, message);
  }

  error(message: string, error?: unknown, fields?: LogFields): void {
    const record: Record<string, unknown> = {};

    if (error instanceof Error) {
      record.err = error;
    } else if (error !== undefined) {
      record.error = error;
    }

    if (fields !== undefined) {
      record.data = fields;
    }

    this.#logger.error(record, message);
  }
}

class PinoDebugLog implements DebugLog {
  readonly #destination: FileDestination | undefined;
  readonly #logger: PinoLogger;

  constructor(logger: PinoLogger, destination?: FileDestination) {
    this.#logger = logger;
    this.#destination = destination;
  }

  forModule(module: string): ModuleLogger {
    return new PinoModuleLogger(this.#logger.child({ module }));
  }

  flush(): void {
    this.#logger.flush();
  }

  close(): void {
    this.flush();
    this.#destination?.end();
  }
}

function createRootLogger(destination: DestinationStream): PinoLogger {
  return pino(
    {
      base: null,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      level: "debug",
      serializers: {
        err: pino.stdSerializers.err,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export function createDebugLog(options: CreateDebugLogOptions): DebugLog {
  if (options.mode === "production") {
    return new PinoDebugLog(pino({ level: "silent" }));
  }

  const logFile =
    options.logFile ??
    join(process.cwd(), ".glassbox-dev", options.mode === "test" ? "test.log" : "debug.log");

  let fileDestination: FileDestination;

  try {
    mkdirSync(dirname(logFile), { recursive: true });
    writeFileSync(logFile, "", "utf8");
    fileDestination = pino.destination({
      dest: logFile,
      sync: true,
    });
  } catch (error) {
    const fallbackLogger = createRootLogger(process.stderr);
    fallbackLogger.error(
      error instanceof Error ? { err: error } : { error },
      "debug log file is unavailable; using stderr",
    );
    return new PinoDebugLog(fallbackLogger);
  }

  const streams: pino.StreamEntry[] = [
    {
      level: "debug",
      stream: fileDestination,
    },
  ];

  if (options.console !== false) {
    streams.push({
      level: "debug",
      stream: process.stdout,
    });
  }

  const logger = createRootLogger(pino.multistream(streams));

  return new PinoDebugLog(logger, fileDestination);
}
