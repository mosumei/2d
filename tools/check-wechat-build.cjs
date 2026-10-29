'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { start } = require('../extensions/jewel-wechat-pack/runtime/subpackage-loader');
const root = path.resolve(__dirname, '../build/wechatgame');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.json')));
const settings = JSON.parse(fs.readFileSync(path.join(root, 'src/settings.json')));
const report = JSON.parse(fs.readFileSync(path.join(root, '../wechatgame-package-report.json')));
assert.ok(report.mainBytes < 4 * 1048576);
assert.ok(manifest.subpackages.some(p => p.name === 'resources'));
assert.ok(settings.assets.subpackages.includes('resources'));
assert.ok(!fs.existsSync(path.join(root, 'assets/resources')), 'Resources were duplicated into the main package');
assert.ok(fs.existsSync(path.join(root, 'subpackages/resources/config.json')));

// Exercise the generated game.js in a sandbox. wx.loadSubpackage immediately
// executes real generated subpackage scripts, just as WeChat does. This catches
// the otherwise invisible "System is not defined" startup-order failure.
const order = [];
let engineStarts = 0;
let hides = 0;
const context = { console, canvas: { width: 720, height: 1280 }, window: { devicePixelRatio: 1 } };
const api = {
    getSystemInfoSync: () => ({ platform: 'ios', screenWidth: 720, screenHeight: 1280, devicePixelRatio: 1 }),
    showLoading() {}, hideLoading() { hides++; },
    showModal(options) { throw new Error('Unexpected startup modal: ' + options.title); },
    loadSubpackage(options) {
        assert.ok(context.System, 'Subpackage executed before SystemJS initialization');
        order.push('subpackage');
        vm.runInContext(fs.readFileSync(path.join(root, 'subpackages/resources/game.js'), 'utf8'), context);
        queueMicrotask(options.success);
        return { onProgressUpdate(fn) { fn({ progress: 50 }); } };
    }
};
class Application {
    init() { return Promise.resolve(); }
    start() { order.push('application'); engineStarts++; return Promise.resolve(); }
}
context.wx = api;
context.require = name => {
    if (name === './jewel-subpackage-loader') return { start: (fn, names) => start(fn, names, api) };
    if (name === './first-screen') return {
        start: () => Promise.resolve(), setProgress: () => Promise.resolve(), end: () => Promise.resolve()
    };
    if (name === 'src/system.bundle.js') {
        order.push('system');
        context.System = { warmup() {}, register() {}, import: id => Promise.resolve(
            id === './application.js' ? { Application } : {}) };
    }
    if (name === 'src/import-map.js') return { default: {} };
    return {};
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'game.js'), 'utf8'), context);
setImmediate(() => {
    try {
        assert.equal(engineStarts, 1);
        assert.ok(order.indexOf('system') < order.indexOf('subpackage'));
        assert.ok(order.indexOf('subpackage') < order.indexOf('application'));
        assert.equal(hides, 1);
        console.log('PASS: generated startup, SystemJS-before-subpackage ordering, one engine start, main < 4 MiB, no duplicated resources.');
        console.log(JSON.stringify(report, null, 2));
    } catch (error) { console.error(error); process.exitCode = 1; }
});
