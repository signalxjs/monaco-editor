import { defineConfig } from 'vite';
import { sigxPlugin } from '@sigx/vite';
import { monacoPrebundledPlugin } from '@sigx/monaco-editor/vite';

// No source aliases — sigx and @sigx/monaco-editor come from node_modules,
// so this config travels with the folder when extracted to its own repo.
export default defineConfig({
    plugins: [
        sigxPlugin(),
        monacoPrebundledPlugin({
            strategy: 'prebundled',
            publicPath: '/monaco-bundle'
        })
    ],
    oxc: {
        jsx: { runtime: 'automatic', importSource: 'sigx' }
    },
    server: {
        port: 5180,
        open: true
    }
});
