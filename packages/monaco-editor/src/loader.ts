/**
 * Monaco loader.
 *
 * Two strategies:
 *   - 'prebundled': loads `<basePath>/monaco.min.js` via a `<script>` tag and
 *     reads `window.monaco`. Vite never sees it; cold start is fast.
 *   - 'cdn': loads Monaco's AMD loader from unpkg / a custom CDN.
 *
 * `loadMonaco()` is idempotent and returns the cached instance after the first
 * call. Configure with `configureMonacoLoader()` and `configureMonaco()` before
 * the first load, or supply config via the `__MONACO_LOADER_CONFIG__` global
 * (the Vite plugin sets this).
 */

import type * as Monaco from 'monaco-editor';
import type { LanguagePack, ThemePack, ExtraLib, MonacoNamespace } from './types';

export type { MonacoNamespace, MonacoEditor } from './types';

export interface MonacoLoaderConfig {
    strategy: 'prebundled' | 'cdn';
    /** Base URL where prebundled `monaco.min.js`, workers, and CSS live. */
    basePath?: string;
    /** Optional CDN URL override. Defaults to unpkg. */
    cdnUrl?: string;
    /** Monaco version to fetch from CDN. */
    version?: string;
}

export interface MonacoSetup {
    /** Language packs to register before first editor creation. */
    languages?: LanguagePack[];
    /** Themes to define against the Monaco instance. */
    themes?: ThemePack[];
    /** Extra `.d.ts` content to inject into Monaco's TS service. */
    extraLibs?: ExtraLib[];
}

declare const __MONACO_LOADER_CONFIG__: MonacoLoaderConfig | undefined;

let monacoInstance: typeof Monaco | null = null;
let loadingPromise: Promise<typeof Monaco> | null = null;
let pendingSetup: Required<MonacoSetup> = { languages: [], themes: [], extraLibs: [] };

function getDefaultConfig(): MonacoLoaderConfig {
    if (typeof __MONACO_LOADER_CONFIG__ !== 'undefined') {
        return __MONACO_LOADER_CONFIG__;
    }
    if (typeof window !== 'undefined' && (window as any).__MONACO_LOADER_CONFIG__) {
        return (window as any).__MONACO_LOADER_CONFIG__;
    }
    return { strategy: 'prebundled', basePath: '/monaco-bundle' };
}

let loaderConfig: MonacoLoaderConfig = getDefaultConfig();

/** Override the load strategy / base path / CDN URL. Must be called before `loadMonaco()`. */
export function configureMonacoLoader(config: Partial<MonacoLoaderConfig>): void {
    loaderConfig = { ...loaderConfig, ...config };
    if (monacoInstance) {
        console.warn(
            '[@sigx/monaco-editor] Loader configuration changed after Monaco was loaded. ' +
            'Reload the page for the change to take effect.'
        );
    }
}

/**
 * Register language packs, themes, and extra libs to apply when Monaco loads.
 * Calls after load apply immediately to the live instance.
 */
export function configureMonaco(setup: MonacoSetup): void {
    pendingSetup = {
        languages: [...pendingSetup.languages, ...(setup.languages ?? [])],
        themes: [...pendingSetup.themes, ...(setup.themes ?? [])],
        extraLibs: [...pendingSetup.extraLibs, ...(setup.extraLibs ?? [])]
    };
    if (monacoInstance) {
        void applySetup(monacoInstance, setup);
    }
}

/** Default worker mappings for the prebundled bundle script. */
function defaultWorkerMap(basePath: string): Record<string, string> {
    return {
        typescript: `${basePath}/ts.worker.min.js`,
        javascript: `${basePath}/ts.worker.min.js`,
        css: `${basePath}/css.worker.min.js`,
        scss: `${basePath}/css.worker.min.js`,
        less: `${basePath}/css.worker.min.js`,
        html: `${basePath}/html.worker.min.js`,
        handlebars: `${basePath}/html.worker.min.js`,
        razor: `${basePath}/html.worker.min.js`,
        json: `${basePath}/json.worker.min.js`
    };
}

function setupPrebundledWorkers(basePath: string, languages: LanguagePack[]): void {
    if (typeof self === 'undefined') return;

    const workerMap = defaultWorkerMap(basePath);
    for (const lang of languages) {
        if (lang.workerLabel && lang.workerUrl) {
            workerMap[lang.workerLabel] = lang.workerUrl;
        }
    }

    (self as any).MonacoEnvironment = {
        getWorkerUrl(_workerId: string, label: string): string {
            return workerMap[label] ?? `${basePath}/editor.worker.min.js`;
        }
    };
}

