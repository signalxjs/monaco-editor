/**
 * Generic helpers that work with a standalone editor, a diff editor, or one
 * side of a diff editor: line-number clicks, view zones that host a sigx
 * component, and language resolution from a file path.
 */

import { render } from 'sigx';
import type { JSXElement } from 'sigx';
import { getMonaco, peekMonaco, registeredLanguagePacks } from './loader';
import type { MonacoCodeEditor, MonacoDiffEditor, MonacoNamespace } from './types';

/** Something that can be undone — returned by every helper here. */
export interface Disposer {
    dispose(): void;
}

/** Which text a line number refers to. A standalone editor reports `'modified'`. */
export type DiffSide = 'original' | 'modified';

export interface LineNumberClick {
    /** 1-based line number in the text named by `side`. */
    line: number;
    side: DiffSide;
    /** The underlying mouse event, e.g. to check modifier keys. */
    event: MouseEvent;
}

function isDiffEditor(editor: MonacoCodeEditor | MonacoDiffEditor): editor is MonacoDiffEditor {
    return typeof (editor as MonacoDiffEditor).getModifiedEditor === 'function';
}

/**
 * Ids of view zones mounted by `mountViewZone`, per host editor (zone ids are
 * only unique within one editor) — clicks on them are not line clicks.
 */
const ownZones = new WeakMap<MonacoCodeEditor, Set<string>>();

/**
 * Report clicks on the line-number gutter. For a diff editor both sides are
 * watched; in unified (inline) view a click on a deleted line — which Monaco
 * draws in a zone of the modified editor — is reported as that line of the
 * original text.
 */
export function onLineNumberClick(
    editor: MonacoCodeEditor | MonacoDiffEditor,
    callback: (click: LineNumberClick) => void
): Disposer {
    if (!isDiffEditor(editor)) {
        return watchGutter(editor, 'modified', null, callback);
    }
    const original = watchGutter(editor.getOriginalEditor(), 'original', null, callback);
    const modified = watchGutter(editor.getModifiedEditor(), 'modified', editor, callback);
    return {
        dispose() {
            original.dispose();
            modified.dispose();
        }
    };
}

function watchGutter(
    editor: MonacoCodeEditor,
    side: DiffSide,
    diff: MonacoDiffEditor | null,
    callback: (click: LineNumberClick) => void
): Disposer {
    const monaco = getMonaco();
    const { MouseTargetType } = monaco.editor;
    return editor.onMouseDown((e) => {
        const target = e.target;
        const event = e.event.browserEvent;
        if (target.type === MouseTargetType.GUTTER_LINE_NUMBERS && target.position) {
            callback({ line: target.position.lineNumber, side, event });
            return;
        }
        if (target.type === MouseTargetType.GUTTER_VIEW_ZONE && diff) {
            const detail = target.detail as { viewZoneId?: string; afterLineNumber?: number } | undefined;
            if (!detail || detail.afterLineNumber === undefined) return;
            if (detail.viewZoneId && ownZones.get(editor)?.has(detail.viewZoneId)) return;
            const line = deletedLineAt(monaco, editor, diff, detail.afterLineNumber, event.clientY);
            if (line !== null) callback({ line, side: 'original', event });
        }
    });
}

/**
 * The original line under `clientY` inside the deleted-lines zone Monaco
 * draws (in unified view) after modified line `afterLineNumber`, or `null`
 * when no deletion is anchored there.
 */
