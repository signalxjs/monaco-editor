import { component, render, signal } from 'sigx';
import {
    MonacoEditor,
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
        code: SAMPLES.typescript
    });

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
                <label style="margin-left: auto;">
                    chars: {state.code.length}
                </label>
            </header>
            <div class="editor-wrap">
                <MonacoEditor
                    value={state.code}
                    language={state.language}
                    theme={state.theme}
                    onChange={(v) => state.code = v}
                />
            </div>
        </>
    );
});

render(<App />, document.getElementById('app')!);
