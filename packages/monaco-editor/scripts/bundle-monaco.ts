#!/usr/bin/env tsx
/**
 * Pre-bundle Monaco into a small set of static files served via `<script>` /
 * `<link>` tags. Output goes to `public/monaco-bundle/` and is committed to
 * git so consumers don't have to rebuild.
 *
 * Usage:
 *   pnpm bundle:monaco                      # default: ts,css,html,json
 *   pnpm bundle:monaco --workers ts,json    # only the listed workers
 *   pnpm bundle:monaco --workers ts         # editor.worker is always included
 *
 * Config can also live in `monaco.bundle.config.json` next to package.json:
 *   { "workers": ["typescript", "json"] }
 */

import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PACKAGE_ROOT, 'public', 'monaco-bundle');
const CONFIG_PATH = join(PACKAGE_ROOT, 'monaco.bundle.config.json');

interface WorkerSpec {
    /** Output filename (without `.min.js`). */
    name: string;
    /** Path to the worker entry inside monaco-editor. */
    entry: string;
    /** CLI / config aliases. */
    aliases: string[];
}

const ALL_WORKERS: WorkerSpec[] = [
    { name: 'ts.worker', entry: 'esm/vs/language/typescript/ts.worker.js', aliases: ['ts', 'typescript', 'js', 'javascript'] },
    { name: 'css.worker', entry: 'esm/vs/language/css/css.worker.js', aliases: ['css', 'scss', 'less'] },
    { name: 'html.worker', entry: 'esm/vs/language/html/html.worker.js', aliases: ['html', 'handlebars', 'razor'] },
    { name: 'json.worker', entry: 'esm/vs/language/json/json.worker.js', aliases: ['json'] }
];

const DEFAULT_WORKERS = ['typescript', 'css', 'html', 'json'];

function parseCliArgs(argv: string[]): { workers?: string[] } {
    const result: { workers?: string[] } = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--workers' && argv[i + 1]) {
            result.workers = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
        }
    }
    return result;
}

function loadConfig(): { workers?: string[] } {
    if (!existsSync(CONFIG_PATH)) return {};
    try {
        return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (err) {
        console.warn(`[bundle-monaco] Failed to read ${CONFIG_PATH}:`, err);
        return {};
    }
}

function resolveWorkers(requested: string[]): WorkerSpec[] {
    const matched: WorkerSpec[] = [];
    for (const req of requested) {
        const spec = ALL_WORKERS.find((w) => w.aliases.includes(req.toLowerCase()) || w.name === req);
        if (spec && !matched.includes(spec)) matched.push(spec);
        else if (!spec) console.warn(`[bundle-monaco] Unknown worker: ${req}`);
    }
    return matched;
}

async function bundleMonacoCore(monacoVersion: string): Promise<void> {
    console.log('  → Building monaco-editor core (IIFE → window.monaco)...');
    await esbuild.build({
        entryPoints: [join(PACKAGE_ROOT, 'node_modules/monaco-editor/esm/vs/editor/editor.main.js')],
        bundle: true,
        format: 'iife',
        globalName: 'monaco',
        minify: true,
        sourcemap: true,
        outfile: join(OUTPUT_DIR, 'monaco.min.js'),
        target: ['es2020'],
        define: { 'process.env.NODE_ENV': '"production"' },
        loader: {
            '.ttf': 'file', '.woff': 'file', '.woff2': 'file',
            '.svg': 'file', '.png': 'file', '.css': 'css'
        },
        treeShaking: true,
        assetNames: '[name]'
    });

    console.log('  → Building Monaco editor.worker...');
    await esbuild.build({
        entryPoints: [join(PACKAGE_ROOT, 'node_modules/monaco-editor/esm/vs/editor/editor.worker.js')],
        bundle: true,
        format: 'iife',
        minify: true,
        sourcemap: true,
        outfile: join(OUTPUT_DIR, 'editor.worker.min.js'),
        target: ['es2020']
    });

    console.log('  → Building Monaco CSS...');
    await esbuild.build({
        entryPoints: [join(PACKAGE_ROOT, 'node_modules/monaco-editor/min/vs/editor/editor.main.css')],
        bundle: true,
        minify: true,
        outfile: join(OUTPUT_DIR, 'monaco.min.css'),
        loader: { '.ttf': 'file', '.woff': 'file', '.woff2': 'file', '.svg': 'file' }
    });

    void monacoVersion; // emitted into the manifest below
}

async function bundleWorker(spec: WorkerSpec): Promise<void> {
    console.log(`  → Building ${spec.name}...`);
    await esbuild.build({
        entryPoints: [join(PACKAGE_ROOT, 'node_modules/monaco-editor', spec.entry)],
        bundle: true,
        format: 'iife',
        minify: true,
        sourcemap: true,
        outfile: join(OUTPUT_DIR, `${spec.name}.min.js`),
        target: ['es2020']
    });
}

async function main(): Promise<void> {
    const cli = parseCliArgs(process.argv.slice(2));
    const fileConfig = loadConfig();
    const requestedWorkers = cli.workers ?? fileConfig.workers ?? DEFAULT_WORKERS;
    const workers = resolveWorkers(requestedWorkers);

    const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    const monacoSpec = packageJson.devDependencies?.['monaco-editor'] ?? packageJson.peerDependencies?.['monaco-editor'] ?? '';
    const monacoVersion = monacoSpec.replace(/^[\^~]/, '') || 'unknown';

    console.log(`\n📦 Bundling Monaco Editor v${monacoVersion}`);
    console.log(`   Workers: ${workers.map((w) => w.name).join(', ') || '(none)'}\n`);

    mkdirSync(OUTPUT_DIR, { recursive: true });

    await bundleMonacoCore(monacoVersion);
    for (const spec of workers) {
        await bundleWorker(spec);
    }

    const files = [
        'monaco.min.js',
        'monaco.min.css',
        'editor.worker.min.js',
        ...workers.map((w) => `${w.name}.min.js`)
    ];

    const manifest = {
        version: monacoVersion,
        generated: new Date().toISOString(),
        workers: workers.map((w) => w.name),
        files: files.filter((f) => existsSync(join(OUTPUT_DIR, f)))
    };
    writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log(`\n✅ Bundled to ${OUTPUT_DIR}`);
    let totalSize = 0;
    for (const file of manifest.files) {
        const filePath = join(OUTPUT_DIR, file);
        if (existsSync(filePath)) {
            const size = statSync(filePath).size;
            totalSize += size;
            console.log(`     ${file}: ${(size / 1024).toFixed(1)} KB`);
        }
    }
    console.log(`     ─────────────────`);
    console.log(`     Total: ${(totalSize / 1024).toFixed(1)} KB (${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`);
}

main().catch((err) => {
    console.error('[bundle-monaco] Failed:', err);
    process.exit(1);
});
