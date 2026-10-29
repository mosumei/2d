#!/bin/zsh
set -u
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
creator_bin='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator'
if [[ ! -x "$creator_bin" ]]; then
  echo '未找到 Cocos Creator 3.8.8，请修改本脚本的 creator_bin 路径。'
  exit 1
fi
"$creator_bin" --project "$project_dir" --build "configPath=$project_dir/tools/build-configs/wechat-subpackages.json"
build_code=$?
# Creator uses 36 to indicate successful command-line builds.
if [[ "$build_code" != 0 && "$build_code" != 36 ]]; then
  echo "构建失败，退出码：$build_code"
  exit "$build_code"
fi
echo "微信构建完成：$project_dir/build/wechatgame"
