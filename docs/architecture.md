# GlassBox Architecture

Status: Accepted for MVP architecture  
Date: 2026-07-16

## 1. Product intent

GlassBox is a local transparency and security-audit layer for AI coding agents. It discovers local agent sessions, turns agent-specific records into a common event model, and lets the user run deterministic rules or request deeper analysis.

The first release targets individual users and Claude Code. The architecture must allow additional adapters such as Codex, OpenCode, and Grok without changing the analysis core.

## 2. Confirmed product principles

- A user session is the smallest unit that can be discovered, selected, scanned, and reported on.
- Session files are read-only inputs. GlassBox never runs commands, scripts, or links found in a session.
- GlassBox stores paths, fingerprints, derived metadata, normalized facts, and analysis results. It does not copy complete source sessions into its database.
- Agent-specific formats stop at the adapter boundary. Rules and reports use a common event model.
- Rule analysis and LLM analysis are independent. Their runs, statuses, versions, and findings never overwrite each other.
- Default agent locations are discovered automatically. Users add extra locations in Settings. Full-disk discovery is an explicit user action.
- Rule, LLM, and multi-session analysis are user-triggered. Discovery does not silently start analysis.
- The same local core is used in foreground and operating-system service modes.
- There is no business-level session-count limit. Work is streamed, cancellable, and bounded by configured local concurrency.

## 3. MVP and roadmap

### MVP

- Claude Code adapter.
- Automatic discovery in Claude Code's standard locations.
- Persistent custom discovery locations.
- Manually triggered full-disk session discovery.
- Session inventory, filtering, and detail views.
- Session revision tracking.
- A deterministic rule-engine framework with a small set of demonstration rules.
- Single-session findings and cross-session aggregation/comprehensive rule analysis.
- CLI and local browser UI.
- Foreground and operating-system service hosting.
- Local SQLite index and durable analysis history.

### Planned after the MVP

- More agent adapters.
- A broad, maintained security-rule library.
- Long-session chunking and multi-pass LLM summaries.
- Detailed cloud/local LLM provider design.
- A safe declarative format for distributing rules.

### Product non-goals

- Scanning arbitrary non-session files for malware.
- Monitoring processes or network traffic.
- Executing content found in a session.
- Treating LLM output as an authoritative or executable decision.

## 4. Technology architecture

GlassBox is a TypeScript modular monolith in a pnpm workspace.

- Node.js LTS runs the CLI, local server, discovery, adapters, task engine, rules, and persistence.
- React and TypeScript implement the browser UI.
- SQLite stores the local index and derived results.
- Zod schemas define runtime-validated contracts at file, API, adapter, and LLM boundaries.
- The browser assets are served by the local server.
- Electron is not required. A native desktop shell can be added later without moving business logic into it.

The installer distribution includes a private Node.js runtime, so users do not have to install Node. The npm distribution may use a compatible system Node.js.

## 5. System overview

```text
CLI ------------------+
                      |
Browser UI --> Local API --> Application services --> Task engine
                                              |
                    +-------------------------+-------------------------+
                    |                         |                         |
               Discovery                Analysis                  Queries
                    |                  /          \                    |
                    v                 v            v                   v
              Agent adapters      Rule engine   LLM boundary       SQLite
                    |
                    v
             Local session files (read-only)
```

The CLI is deliberately thin. If a server is already running, it connects to it. Otherwise it starts the same server entry point with a foreground lifetime. Installing the service changes process lifecycle only; it does not change discovery or analysis behavior.

## 6. Repository boundaries

```text
apps/
  cli/                 Thin commands and local-server bootstrap
  server/              HTTP API, lifecycle, dependency composition
  web/                 React browser UI

packages/
  domain/              Pure domain types and invariants
  application/         Use cases, orchestration, status derivation
  api-contract/        Shared request, response, and event schemas
  adapter-sdk/         Adapter contracts and normalized event schema
  adapter-claude/      Claude Code discovery and JSONL parsing
  discovery/           Search plans, traversal, progress, cancellation
  rule-engine/         Rule lifecycle, evaluation, evidence, rule packs
  persistence/         SQLite repositories and migrations
  llm-engine/          Reserved provider/analysis boundary; design deferred
  test-support/        Fixtures and contract-test helpers
```

