# @sigx/monaco-editor

Pluggable [Monaco editor](https://microsoft.github.io/monaco-editor/) wrapper for [sigx](https://sigx.dev/core/), with a fast dev experience.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/monaco/>**

## Why

Monaco is large enough that letting Vite pre-bundle it costs many seconds on every cold start. This package ships a pre-built, self-contained Monaco bundle (`monaco.min.js` + workers) and a Vite plugin that intercepts every `monaco-editor` import so the bundler never touches Monaco at all. Monaco is loaded into the page via a `<script>` tag at runtime.

## Install

```bash
pnpm add @sigx/monaco-editor monaco-editor
```

## A taste

```tsx
import { component, signal } from 'sigx';
import { MonacoEditor } from '@sigx/monaco-editor';

export const Editor = component(({ signal }) => {
    const state = signal({ code: 'console.log("hi")', language: 'typescript' });

    return () => (
        <MonacoEditor
            value={state.code}
            language={state.language}
            theme="vs-dark"
            onChange={(v) => state.code = v}
        />
    );
});
```

The Vite plugin, loader configuration, language packs, Shiki theming and the full API are documented at **<https://sigx.dev/monaco/>**.

## Part of SignalX

- [sigx](https://sigx.dev/core/) — the reactive core.
- [@sigx/vite](https://sigx.dev/vite/) — the Vite integration.
- [@sigx/live-code](https://sigx.dev/) — runnable code examples.

Browse the whole ecosystem at **<https://sigx.dev>**.

## License

MIT
