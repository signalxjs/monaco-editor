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

### Two-way binding (`model`)

Instead of pairing `value` with `onChange`, bind the editor content with sigx's
two-way `model` directive — edits flow straight back into your state:

```tsx
<MonacoEditor model={() => state.code} language="typescript" />
```

When `model` is supplied it is the source of truth and takes precedence over
`value`. `onChange` still fires if you also pass it.

### Diffs

`<MonacoDiffEditor>` shows two texts side by side (`renderSideBySide`, the
default) or unified. It is read-only unless `readOnly={false}`, and every prop
is reactive:

```tsx
import { MonacoDiffEditor, languageForPath } from '@sigx/monaco-editor';

<MonacoDiffEditor
    original={state.before}
    modified={state.after}
    language={languageForPath(state.path)}
    renderSideBySide={state.split}
    hideUnchangedRegions
    onReady={(diff) => { /* the live IStandaloneDiffEditor */ }}
/>
```

`createDiffEditor(options)` is the imperative equivalent of `createEditor`.

### Line actions

These helpers work with a standalone editor and with a diff editor:

- **`onLineNumberClick(editor, cb)`** reports clicks on the line-number gutter as
  `{ line, side, event }`. In unified view, a click on a deleted line reports the
  line of the original text.
- **`mountViewZone(editor, { afterLineNumber, side? }, () => <Comment />)`** mounts
  a sigx element between two lines. The element keeps its own mouse and keyboard
  input, and its height follows its content. The call returns a disposer.
- **`languageForPath(path)`** picks a language id. It reads the extensions of your
  registered language packs and the extensions of Monaco's built-in languages.

A comment box that opens under the line the user clicks:

```ts
onLineNumberClick(diff, ({ line, side }) => {
    zone?.dispose();
    zone = mountViewZone(diff, { afterLineNumber: line, side }, () => <Comment line={line} />);
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