Dependencies point inward:

```text
apps -> application -> domain
          ^              ^
          |              |
 adapters / rules / persistence implement declared ports
```

The domain package does not import Node APIs, HTTP, SQLite, React, a particular agent, or an LLM SDK. Cross-package imports are enforced by lint rules and architecture tests.

## 7. Session identity and revisions

### 7.1 Stable identity

`Session` is identified by an adapter ID plus the agent's native session ID. A path is a source location, not the identity. This permits a session to move without silently becoming a different conversation.

If an adapter cannot obtain a native ID, it derives a stable fallback ID and records that the identity is inferred. Collisions are handled as separate source conflicts rather than merging data silently.

### 7.2 Revisions

A scan result always refers to an exact `SessionRevision`. SHA-256 is used instead of MD5 because it is available in the Node runtime, supports streaming, and is appropriate for an audit product.

```text
Session
  current observed source state
  SessionRevision[]
    aggregate SHA-256
    captured time
    total scanned bytes
    source manifest
    AnalysisRun[]
```

Discovery records cheap observations such as canonical path, file identity where available, size, and modification time. It does not hash every discovered file. Analysis streams the selected bytes through SHA-256 while parsing and creates or reuses the authoritative revision.

For the usual append-only case, analysis captures the starting length and reads only through that boundary. If more bytes appear, the completed result remains valid for its revision and the session is marked as having unscanned content. If bytes within the captured range are replaced while scanning, the run ends as `unstable` and does not publish findings.

For future agents whose session is spread across multiple files, the adapter returns a source manifest. The revision digest is calculated from the ordered source roles, lengths, and individual digests.

## 8. Core data model

- `SourceLocation`: default, custom, or full-disk-discovered location and whether it is enabled.
- `Session`: stable agent conversation identity and searchable metadata.
- `SessionSource`: one physical source belonging to a session.
- `ObservedSourceState`: latest inexpensive file observation from discovery.
- `SessionRevision`: immutable identity of the bytes analyzed at one point in time.
- `NormalizedEvent`: an adapter-independent action or message with a source reference.
- `AnalysisRun`: immutable record of one rule, collection-rule, or future LLM run.
- `AnalysisRunInput`: exact session revisions included in a run.
- `Finding`: severity, confidence, category, explanation, and evidence.
- `Task`: durable execution and progress state for discovery or analysis work.

Evidence uses a `SourceRef` containing the source role, JSONL line or byte range, and a minimal display excerpt. This is enough to explain a finding without copying the complete session.

Normalized events store fields required for filtering, rules, and aggregation. Raw message bodies remain in the original file and are loaded on demand. Sensitive raw content is not written to production application logs. Local development/test Debug logs are an explicit exception and may contain raw content for diagnosis; they are ignored by Git and disabled in release builds.

## 9. Analysis state

Rule and LLM status is derived per current revision, not kept as a pair of booleans.

```text
never -> queued -> running -> completed
                     |          |
                     |          +-> stale when source/analyzer/config changes
                     +-> failed
                     +-> canceled
                     +-> unstable
```

When discovery sees a size or modification-time change before a new digest is calculated, the previous result is shown as `possibly_stale`. After the next analysis produces a revision digest, GlassBox can determine whether the content truly changed.

Every `AnalysisRun` stores:

- analysis kind and scope;
- exact input revision IDs;
- adapter and normalized-schema versions;
- rule-pack or future prompt/model versions;
- relevant configuration digest;
- timestamps and terminal status;
- structured error details;
- generated findings.

Old runs are retained. The UI defaults to the run relevant to the current revision and lets the user inspect history.

## 10. Discovery

