#!/bin/bash

# 並列構築スクリプト
# 複数のタスクを並列で構築・実行する例

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QEZU_CMD="node $PROJECT_DIR/dist/cli.js"

echo "並列構築タスク開始"
echo ""

# タスク1: CodexでTypeScriptのユーティリティ関数を生成
echo "タスク1: CodexでTypeScriptユーティリティ関数を生成..."
for i in {1..5}; do
  $QEZU_CMD run codex generate prompt="TypeScriptのユーティリティ関数${i}: 配列操作、オブジェクト操作、文字列処理" language=typescript maxTokens=1000 &
done

# タスク2: Claudeでドキュメント生成
echo "タスク2: Claudeでドキュメントを生成..."
for i in {1..5}; do
  $QEZU_CMD run claude chat message="API仕様書${i}のドキュメントを生成してください。RESTful APIの設計原則を含めて" model=claude-3-opus &
done

# タスク3: GeminiでPythonのデータ処理関数を生成
echo "タスク3: GeminiでPythonデータ処理関数を生成..."
for i in {1..5}; do
  $QEZU_CMD run gemini generate prompt="Pythonのデータ処理関数${i}: CSV読み込み、JSON変換、データフィルタリング" language=python model=gemini-pro &
done

wait

echo ""
echo "並列構築タスク完了（合計15件のジョブを投入）"
echo ""
echo "次のコマンドで状態を確認:"
echo "  $QEZU_CMD status     # キュー状態"
echo "  npm run logs         # ログ確認"
echo "  pm2 monit            # PM2モニタリング"

