#!/bin/bash

# 16並列テストスクリプト
# Flowiseフローを並列に投入するテスト

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QEZU_CMD="node $PROJECT_DIR/dist/cli.js"

FLOW_ID=${1:-"flow_abc123"}  # 第1引数でFlow IDを指定（デフォルト: flow_abc123）
COUNT=${2:-32}  # 第2引数で投入数を指定（デフォルト: 32）

echo "Flowise並列テスト開始"
echo "Flow ID: $FLOW_ID"
echo "投入数: $COUNT"

for i in $(seq 1 $COUNT); do
  $QEZU_CMD run flowise "$FLOW_ID" topic="第${i}章: 並列エージェント" mode=prompt &
done

wait

echo "すべてのジョブを投入しました"
echo "キュー状態を確認: $QEZU_CMD status"

