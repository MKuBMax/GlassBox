# GlassBox Testing Strategy

Status: Accepted
Date: 2026-07-17

## 1. Purpose

GlassBox uses test-driven development to make security-sensitive behavior explicit before implementation. Tests define observable behavior; development-only logs preserve enough execution detail for a developer or AI agent to diagnose failures quickly.

The strategy prioritizes:

- correctness of session identity, revisions, parsing, and evidence;
- deterministic reproduction of bugs and malformed input;
- real filesystem and SQLite behavior where those boundaries matter;
- fast feedback during development;
- cross-platform confidence on Windows, macOS, and Linux;
- simple tooling that can grow only when the project demonstrates a need.

## 2. TDD workflow

Every behavior change follows the same loop:

1. List the behavior scenarios that matter.
2. Select exactly one scenario.
3. Write one runnable test with setup, invocation, and explicit assertions.
4. Run it and verify that it fails for the expected missing behavior.
5. Write the smallest implementation that makes it and all previous tests pass.
6. Refactor implementation and tests while they remain green.
7. Continue with the next scenario.

The initial failure is required. A test that passes before the behavior is implemented does not prove the intended change. A failure caused only by syntax, imports, or broken setup is not a useful Red step.

Every bug fix starts with a regression test that reproduces the bug.

## 3. Test layers

### Unit tests

Unit tests cover pure domain behavior, state transitions, event normalization, and rule decisions. They are colocated with source files:

```text
session.ts
session.test.ts
```

They use explicit inputs and outputs, avoid filesystem or database access, and should normally finish in milliseconds.

### Integration tests

Integration tests cover boundaries whose real behavior matters:

- temporary files and directories;
- Claude Code JSONL parsing;
- append, overwrite, move, deletion, and permission behavior;
- real SQLite databases and migrations;
- application use cases across adapter, revision, rule, and repository ports;
- local API contracts when the server exists.

Use operating-system temporary directories and a real temporary SQLite database. Do not mock `node:fs` or SQLite for these tests.

Integration tests live in the owning package when they exercise one package. Cross-package flows live under a root `tests/integration/` directory once such flows exist.

### End-to-end tests

Playwright is added only after the local API and browser UI provide real user behavior. E2E tests cover a small number of critical flows such as discovering sessions, starting a scan, observing stale results, cancellation, and viewing evidence.

E2E tests do not duplicate all parser and rule edge cases.

## 4. Fixture policy

Committed fixtures are synthetic and minimal. They must contain only the fields needed to demonstrate one behavior.

```text
packages/adapter-claude/
  test/
    fixtures/
      <format-version>/
        basic-session.jsonl
        malformed-line.jsonl
        truncated-tail.jsonl
```

Each adapter fixture has explicit expected metadata, normalized events, diagnostics, and source references. Large-input tests generate records at runtime instead of committing large logs.

Real user sessions are never committed. A future opt-in local compatibility command may read a user-provided session and write detailed local Debug logs, but it is not part of deterministic CI.

## 5. Required behavior matrix

Coverage percentages do not replace these cases.

| Area             | Required cases                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Session identity | native ID, moved path, inferred ID, identity conflict                                                               |
| Revisions        | unchanged file, append during scan, overwrite during scan, same-size edit, deletion, multiple sources               |
| Adapter parsing  | valid records, unknown fields, missing fields, malformed line, truncated tail, large line, stable source references |
| Discovery        | default location, custom location, duplicate path, unreadable path, symlink loop, cancellation                      |
| Analysis state   | every valid transition, invalid transition, failure, cancellation, interruption, stale and possibly-stale results   |
| Rules            | positive, negative, ordering, duplicate events, evidence, bounded state                                             |
| Persistence      | empty migration, upgrade migration, rollback, uniqueness, transaction failure, reopened database                    |
| API              | valid contract, invalid input, structured error, local authorization and Origin checks                              |
| UI               | untrusted text escaping, loading, empty, failure, stale state, cancellation                                         |
| Security         | source remains read-only, session commands never execute, raw sessions are not persisted as product data            |

## 6. Test doubles and determinism

- Inject clocks and ID generators where time or randomness affects behavior.
- Use fixed UTC timestamps in assertions.
- Use temporary directories unique to each test and clean them after the test.
- Prefer small fakes that implement a declared port over mocking private functions.
- Do not mock the unit under test or assert internal call order unless call order is the behavior.
- Unit and integration tests do not use the network.
- Random or generated tests must record their seed when failing.
- Do not use arbitrary sleeps. Wait for an observable state with a deadline.

## 7. Development Debug log

The Debug log is a diagnosis aid, not a test oracle. Tests determine correctness through assertions.

The first implementation is intentionally simple:

- `packages/logging` exposes the project Logger interface.
- Pino is hidden behind that interface.
- Development output goes to the console and `.glassbox-dev/debug.log`.
- Test output goes to `.glassbox-dev/test.log`.
- Each line is JSON containing timestamp, level, module, message, and supplied data.
- The file is truncated at the beginning of each development or test run.
- Tests initially run in one worker so file order remains readable.
- Complete paths, session records, internal state, and stacks are permitted in these local development/test logs.
- `.glassbox-dev/` is ignored by Git and must never be committed.
- Failure to open or write the log falls back to `stderr` and must not fail the behavior being tested.
- Release builds do not enable this detailed Debug output.

