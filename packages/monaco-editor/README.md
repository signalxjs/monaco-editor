# @sigx/monaco-editor

Pluggable [Monaco editor](https://microsoft.github.io/monaco-editor/) wrapper for [sigx](https://github.com/signalxjs/core), with a fast dev experience.

## Why

Monaco is large enough that letting Vite pre-bundle it costs many seconds on every cold start. This package ships a pre-built, self-contained Monaco bundle (`monaco.min.js` + workers) and a Vite plugin that intercepts every `monaco-editor` import so the bundler never touches Monaco at all. Monaco is loaded into the page via a `<script>` tag at runtime.

## Install

```bash
pnpm add @sigx/monaco-editor monaco-editor
```

## Use

### 1. Add the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { monacoPrebundledPlugin } from '@sigx/monaco-editor/vite';

export default defineConfig({
    plugins: [
        monacoPrebundledPlugin({
            strategy: 'prebundled',
            publicPath: '/monaco-bundle',
            languages: ['typescript', 'css', 'html', 'json']
        })
    ]
});
```

### 2. Use the component

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

### 3. Optionally register language packs

```ts
import { configureMonaco } from '@sigx/monaco-editor';
import { typescriptLanguagePack } from '@sigx/monaco-editor/languages/typescript';
import { jsonLanguagePack } from '@sigx/monaco-editor/languages/json';

configureMonaco({
    languages: [
        typescriptLanguagePack({ jsxImportSource: 'sigx' }),
        jsonLanguagePack()
    ]
});
```

### 4. Optionally use Shiki for nicer TextMate highlighting

```ts
import { applyShikiThemes } from '@sigx/monaco-editor/shiki';

await applyShikiThemes(monaco, {
    themes: ['github-dark', 'github-light'],
    langs: ['tsx', 'typescript', 'jsx', 'javascript']
});
```

## Pre-bundling

The package ships a pre-built `public/monaco-bundle/`. To regenerate it (e.g. after upgrading Monaco):

```bash
pnpm bundle:monaco
```

You can configure which workers to bundle:

```bash
pnpm bundle:monaco --workers typescript,json
```

## API

### Loader

| | |
|---|---|
| `loadMonaco()` | Lazy-load Monaco using the configured strategy. Returns the Monaco namespace. |
| `configureMonacoLoader(config)` | Override the load strategy / base path / CDN URL before first call. |
| `isMonacoLoaded()` | `true` once Monaco is in memory. |
| `getMonaco()` | Synchronous accessor; throws if not loaded. |

### Setup

| | |
|---|---|
| `configureMonaco({ languages, themes, extraLibs })` | Register language packs, themes, and extra `.d.ts` libs to apply when Monaco loads. |
| `createEditor({ container, value, language, theme, onChange, ... })` | Imperative low-level API. |
| `<MonacoEditor />` | sigx component wrapper. |

### Vite plugin (`@sigx/monaco-editor/vite`)

| | |
|---|---|
| `monacoPrebundledPlugin({ strategy, publicPath, languages, cdnUrl, version })` | Intercepts `monaco-editor` imports, copies the bundle to `public/`, injects loader config. |

## License

MIT
