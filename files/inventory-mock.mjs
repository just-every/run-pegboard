const stack = [];
const rows = globalThis.__pegboardTestInventory ??= [];
export function describe(name, ...args) {
 rows.push({ file: globalThis.__pegboardFile, name: [...stack, name].join(' '), title: name, type: 'suite' });
 stack.push(name);
 try { args.at(-1)(); } finally { stack.pop(); }
}
export function it(name) { rows.push({ file: globalThis.__pegboardFile, name: [...stack, name].join(' '), title: name, type: 'test' }); }
export const test = it, suite = describe;
export function before() {}
export function after() {}
export function beforeEach() {}
export function afterEach() {}
it.skip = it; it.todo = it; describe.skip = describe;
export default test;
