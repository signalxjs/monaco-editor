// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { component, render, signal } from 'sigx';
import {
    MonacoDiffEditor,
    configureMonaco,
    createDiffEditor,
    languageForPath,
    loadMonaco,
    modifiedAnchorFor,
    mountViewZone,
    onLineNumberClick
} from '../src/index';
import { FakeCodeEditor, fakeMonaco, type FakeDiffEditor } from './fake-monaco';

const monaco = fakeMonaco();

beforeAll(async () => {
    // Satisfy the prebundled loader without touching the network: Monaco is
    // "already on the page" and its stylesheet link already exists.
    const link = document.createElement('link');
    link.setAttribute('data-monaco-prebundled', 'true');
    document.head.appendChild(link);
    (window as any).monaco = monaco;
    configureMonaco({ languages: [{ id: 'sigx-css', extensions: ['.module.css'] }] });
    await loadMonaco();
});

const flush = () => new Promise((r) => setTimeout(r, 0));
const last = (): FakeDiffEditor => monaco.created[monaco.created.length - 1]!;

describe('createDiffEditor', () => {
    it('creates both models, applies the shorthands and disposes the models with the editor', async () => {
        const container = document.createElement('div');
        const editor = await createDiffEditor({
            container,
            original: 'a\n',
            modified: 'b\n',
            language: 'tsx',
            renderSideBySide: false,
            hideUnchangedRegions: { contextLineCount: 2 }
        }) as unknown as FakeDiffEditor;

        expect(editor.container).toBe(container);
        expect(editor.options).toMatchObject({
            readOnly: true,
            originalEditable: false,
            renderSideBySide: false,
            hideUnchangedRegions: { enabled: true, contextLineCount: 2 }
        });
        const { original, modified } = editor.getModel()!;
        expect(original.getValue()).toBe('a\n');
        expect(modified.getValue()).toBe('b\n');
        // TSX dance: created as typescript on a .tsx uri, then swapped to tsx.
        expect(original.uri).toMatch(/\.tsx$/);
        expect(modified.language).toBe('tsx');

        editor.dispose();
        expect(original.disposed && modified.disposed).toBe(true);
    });

    it('reports edits of the modified side through onChange', async () => {
        const onChange = vi.fn();
        const editor = await createDiffEditor({
            container: document.createElement('div'),
            original: '',
            modified: 'x',
            readOnly: false,
            onChange
        }) as unknown as FakeDiffEditor;
        editor.getModel()!.modified.setValue('xy');
        expect(onChange).toHaveBeenCalledWith('xy');
        expect(editor.options.readOnly).toBe(false);
    });
});

describe('<MonacoDiffEditor>', () => {
    it('mirrors prop changes onto the live editor and disposes on unmount', async () => {
        const state = signal({ original: 'one', modified: 'two', split: true, show: true });
        const ready = vi.fn();
        const App = component(() => () => (state.show
            ? <MonacoDiffEditor
                original={state.original}
                modified={state.modified}
                renderSideBySide={state.split}
                onReady={ready}
            />
            : <span />));
        const host = document.createElement('div');
        render(<App />, host);
        await flush();

        const editor = last();
        expect(ready).toHaveBeenCalledWith(editor);
        expect(editor.options.renderSideBySide).toBe(true);

        state.modified = 'three';
        state.split = false;
        await flush();
        expect(editor.getModel()!.modified.getValue()).toBe('three');
        expect(editor.options.renderSideBySide).toBe(false);

        state.show = false;
        await flush();
        expect(editor.disposed).toBe(true);
    });
});

describe('onLineNumberClick', () => {
    it('reports line-number clicks on either side of a diff', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '' }) as unknown as FakeDiffEditor;
        const clicks: unknown[] = [];
        const off = onLineNumberClick(editor as any, ({ line, side }) => clicks.push({ line, side }));

        editor.original.fireMouseDown({ type: 3, position: { lineNumber: 4 } });
        editor.modified.fireMouseDown({ type: 3, position: { lineNumber: 7 } });
        editor.modified.fireMouseDown({ type: 6, position: { lineNumber: 9 } }); // content click: ignored
        expect(clicks).toEqual([{ line: 4, side: 'original' }, { line: 7, side: 'modified' }]);

        off.dispose();
        editor.modified.fireMouseDown({ type: 3, position: { lineNumber: 1 } });
        expect(clicks).toHaveLength(2);
    });

    it('maps a click in the unified deleted-lines zone to the original line', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '' }) as unknown as FakeDiffEditor;
        const dom = document.createElement('div');
        editor.modified = new FakeCodeEditor(20, dom);
        // Original 56–57 deleted, anchored after modified line 67.
        editor.lineChanges = [{ originalStartLineNumber: 56, originalEndLineNumber: 57, modifiedStartLineNumber: 68, modifiedEndLineNumber: 69 }];
        const clicks: unknown[] = [];
        onLineNumberClick(editor as any, ({ line, side }) => clicks.push({ line, side }));

        // Zone starts at the bottom of line 67 (67 * 20 = 1340); second row is 1360–1380.
        editor.modified.fireMouseDown({ type: 5, detail: { viewZoneId: 'diff', afterLineNumber: 67 } }, 1365);
        // A zone after a line with no deletion is not a line click.
        editor.modified.fireMouseDown({ type: 5, detail: { viewZoneId: 'x', afterLineNumber: 3 } }, 70);
        expect(clicks).toEqual([{ line: 57, side: 'original' }]);
    });
});