export function deletedLineAt(
    monaco: MonacoNamespace,
    editor: MonacoCodeEditor,
    diff: MonacoDiffEditor,
    afterLineNumber: number,
    clientY: number
): number | null {
    const change = (diff.getLineChanges() ?? []).find((c) => {
        if (c.originalEndLineNumber === 0) return false; // pure insertion: nothing deleted
        const anchor = c.modifiedEndLineNumber === 0 ? c.modifiedStartLineNumber : c.modifiedStartLineNumber - 1;
        return anchor === afterLineNumber;
    });
    if (!change) return null;
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const dom = editor.getDomNode();
    if (!dom || lineHeight <= 0) return change.originalStartLineNumber;
    const zoneTop = afterLineNumber > 0 ? editor.getBottomForLineNumber(afterLineNumber) : 0;
    const y = clientY - dom.getBoundingClientRect().top + editor.getScrollTop();
    const offset = Math.floor((y - zoneTop) / lineHeight);
    const line = change.originalStartLineNumber + Math.max(0, offset);
    return Math.min(line, change.originalEndLineNumber);
}

export interface ViewZoneOptions {
    /** The zone is shown below this line (0 = above the first line). */
    afterLineNumber: number;
    /** Initial height, used until the content has been measured. */
    heightInPx?: number;
    /** Orders zones that share `afterLineNumber`; higher goes lower. */
    ordinal?: number;
    /**
     * For a diff editor: which text `afterLineNumber` refers to. Defaults to
     * `'modified'`. In unified view an original line is placed in the
     * modified editor, below the deleted block that shows it. The placement
     * is computed once: remount the zone after switching between split and
     * unified view.
     */
    side?: DiffSide;
}

/**
 * Whether a diff editor currently shows two editors side by side. `false` in
 * unified view — including when Monaco falls back to it because the editor
 * is too narrow (`useInlineViewWhenSpaceIsLimited`).
 */
export function isSideBySide(diff: MonacoDiffEditor): boolean {
    const root = diff.getContainerDomNode().querySelector('.monaco-diff-editor');
    return root?.classList.contains('side-by-side') ?? true;
}

/**
 * The modified line after which original line `line` appears in unified
 * view: the line the deleted block is anchored to when `line` was deleted
 * or changed, otherwise the unchanged line's counterpart.
 */
export function modifiedAnchorFor(diff: MonacoDiffEditor, line: number): number {
    let shift = 0;
    const changes = [...(diff.getLineChanges() ?? [])].sort((a, b) => a.originalStartLineNumber - b.originalStartLineNumber);
    for (const c of changes) {
        const removed = c.originalEndLineNumber === 0 ? 0 : c.originalEndLineNumber - c.originalStartLineNumber + 1;
        const added = c.modifiedEndLineNumber === 0 ? 0 : c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
        if (removed > 0 && line >= c.originalStartLineNumber && line <= c.originalEndLineNumber) {
            return c.modifiedEndLineNumber === 0 ? c.modifiedStartLineNumber : c.modifiedStartLineNumber - 1;
        }
        const before = removed > 0 ? c.originalEndLineNumber < line : c.originalStartLineNumber < line;
        if (!before) break;
        shift += added - removed;
    }
    return Math.max(0, line + shift);
}

let zoneWidgetCounter = 0;

/**
 * Mount a sigx element between two lines, e.g. an inline comment box.
 *
 * Monaco draws view zones underneath its text layer, so content placed in a
 * zone's own node cannot be clicked. As VS Code's zone widgets do, the view
 * zone here is only an empty spacer; the content lives in an overlay widget
 * that follows the spacer's position and spans the text area. The spacer
 * follows the content's height (via `ResizeObserver` where available).
 * Mouse and keyboard input inside the content do not reach the editor.
 *
 * Returns a disposer that unmounts the element and removes zone and widget.
 */
