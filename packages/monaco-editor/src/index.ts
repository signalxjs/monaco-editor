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

// Imperative diff editor creation
export {
    createDiffEditor,
    type CreateDiffEditorOptions,
    type HideUnchangedRegionsOptions
} from './create-diff-editor';

// sigx components
export { MonacoEditor, type MonacoEditorProps } from './component';
export { MonacoDiffEditor, type MonacoDiffEditorProps } from './diff-component';

// Helpers for editors and diff editors
export {
    onLineNumberClick,
    mountViewZone,
    languageForPath,
    isSideBySide,
    modifiedAnchorFor,
    type Disposer,
    type DiffSide,
    type LineNumberClick,
    type ViewZoneOptions
} from './helpers';

// Shared types
export type {
    MonacoNamespace,
    MonacoEditor as MonacoEditorInstance,
    MonacoEditorConstructionOptions,
    MonacoDiffEditor as MonacoDiffEditorInstance,
    MonacoDiffEditorConstructionOptions,
    MonacoCodeEditor,
    MonacoTextModel,
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