function setupCdnWorkers(cdnBase: string): void {
    if (typeof self === 'undefined') return;
    (self as any).MonacoEnvironment = {
        getWorkerUrl(_workerId: string, _label: string): string {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(
                `importScripts('${cdnBase}/min/vs/base/worker/workerMain.js');`
            )}`;
        }
    };
}

async function loadFromPrebundled(basePath: string, languages: LanguagePack[]): Promise<typeof Monaco> {
    setupPrebundledWorkers(basePath, languages);

    if (!document.querySelector('link[data-monaco-prebundled]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${basePath}/monaco.min.css`;
        link.setAttribute('data-monaco-prebundled', 'true');
        document.head.appendChild(link);
    }

    if ((window as any).monaco) {
        return (window as any).monaco as typeof Monaco;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${basePath}/monaco.min.js`;
        script.onload = () => {
            const monaco = (window as any).monaco as typeof Monaco;
            if (monaco) resolve(monaco);
            else reject(new Error('[@sigx/monaco-editor] window.monaco not defined after script load'));
        };
        script.onerror = () => reject(new Error(
            `[@sigx/monaco-editor] Failed to load script ${basePath}/monaco.min.js`
        ));
        document.head.appendChild(script);
    });
}

async function loadFromCdn(version: string, cdnUrl?: string): Promise<typeof Monaco> {
    const baseUrl = cdnUrl || `https://unpkg.com/monaco-editor@${version}`;

    setupCdnWorkers(baseUrl);

    if (!document.querySelector('link[data-monaco-cdn]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${baseUrl}/min/vs/editor/editor.main.css`;
        link.setAttribute('data-monaco-cdn', 'true');
        document.head.appendChild(link);
    }

    return new Promise((resolve, reject) => {
        const loaderScript = document.createElement('script');
        loaderScript.src = `${baseUrl}/min/vs/loader.js`;
        loaderScript.onload = () => {
            const req = (window as any).require;
            req.config({ paths: { vs: `${baseUrl}/min/vs` } });
            req(['vs/editor/editor.main'], (monaco: typeof Monaco) => resolve(monaco), reject);
        };
        loaderScript.onerror = reject;
        document.head.appendChild(loaderScript);
    });
}

/**
 * Apply a partial setup to a live Monaco instance: register languages, define
 * themes, add extra libs. Idempotent at the Monaco level (re-registering a
 * language is a no-op aside from updating extension/alias metadata).
 */
async function applySetup(monaco: MonacoNamespace, setup: MonacoSetup): Promise<void> {
    for (const lang of setup.languages ?? []) {
        monaco.languages.register({
            id: lang.id,
            extensions: lang.extensions,
            aliases: lang.aliases
        });
        if (lang.setup) await lang.setup(monaco);
    }

    for (const theme of setup.themes ?? []) {
        monaco.editor.defineTheme(theme.name, theme.data);
    }

    if (setup.extraLibs?.length) {
        // Monaco 0.55 exposes `monaco.typescript`; older versions use `monaco.languages.typescript`.
        const ts: any = (monaco as any).typescript ?? (monaco as any).languages?.typescript;
        if (ts?.typescriptDefaults) {
            for (const lib of setup.extraLibs) {
                ts.typescriptDefaults.addExtraLib(lib.content, lib.filePath);
            }
        }
    }
}

/** Lazy-load Monaco using the configured strategy. Idempotent. */
export async function loadMonaco(): Promise<typeof Monaco> {
    if (monacoInstance) return monacoInstance;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        let monaco: typeof Monaco;
        switch (loaderConfig.strategy) {
            case 'prebundled':
                if (!loaderConfig.basePath) {
                    throw new Error('[@sigx/monaco-editor] prebundled strategy requires basePath');
                }
                monaco = await loadFromPrebundled(loaderConfig.basePath, pendingSetup.languages);
                break;
            case 'cdn': {
                const version = loaderConfig.version ?? '0.55.1';
                monaco = await loadFromCdn(version, loaderConfig.cdnUrl);
                break;
            }
            default:
                throw new Error(`[@sigx/monaco-editor] unknown strategy: ${(loaderConfig as any).strategy}`);
        }

        await applySetup(monaco, pendingSetup);
        monacoInstance = monaco;
        return monaco;
    })();

    return loadingPromise;
}

export function isMonacoLoaded(): boolean {
    return monacoInstance !== null;
}

export function getMonaco(): typeof Monaco {
    if (!monacoInstance) {
        throw new Error('[@sigx/monaco-editor] Monaco not loaded. Call loadMonaco() first.');
    }
    return monacoInstance;
}

export function getLoaderConfig(): MonacoLoaderConfig {
    return { ...loaderConfig };
}
