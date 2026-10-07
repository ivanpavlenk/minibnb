/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.spec.ts'],
    reporters: ['default'],
    maxWorkers: 1,
    testTimeout: 120000,
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: {
                    module: 'commonjs',
                    target: 'ES2021',
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                    esModuleInterop: true,
                    strict: true,
                },
            },
        ],
    },
};