// Exercise the shipped code: source-only tests miss Creator's iterator spread transform.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'build/wechatgame/assets/main/index.js'), 'utf8');
const start = source.indexOf('System.register("chunks:///_virtual/LevelScramble.ts"');
assert.ok(start >= 0, 'Build the WeChat project first');
const end = source.indexOf('System.register(', start + 20);
let scramble;
vm.runInNewContext(source.slice(start, end < 0 ? undefined : end), {
    System: { register(name, dependencies, factory) {
        const module = factory((name, value) => { if (name === 'scrambleLevel') scramble = value; });
        module.setters[0]({ createForOfIteratorHelperLoose(value) {
            const iterator = value[Symbol.iterator]();
            return iterator.next.bind(iterator);
        } });
        module.setters[1]({ cclegacy: { _RF: { push() {}, pop() {} } } });
        module.execute();
    } }
});
function counts(rows) {
    const result = {};
    for (const row of rows) for (const color of row) {
        if (color !== '.') result[color] = (result[color] || 0) + 1;
    }
    return result;
}
for (const name of ['level_01', 'level_02', 'level_03']) {
    const { target } = JSON.parse(fs.readFileSync(path.join(root, `assets/resources/levels/${name}.json`)));
    const initial = scramble(target);
    assert.equal(initial.length, target.length);
    assert.deepEqual(counts(initial), counts(target));
    initial.forEach((row, i) => {
        assert.equal(row.length, target[i].length);
        for (let j = 0; j < row.length; j++) assert.equal(row[j] === '.', target[i][j] === '.');
    });
    console.log('PASS WeChat compiled scramble:', name);
}
