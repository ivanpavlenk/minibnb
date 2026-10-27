import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const schemaText = readFileSync(join(root, 'src/config/env.schema.ts'), 'utf8');
const exampleText = readFileSync(join(root, '.env.example'), 'utf8');

const schemaKeys = [
    ...new Set(
        [...schemaText.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*:/gm)].map((m) => m[1]),
    ),
];

const exampleKeys = new Set(
    [...exampleText.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]),
);

const missing = schemaKeys.filter((key) => !exampleKeys.has(key));

if (missing.length > 0) {
    console.error('.env.example is out of sync with env.schema.ts. Missing:');
    for (const key of missing) {
        console.error('  - ' + key);
    }
    process.exit(1);
}

console.log('check:env ok');