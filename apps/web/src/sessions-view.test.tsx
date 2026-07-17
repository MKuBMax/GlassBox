import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionsView } from "./sessions-view";

describe("SessionsView", () => {
  it("renders one fixed visual system without prototype controls or ambient decoration", () => {
    const html = renderToStaticMarkup(
      <SessionsView
        data={{
          projectsRoot: "/home/person/.claude/projects",
          scannedAt: "2026-07-17T04:00:00.000Z",
          sessions: [],
          warnings: [],
        }}
        error={null}
        isRefreshing={false}
        onRefresh={() => undefined}
      />,
    );

    expect(html).toContain('<div class="app-shell">');
    expect(html).not.toContain("视觉方案");
    expect(html).not.toContain("方案 1");
    expect(html).not.toContain("ambient-field");
  });

  it("renders discovered session metadata and its unscanned state", () => {
    const html = renderToStaticMarkup(
      <SessionsView
        data={{
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
        }}
        error={null}
        isRefreshing={false}
        onRefresh={() => undefined}
      />,
    );

    expect(html).toContain("Synthetic session");
    expect(html).toContain("/workspace/project");
    expect(html).toContain("未扫描");
    expect(html).toContain("1 个 Session");
  });

  it("explains when the default location contains no sessions", () => {
    const html = renderToStaticMarkup(
      <SessionsView
        data={{
          projectsRoot: "/home/person/.claude/projects",
          scannedAt: "2026-07-17T04:00:00.000Z",
          sessions: [],
          warnings: [],
        }}
        error={null}
        isRefreshing={false}
        onRefresh={() => undefined}
      />,
    );

    expect(html).toContain("没有找到 Claude Code Session");
    expect(html).toContain("后续版本会在设置中支持添加自定义位置");
  });
});
