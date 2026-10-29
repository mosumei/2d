微信小游戏分包

1. resources 的微信平台压缩类型保存在：
   assets/resources.meta（bundleConfigID）
   settings/v2/packages/builder.json（对应的平台配置）
   两个文件需一起保留。其他平台继续使用本地资源。

2. Cocos 3.8.8 会把 resources 输出到 subpackages/resources，
   自动生成 game.json 和 src/settings.json 的分包声明。
   不移动源素材，不改变 resources.load 路径，不需要 CDN。

3. 本构建扩展只处理 wechatgame。
   SystemJS 初始化后、首场景启动前下载分包，提供下载进度和失败重试。
   构建结束检查主包原始文件大小；超过 4 MiB 则让构建报错。
   报告输出到 build/wechatgame-package-report.json，不打入游戏包。

4. 首次安装构建扩展后重启编辑器。
   可直接双击 tools/build-wechat.command 构建，或在编辑器导入
   tools/build-configs/wechat-subpackages.json 后构建。
   微信开发者工具打开 build/wechatgame 目录。

5. 无界面检查：
   node tools/test-wechat-package.cjs
   node tools/check-wechat-build.cjs（需要先构建）
