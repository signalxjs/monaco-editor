import { component, onMounted, onUnmounted, watch } from 'sigx';
import { peekMonaco } from './loader';
import { createDiffEditor, hideUnchangedRegionsOption, type HideUnchangedRegionsOptions } from './create-diff-editor';
import type { MonacoDiffEditor as MonacoDiffEditorInstance, MonacoDiffEditorConstructionOptions } from './types';

export interface MonacoDiffEditorProps {
    /** The "before" text. Reactive. */
    original?: string;
    /** The "after" text. Reactive. */
    modified?: string;
    /** Language id for both sides. Reactive. */
    language?: string;
    /** Theme id. Reactive. */
    theme?: string;
    /** Whether the modified side is read-only. Defaults to `true`. Reactive. */
    readOnly?: boolean;
    /** `true` for split view, `false` for unified. Defaults to `true`. Reactive. */
    renderSideBySide?: boolean;
    /** Collapse long unchanged regions. Reactive. */
    hideUnchangedRegions?: boolean | HideUnchangedRegionsOptions;
    /** Font size. Applied at creation only. */
    fontSize?: number;
    /** Container className. */
    class?: string;
    /** Inline style for the container. */
    style?: string | Record<string, string | number>;
    /** Raw Monaco construction options, merged on top of the shorthands. Applied at creation only. */
    monacoOptions?: MonacoDiffEditorConstructionOptions;
    /**
     * Fires when the modified text is edited in the editor (possible only
     * with `readOnly={false}`); changes pushed in through `modified` do not fire it.
     */
    onChange?: (value: string) => void;
    /** Fires once with the live diff editor after it is created. */
    onReady?: (editor: MonacoDiffEditorInstance) => void;
}

/**
 * `<MonacoDiffEditor />` — a thin sigx wrapper over `createDiffEditor`.
 * Lazy-loads Monaco on mount, mirrors prop changes onto the live editor,
 * disposes it (and its models) on unmount.
 */
export const MonacoDiffEditor = component<MonacoDiffEditorProps>(({ props }) => {
    let containerEl: HTMLDivElement | null = null;
    let editor: MonacoDiffEditorInstance | null = null;
    let disposed = false;
    // True while an external `modified` change is pushed into the model, so
    // the resulting content event is not reported through `onChange`.
    let isApplyingExternalValue = false;

    const setSide = (side: 'original' | 'modified', next: string): void => {
        const model = editor?.getModel()?.[side];
        if (!model || model.getValue() === next) return;
        isApplyingExternalValue = true;
        try {
            model.setValue(next);
        } finally {
            isApplyingExternalValue = false;
        }
    };

    onMounted(() => {
        if (!containerEl) return;
        const container = containerEl;

        void (async () => {
            try {
                const created = await createDiffEditor({
                    container,
                    original: props.original ?? '',
                    modified: props.modified ?? '',
                    language: props.language,
                    theme: props.theme,
                    readOnly: props.readOnly,
                    renderSideBySide: props.renderSideBySide,
                    hideUnchangedRegions: props.hideUnchangedRegions,
                    fontSize: props.fontSize,
                    monacoOptions: props.monacoOptions,
                    onChange: (v) => {
                        if (!isApplyingExternalValue) props.onChange?.(v);
                    }
                });
                // Unmounted while Monaco was loading: nothing to hand out.
                if (disposed) {
                    created.dispose();
                    return;
                }
                editor = created;
                // Texts may have changed while Monaco was loading; the watches
                // below skipped those updates, so reconcile once here.
                setSide('original', props.original ?? '');
                setSide('modified', props.modified ?? '');
                props.onReady?.(editor);
            } catch (err) {
                console.error('[@sigx/monaco-editor] Failed to create diff editor:', err);
            }
        })();
    });

    onUnmounted(() => {
        disposed = true;
        editor?.dispose();
        editor = null;
    });

    watch(() => props.original ?? '', (next) => setSide('original', next));
    watch(() => props.modified ?? '', (next) => setSide('modified', next));

    watch(
        () => props.language,
        (next) => {
            const monaco = peekMonaco();
            const model = editor?.getModel();
            if (!monaco || !model || !next) return;
            monaco.editor.setModelLanguage(model.original, next);
            monaco.editor.setModelLanguage(model.modified, next);
        }
    );

    watch(
        () => props.theme,
        (next) => {
            const monaco = peekMonaco();
            if (monaco && next) monaco.editor.setTheme(next);
        }
    );

    watch(
        () => [props.readOnly, props.renderSideBySide, props.hideUnchangedRegions] as const,
        ([readOnly, renderSideBySide, hide]) => {
            editor?.updateOptions({
                readOnly: readOnly ?? true,
                renderSideBySide: renderSideBySide ?? true,
                hideUnchangedRegions: hideUnchangedRegionsOption(hide)
            });
        }
    );

    return () => (
        <div
            class={props.class ?? 'sigx-monaco-diff-editor'}
            style={props.style ?? 'width: 100%; height: 100%;'}
            ref={(el: HTMLDivElement) => { containerEl = el; }}
        />
    );
});
