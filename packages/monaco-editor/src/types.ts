import type * as Monaco from 'monaco-editor';

export type MonacoNamespace = typeof Monaco;
export type MonacoEditor = Monaco.editor.IStandaloneCodeEditor;
export type MonacoEditorConstructionOptions = Monaco.editor.IStandaloneEditorConstructionOptions;

/**
 * A pluggable language registration. Built-in packs live under
 * `@sigx/monaco-editor/languages/*` and consumers can write their own.
 */
export interface LanguagePack {
    /** Language id (e.g. 'typescript', 'tsx', 'json'). */
    id: string;
    /** File extensions associated with this language. */
    extensions?: string[];
    /** Display aliases. */
    aliases?: string[];
    /**
     * Monaco worker label (e.g. 'typescript', 'css'). When set together with
     * `workerUrl`, the prebundled loader maps this label to that URL.
     */
    workerLabel?: string;
    /** Worker script URL. Combine with `workerLabel`. */
    workerUrl?: string;
    /** Called once after Monaco loads — register completions, compiler options, etc. */
    setup?: (monaco: MonacoNamespace) => void | Promise<void>;
}

export interface ThemePack {
    name: string;
    data: Monaco.editor.IStandaloneThemeData;
}

export interface ExtraLib {
    content: string;
    filePath: string;
}
