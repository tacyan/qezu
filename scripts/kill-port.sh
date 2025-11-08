#!/bin/bash

# ポートを解放するスクリプト

PORT=${1:-3000}

echo "ポート ${PORT} を使用しているプロセスを確認中..."

PID=$(lsof -ti:${PORT} 2>/dev/null)

if [ -z "$PID" ]; then
  echo "ポート ${PORT} は使用されていません"
  exit 0
fi

echo "プロセス ID: ${PID}"
echo "プロセスを停止しますか? (y/n)"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
  kill -9 ${PID} 2>/dev/null
  echo "ポート ${PORT} を解放しました"
else
  echo "キャンセルしました"
  exit 1
fi

