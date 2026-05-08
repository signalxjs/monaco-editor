/**
 * @sigx/monaco-editor — pluggable Monaco wrapper for sigx.
 *
 * The Vite plugin (subpath: `@sigx/monaco-editor/vite`) and the Shiki helper
 * (subpath: `@sigx/monaco-editor/shiki`) live under their own entry points so
 * Node-only / opt-in code doesn't pull into client bundles by default.
 */

// Loader
export {
    loadMonaco,
    isMonacoLoaded,
    getMonaco,
    configureMonacoLoader,
    configureMonaco,
    getLoaderConfig,
    type MonacoLoaderConfig,
    type MonacoSetup
} from './loader';

// Imperative editor creation
export { createEditor, type CreateEditorOptions } from './create-editor';

// sigx component
export { MonacoEditor, type MonacoEditorProps } from './component';

// Shared types
export type {
    MonacoNamespace,
    MonacoEditor as MonacoEditorInstance,
    MonacoEditorConstructionOptions,
    LanguagePack,
    ThemePack,
    ExtraLib
} from './types';

// Built-in language packs (also available as their own subpaths)
export {
    typescriptLanguagePack,
    htmlLanguagePack,
    cssLanguagePack,
    jsonLanguagePack,
    type TypescriptPackOptions,
    type JsonPackOptions
} from './languages';
