'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('../extensions/jewel-wechat-pack/runtime/subpackage-loader');

function mockApi() {
    const calls = { titles: [], tasks: [], dialogs: [], hidden: 0 };
    const api = {
        showLoading: value => calls.titles.push(value.title),
        hideLoading: () => calls.hidden++,
        showModal: value => calls.dialogs.push(value),
        loadSubpackage: options => {
            const task = { options, onProgressUpdate(fn) { this.progress = fn; } };
            calls.tasks.push(task);
            return task;
        }
    };
    return { api, calls };
}
(async () => {
    const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/resources.meta')));
    const builder = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings/v2/packages/builder.json')));
    const config = builder.bundleConfig.custom[meta.userData.bundleConfigID];
    assert.equal(config.configs.miniGame.overwriteSettings.wechatgame.compressionType, 'subpackage');
    assert.equal(config.configs.miniGame.overwriteSettings.wechatgame.isRemote, false);
    assert.equal(config.configs.web.preferredOptions.isRemote, false);
    assert.equal(config.configs.native.preferredOptions.isRemote, false);
    const { api, calls } = mockApi();
    let bootCount = 0;
    const loaded = start(() => { bootCount++; return 'ready'; }, ['resources', 'extra'], api);
    assert.equal(bootCount, 0, 'Engine started before resource package was ready');
    calls.tasks[0].progress({ progress: 50 });
    assert.ok(calls.titles.some(title => title.includes('25%')));
    calls.tasks[0].options.success();
    assert.equal(calls.tasks[1].options.name, 'extra');
    assert.equal(bootCount, 0, 'Engine started before all subpackages were ready');
    calls.tasks[1].options.success();
    calls.tasks[1].options.success(); // Duplicate platform callbacks cannot double-start.
    assert.equal(await loaded, 'ready');
    assert.equal(bootCount, 1);
    assert.equal(calls.hidden, 1);

    const retry = mockApi();
    let retriesBooted = 0;
    const retried = start(() => { retriesBooted++; }, ['resources'], retry.api);
    retry.calls.tasks[0].options.fail(new Error('offline'));
    assert.equal(retriesBooted, 0);
    assert.equal(retry.calls.dialogs[0].confirmText, '重试');
    retry.calls.dialogs[0].success({ confirm: true });
    assert.equal(retry.calls.tasks.length, 2);
    retry.calls.tasks[0].options.success(); // Ignore late success from failed attempt.
    assert.equal(retriesBooted, 0);
    retry.calls.tasks[1].options.success();
    await retried;
    assert.equal(retriesBooted, 1);

    const failure = mockApi();
    const failed = start(() => Promise.reject(new Error('engine error')), [], failure.api);
    await assert.rejects(failed, /engine error/);
    assert.equal(failure.calls.hidden, 1);
    assert.equal(failure.calls.dialogs[0].title, '游戏启动失败');
    await assert.rejects(start(() => {}, ['resources'], {}), /不支持分包/);
    console.log('PASS: persistent config, resource-before-engine startup, progress, retry, stale callbacks, startup errors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
