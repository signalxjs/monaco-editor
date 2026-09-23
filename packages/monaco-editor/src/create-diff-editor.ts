/**
 * Imperative diff editor creation — the diff counterpart of `createEditor`.
 * Both sides get their own text model, built with the same TSX/JSX language
 * resolution `createEditor` uses. The models belong to the editor: they are
 * disposed together with it.
 */

import { loadMonaco } from './loader';
import { createModelFor } from './create-editor';
import type { MonacoDiffEditor, MonacoDiffEditorConstructionOptions } from './types';

/** Options for Monaco's "hide unchanged regions" collapsing. */
export interface HideUnchangedRegionsOptions {
    enabled?: boolean;
    /** Lines revealed per click on a collapsed region. */
    revealLineCount?: number;
    /** Only collapse regions at least this long. */
    minimumLineCount?: number;
    /** Unchanged lines kept visible around every change. */
    contextLineCount?: number;
}

export interface CreateDiffEditorOptions {
    container: HTMLElement;
    /** The "before" text (left side in split view). */
    original: string;
    /** The "after" text (right side in split view). */
    modified: string;
    /** Language id for both sides. May be a generic id ('typescript') or a JSX/TSX flavor. */
    language?: string;
    /** Theme id. Themes registered via `configureMonaco({ themes })` are valid. */
    theme?: string;
    /** Whether the modified side is read-only. Defaults to `true`; the original side always is. */
    readOnly?: boolean;
    /** `true` for split (side-by-side) view, `false` for unified (inline). Defaults to `true`. */
    renderSideBySide?: boolean;
    /** Collapse long unchanged regions. `true` enables Monaco's defaults. */
    hideUnchangedRegions?: boolean | HideUnchangedRegionsOptions;
    fontSize?: number;
    /**
     * Override / extend Monaco's construction options. Merged on top of the
     * defaults derived from the simpler shorthand fields above.
     */
    monacoOptions?: MonacoDiffEditorConstructionOptions;
    /**
     * Fires on every content change of the modified side — typing (possible
     * only with `readOnly: false`) and `setValue` calls alike.
     */
    onChange?: (value: string) => void;
}

/** Normalise the `hideUnchangedRegions` shorthand into Monaco's option shape. */
export function hideUnchangedRegionsOption(
    value: boolean | HideUnchangedRegionsOptions | undefined
): HideUnchangedRegionsOptions {
    if (value === undefined || value === false) return { enabled: false };
    if (value === true) return { enabled: true };
    return { enabled: true, ...value };
}

export async function createDiffEditor(options: CreateDiffEditorOptions): Promise<MonacoDiffEditor> {
    const monaco = await loadMonaco();

    const lang = options.language ?? 'plaintext';
    const original = createModelFor(monaco, options.original, lang);
    const modified = createModelFor(monaco, options.modified, lang);

    const baseOptions: MonacoDiffEditorConstructionOptions = {
        theme: options.theme ?? 'vs-dark',
        readOnly: options.readOnly ?? true,
        originalEditable: false,
        renderSideBySide: options.renderSideBySide ?? true,
        hideUnchangedRegions: hideUnchangedRegionsOption(options.hideUnchangedRegions),
        minimap: { enabled: false },
        fontSize: options.fontSize ?? 14,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderOverviewRuler: false,
        wordWrap: 'off',
        fixedOverflowWidgets: true
    };

    let editor: MonacoDiffEditor;
    try {
        editor = monaco.editor.createDiffEditor(options.container, {
            ...baseOptions,
            ...options.monacoOptions
        });
        editor.setModel({ original, modified });
    } catch (err) {
        // Nothing owns the models yet: don't leak them.
        original.dispose();
        modified.dispose();
        throw err;
    }

    // The diff editor does not own models passed to `setModel` — dispose the
    // ones we created when it goes away.
    editor.onDidDispose(() => {
        original.dispose();
        modified.dispose();
    });

    if (options.onChange) {
        modified.onDidChangeContent(() => {
            options.onChange!(modified.getValue());
        });
    }

    return editor;
}
