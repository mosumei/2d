'use strict';

/** Runs after SystemJS setup and before the first scene. Resources keep their original paths. */
exports.start = function (startEngine, packages, api) {
    api = api || wx;
    var names = packages || [];
    var lastTitle = '';
    function status(title) {
        if (lastTitle === title) return;
        lastTitle = title;
        if (typeof api.showLoading === 'function') {
            api.showLoading({ title: title, mask: true });
        }
    }
    function hide() {
        lastTitle = '';
        if (typeof api.hideLoading === 'function') api.hideLoading();
    }
    return new Promise(function (resolve, reject) {
        var index = 0;
        var booted = false;
        function boot() {
            if (booted) return;
            booted = true;
            status('正在启动游戏');
            Promise.resolve().then(startEngine).then(function (value) {
                hide(); resolve(value);
            }, function (error) {
                hide();
                if (typeof api.showModal === 'function') {
                    api.showModal({ title: '游戏启动失败', content: '请退出小游戏后重新进入。', showCancel: false });
                }
                reject(error);
            });
        }
        function download() {
            if (index >= names.length) { boot(); return; }
            if (typeof api.loadSubpackage !== 'function') {
                hide(); reject(new Error('当前微信版本不支持分包，请更新微信后重试。')); return;
            }
            var settled = false;
            status('加载游戏资源 ' + Math.floor(index / names.length * 100) + '%');
            var task;
            function failed(error) {
                if (settled) return;
                settled = true;
                hide();
                if (typeof api.showModal !== 'function') { reject(error); return; }
                api.showModal({
                    title: '资源下载失败',
                    content: '请检查网络连接，点击重试继续下载。',
                    confirmText: '重试', showCancel: false,
                    success: function (answer) {
                        if (answer.confirm) download();
                        else reject(error);
                    },
                    fail: function () { reject(error); }
                });
            }
            try {
                task = api.loadSubpackage({
                    name: names[index],
                    success: function () {
                        if (settled) return;
                        settled = true;
                        index += 1;
                        download();
                    },
                    fail: failed
                });
                if (task && typeof task.onProgressUpdate === 'function') {
                    task.onProgressUpdate(function (event) {
                        if (settled) return;
                        var progress = Math.min(100, Math.max(0, Number(event.progress) || 0));
                        status('加载游戏资源 ' + Math.floor((index + progress / 100) / names.length * 100) + '%');
                    });
                }
            } catch (error) { failed(error); }
        }
        download();
    });
};
