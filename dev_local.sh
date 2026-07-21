#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SERVER_PORT="43110"
WEB_PORT="5173"

SERVICE_PIDS=()
SERVICE_NAMES=()

log() {
  printf '[GlassBox] %s\n' "$*"
}

fail() {
  printf '[GlassBox] 错误: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local exit_code=$?

  # Disable the traps while stopping children so cleanup is safe to call once.
  trap - EXIT INT TERM

  if ((${#SERVICE_PIDS[@]} > 0)); then
    log "停止开发服务..."
  fi

  if ((${#SERVICE_PIDS[@]} > 0)); then
    for pid in "${SERVICE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done

    # Reap children so the shell does not leave pnpm/node processes behind.
    for pid in "${SERVICE_PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi

  exit "$exit_code"
}

handle_signal() {
  exit 130
}

trap cleanup EXIT
trap handle_signal INT TERM

cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || fail "未找到 Node.js，请先安装 Node.js 24。"
command -v pnpm >/dev/null 2>&1 || fail "未找到 pnpm，请先安装 pnpm 11.13.1。"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" -lt 24 ]]; then
  fail "Node.js 版本过低（当前 $(node --version)，需要 Node.js 24 或更高版本）。"
fi
if [[ "$node_major" != "24" ]]; then
  log "警告: 项目当前按 Node.js 24 验证，当前版本为 $(node --version)。"
fi

pnpm_version="$(pnpm --version)"
if [[ "$pnpm_version" != "11.13.1" ]]; then
  fail "pnpm 版本不匹配（当前 $pnpm_version，需要 11.13.1）。"
fi

check_port_available() {
  local port="$1"
  local listeners=""

  # lsof is available on macOS/Linux. If it is unavailable (for example in a
  # minimal shell on Windows), the services themselves will report a bind error.
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  listeners="$(lsof -nP "-iTCP:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$listeners" ]]; then
    printf '%s\n' "$listeners" >&2
    fail "端口 $port 已被占用。请停止占用该端口的服务后重试（脚本不会自动终止未知进程）。"
  fi
}

log "检查端口..."
check_port_available "$SERVER_PORT"
check_port_available "$WEB_PORT"

log "安装/校验 workspace 依赖..."
# CI=1 makes this idempotent startup command non-interactive when pnpm needs
# to recreate a stale node_modules directory.
CI=1 pnpm install --frozen-lockfile --prefer-offline

log "构建共享包和本地 API..."
pnpm build:packages
pnpm --filter @glassbox/server build

start_service() {
  local name="$1"
  local package_name="$2"

  log "启动 ${name}..."
  pnpm --filter "$package_name" run dev &
  SERVICE_PIDS+=("$!")
  SERVICE_NAMES+=("$name")
}

start_service "API" "@glassbox/server"
start_service "Web" "@glassbox/web"

log "开发服务已启动："
log "  API: http://127.0.0.1:${SERVER_PORT}"
log "  Web: http://127.0.0.1:${WEB_PORT}"
log "按 Ctrl+C 可同时停止它们。"

while :; do
  for index in "${!SERVICE_PIDS[@]}"; do
    pid="${SERVICE_PIDS[$index]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      fail "${SERVICE_NAMES[$index]} 进程已退出，正在停止其他服务。"
    fi
  done
  sleep 1
done
