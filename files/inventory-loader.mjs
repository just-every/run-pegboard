export async function resolve(specifier, context, next) {
 if (specifier === 'node:test') return { url: new URL('./pegboard-test-inventory-mock.mjs', import.meta.url).href, shortCircuit: true };
 return next(specifier, context);
}
