import type { SessionSummary, SessionsResponse } from "@glassbox/api-contract";

export interface SessionsViewProps {
  readonly data: SessionsResponse;
  readonly error: string | null;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
}

function BoxMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="M7 4.5h18a2.5 2.5 0 0 1 2.5 2.5v18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 25V7A2.5 2.5 0 0 1 7 4.5Z" />
      <path d="m10 12 6-3.5 6 3.5v8l-6 3.5-6-3.5v-8Z" />
      <path d="m10 12 6 3.5 6-3.5M16 15.5v8" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" />
    </svg>
  );
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unit = units[0]!;

  for (const nextUnit of units.slice(1)) {
    if (size < 1024) {
      break;
    }
    size /= 1024;
    unit = nextUnit;
  }

  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(size)} ${unit}`;
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    hour12: false,
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function projectName(session: SessionSummary): string {
  if (!session.projectPath) {
    return "未知项目";
  }

  return session.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? session.projectPath;
}

function SessionCard({ session }: { readonly session: SessionSummary }) {
  return (
    <li className="session-card">
      <article>
        <div className="session-card__topline">
          <div className="session-badges" aria-label="Session 状态">
            <span className="badge badge--agent">Claude Code</span>
            <span className="badge badge--pending">
              <span className="status-dot" aria-hidden="true" />
              未扫描
            </span>
          </div>
          <time dateTime={session.modifiedAt}>{formatDate(session.modifiedAt)}</time>
        </div>

        <h3>{session.title ?? "未命名 Session"}</h3>
        <p className="project-path" title={session.projectPath ?? undefined}>
          <span>{projectName(session)}</span>
          {session.projectPath ? <code>{session.projectPath}</code> : null}
        </p>

        <dl className="session-meta">
          <div>
            <dt>Session ID</dt>
            <dd>
              <code>{session.nativeSessionId}</code>
              {session.identityOrigin === "inferred" ? (
                <span className="inferred-label">推断</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{formatBytes(session.sizeBytes)}</dd>
          </div>
          <div className="source-meta">
            <dt>只读来源</dt>
            <dd>
              <code title={session.sourcePath}>{session.sourcePath}</code>
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}

export function AppHeader() {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="GlassBox 首页">
        <span className="brand-mark">
          <BoxMark />
        </span>
        <span>GlassBox</span>
      </a>
      <div className="local-mode">
        <span aria-hidden="true" />
        本地只读模式
      </div>
    </header>
  );
}

export function SessionsView({ data, error, isRefreshing, onRefresh }: SessionsViewProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <AppHeader />

      <main id="main-content" className="dashboard">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">SESSION INVENTORY</p>
            <h1 id="page-title">Sessions</h1>
            <p>
              从 Claude Code 默认目录读取会话元数据。GlassBox
              不会修改文件，也不会执行会话中的任何内容。
            </p>
          </div>
          <button
            className="refresh-button"
            type="button"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshIcon />
            {isRefreshing ? "正在刷新…" : "刷新列表"}
          </button>
        </section>

        <section className="overview" aria-label="发现概览">
          <div className="overview-card overview-card--primary">
            <span>已发现</span>
            <strong>{data.sessions.length}</strong>
            <small>个 Session</small>
          </div>
          <div className="overview-card">
            <span>默认位置</span>
            <code title={data.projectsRoot}>{data.projectsRoot}</code>
          </div>
          <div className="overview-card">
            <span>最后刷新</span>
            <strong className="overview-value--small">{formatDate(data.scannedAt)}</strong>
          </div>
        </section>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>刷新失败</strong>
            <span>{error}，当前仍显示上一次成功读取的结果。</span>
          </div>
        ) : null}

        {data.warnings.length > 0 ? (
          <details className="warning-panel">
            <summary>{data.warnings.length} 个文件读取警告</summary>
            <ul>
              {data.warnings.map((warning) => (
                <li key={`${warning.code}:${warning.path}`}>
                  <strong>{warning.code}</strong>
                  <span>{warning.message}</span>
                  <code>{warning.path}</code>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <section className="inventory" aria-labelledby="inventory-title" aria-busy={isRefreshing}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">LOCAL RECORDS</p>
              <h2 id="inventory-title">会话列表</h2>
            </div>
            <span>{data.sessions.length} 个 Session</span>
          </div>

          {data.sessions.length === 0 ? (
            <div className="empty-state">
              <BoxMark />
              <h3>没有找到 Claude Code Session</h3>
              <p>当前默认位置中没有主会话文件。后续版本会在设置中支持添加自定义位置。</p>
            </div>
          ) : (
            <ol className="session-list">
              {data.sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span>GlassBox MVP</span>
        <span>Session 内容始终保留在原始文件中</span>
      </footer>
    </div>
  );
}