export function mountViewZone(
    editor: MonacoCodeEditor | MonacoDiffEditor,
    options: ViewZoneOptions,
    content: () => JSXElement
): Disposer {
    let host: MonacoCodeEditor = editor as MonacoCodeEditor;
    let afterLineNumber = options.afterLineNumber;
    let ordinal = options.ordinal;
    if (isDiffEditor(editor)) {
        host = editor.getModifiedEditor();
        if (options.side === 'original') {
            if (isSideBySide(editor)) {
                host = editor.getOriginalEditor();
            } else {
                // Unified view shows only the modified editor: anchor the zone
                // there, below the deleted block that holds the original line.
                afterLineNumber = modifiedAnchorFor(editor, afterLineNumber);
                ordinal ??= 1_000_000;
            }
        }
    }

    const container = document.createElement('div');
    container.className = 'sigx-monaco-view-zone';
    container.style.position = 'absolute';
    // Keep Monaco from treating clicks / keys inside the content as editor input.
    for (const type of ['mousedown', 'pointerdown', 'wheel', 'keydown', 'keypress', 'keyup'] as const) {
        container.addEventListener(type, (e) => e.stopPropagation());
    }

    const widgetId = `sigx.monaco.viewZone.${++zoneWidgetCounter}`;
    const widget = {
        getId: () => widgetId,
        getDomNode: () => container,
        getPosition: () => null
    };

    const place = (): void => {
        const layout = host.getLayoutInfo();
        container.style.left = `${layout.contentLeft}px`;
        container.style.width = `${Math.max(0, layout.contentWidth - layout.verticalScrollbarWidth)}px`;
    };

    const zone = {
        afterLineNumber,
        heightInPx: options.heightInPx ?? 0,
        ordinal,
        domNode: document.createElement('div'),
        suppressMouseDown: true,
        onDomNodeTop: (top: number) => {
            container.style.top = `${top}px`;
        }
    };
    let zoneId: string | null = null;
    host.changeViewZones((accessor) => {
        zoneId = accessor.addZone(zone);
    });
    if (zoneId) {
        let ids = ownZones.get(host);
        if (!ids) ownZones.set(host, ids = new Set());
        ids.add(zoneId);
    }
    host.addOverlayWidget(widget);
    place();
    const layoutListener = host.onDidLayoutChange(place);

    render(content(), container);

    const relayout = (height: number): void => {
        if (!zoneId || height === zone.heightInPx) return;
        zone.heightInPx = height;
        const id = zoneId;
        host.changeViewZones((accessor) => accessor.layoutZone(id));
    };
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => relayout(container.offsetHeight));
        observer.observe(container);
    }
    relayout(container.offsetHeight || zone.heightInPx);

    let disposed = false;
    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            observer?.disconnect();
            layoutListener.dispose();
            render(null as unknown as JSXElement, container);
            host.removeOverlayWidget(widget);
            if (zoneId) {
                const id = zoneId;
                ownZones.get(host)?.delete(id);
                host.changeViewZones((accessor) => accessor.removeZone(id));
            }
        }
    };
}

/**
 * The Monaco language id for a file path, from the extensions of language
 * packs registered with `configureMonaco()` and the extensions / file names
 * of Monaco's own languages (once Monaco is loaded). An exact file-name match
 * wins, then the longest matching extension — so `.d.ts` beats `.ts`.
 * Falls back to `'plaintext'`.
 */
export function languageForPath(path: string, monaco: MonacoNamespace | null = peekMonaco()): string {
    const name = (path.split(/[\\/]/).pop() ?? path).toLowerCase();

    let bestId: string | null = null;
    let bestLength = 0;
    const consider = (id: string, extensions: readonly string[] | undefined, filenames?: readonly string[]): void => {
        if (filenames?.some((f) => f.toLowerCase() === name)) {
            if (bestLength < Number.MAX_SAFE_INTEGER) {
                bestId = id;
                bestLength = Number.MAX_SAFE_INTEGER;
            }
            return;
        }
        for (const ext of extensions ?? []) {
            const e = ext.toLowerCase();
            if (name.length > e.length && name.endsWith(e) && e.length > bestLength) {
                bestId = id;
                bestLength = e.length;
            }
        }
    };

    for (const pack of registeredLanguagePacks()) consider(pack.id, pack.extensions);
    for (const lang of monaco?.languages.getLanguages() ?? []) consider(lang.id, lang.extensions, lang.filenames);

    return bestId ?? 'plaintext';
}