describe('mountViewZone', () => {
    it('reserves a zone and mounts the content in an overlay widget that follows it', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '' }) as unknown as FakeDiffEditor;
        const zone = mountViewZone(editor as any, { afterLineNumber: 61, heightInPx: 120, ordinal: 10 }, () => <textarea class="ask" />);

        const [[id, z]] = [...editor.modified.zones];
        expect(z).toMatchObject({ afterLineNumber: 61, ordinal: 10, heightInPx: 120 });
        const [widget] = [...editor.modified.widgets.values()];
        const node = widget!.getDomNode();
        expect(node.querySelector('textarea.ask')).not.toBeNull();
        // Spans the text area and follows the zone's top.
        expect(node.style.left).toBe('90px');
        expect(node.style.width).toBe('586px');
        z.onDomNodeTop!(440);
        expect(node.style.top).toBe('440px');
        editor.modified.layout = { contentLeft: 50, contentWidth: 300, verticalScrollbarWidth: 0 };
        for (const l of editor.modified.layoutListeners) l();
        expect(node.style.width).toBe('300px');

        // Clicks on our own zone are not reported as line clicks.
        const clicks: unknown[] = [];
        onLineNumberClick(editor as any, (c) => clicks.push(c));
        editor.lineChanges = [{ originalStartLineNumber: 61, originalEndLineNumber: 61, modifiedStartLineNumber: 62, modifiedEndLineNumber: 62 }];
        editor.modified.fireMouseDown({ type: 5, detail: { viewZoneId: id, afterLineNumber: 61 } }, 10);
        expect(clicks).toEqual([]);

        zone.dispose();
        expect(editor.modified.zones.size).toBe(0);
        expect(editor.modified.widgets.size).toBe(0);
        expect(editor.modified.layoutListeners).toHaveLength(0);
        expect(node.querySelector('textarea')).toBeNull();
        zone.dispose(); // idempotent
    });

    it('hosts an original-side zone in the original editor in split view', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '' }) as unknown as FakeDiffEditor;
        mountViewZone(editor as any, { afterLineNumber: 2, side: 'original' }, () => <span />);
        expect(editor.original.zones.size).toBe(1);
        expect(editor.modified.zones.size).toBe(0);
    });

    it('anchors an original-side zone below its deleted block in unified view', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '', renderSideBySide: false }) as unknown as FakeDiffEditor;
        // Original 56–61 replaced by modified 68–72.
        editor.lineChanges = [{ originalStartLineNumber: 56, originalEndLineNumber: 61, modifiedStartLineNumber: 68, modifiedEndLineNumber: 72 }];
        mountViewZone(editor as any, { afterLineNumber: 61, side: 'original' }, () => <span />);
        expect(editor.original.zones.size).toBe(0);
        const [z] = [...editor.modified.zones.values()];
        expect(z).toMatchObject({ afterLineNumber: 67 });
        expect(z!.ordinal).toBeGreaterThan(0);
    });
});

describe('modifiedAnchorFor', () => {
    it('maps original lines through insertions and deletions', async () => {
        const editor = await createDiffEditor({ container: document.createElement('div'), original: '', modified: '' }) as unknown as FakeDiffEditor;
        editor.lineChanges = [
            // 3 lines inserted after original 3.
            { originalStartLineNumber: 3, originalEndLineNumber: 0, modifiedStartLineNumber: 4, modifiedEndLineNumber: 6 },
            // Original 10–11 deleted; in modified they would follow line 12.
            { originalStartLineNumber: 10, originalEndLineNumber: 11, modifiedStartLineNumber: 12, modifiedEndLineNumber: 0 }
        ];
        expect(modifiedAnchorFor(editor as any, 2)).toBe(2);
        expect(modifiedAnchorFor(editor as any, 5)).toBe(8);
        expect(modifiedAnchorFor(editor as any, 11)).toBe(12);
        expect(modifiedAnchorFor(editor as any, 12)).toBe(13);
    });
});

describe('languageForPath', () => {
    it('resolves from registered packs and Monaco languages, longest extension first', () => {
        expect(languageForPath('packages/ui/src/shell/shell.css')).toBe('css');
        expect(languageForPath('a/b/button.module.css')).toBe('sigx-css');
        expect(languageForPath('C:\\repo\\src\\index.MTS')).toBe('typescript');
        expect(languageForPath('docker/Dockerfile')).toBe('dockerfile');
        expect(languageForPath('README')).toBe('plaintext');
        expect(languageForPath('.ts')).toBe('plaintext');
    });

    it('works before Monaco is loaded from registered packs alone', () => {
        expect(languageForPath('x.module.css', null)).toBe('sigx-css');
        expect(languageForPath('x.ts', null)).toBe('plaintext');
    });
});
