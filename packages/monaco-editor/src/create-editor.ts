/**
 * Imperative editor creation. The sigx component in `component.tsx` builds on
 * top of this. The TSX/JSX file-extension dance (creating the model with `.tsx`
 * URI so Monaco's TS worker treats it as TSX, then optionally swapping to a
 * separate language id for highlighting) is preserved from the original
 * `@sigx/live-code` implementation — it's a Monaco gotcha, not sigx-specific.
 */

import { loadMonaco } from './loader';
import type { MonacoEditor, MonacoEditorConstructionOptions } from './types';

let modelCounter = 0;

export interface CreateEditorOptions {
    container: HTMLElement;
    value: string;
    /** Language id. May be a generic id ('typescript') or a JSX/TSX flavor. */
    language?: string;
    /** Theme id. Themes registered via `configureMonaco({ themes })` are valid. */
    theme?: string;
    readOnly?: boolean;
    minimap?: boolean;
    lineNumbers?: 'on' | 'off' | 'relative';
    fontSize?: number;
    /**
     * Override / extend Monaco's construction options. Merged on top of the
     * defaults derived from the simpler shorthand fields above.
     */
    monacoOptions?: MonacoEditorConstructionOptions;
    /** Fires on every content change with the new value. */
    onChange?: (value: string) => void;
}

/**
 * Pick the correct file extension and Shiki-friendly language id for a given
 * input language. Required so Monaco's TypeScript worker picks the right
 * script kind (TS vs TSX vs JS vs JSX).
 */
function resolveLanguage(lang: string): {
    extension: string;
    initialLangId: string;
    finalLangId: string;
    needsLanguageSwap: boolean;
} {
    if (lang === 'typescriptreact' || lang === 'tsx') {
        return { extension: '.tsx', initialLangId: 'typescript', finalLangId: 'tsx', needsLanguageSwap: true };
    }
    if (lang === 'javascriptreact' || lang === 'jsx') {
        return { extension: '.jsx', initialLangId: 'javascript', finalLangId: 'jsx', needsLanguageSwap: true };
    }
    if (lang === 'javascript') {
        return { extension: '.js', initialLangId: 'javascript', finalLangId: 'javascript', needsLanguageSwap: false };
    }
    if (lang === 'typescript') {
        return { extension: '.ts', initialLangId: 'typescript', finalLangId: 'typescript', needsLanguageSwap: false };
    }
    return { extension: '', initialLangId: lang, finalLangId: lang, needsLanguageSwap: false };
}

export async function createEditor(options: CreateEditorOptions): Promise<MonacoEditor> {
    const monaco = await loadMonaco();

    const lang = options.language ?? 'typescript';
    const { extension, initialLangId, finalLangId, needsLanguageSwap } = resolveLanguage(lang);

    const modelUri = monaco.Uri.parse(
        `file:///playground-${++modelCounter}${extension || ''}`
    );

    const model = monaco.editor.createModel(options.value, initialLangId, modelUri);

    // Swap to the highlight-friendly language id (e.g. 'tsx') *after* the model
    // has been registered with the TS worker for IntelliSense.
    if (needsLanguageSwap) {
        monaco.editor.setModelLanguage(model, finalLangId);
    }

    const baseOptions: MonacoEditorConstructionOptions = {
        model,
        theme: options.theme ?? 'vs-dark',
        readOnly: options.readOnly ?? false,
        minimap: { enabled: options.minimap ?? false },
        lineNumbers: options.lineNumbers ?? 'on',
        fontSize: options.fontSize ?? 14,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        tabSize: 2,
        wordWrap: 'on',
        renderWhitespace: 'none',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        // Keep suggestion / hover widgets inside the editor container — fixes
        // z-index issues when the editor lives inside a modal.
        fixedOverflowWidgets: true
    };

    const editor = monaco.editor.create(options.container, {
        ...baseOptions,
        ...options.monacoOptions
    });

    if (options.onChange) {
        editor.onDidChangeModelContent(() => {
            options.onChange!(editor.getValue());
        });
    }

    return editor;
}
