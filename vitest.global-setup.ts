import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export default function prepareTestDebugLog(): void {
  const logDirectory = join(process.cwd(), ".glassbox-dev");

  mkdirSync(logDirectory, { recursive: true });
  writeFileSync(join(logDirectory, "test.log"), "", "utf8");
}