Do not add rotation, remote transport, OpenTelemetry, automatic context propagation, or per-test artifacts until an observed problem requires them.

## 8. Assertions

- Assert domain results, persisted records, emitted events, and user-visible behavior.
- Use explicit assertions for risk categories, severity, confidence, and evidence.
- Do not make broad snapshots the only assertion for security decisions.
- Use focused snapshots only for stable, reviewable structures where a textual diff is valuable.
- Do not assert timestamps, random IDs, log formatting, or implementation-only fields unless they are the behavior under test.
- Logger-specific tests may assert structured log records. Other tests must not use log text as their correctness signal.

## 9. Coverage policy

Coverage is a diagnostic, not the primary target.

- Add V8 coverage with the first real domain tests.
- Publish a coverage report in CI.
- Do not introduce an arbitrary global percentage gate while the repository is mostly scaffolding.
- Once the domain, adapter, and rule packages have meaningful baselines, use a ratchet: coverage may not decrease without an explicit reason.
- Critical behavior in the required matrix must be tested even when coverage already reports 100%.

Mutation testing, fuzzing frameworks, and property-testing libraries are deferred until rules and parsers are mature enough to justify their maintenance cost.

## 10. Commands

The intended command split is:

```sh
pnpm test                    # deterministic unit and integration suite
pnpm test:watch              # local Red-Green-Refactor loop
pnpm test -- <path>          # one file or focused pattern
pnpm test:coverage           # V8 coverage report
pnpm test:e2e                # Playwright, once E2E behavior exists
pnpm check                   # complete pre-commit quality gate
```

Only add a command to `AGENTS.md` after it is implemented and verified. Do not reintroduce the removed `--passWithNoTests` allowance.

## 11. CI policy

Pull requests must pass formatting, linting, type checking, unit/integration tests, and builds.

- Run deterministic unit and integration tests on Windows, macOS, and Linux because path, permissions, and file-update behavior are product concerns.
- Run E2E tests on one primary CI operating system for normal pull requests, then smoke-test supported systems before release.
- Do not automatically retry failed tests. A flaky test is a defect to fix or remove from the blocking suite.
- Keep the normal pull-request pipeline below five minutes where practical.
- Move stress, very-large-input, and long performance checks to a scheduled job if they become too slow for normal development.

## 12. Definition of done

A behavior change is complete when:

- its scenario was first represented by a meaningful failing test;
- the implementation and all previous tests pass;
- relevant failure and edge cases are covered;
- no test is skipped or focused with `.skip` or `.only`;
- local Debug logs are sufficient to diagnose a failure without adding temporary `console.log` calls;
- the full `pnpm check` command passes;
- changed behavior and decisions are reflected in the source-of-truth documentation.

## 13. Assumptions and non-goals

Assumptions:

- The project remains a single local TypeScript application during the MVP.
- Tests are primarily maintained by AI agents and therefore favor explicit fixtures, types, and assertions.
- Detailed Debug logs are local development artifacts and may contain private content.
- Production observability will be designed separately if the product requires it.

Non-goals for the initial test foundation:

- production telemetry or remote log collection;
- distributed tracing;
- full browser/device matrices;
- exhaustive performance benchmarking on every commit;
- a large test-helper framework before repeated patterns exist.

## 14. Decision log

| Decision                                                      | Alternatives considered                                 | Reason                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Use TDD for behavior changes                                  | Tests after implementation                              | Tests shape interfaces and prove regressions before implementation                             |
| Keep unit, integration, and later E2E layers                  | E2E-heavy suite; unit-only suite                        | Balances fast feedback with real filesystem, SQLite, and UI confidence                         |
| Commit synthetic fixtures                                     | Commit redacted real sessions; depend on local sessions | Deterministic, reviewable, and safe across contributors and CI                                 |
| Use real temporary filesystem and SQLite in integration tests | Mock both boundaries                                    | Their platform behavior is central to GlassBox correctness                                     |
| Keep the first Debug logger simple                            | Context propagation, rotating logs, telemetry stack     | A single readable file solves the current diagnosis need                                       |
| Permit raw content in local Debug/test logs                   | Apply production redaction rules                        | These logs exist specifically for local development diagnosis and are never committed          |
| Do not assert general log text                                | Use logs as test oracle                                 | Behavior assertions remain stable when diagnostics change                                      |
| Start tests in one worker                                     | Parallel test files                                     | Produces one ordered Debug log while the suite is small                                        |
| Delay a numeric coverage gate                                 | Enforce a high global percentage immediately            | Early percentages reward scaffolding games; required behavior and a later ratchet are stronger |
| Run core tests on three operating systems                     | Linux-only CI                                           | Filesystem and path behavior are product-critical                                              |
