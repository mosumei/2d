'use strict';
const fs = require('fs');
const path = require('path');
exports.throwError = true;

function sizeOf(root) {
    if (!fs.existsSync(root)) return 0;
    return fs.readdirSync(root, { withFileTypes: true }).reduce((total, entry) => {
        const file = path.join(root, entry.name);
        return total + (entry.isDirectory() ? sizeOf(file) : fs.statSync(file).size);
    }, 0);
}

exports.onAfterBuild = async function (options, result) {
    if (options.platform !== 'wechatgame') return;
    const dest = result.dest || result.paths.dir;
    const gameConfig = JSON.parse(fs.readFileSync(path.join(dest, 'game.json'), 'utf8'));
    const settings = JSON.parse(fs.readFileSync(path.join(dest, 'src/settings.json'), 'utf8'));
    const packages = gameConfig.subpackages || [];
    if (!packages.some(item => item.name === 'resources') ||
        !settings.assets.subpackages.includes('resources')) {
        throw new Error('resources 尚未配置为微信分包。请保留 assets/resources.meta 和 settings/v2/packages/builder.json 的分包配置，重新构建。');
    }
    let entry = fs.readFileSync(path.join(dest, 'game.js'), 'utf8');
    if (!entry.includes('// jewel-subpackage-bootstrap')) {
        const start = 'return firstScreen.end().then(() => application.start());';
        if (!entry.includes(start)) {
            throw new Error('微信启动模板发生变化，无法安全添加分包加载器。');
        }
        const names = packages.filter(item => settings.assets.subpackages.includes(item.name)).map(item => item.name);
        // A WeChat subpackage immediately executes game.js, which registers its
        // scripts in SystemJS. Download only AFTER Cocos has initialized SystemJS.
        // The engine still waits for all resources before application.start().
        entry = '// jewel-subpackage-bootstrap\n' + entry.replace(start,
            'return firstScreen.end().then(() => require("./jewel-subpackage-loader").start(' +
            'function () { return application.start(); }, ' + JSON.stringify(names) + '));');
        fs.writeFileSync(path.join(dest, 'game.js'), entry);
    }
    fs.copyFileSync(path.join(__dirname, 'runtime/subpackage-loader.js'), path.join(dest, 'jewel-subpackage-loader.js'));
    const report = {
        mainBytes: 0, totalBytes: sizeOf(dest),
        subpackages: packages.map(item => ({ name: item.name, root: item.root, bytes: sizeOf(path.join(dest, item.root)) }))
    };
    report.mainBytes = report.totalBytes - report.subpackages.reduce((sum, item) => sum + item.bytes, 0);
    const mainMiB = (report.mainBytes / 1048576).toFixed(2);
    fs.writeFileSync(path.join(dest, '../wechatgame-package-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('[微信分包] 主包 ' + mainMiB + ' MiB；资源分包 ' +
        report.subpackages.map(item => item.name + ': ' + (item.bytes / 1048576).toFixed(2) + ' MiB').join(', '));
    if (report.mainBytes > 4 * 1048576) throw new Error('微信主包仍超过 4 MiB（当前 ' + mainMiB + ' MiB），请检查新增的主包依赖。');
};
