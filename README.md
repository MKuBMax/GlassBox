# GlassBox

GlassBox — The transparency layer for AI agents.

## Documentation

- [AI agent guide and documentation index](AGENTS.md)
- [Architecture](docs/architecture.md)
- [Testing strategy](docs/testing-strategy.md)
- [Visual design](docs/design-system.md)

## Development

GlassBox can now discover primary Claude Code sessions from the default local
directory and display their read-only metadata in the browser. Rule scanning,
session details, persistence, custom locations, and full-disk discovery are not
implemented yet.

Requirements: Node.js 24 and pnpm 11.13.1.

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:5173/>. The local API binds to
`127.0.0.1:43110`.

Run every quality gate with:

```sh
pnpm check
```
