import { defineLibConfig } from '@sigx/vite/lib';

// Multi-entry build mirroring the package's exports map. sigx and friends are
// consumed from node_modules — no source aliases, so this config travels
// cleanly when the folder is extracted to its own repo.
export default defineLibConfig({
    entry: {
        index: 'src/index.ts',
        'vite-plugin': 'src/vite-plugin.ts',
        'shiki/index': 'src/shiki/index.ts',
        'languages/typescript': 'src/languages/typescript.ts',
        'languages/html': 'src/languages/html.ts',
        'languages/css': 'src/languages/css.ts',
        'languages/json': 'src/languages/json.ts'
    },
    external: [
        'monaco-editor',
        'shiki',
        'shiki/core',
        'shiki/engine/javascript',
        '@shikijs/monaco',
        /^@shikijs\/(themes|langs)/,
        'sigx',
        /^@sigx\//,
        // Vite plugin runs in Node — exclude Node built-ins and Vite itself.
        'vite',
        'fs',
        'path',
        'url',
        /^node:/
    ],
    jsx: true
});
