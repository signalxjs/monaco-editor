# Contributing to @sigx/monaco-editor

Thanks for your interest! This repo ships [`@sigx/monaco-editor`](./packages/monaco-editor) — a pluggable Monaco editor wrapper for [sigx](https://github.com/signalxjs/core). Other SignalX packages (router, store, UI kit, SSG, docs site) live in their own repositories under [`signalxjs`](https://github.com/signalxjs).

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0`
- **pnpm** `>=10` (this repo uses workspaces; `npm` and `yarn` are not supported)

## Getting started

```bash
git clone https://github.com/signalxjs/monaco-editor.git
cd monaco-editor
pnpm install
pnpm --filter @sigx/monaco-editor bundle:monaco
pnpm build
```

The `bundle:monaco` step regenerates the prebuilt Monaco bundle under `packages/monaco-editor/public/monaco-bundle/`. It only needs to be re-run after upgrading Monaco.

## Common tasks

| Task | Command |
|---|---|
| Build the library | `pnpm build` |
| Run the basic example | `pnpm dev:basic` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Run tests | `pnpm test` |

## Pre-push checklist

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## Pull request guidelines

- **Keep PRs small and focused.** One logical change per PR.
- **Reference an issue** if one exists; otherwise describe the motivation in the PR body.
- **Add tests** for new behaviour or bug fixes.
- **Don't bump versions** in your PR — release versioning is handled centrally via the `pnpm version:*` scripts.

## Reporting bugs and requesting features

- **Bug?** Open an issue with the [bug report template](https://github.com/signalxjs/monaco-editor/issues/new?template=bug_report.yml). A minimal reproduction (StackBlitz or a small repo) helps a lot.
- **Feature idea?** Use the [feature request template](https://github.com/signalxjs/monaco-editor/issues/new?template=feature_request.yml). API sketches welcome.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be kind.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE](./LICENSE)).
