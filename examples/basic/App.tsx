import { component, render, signal } from 'sigx';
import {
    MonacoEditor,
    MonacoDiffEditor,
    mountViewZone,
    onLineNumberClick,
    type Disposer,
    type MonacoDiffEditorInstance,
    configureMonaco,
    typescriptLanguagePack,
    cssLanguagePack,
    jsonLanguagePack,
    htmlLanguagePack
} from '@sigx/monaco-editor';

// Register everything we want available across editor instances. Runs once
// at module-eval time; the registrations are queued until the first
// loadMonaco() call.
configureMonaco({
    languages: [
        typescriptLanguagePack({ jsxImportSource: 'sigx' }),
        cssLanguagePack(),
        jsonLanguagePack(),
        htmlLanguagePack()
    ]
});

const SAMPLES: Record<string, string> = {
    typescript: `function greet(name: string): string {\n    return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet('sigx'));\n`,
    json: `{\n    "name": "@sigx/monaco-editor",\n    "version": "0.1.0",\n    "languages": ["typescript", "json", "css", "html"]\n}\n`,
    css: `.editor {\n    width: 100%;\n    height: 100vh;\n    background: #1e1e1e;\n    color: #d4d4d4;\n}\n`,
    html: `<!doctype html>\n<html>\n    <body>\n        <h1>Hello sigx</h1>\n    </body>\n</html>\n`
};

const App = component(({ signal }) => {
    const state = signal({
        language: 'typescript',
        theme: 'vs-dark',
        code: SAMPLES.typescript,
        // Diff mode compares the language's sample with your edits.
        diff: false,
        split: true
    });

    // In diff mode, clicking a line number opens a note under that line.
    let zone: Disposer | null = null;
    function wireDiff(editor: MonacoDiffEditorInstance): void {
        onLineNumberClick(editor, ({ line, side }) => {
            zone?.dispose();
            zone = mountViewZone(editor, { afterLineNumber: line, side }, () => (
                <div style="padding: 8px 12px; background: #252526; border: 1px solid #555;">
                    Note on {side} line {line}{' '}
                    <button onClick={() => { zone?.dispose(); zone = null; }}>Close</button>
                </div>
            ));
        });
    }

    function setLanguage(lang: string): void {
        state.language = lang;
        state.code = SAMPLES[lang] ?? '';
    }

    return () => (
        <>
            <header>
                <h1>@sigx/monaco-editor — basic example</h1>
                <label>
                    Language:
                    <select
                        value={state.language}
                        onChange={(e: Event) => setLanguage((e.target as HTMLSelectElement).value)}
                    >
                        <option value="typescript">typescript</option>
                        <option value="json">json</option>
                        <option value="css">css</option>
                        <option value="html">html</option>
                    </select>
                </label>
                <label>
                    Theme:
                    <select
                        value={state.theme}
                        onChange={(e: Event) => state.theme = (e.target as HTMLSelectElement).value}
                    >
                        <option value="vs-dark">vs-dark</option>
                        <option value="vs">vs (light)</option>
                        <option value="hc-black">hc-black</option>
                    </select>
                </label>
                <label>
                    <input type="checkbox" checked={state.diff} onChange={() => state.diff = !state.diff} />
                    Diff vs sample
                </label>
                {state.diff && (
                    <label>
                        <input
                            type="checkbox"
                            checked={state.split}
                            onChange={() => {
                                // Zone placement depends on the view: close the note.
                                zone?.dispose();
                                zone = null;
                                state.split = !state.split;
                            }}
                        />
                        Split
                    </label>
                )}
                <label style="margin-left: auto;">
                    chars: {state.code.length}
                </label>
            </header>
            <div class="editor-wrap">
                {state.diff
                    ? (
                        <MonacoDiffEditor
                            original={SAMPLES[state.language] ?? ''}
                            modified={state.code}
                            language={state.language}
                            theme={state.theme}
                            renderSideBySide={state.split}
                            onReady={wireDiff}
                        />
                    )
                    : (
                        <MonacoEditor
                            model={() => state.code}
                            language={state.language}
                            theme={state.theme}
                        />
                    )}
            </div>
        </>
    );
});

render(<App />, document.getElementById('app')!);
