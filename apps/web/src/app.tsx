import { sessionsResponseSchema, type SessionsResponse } from "@glassbox/api-contract";
import { useCallback, useEffect, useState } from "react";

import { AppHeader, SessionsView } from "./sessions-view";

async function requestSessions(signal?: AbortSignal): Promise<SessionsResponse> {
  const response = await fetch("/v1/sessions", {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error(`本地服务返回 ${response.status}`);
  }

  return sessionsResponseSchema.parse(await response.json());
}

function StatusScreen({
  error,
  onRetry,
}: {
  readonly error: string | null;
  readonly onRetry: () => void;
}) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="status-screen">
        {error ? (
          <div className="status-panel status-panel--error" role="alert">
            <span className="status-symbol">!</span>
            <p className="eyebrow">LOCAL SERVICE UNAVAILABLE</p>
            <h1>无法读取 Session</h1>
            <p>{error}</p>
            <button type="button" className="refresh-button" onClick={onRetry}>
              重新连接
            </button>
          </div>
        ) : (
          <div className="status-panel" aria-live="polite" aria-label="加载状态">
            <span className="loading-mark" aria-hidden="true" />
            <p className="eyebrow">READING LOCAL METADATA</p>
            <h1>正在查找 Claude Code Sessions</h1>
            <p>只读取默认目录中的会话元数据，请稍候。</p>
            <div className="loading-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "发生了未知错误";
}

export function App() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setIsLoading(true);

    try {
      setData(await requestSessions(signal));
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }
      setError(errorMessage(loadError));
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSessions(controller.signal);

    return () => controller.abort();
  }, [loadSessions]);

  if (data === null) {
    return <StatusScreen error={error} onRetry={() => void loadSessions()} />;
  }

  return (
    <SessionsView
      data={data}
      error={error}
      isRefreshing={isLoading}
      onRefresh={() => void loadSessions()}
    />
  );
}