Each adapter supplies standard locations and a cheap candidate probe. For Claude Code, the adapter initially targets the known Claude Code project/session layout and identifies JSONL sessions without fully parsing their content.

The first Claude Code implementation treats only direct `.jsonl` children of each project directory as primary sessions; nested subagent, workflow, and tool-result files are excluded. Inventory reads at most 256 KiB from the start of each candidate to recover the internal `sessionId`, project path, and a display title. The filename stem is an explicitly inferred identity fallback when no internal ID is available. This bounded metadata read does not hash or fully parse the session.

### Normal flow

1. On startup or refresh, scan enabled default and custom locations.
2. Upsert the session inventory and latest observed source states.
3. Mark missing, moved, changed, malformed, or unreadable sources explicitly.
4. Do not start rule or LLM analysis.

### Settings

- Add, disable, or remove custom locations.
- Refresh normal locations.
- Start a full-disk search.
- Review permission and parsing warnings.
- Save a useful parent directory found by full-disk search as a custom location.

Full-disk search is cancellable, reports progress, does not follow directory symlinks by default, avoids duplicate canonical paths, and treats permission failures as warnings. Platform-specific system and virtual filesystem exclusions prevent obviously unsafe or endless traversal. Users may review and override exclusions where the operating system permits it.

## 11. Adapter contract

An adapter owns agent-specific knowledge and provides these capabilities:

```text
identity and schema version
defaultLocations(platform)
discover(searchRoot) -> session candidates
identify(candidate) -> stable session identity and metadata
capture(session) -> bounded source manifest
parse(captured sources) -> async stream of normalized events
```

Parsing is streaming and tolerant of truncated final JSONL lines. Malformed records produce structured diagnostics with source positions. They do not cause valid earlier records to disappear.

Adapter contract fixtures are versioned. Any adapter change must prove whether it preserves normalized output or intentionally requires results to become stale.

## 12. Rule engine

Rules consume normalized events only. They do not receive arbitrary filesystem, network, shell, or process capabilities.

A rule includes a stable ID, version, title, category, default severity, confidence policy, supported event types, evaluation lifecycle, and remediation text. Evaluators may emit findings for one event or keep bounded state to recognize sequences such as download followed by execution.

Two scopes are supported:

- Session rules stream over one revision.
- Collection rules query derived facts and findings for a user-selected set of revisions.

Rule-pack version and configuration digests are stored on each run. Re-running creates a new immutable run rather than updating old findings.

MVP rules are first-party TypeScript compiled with the application. This keeps the initial framework easy to test and avoids executing downloaded rule scripts. A future declarative rule format must be data-only, schema-validated, resource-limited, and unable to call Node APIs.

## 13. LLM boundary

Detailed LLM design is intentionally deferred. The architecture reserves separate single-session and collection-analysis run types plus a provider boundary.

The following constraints are already fixed:

- cloud and local providers must share one application-facing contract;
- credentials must be kept in the operating-system credential store;
- users must know which content range and provider will be used;
- session content is untrusted input;
- models receive no shell or file-operation tools;
- returned structures are schema-validated and treated as advisory;
- LLM runs do not overwrite rule runs;
- over-limit input may fail clearly until chunking is designed.

Provider selection, prompts, redaction, chunking, retries, caching, cost controls, and multi-pass aggregation require a separate design decision record.

## 14. Persistence

SQLite runs locally in WAL mode behind repository interfaces. SQL migrations are explicit, ordered, and tested both from an empty database and from every supported previous schema.

Logical tables:

```text
source_locations
sessions
session_sources
observed_source_states
session_revisions
revision_sources
normalized_events
tasks
analysis_runs
analysis_run_inputs
findings
finding_evidence
settings
```

Secrets and complete raw sessions are not database columns. Database access stays inside `packages/persistence`, so repository implementations can evolve without changing adapters or rule logic.

Indexes prioritize agent/native session ID, project, time, availability, current risk, event type, finding category/severity, and analysis status. Retention and compaction controls can be added if derived event storage becomes large.

## 15. Task execution and reliability

