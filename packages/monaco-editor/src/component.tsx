import { component, onMounted, onUnmounted, watch } from 'sigx';
import { createEditor } from './create-editor';
import type { MonacoEditor as MonacoEditorInstance, MonacoEditorConstructionOptions } from './types';

export interface MonacoEditorProps {
    /** Editor value. Reactive. */
    value: string;
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
 */
export const MonacoEditor = component<MonacoEditorProps>(({ props }) => {
    let containerEl: HTMLDivElement | null = null;
    let editor: MonacoEditorInstance | null = null;
    let lastValueFromEditor = '';

    onMounted(() => {
        if (!containerEl) return;

        // Capture the container at the time of mount; further work is async.
        const container = containerEl;

        void (async () => {
            try {
                editor = await createEditor({
                    container,
                    value: props.value,
                    language: props.language,
                    theme: props.theme,
                    readOnly: props.readOnly,
                    minimap: props.minimap,
                    lineNumbers: props.lineNumbers,
                    fontSize: props.fontSize,
                    monacoOptions: props.monacoOptions,
                    onChange: (v) => {
                        lastValueFromEditor = v;
                        props.onChange?.(v);
                    }
                });
                lastValueFromEditor = props.value;
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

    // Mirror prop changes onto the live editor.
    watch(
        () => props.value,
        (next) => {
            // Skip re-applying values that came from the editor itself —
            // otherwise `onChange` → parent state → `props.value` would loop.
            if (!editor || next === lastValueFromEditor) return;
            if (editor.getValue() !== next) editor.setValue(next);
        }
    );

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
