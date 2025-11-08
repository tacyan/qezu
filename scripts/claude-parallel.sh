#!/bin/bash

# Claude並列実行スクリプト
# Claude CLIでチャットを並列実行する

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QEZU_CMD="node $PROJECT_DIR/dist/cli.js"

COUNT=${1:-16}  # 第1引数で投入数を指定（デフォルト: 16）
MESSAGE_PREFIX=${2:-"質問"}  # 第2引数でメッセージのプレフィックスを指定

echo "Claude並列実行開始"
echo "投入数: $COUNT"
echo "メッセージプレフィックス: $MESSAGE_PREFIX"
echo ""

for i in $(seq 1 $COUNT); do
  $QEZU_CMD run claude chat message="${MESSAGE_PREFIX}${i}: 並列処理、非同期処理、パフォーマンス最適化について教えてください" model=claude-3-opus &
done

wait

echo ""
echo "Claudeジョブを${COUNT}件投入しました"
echo "キュー状態を確認: $QEZU_CMD status"

