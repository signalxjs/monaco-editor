import type { LanguagePack } from '../types';

/**
 * CSS / SCSS / LESS language pack. The CSS worker handles all three.
 */
export function cssLanguagePack(): LanguagePack {
    return {
        id: 'css',
        extensions: ['.css'],
        workerLabel: 'css'
    };
}
