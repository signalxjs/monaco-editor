/**
 * TypeScript / JavaScript language pack.
 *
 * Registers `typescript`, `javascript`, `tsx`, and `jsx` language ids,
 * configures Monaco's TypeScript service with sensible defaults, and wires up
 * completion + hover providers for the `tsx` / `jsx` ids so IntelliSense keeps
 * working when the model uses a JSX-flavored language id (needed when Shiki
 * provides the highlighting).
 */

import type { LanguagePack, MonacoNamespace } from '../types';

export interface TypescriptPackOptions {
    /** JSX import source. Defaults to 'react' for vanilla Monaco. Pass 'sigx' for sigx apps. */
    jsxImportSource?: string;
    /** Override Monaco's compiler options. Merged on top of the pack defaults. */
    compilerOptions?: Record<string, unknown>;
    /** Override diagnostics options. */
    diagnosticsOptions?: { noSemanticValidation?: boolean; noSyntaxValidation?: boolean };
    /** Skip the JSX/TSX completion + hover providers (default: false). */
    skipJsxProviders?: boolean;
}

function applyTypescriptDefaults(monaco: MonacoNamespace, options: TypescriptPackOptions): void {
    // Monaco 0.55 exposes `monaco.typescript`; older versions used
    // `monaco.languages.typescript`. Support both.
    const ts: any = (monaco as any).typescript ?? (monaco as any).languages?.typescript;
    if (!ts) {
        console.warn('[@sigx/monaco-editor] TypeScript service not found on Monaco instance.');
        return;
    }

    const compilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: options.jsxImportSource ?? 'react',
        allowNonTsExtensions: true,
        allowJs: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        ...options.compilerOptions
    };

    const diagnosticsOptions = {
        noSemanticValidation: false,
        noSyntaxValidation: false,
        ...options.diagnosticsOptions
    };

    ts.typescriptDefaults.setCompilerOptions(compilerOptions);
    ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    ts.javascriptDefaults.setCompilerOptions(compilerOptions);
    ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
}

function registerJsxProviders(monaco: MonacoNamespace): void {
    const ts: any = (monaco as any).typescript ?? (monaco as any).languages?.typescript;
    if (!ts) return;

    for (const langId of ['tsx', 'jsx']) {
        monaco.languages.registerCompletionItemProvider(langId, {
            triggerCharacters: ['.', '"', "'", '/', '<'],
            async provideCompletionItems(model, position) {
                const worker = await ts.getTypeScriptWorker();
                const client = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const completions = await client.getCompletionsAtPosition(model.uri.toString(), offset);
                if (!completions) return { suggestions: [] };
                return {
                    suggestions: completions.entries.map((entry: { name: string; kind: string }) => ({
                        label: entry.name,
                        kind: monaco.languages.CompletionItemKind[
                            entry.kind as keyof typeof monaco.languages.CompletionItemKind
                        ] || monaco.languages.CompletionItemKind.Property,
                        insertText: entry.name,
                        range: undefined as any
                    }))
                };
            }
        });

        monaco.languages.registerHoverProvider(langId, {
            async provideHover(model, position) {
                const worker = await ts.getTypeScriptWorker();
                const client = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const info = await client.getQuickInfoAtPosition(model.uri.toString(), offset);
                if (!info) return null;
                const displayParts = info.displayParts?.map((p: { text: string }) => p.text).join('') || '';
                const documentation = info.documentation?.map((p: { text: string }) => p.text).join('') || '';
                return {
                    contents: [
                        { value: '```typescript\n' + displayParts + '\n```' },
                        ...(documentation ? [{ value: documentation }] : [])
                    ]
                };
            }
        });
    }
}

/**
 * Build a TypeScript / JavaScript language pack. Registers four ids:
 * `typescript`, `javascript`, `tsx`, `jsx`. Use `configureMonaco({ languages: [typescriptLanguagePack()] })`.
 */
export function typescriptLanguagePack(options: TypescriptPackOptions = {}): LanguagePack {
    return {
        id: 'typescript',
        extensions: ['.ts'],
        workerLabel: 'typescript',
        async setup(monaco) {
            // Register sibling language ids (typescript itself is registered by
            // the orchestrator from the LanguagePack's own id field).
            monaco.languages.register({ id: 'javascript', extensions: ['.js'] });
            monaco.languages.register({ id: 'tsx', extensions: ['.tsx'], aliases: ['TypeScript React'] });
            monaco.languages.register({ id: 'jsx', extensions: ['.jsx'], aliases: ['JavaScript React'] });

            applyTypescriptDefaults(monaco, options);

            if (!options.skipJsxProviders) {
                registerJsxProviders(monaco);
            }
        }
    };
}
