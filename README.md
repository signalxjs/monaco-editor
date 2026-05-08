# @sigx/monaco-editor

A pluggable [Monaco editor](https://microsoft.github.io/monaco-editor/) wrapper for [sigx](https://github.com/signalxjs/core), with a fast dev experience: Monaco is loaded from a pre-bundled, self-contained set of static assets via a `<script>` tag, completely bypassing Vite's dependency optimization.

## Why this exists

Monaco is huge. Letting Vite optimize it on every cold start of every consumer app costs many seconds of dev time. This package ships a pre-built `monaco.min.js` (plus workers) and a tiny Vite plugin that intercepts `monaco-editor` imports so Vite never tries to bundle Monaco at all.

## Layout

```
monaco-editor/
├── packages/
│   └── monaco-editor/        # @sigx/monaco-editor — the library
└── examples/
    └── basic/                # @sigx-example/monaco-basic — sigx demo
```

## Packages

- [`@sigx/monaco-editor`](./packages/monaco-editor/README.md) — the library and its Vite plugin.

## Quick start

```bash
pnpm install
pnpm --filter @sigx/monaco-editor bundle:monaco
pnpm dev:basic
```

## License

MIT
