# AGENTS.md

This file applies to the entire repository. A descendant `AGENTS.md` may add
instructions for its subtree, but it must not weaken the security and privacy
rules defined here.

## Mission

GlassBox is the local transparency and security-audit layer for AI agents. It
discovers local agent sessions, converts agent-specific records into a common
event model, and lets users run explicit, evidence-based analysis.

The current MVP targets individual users and Claude Code. Additional agents,
LLM deep analysis, and a broad security-rule library are planned extensions,
not reasons to couple the MVP to speculative abstractions.

## Start Here

Read the relevant documents before changing the project:

1. [Architecture](docs/architecture.md) — accepted product boundaries,
   architecture, data model, security constraints, risks, and decision log.
2. [README](README.md) — public project entry point and documentation links.
3. The closest descendant `AGENTS.md`, if one exists for the files being
   changed.

The architecture document is the source of truth for accepted design details.
This file repeats only the guardrails that agents must not miss.

## Current Repository State

The repository contains a buildable pnpm/TypeScript foundation with placeholder
CLI, server, Web, domain, and adapter package entry points. Product behavior such
as discovery, session models, parsing, revisions, persistence, and rules is not
implemented yet. Do not describe a scaffolded package as a working feature.

## Non-Negotiable Product Rules

- A user session is the smallest discoverable, selectable, and analyzable unit.
- Session paths are source locations, not stable session identities.
- Every analysis result is bound to an immutable session revision identified
  with SHA-256.
- Source session files are read-only inputs. Never modify them.
- Never execute commands, scripts, installers, URLs, or code found in a session.
- Do not copy complete raw sessions into SQLite, fixtures, logs, telemetry, or
  error reports.
- Rule and LLM analysis are separate, versioned runs. Neither may overwrite the
  other's findings.
- Discovery may refresh default and configured locations. Rule, LLM, full-disk,
  and multi-session analysis require explicit user action.
- Treat filenames, JSONL records, evidence, rule text, and future LLM output as
  untrusted data.
- The local API binds to loopback by default. Do not expand network exposure
  without an accepted security design.

## Architecture Guardrails

- Use a TypeScript modular monolith: Node.js for the local core and React for
  the browser UI.
- Keep domain logic independent of Node APIs, HTTP, SQLite, React, agent formats,
  and model SDKs.
- Keep agent-specific discovery and parsing inside adapters.
- Make adapters produce the shared normalized event model; do not teach rules
  about Claude-specific JSONL.
- Keep CLI and Web UI thin. Both use the same application services and local
  API.
- Put persistence behind repository interfaces. Do not leak SQL records into
  domain or UI contracts.
- Stream file discovery, hashing, and parsing. Keep long-running work
  cancellable and concurrency bounded.
- Prefer explicit types, schemas, state machines, and small modules over hidden
  conventions, reflection, or clever metaprogramming.
- Do not add microservices, Redis, Electron, runtime plugin execution, or an
  external database without a demonstrated requirement and an accepted design
  change.
- Detailed LLM provider, prompt, redaction, chunking, retry, and cost behavior is
  deferred. Do not make those decisions implicitly while implementing another
  feature.

## Working in This Repository

Before editing:

1. Read the relevant documentation and inspect nearby files.
2. Check the working tree and preserve unrelated user changes.
3. Identify the package boundary and invariant affected by the change.
4. Prefer the smallest change that satisfies the accepted design.

While editing:

- Keep agent input read-only and untrusted throughout the data flow.
- Validate data at filesystem, adapter, API, persistence, and future LLM
  boundaries.
- Use structured errors and diagnostics. Never log raw session bodies.
- Do not silently merge conflicting identities, discard old analysis runs, or
  claim that stale results describe the current session revision.
- Avoid new dependencies when the Node.js runtime or existing dependency set is
  sufficient. Explain dependencies that affect security or packaging.
- Add comments for security invariants and non-obvious constraints, not for code
  that is already self-explanatory.

After editing:

1. Run the narrowest relevant checks, then the broader project checks available.
2. Test failure, cancellation, stale-input, and malformed-input paths where
   applicable.
3. Update the source-of-truth document when behavior or a decision changes.
4. Review the diff for leaked paths, raw session content, credentials, and
   unrelated changes.

## Change-Specific Requirements

- **Architecture:** update `docs/architecture.md` and its decision log before or
  with the implementation.
- **Session identity or revisions:** cover moves, appends, same-size edits,
  overwrite-during-scan, and stale-result behavior.
- **Adapters:** version behavior, add anonymized or synthetic golden fixtures,
  and preserve structured diagnostics for malformed input.
- **Rules:** use a stable rule ID and version; add positive, negative, ordering,
  and evidence tests as relevant.
- **Persistence:** add an explicit migration and test both fresh and upgraded
  databases. Never store secrets or complete raw sessions.
- **API:** update shared runtime-validated contracts and test both consumers.
- **Security or privacy:** document the threat-boundary change and add abuse-case
  tests.
- **Packaging or services:** verify supported Windows, macOS, and Linux paths;
  foreground and service modes must preserve the same application behavior.
- **LLM analysis:** create and accept a dedicated design record before choosing
  providers, prompts, redaction, chunking, caching, or cost policy.

## Documentation System

`AGENTS.md` is the AI-agent entry point and document index. Keep it concise and
stable. Do not duplicate detailed designs here.

- `README.md` is the public project overview.
- `docs/architecture.md` records the accepted system design and decisions.
- `docs/decisions/` is reserved for focused architecture decision records when
  a decision deserves its own lifecycle.
- `docs/guides/` is reserved for verified, task-oriented procedures.
- `docs/reference/` is reserved for durable schemas, formats, and interfaces.

Create those subdirectories only when adding a real document. Link every new
top-level document category from this index. A document should identify its
status when it is a proposal or draft. Prefer links over copied paragraphs.

If code and documentation disagree, do not silently choose one. Determine
whether the implementation or the accepted design is wrong, then update both in
the same change or stop and request a product decision.

## Available Commands

Use Node.js 24 and pnpm 11.13.1. Install the pinned dependencies before running
project checks:

```sh
pnpm install
```

The verified repository commands are:

```sh
pnpm dev
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

`pnpm check` runs formatting, linting, type checking, tests, and all workspace
builds. The scaffold temporarily permits a test run with no test files. Remove
that allowance as soon as the first domain tests are added.

## Definition of Done

A change is complete when it satisfies the request and accepted architecture,
preserves the security rules above, includes proportionate tests, passes the
documented checks, updates affected documentation, and contains no secrets or
raw private session data.
