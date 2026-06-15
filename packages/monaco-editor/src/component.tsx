import { component, onMounted, onUnmounted, watch } from 'sigx';
import type { Define } from 'sigx';
import { createEditor } from './create-editor';
import type { MonacoEditor as MonacoEditorInstance, MonacoEditorConstructionOptions } from './types';

export interface MonacoEditorProps extends Define.Model<string> {
    /**
     * Editor value. Reactive. Use this for one-way binding paired with
     * `onChange`. For two-way binding, prefer `model` instead — when `model`
     * is supplied it takes precedence over `value`.
     */
    value?: string;
    /** Language id. Reactive. */
    language?: string;
    /** Theme id. Reactive. */
    theme?: string;
    /** Read-only flag. Reactive. */
    readOnly?: boolean;
    /** Hide / show the minimap. */
    minimap?: boolean;
    /** Line number rendering. */
    lineNumbers?: 'on' | 'off' | 'relative';
    /** Font size. */
    fontSize?: number;
    /** Container className. */
    class?: string;
    /** Inline style for the container. */
    style?: string | Record<string, string | number>;
    /** Raw Monaco construction options. Merged on top of the simpler shorthands. */
    monacoOptions?: MonacoEditorConstructionOptions;
    /** Fires on every content change with the new value. */
    onChange?: (value: string) => void;
    /** Fires once with the live editor instance after the editor is created. */
    onReady?: (editor: MonacoEditorInstance) => void;
}

/**
 * `<MonacoEditor />` — a thin sigx wrapper over `createEditor`. Lazy-loads
 * Monaco on mount, mirrors prop changes onto the live editor, disposes on
 * unmount.
 *
 * Supports two binding styles for the content:
 *   - One-way: `value={state.code}` plus `onChange={(v) => state.code = v}`.
 *   - Two-way: `model={() => state.code}` (or `model={[state, 'code']}`).
 * When `model` is supplied it is the source of truth and edits are written
 * back through `props.model.value`.
 */
export const MonacoEditor = component<MonacoEditorProps>(({ props }) => {
    let containerEl: HTMLDivElement | null = null;
    let editor: MonacoEditorInstance | null = null;
    // True while we're pushing an external `value`/`model` change into Monaco.
    // Monaco fires a content-change event for programmatic `setValue` too, so
    // this flag lets `emitChange` tell those apart from real user edits and not
    // echo them back into `model` (which would be redundant and could re-run
    // custom model setters).
    let isApplyingExternalValue = false;

    // The effective content, sourced from `model` when present, otherwise the
    // plain `value` prop. Reading `props.model.value` / `props.value` inside a
    // tracking scope (e.g. `watch`) makes this reactive.
    const readValue = (): string => (props.model ? props.model.value : props.value) ?? '';

    // Propagate an editor-originated edit back to the parent: into the two-way
    // `model` binding when present, and always via `onChange`. Programmatic
    // updates (see `applyExternalValue`) are ignored so they don't loop.
    const emitChange = (v: string): void => {
        if (isApplyingExternalValue) return;
        if (props.model) props.model.value = v;
        props.onChange?.(v);
    };

    // Push an external value into the live editor, guarding the resulting
    // content-change event so it isn't treated as a user edit.
    const applyExternalValue = (next: string): void => {
        if (!editor || editor.getValue() === next) return;
        isApplyingExternalValue = true;
        try {
            editor.setValue(next);
        } finally {
            isApplyingExternalValue = false;
        }
    };

    onMounted(() => {
        if (!containerEl) return;

        // Capture the container at the time of mount; further work is async.
        const container = containerEl;

        void (async () => {
            try {
                editor = await createEditor({
                    container,
                    value: readValue(),
                    language: props.language,
                    theme: props.theme,
                    readOnly: props.readOnly,
                    minimap: props.minimap,
                    lineNumbers: props.lineNumbers,
                    fontSize: props.fontSize,
                    monacoOptions: props.monacoOptions,
                    onChange: emitChange
                });
                // `value`/`model` may have changed while Monaco was loading; the
                // watch below skipped those updates (editor was still null), so
                // reconcile the editor to the current value once here.
                applyExternalValue(readValue());
                props.onReady?.(editor);
            } catch (err) {
                console.error('[@sigx/monaco-editor] Failed to create editor:', err);
            }
        })();
    });

    onUnmounted(() => {
        editor?.dispose();
        editor = null;
    });

    // Mirror external content changes (via `value` or `model`) onto the live
    // editor. Edits that originated in the editor are already reflected, so the
    // `editor.getValue() === next` short-circuit in `applyExternalValue` makes
    // this a no-op for them.
    watch(readValue, applyExternalValue);

    watch(
        () => props.language,
        (next) => {
            if (!editor || !next) return;
            const model = editor.getModel();
            if (!model) return;
            // Re-resolve via Monaco off the live instance — same behavior as
            // createEditor's language resolution but applied to the existing model.
            const monaco = (window as any).monaco;
            if (monaco) monaco.editor.setModelLanguage(model, next);
        }
    );

    watch(
        () => props.theme,
        (next) => {
            if (!next) return;
            const monaco = (window as any).monaco;
            if (monaco) monaco.editor.setTheme(next);
        }
    );

    watch(
        () => props.readOnly,
        (next) => {
            editor?.updateOptions({ readOnly: next ?? false });
        }
    );

    return () => (
        <div
            class={props.class ?? 'sigx-monaco-editor'}
            style={props.style ?? 'width: 100%; height: 100%;'}
            ref={(el: HTMLDivElement) => { containerEl = el; }}
        />
    );
});
