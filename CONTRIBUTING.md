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

## Releasing (maintainers)

Releases are automated via GitHub Actions and npm trusted publishing (OIDC) — no `NPM_TOKEN` is needed. The release workflow is triggered by pushing a `v*.*.*` tag.

### One-time setup

1. On npmjs.com, configure **Trusted Publishing** for `@sigx/monaco-editor`, pointing at:
   - Repository: `signalxjs/monaco-editor`
   - Workflow: `release.yml`
   - Environment: _(leave blank)_
2. Confirm GitHub repo permissions allow `id-token: write` for the `release.yml` workflow (already declared at the job level).

### Cutting a release

```bash
# 1. Make sure main is green and your working tree is clean.
git checkout main && git pull

# 2. Make sure the prebuilt monaco-bundle is up to date and committed.
pnpm --filter @sigx/monaco-editor bundle:monaco
git add packages/monaco-editor/public/monaco-bundle && git commit -m "chore: refresh monaco-bundle" || true

# 3. Bump the version (this updates package.json and creates a tag).
pnpm version:patch    # or version:minor / version:major

# 4. Push the tag — this triggers .github/workflows/release.yml
git push --follow-tags
```

The `Release` workflow then runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` / `typecheck` / `build` / `test` / `verify:pack`
3. `node scripts/publish.js --skip-bundle` — publishes with provenance via OIDC. `--skip-bundle` skips regenerating the prebuilt monaco assets (they're already in the tag's tree); never use it for local releases where the bundle hasn't been committed.
4. Creates (or promotes) the matching GitHub Release with auto-generated notes

### Local dry-run

```bash
pnpm publish:dry      # `pnpm pack --dry-run` per workspace package
pnpm verify:pack      # asserts the produced tarball has the expected shape
```

### Beta / pre-release

```bash
pnpm version:set 0.2.0-beta.0
git push --follow-tags
# Or, to publish without tagging:
pnpm publish:beta
```

### Troubleshooting

- **OIDC publish fails with `403`** — check that the npm Trusted Publishing config still matches the repo + workflow filename.
- **`verify:pack` complains about missing `monaco-bundle/`** — run `pnpm --filter @sigx/monaco-editor bundle:monaco` and commit the result before tagging.
- **Consumers report unmet peer `@sigx/monaco-editor`** — bump and publish here first, then bump consumers (e.g. `@sigx/live-code`).

## Reporting bugs and requesting features

- **Bug?** Open an issue with the [bug report template](https://github.com/signalxjs/monaco-editor/issues/new?template=bug_report.yml). A minimal reproduction (StackBlitz or a small repo) helps a lot.
- **Feature idea?** Use the [feature request template](https://github.com/signalxjs/monaco-editor/issues/new?template=feature_request.yml). API sketches welcome.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be kind.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE](./LICENSE)).
