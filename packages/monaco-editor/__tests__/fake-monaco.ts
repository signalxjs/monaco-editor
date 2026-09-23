/**
 * A tiny stand-in for the Monaco namespace: just enough of `editor` and
 * `languages` for the diff editor and helpers, recording what was called.
 */

type Listener<T> = (e: T) => void;

export class FakeModel {
    disposed = false;
    private listeners: Listener<void>[] = [];
    constructor(public value: string, public language: string, public uri: string) {}
    getValue(): string { return this.value; }
    setValue(v: string): void { this.value = v; for (const l of this.listeners) l(); }
    onDidChangeContent(l: Listener<void>): { dispose(): void } {
        this.listeners.push(l);
        return { dispose: () => { this.listeners = this.listeners.filter((x) => x !== l); } };
    }
    dispose(): void { this.disposed = true; }
}

export interface FakeZone { afterLineNumber: number; heightInPx: number; ordinal?: number; domNode: HTMLElement; onDomNodeTop?: (top: number) => void }
export interface FakeWidget { getId(): string; getDomNode(): HTMLElement }

export class FakeCodeEditor {
    zones = new Map<string, FakeZone>();
    layouts: string[] = [];
    mouseDown: Listener<any>[] = [];
    widgets = new Map<string, FakeWidget>();
    layoutListeners: Listener<void>[] = [];
    layout = { contentLeft: 90, contentWidth: 600, verticalScrollbarWidth: 14 };
    private nextZone = 0;
    addOverlayWidget(w: FakeWidget): void { this.widgets.set(w.getId(), w); }
    removeOverlayWidget(w: FakeWidget): void { this.widgets.delete(w.getId()); }
    getLayoutInfo() { return this.layout; }
    onDidLayoutChange(l: Listener<void>): { dispose(): void } {
        this.layoutListeners.push(l);
        return { dispose: () => { this.layoutListeners = this.layoutListeners.filter((x) => x !== l); } };
    }
    constructor(public lineHeight = 20, public dom: HTMLElement | null = null) {}
    onMouseDown(l: Listener<any>): { dispose(): void } {
        this.mouseDown.push(l);
        return { dispose: () => { this.mouseDown = this.mouseDown.filter((x) => x !== l); } };
    }
    fireMouseDown(target: unknown, clientY = 0): void {
        for (const l of this.mouseDown) l({ target, event: { browserEvent: { clientY } } });
    }
    changeViewZones(cb: (a: any) => void): void {
        cb({
            addZone: (z: FakeZone) => { const id = `z${++this.nextZone}`; this.zones.set(id, z); return id; },
            layoutZone: (id: string) => { this.layouts.push(id); },
            removeZone: (id: string) => { this.zones.delete(id); }
        });
    }
    getOption(): number { return this.lineHeight; }
    getDomNode(): HTMLElement | null { return this.dom; }
    getBottomForLineNumber(line: number): number { return line * this.lineHeight; }
    getScrollTop(): number { return 0; }
}

export class FakeDiffEditor {
    original = new FakeCodeEditor();
    modified = new FakeCodeEditor();
    model: { original: FakeModel; modified: FakeModel } | null = null;
    options: Record<string, unknown>;
    lineChanges: unknown[] = [];
    disposed = false;
    private disposeListeners: Listener<void>[] = [];
    root = document.createElement('div');
    constructor(public container: unknown, options: Record<string, unknown>) {
        this.options = { ...options };
        // Monaco marks its root `side-by-side` while two editors show.
        this.root.className = options.renderSideBySide === false ? 'monaco-diff-editor' : 'monaco-diff-editor side-by-side';
    }
    getContainerDomNode(): HTMLElement { const c = document.createElement('div'); c.appendChild(this.root); return c; }
    setModel(m: { original: FakeModel; modified: FakeModel }): void { this.model = m; }
    getModel(): { original: FakeModel; modified: FakeModel } | null { return this.model; }
    getOriginalEditor(): FakeCodeEditor { return this.original; }
    getModifiedEditor(): FakeCodeEditor { return this.modified; }
    getLineChanges(): unknown[] { return this.lineChanges; }
    updateOptions(o: Record<string, unknown>): void { Object.assign(this.options, o); }
    onDidDispose(l: Listener<void>): void { this.disposeListeners.push(l); }
    dispose(): void { this.disposed = true; for (const l of this.disposeListeners) l(); }
}

export function fakeMonaco() {
    const created: FakeDiffEditor[] = [];
    const models: FakeModel[] = [];
    const monaco = {
        created,
        models,
        Uri: { parse: (s: string) => s },
        editor: {
            MouseTargetType: { GUTTER_LINE_NUMBERS: 3, GUTTER_VIEW_ZONE: 5 },
            EditorOption: { lineHeight: 75 },
            createModel(value: string, language: string, uri: string) {
                const m = new FakeModel(value, language, uri);
                models.push(m);
                return m;
            },
            setModelLanguage(model: FakeModel, language: string) { model.language = language; },
            setTheme() {},
            createDiffEditor(container: unknown, options: Record<string, unknown>) {
                const d = new FakeDiffEditor(container, options);
                created.push(d);
                return d;
            }
        },
        languages: {
            register() {},
            getLanguages: () => [
                { id: 'typescript', extensions: ['.ts', '.mts'] },
                { id: 'css', extensions: ['.css'] },
                { id: 'dockerfile', extensions: ['.dockerfile'], filenames: ['Dockerfile'] }
            ]
        }
    };
    return monaco;
}
