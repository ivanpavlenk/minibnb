export function postgresErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
        return undefined;
    }
    const wrapped = error as { driverError?: { code?: string }; code?: string };
    return wrapped.driverError?.code ?? wrapped.code;
}
