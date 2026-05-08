import type { LanguagePack } from '../types';

/**
 * HTML language pack. Wires up the `html` worker label to the prebundled
 * `html.worker.min.js`. Monaco itself ships the HTML language definition
 * (handlebars/razor reuse the same worker).
 */
export function htmlLanguagePack(): LanguagePack {
    return {
        id: 'html',
        extensions: ['.html', '.htm'],
        workerLabel: 'html'
    };
}
