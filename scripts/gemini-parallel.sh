#!/bin/bash

# Gemini並列実行スクリプト
# Gemini CLIでコード生成を並列実行する

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QEZU_CMD="node $PROJECT_DIR/dist/cli.js"

COUNT=${1:-16}  # 第1引数で投入数を指定（デフォルト: 16）
PROMPT_PREFIX=${2:-"Pythonの関数"}  # 第2引数でプロンプトのプレフィックスを指定

echo "Gemini並列実行開始"
echo "投入数: $COUNT"
echo "プロンプトプレフィックス: $PROMPT_PREFIX"
echo ""

for i in $(seq 1 $COUNT); do
  $QEZU_CMD run gemini generate prompt="${PROMPT_PREFIX}${i}: データ処理、API呼び出し、ファイル操作のいずれか" language=python model=gemini-pro &
done

wait

echo ""
echo "Geminiジョブを${COUNT}件投入しました"
echo "キュー状態を確認: $QEZU_CMD status"

