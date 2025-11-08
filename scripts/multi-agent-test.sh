#!/bin/bash

# マルチエージェント並列テストスクリプト
# Codex、Claude、Geminiを並列で実行する

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QEZU_CMD="node $PROJECT_DIR/dist/cli.js"

COUNT=${1:-10}  # 第1引数で各エージェントの投入数を指定（デフォルト: 10）

echo "マルチエージェント並列テスト開始"
echo "各エージェントの投入数: $COUNT"
echo ""

# Codexでコード生成を並列投入
echo "Codex: コード生成タスクを投入中..."
for i in $(seq 1 $COUNT); do
  $QEZU_CMD run codex generate prompt="TypeScriptのユーティリティ関数${i}を生成: 配列操作関数" language=typescript maxTokens=500 &
done

# Claudeでチャットを並列投入
echo "Claude: チャットタスクを投入中..."
for i in $(seq 1 $COUNT); do
  $QEZU_CMD run claude chat message="質問${i}: 並列処理のベストプラクティスについて教えてください" model=claude-3-opus &
done

# Geminiでコード生成を並列投入
echo "Gemini: コード生成タスクを投入中..."
for i in $(seq 1 $COUNT); do
  $QEZU_CMD run gemini generate prompt="Pythonのデータ処理関数${i}を生成: JSONパース処理" language=python model=gemini-pro &
done

wait

echo ""
echo "すべてのジョブを投入しました（合計: $((COUNT * 3))件）"
echo "キュー状態を確認: $QEZU_CMD status"
echo "ログを確認: npm run logs"