The local service owns a small persistent task queue; no Redis or external worker service is introduced.

- `AbortController` propagates cancellation through traversal, parsing, hashing, rules, and persistence.
- File and analysis concurrency is bounded so a user-selected full-disk operation cannot make the UI unusable.
- Progress events include current phase, counts, bytes where known, warnings, and whether cancellation is still in progress.
- Writes are committed at stable boundaries. Findings become visible only with a completed run.
- On restart, tasks left in `running` become `interrupted`. MVP lets users restart them rather than pretending to resume from an unsafe point.
- Repeating a request creates an explicit new run or returns the already-running task; it never silently races two writers for the same run.

Exact concurrency defaults will be determined by cross-platform measurements and exposed as advanced settings only if needed.

## 16. Local API and CLI

The server binds to a loopback address only. It serves the browser application and a versioned local API from the same origin. A random local token, restrictive file permissions, Origin checks, and CSRF protection prevent unrelated local pages from issuing scan commands.

REST-style commands and queries are sufficient. Server-Sent Events carry task progress and inventory invalidation; WebSockets are not introduced without a bidirectional requirement.

Initial API groups:

```text
/v1/sessions
/v1/locations
/v1/discovery-runs
/v1/analysis-runs
/v1/findings
/v1/tasks
/v1/settings
```

All request, response, and event bodies use shared Zod contracts. The UI and CLI do not import persistence or adapter implementations.

Expected CLI shape:

```text
glassbox                         Start/connect and open the browser
glassbox serve                  Run the local service in the foreground
glassbox sessions list          Query discovered sessions
glassbox discover               Refresh default and custom locations
glassbox discover --full-disk   Explicit full-disk discovery
glassbox scan --rules ...       Start rule analysis for selected sessions
glassbox service ...            Install/start/stop/remove OS service hosting
```

Exact command flags are an implementation-level design and may evolve without changing the package boundaries.

## 17. Security and privacy boundaries

- Bind only to loopback by default; LAN access is not an MVP option.
- Open source files read-only and never invoke session content.
- Do not follow directory symlinks during broad discovery by default.
- Treat adapter input, evidence, filenames, rule text, and future LLM output as untrusted display data.
- Escape UI content and apply a restrictive Content Security Policy.
- Store cloud credentials through the OS credential store and retain only credential references in SQLite.
- Keep telemetry off by default and never include session contents, evidence excerpts, paths, or prompts in telemetry.
- Redact raw content from operational logs and structured errors.
- Sign and checksum released installers; publish checksums separately.
- Limit task concurrency and result sizes to resist malformed or adversarial session input.

## 18. Distribution and service hosting

Primary release artifacts:

- macOS signed/notarized installer and Homebrew cask/formula;
- Windows signed installer and WinGet package;
- Linux tarball plus deb/rpm where maintained;
- npm package as an additional developer-oriented channel;
- shell installer that downloads and verifies the platform artifact.

Native installers bundle a private Node.js LTS runtime, compiled server/CLI JavaScript, browser assets, and migrations. They do not depend on a global Node installation.

Service adapters wrap the same `serve` entry point for launchd, Windows service hosting, and systemd. Service installation is an explicit user action. Configuration and SQLite data live in standard per-user application-data directories, not inside the installation directory.

Release CI builds and smoke-tests each supported OS/architecture. Packaging native addons is avoided where a maintained built-in or JavaScript implementation is sufficient.

## 19. Testing strategy

- Adapter golden tests use versioned, anonymized Claude Code JSONL fixtures.
- Parser tests cover malformed lines, truncated tails, missing fields, large records, and schema changes.
- Revision tests cover append-during-scan, overwrite-during-scan, moves, deletion, same-size edits, and multi-file manifests.
- Rule tests include positive, negative, ordering, duplicate-event, and bounded-state cases.
- Repository tests run real migrations and queries against temporary SQLite databases.
- API contract tests ensure CLI, UI, and server schemas remain compatible.
- Integration tests cover discovery through completed findings without mocking the main boundaries.
- Playwright tests cover the session inventory, scan progress, cancellation, stale results, and evidence views.
- Security tests cover path edge cases, symlink loops, HTML/script payloads, local API origin checks, and oversized input.
- CI runs type checking, linting, unit/integration tests, and packaging smoke tests on Windows, macOS, and Linux.

