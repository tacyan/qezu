#!/bin/bash

# qezuセットアップスクリプト

set -e

echo "qezuセットアップ開始..."

# Redisの起動確認（ローカルインストール前提）
if command -v redis-server >/dev/null 2>&1; then
  if ! pgrep -x "redis-server" > /dev/null; then
    echo "Redisを起動します..."
    redis-server --daemonize yes || echo "Redisの起動に失敗しました。手動で起動してください: redis-server"
  else
    echo "Redisは既に起動しています"
  fi
else
  echo "警告: Redisがインストールされていません"
  echo "macOSの場合: brew install redis"
  echo "Ubuntu/Debianの場合: sudo apt-get install redis-server"
  echo "または、Redisをスキップして続行します（BullMQはRedisが必要です）"
fi

# 依存関係のインストール
echo "依存関係をインストールします..."
npm install

# ビルド
echo "ビルドします..."
npm run build

# .envファイルの確認
if [ ! -f .env ]; then
  echo ".envファイルを作成します..."
  cat > .env << EOF
# Redis接続設定
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# FlowiseのURL（/api/v1/prediction/ で終わるのが定番）
QEZU_FLOWISE_URL=http://localhost:3000/api/v1/prediction/

# FlowiseのAPIキー（未設定なら空のままでOK）
QEZU_FLOWISE_KEY=

# 並列処理設定（16並列: 8プロセス × 2並列度）
QEZU_CONCURRENCY=2
QEZU_PROCS=8
EOF
  echo ".envファイルを作成しました。必要に応じて編集してください。"
else
  echo ".envファイルは既に存在します"
fi

echo "セットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. Flowiseを起動: npx flowise start"
echo "2. Flowise UIでフローを作成し、Flow IDを取得"
echo "3. .envファイルでQEZU_FLOWISE_URLとFlow IDを設定"
echo "4. ワーカーを起動: npm run start:16"
echo "5. テスト実行: ./scripts/parallel-test.sh <flowId>"

