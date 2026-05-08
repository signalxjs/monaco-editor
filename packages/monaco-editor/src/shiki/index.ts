/**
 * Optional Shiki integration.
 *
 * Shiki provides TextMate-grammar-based highlighting that's far more accurate
 * than Monaco's built-in tokenizer for nested grammars like JSX/TSX. This
 * module wires a Shiki highlighter into a Monaco instance — themes and
 * languages are passed in by the consumer so the package itself doesn't pin a
 * particular set.
 *
 * Requires `shiki` and `@shikijs/monaco` to be installed (declared as optional
 * peer dependencies of `@sigx/monaco-editor`).
 *
 * @example
 * ```ts
 * import { loadMonaco } from '@sigx/monaco-editor';
 * import { applyShikiThemes } from '@sigx/monaco-editor/shiki';
 *
 * const monaco = await loadMonaco();
 * await applyShikiThemes(monaco, {
 *     themes: [import('@shikijs/themes/github-dark'), import('@shikijs/themes/github-light')],
 *     langs:  [import('@shikijs/langs/tsx'), import('@shikijs/langs/typescript')]
 * });
 * ```
 */

import type { MonacoNamespace } from '../types';

export interface ApplyShikiOptions {
    /**
     * Shiki theme imports. Each entry can be a `Promise<...>` from
     * `import('@shikijs/themes/<name>')` or an already-resolved theme object.
     */
    themes: Array<Promise<unknown> | unknown>;
    /**
     * Shiki language imports. Same format as `themes`.
     */
    langs: Array<Promise<unknown> | unknown>;
    /**
     * Languages to register with Monaco before Shiki wires up the grammars.
     * If omitted, assumes the consumer has already registered their language
     * ids (e.g. via `configureMonaco({ languages: [...] })`).
     */
    monacoLanguages?: Array<{ id: string; extensions?: string[]; aliases?: string[] }>;
}

export interface ApplyShikiResult {
    /** The created `HighlighterCore`. Useful if you want to highlight static code outside Monaco. */
    highlighter: unknown;
}

/**
 * Apply Shiki TextMate grammars + themes to a Monaco instance. Returns the
 * underlying highlighter so the consumer can reuse it for non-Monaco code.
 */
export async function applyShikiThemes(
    monaco: MonacoNamespace,
    options: ApplyShikiOptions
): Promise<ApplyShikiResult> {
    // Shiki + @shikijs/monaco are optional peers — load them dynamically so
    // consumers who don't use this subpath don't pay the bundling cost.
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, { shikiToMonaco }] =
        await Promise.all([
            import('shiki/core'),
            import('shiki/engine/javascript'),
            import('@shikijs/monaco')
        ]);

    const highlighter = await createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        themes: options.themes as any,
        langs: options.langs as any
    });

    for (const lang of options.monacoLanguages ?? []) {
        monaco.languages.register({
            id: lang.id,
            extensions: lang.extensions,
            aliases: lang.aliases
        });
    }

    shikiToMonaco(highlighter, monaco as any);

    return { highlighter };
}
