import type { LanguagePack, MonacoNamespace } from '../types';

export interface JsonPackOptions {
    /** JSON schemas to register with Monaco's JSON service. */
    schemas?: Array<{
        uri: string;
        fileMatch?: string[];
        schema?: unknown;
    }>;
    /** Whether to validate against schemas. Default true. */
    validate?: boolean;
    /** Whether to enable schema-derived completions. Default true. */
    enableSchemaRequest?: boolean;
}

export function jsonLanguagePack(options: JsonPackOptions = {}): LanguagePack {
    return {
        id: 'json',
        extensions: ['.json'],
        workerLabel: 'json',
        setup(monaco: MonacoNamespace) {
            const json: any = (monaco as any).json ?? (monaco as any).languages?.json;
            if (!json?.jsonDefaults) return;

            json.jsonDefaults.setDiagnosticsOptions({
                validate: options.validate ?? true,
                enableSchemaRequest: options.enableSchemaRequest ?? true,
                schemas: options.schemas ?? []
            });
        }
    };
}
