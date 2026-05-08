/**
 * Vite plugin for Monaco prebundled / CDN strategies.
 *
 * For the prebundled strategy, the plugin:
 *   1. Intercepts every `monaco-editor` import (static and dynamic) and
 *      replaces it with a virtual stub that throws if accessed. Monaco is
 *      expected to be loaded at runtime via `loadMonaco()` from
 *      `@sigx/monaco-editor`, which injects a `<script>` tag pointing at the
 *      prebundled bundle.
 *   2. Copies the bundle into the dev server's public directory.
 *   3. Emits the bundle files into the production build output.
 *   4. Injects `window.__MONACO_LOADER_CONFIG__` into `index.html` so the
 *      loader picks up `basePath` / `strategy` without needing `define:`.
 *
 * For the CDN strategy, only the import interception and the HTML injection
 * happen — Monaco is fetched from unpkg / a custom CDN at runtime.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import { existsSync, readFileSync, statSync, createReadStream } from 'fs';
import { join, dirname, extname, normalize } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface MonacoPrebundledPluginOptions {
    /**
     * Loading strategy.
     * - `'prebundled'` (default): use the static bundle shipped with this package.
     * - `'cdn'`: load Monaco from unpkg / a custom CDN.
     */
    strategy?: 'prebundled' | 'cdn';

    /**
     * Public path where the bundle is served from.
     * @default '/monaco-bundle'
     */
    publicPath?: string;

    /**
     * CDN URL when `strategy === 'cdn'`.
     * @default 'https://unpkg.com/monaco-editor@<version>'
     */
    cdnUrl?: string;

    /**
     * Monaco version (CDN strategy only).
     * @default '0.55.1'
     */
    version?: string;

    /**
     * Worker labels the consumer needs. Currently informational — the
     * prebundled bundle ships a fixed set (typescript, css, html, json,
     * editor); registering a `LanguagePack` with `workerLabel + workerUrl` at
     * runtime is how you wire up additional workers.
     */
    languages?: string[];
}

const VIRTUAL_STUB_ID = '\0virtual:monaco-stub';

const MIME_BY_EXT: Record<string, string> = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml'
};