## 20. Key risks

| Risk                                            | Architectural response                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Agent formats change without notice             | Versioned adapters, tolerant parsing, golden fixtures, diagnostics                      |
| Live session changes during analysis            | Bounded capture, streaming SHA-256, immutable revisions, unstable-run detection         |
| Full-disk discovery is slow or hits permissions | Default locations first, explicit full-disk action, cancellation, warnings, exclusions  |
| False positives undermine trust                 | Evidence-first findings, separate severity/confidence, immutable run history            |
| Session content attacks the UI or LLM           | Treat all content as untrusted, escape output, no model tools, schema validation        |
| Derived SQLite data grows large                 | Streaming analysis, selective derived events, indexes, future retention controls        |
| Cross-platform packaging becomes complex        | No Electron for MVP, bundled standard runtime, avoid native addons, release matrix      |
| AI-led maintenance causes architecture drift    | Strong types, runtime schemas, dependency rules, short explicit modules, contract tests |

## 21. Decision log

| Decision                                             | Alternatives considered             | Reason                                                                                                               |
| ---------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Full TypeScript stack                                | Go + TypeScript; Rust + TypeScript  | Unified types and lower AI maintenance cost fit JSON, rules, UI, and LLM orchestration                               |
| Node local service plus browser UI                   | Electron-first desktop; CLI only    | Covers all desktop OSes and CLI automation without Chromium packaging overhead                                       |
| Modular monolith                                     | Microservices                       | One local user and one database do not justify distributed-system cost                                               |
| Session is the minimum unit                          | File; individual event              | Matches user intent and remains stable when a file moves or an adapter uses multiple files                           |
| SHA-256 session revisions                            | MD5; size/mtime only                | Reliable audit identity, streamable, built into Node, resistant to intentional collisions                            |
| Do not copy raw sessions                             | Import full sessions into SQLite    | Minimizes private-data duplication and storage use                                                                   |
| Default discovery is automatic                       | Require path choice on first run    | Normal use should immediately show known sessions                                                                    |
| Custom paths in Settings                             | Search-path wizard every run        | Keeps normal flow simple while supporting nonstandard layouts                                                        |
| Full-disk discovery is explicit                      | Automatic full-disk crawl           | Avoids surprising cost and permission prompts                                                                        |
| Analysis is user-triggered                           | Automatic rule/LLM scans            | Preserves user control over work and LLM cost/privacy                                                                |
| Versioned immutable analysis runs                    | Two scanned/not-scanned booleans    | Correctly represents changes, failures, history, and differing rule/LLM revisions                                    |
| First-party TypeScript rules for MVP                 | Downloadable scripts; early DSL     | Validates the engine without creating a code-execution or language-design problem                                    |
| SQLite repository boundary                           | JSON files; external database       | Local querying and transactions without an external service; replaceable later                                       |
| LLM details deferred                                 | Choose providers and chunking now   | Product constraints are known, but implementation choices need a dedicated design                                    |
| Native installers bundle Node                        | Require npm/Node for everyone       | Predictable runtime and one-step installation across platforms                                                       |
| Root `AGENTS.md` is the AI documentation entry point | Pure index; duplicate full handbook | Combines a discoverable document map with stable safety guardrails while detailed design remains canonical elsewhere |
| TDD with a simple local Debug log                    | Tests after implementation; full observability stack | Makes behavior explicit first while preserving an AI-readable failure trace without premature logging infrastructure |

## 22. Deferred design records

Create separate design records before implementing these areas:

1. LLM providers, prompts, redaction, structured output, cost controls, and long-session aggregation.
2. Declarative rule-pack format, update/signing mechanism, and compatibility policy.