function contentTypeFor(filePath: string): string {
    return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Locate the prebundled directory, whether the package is being developed
 * in-tree (relative path) or installed as a node_modules dependency.
 */
function findMonacoBundleDir(): string | null {
    // Dev path — sibling to dist/ when bundled, sibling to src/ when running from source.
    const candidates = [
        join(__dirname, '..', 'public', 'monaco-bundle'),
        join(__dirname, '..', '..', 'public', 'monaco-bundle')
    ];
    for (const p of candidates) {
        if (existsSync(p)) return p;
    }

    // Installed path
    const installed = join(process.cwd(), 'node_modules', '@sigx', 'monaco-editor', 'public', 'monaco-bundle');
    if (existsSync(installed)) return installed;

    return null;
}

export function monacoPrebundledPlugin(options: MonacoPrebundledPluginOptions = {}): Plugin {
    const {
        strategy = 'prebundled',
        publicPath = '/monaco-bundle',
        cdnUrl,
        version = '0.55.1'
    } = options;

    let config: ResolvedConfig;
    let monacoBundleDir: string | null = null;

    return {
        name: 'vite-plugin-monaco-prebundled',
        // Run before other plugins to intercept Monaco imports early.
        enforce: 'pre',

        configResolved(resolved) {
            config = resolved;

            if (strategy === 'prebundled') {
                monacoBundleDir = findMonacoBundleDir();
                if (!monacoBundleDir) {
                    console.warn(
                        '[@sigx/monaco-editor] Prebundled Monaco not found. ' +
                        'Run `pnpm --filter @sigx/monaco-editor bundle:monaco` first.'
                    );
                }
            }
        },

        config() {
            return {
                optimizeDeps: {
                    exclude: ['monaco-editor']
                },
                resolve: {
                    alias: {
                        // Strict prefix match: only `monaco-editor` and `monaco-editor/...`,
                        // never `@sigx/monaco-editor`.
                        'monaco-editor': VIRTUAL_STUB_ID
                    }
                },
                build: {
                    rollupOptions: {
                        external: strategy === 'cdn' ? ['monaco-editor'] : []
                    }
                }
            };
        },

        resolveId(id) {
            if (id.includes('/monaco-bundle/') || id.includes('\\monaco-bundle\\')) {
                return null;
            }
            if (id === 'monaco-editor' || id.startsWith('monaco-editor/')) {
                return { id: VIRTUAL_STUB_ID, external: false };
            }
            return null;
        },

        load(id) {
            if (id === VIRTUAL_STUB_ID) {
                return `throw new Error(${JSON.stringify(
                    '[@sigx/monaco-editor] Monaco import was intercepted by the Vite plugin. ' +
                    'Use loadMonaco() from @sigx/monaco-editor instead.'
                )});`;
            }
            return null;
        },

        transform(code, id) {
            if (!code.includes('monaco-editor')) return null;

            let transformed = code;

            // Dynamic imports: import('monaco-editor[/...]')
            transformed = transformed.replace(
                /import\s*\(\s*['"]monaco-editor[^'"]*['"]\s*\)/g,
                '(async () => ({ default: class {} }))()'
            );

            // Static imports: from 'monaco-editor[/...]'
            transformed = transformed.replace(
                /from\s+['"]monaco-editor[^'"]*['"]/g,
                `from ${JSON.stringify(VIRTUAL_STUB_ID)}`
            );

            // Type-only imports: import type * as X from 'monaco-editor'
            transformed = transformed.replace(
                /import\s+type\s+\*\s+as\s+\w+\s+from\s+['"]monaco-editor['"]/g,
                'type _MonacoStub = any; const _unused: _MonacoStub = null as any'
            );

            return transformed === code ? null : { code: transformed, map: null };
        },

        // Dev: serve the bundle directly from its source directory via a
        // middleware. Avoids the cpSync-vs-first-request race that the older
        // public/ copy approach suffered from, and keeps the consumer's
        // public/ directory clean.
        configureServer(server) {
            if (strategy !== 'prebundled' || !monacoBundleDir) return;

            const prefix = publicPath.endsWith('/') ? publicPath : publicPath + '/';
            const bundleDir = monacoBundleDir;

            server.middlewares.use((req, res, next) => {
                const url = req.url ?? '';
                if (!url.startsWith(prefix)) return next();

                // Strip query/hash, then resolve against the bundle dir while
                // refusing path traversal.
                const requested = url.slice(prefix.length).split('?')[0].split('#')[0];
                const filePath = normalize(join(bundleDir, requested));
                if (!filePath.startsWith(normalize(bundleDir))) {
                    res.statusCode = 403;
                    return res.end('Forbidden');
                }
                if (!existsSync(filePath) || !statSync(filePath).isFile()) {
                    return next();
                }

                const contentType = contentTypeFor(filePath);
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                createReadStream(filePath).pipe(res);
            });
        },

        // Production: emit the bundle files as build assets.
        generateBundle() {
            if (strategy !== 'prebundled' || !monacoBundleDir) return;

            const manifestPath = join(monacoBundleDir, 'manifest.json');
            if (!existsSync(manifestPath)) return;

            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            for (const file of manifest.files) {
                const filePath = join(monacoBundleDir, file);
                if (existsSync(filePath)) {
                    this.emitFile({
                        type: 'asset',
                        fileName: `monaco-bundle/${file}`,
                        source: readFileSync(filePath)
                    });
                }
            }
        },

        transformIndexHtml(html) {
            const configObj = strategy === 'cdn'
                ? { strategy: 'cdn', version, cdnUrl: cdnUrl ?? '' }
                : { strategy: 'prebundled', basePath: publicPath };

            const configScript =
                `<script>window.__MONACO_LOADER_CONFIG__ = ${JSON.stringify(configObj)};</script>`;

            return html.replace(/<head>/, `<head>\n    ${configScript}`);
        }
    };
}

export default monacoPrebundledPlugin;
