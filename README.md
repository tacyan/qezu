# qezu

**ローカル並列エンジン（PM2×BullMQ）でマルチエージェント（Flowise/Codex/Claude/Gemini）を並列実行**

複数のAIエージェント（Codex、Claude、Gemini）を同時に並列実行し、結果を統合して表示できるツールです。Webインターフェースから簡単に操作でき、スライド生成などのタスクもサポートしています。

## ✨ 主な機能

- 🚀 **マルチエージェント並列実行**: Codex、Claude、Geminiを同時に実行して結果を比較
- 📊 **Webインターフェース**: ブラウザから簡単に操作可能
- 📝 **スライド生成**: AIエージェントでスライドを生成し、リアルタイムでプレビュー
- ⚡ **高速処理**: PM2とBullMQによる16並列処理
- 🔄 **Flowise連携**: Flowiseで作成したワークフローを並列実行

## 📋 目次

- [必要な環境](#必要な環境)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [使い方](#使い方)
- [トラブルシューティング](#トラブルシューティング)
- [よくある質問](#よくある質問)

## 必要な環境

### 必須

- **Node.js 20以上**
- **npm** または **pnpm**
- **Redis**（ローカルインストール）

### オプション（使用するエージェントに応じて）

- **Codex CLI**: `npm install -g @codex/cli`
- **Claude CLI**: `npm install -g @anthropic/claude-cli`
- **Gemini CLI**: `npm install -g @google/gemini-cli`

### バージョン確認

```bash
node -v        # v20.0.0 以上であることを確認
npm -v         # npm がインストールされていることを確認
redis-server --version  # Redis がインストールされていることを確認
```

## インストール

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd qezu
```

### 2. Redisのインストールと起動

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis  # 自動起動を有効化
```

**手動起動（どのOSでも）:**
```bash
redis-server
```

Redisが起動しているか確認:
```bash
redis-cli ping
# 応答: PONG が返ってくればOK
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. ビルド

```bash
npm run build
```

### 5. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成:

```bash
cp .env.example .env  # もしサンプルファイルがあれば
# または
touch .env
```

`.env` ファイルに以下を記述:

```env
# Redis接続設定（デフォルト値）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# FlowiseのURL（Flowiseを使用する場合のみ）
QEZU_FLOWISE_URL=http://localhost:3000/api/v1/prediction/

# FlowiseのAPIキー（Flowiseを使用する場合のみ、空でもOK）
QEZU_FLOWISE_KEY=

# 並列処理設定（16並列: 8プロセス × 2並列度）
QEZU_CONCURRENCY=2
QEZU_PROCS=8

# CLIツールのパス（グローバルインストールしている場合は省略可）
CODEX_CLI_PATH=/Users/your-username/.npm-global/bin/codex
CLAUDE_CLI_PATH=/Users/your-username/.npm-global/bin/claude
GEMINI_CLI_PATH=/Users/your-username/.npm-global/bin/gemini
```

**CLIパスの確認方法:**
```bash
which codex   # Codex CLIのパスを確認
which claude  # Claude CLIのパスを確認
which gemini  # Gemini CLIのパスを確認
```

### 6. AIエージェントのAPIキー設定（必要に応じて）

**Gemini APIキーの設定:**

```bash
# 方法1: 環境変数に設定
export GEMINI_API_KEY="your-api-key-here"

# 方法2: .envファイルに追加
echo "GEMINI_API_KEY=your-api-key-here" >> .env

# 方法3: ~/.gemini/settings.json に設定
mkdir -p ~/.gemini
cat > ~/.gemini/settings.json << EOF
{
  "apiKey": "your-api-key-here"
}
EOF
```

## クイックスタート

### 方法1: セットアップスクリプトを使用（推奨）

```bash
# セットアップスクリプトを実行（Redis起動確認、依存関係インストール、ビルド）
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 方法2: 手動セットアップ

```bash
# 1. 依存関係をインストール
npm install

# 2. ビルド
npm run build

# 3. Redisが起動していることを確認
redis-cli ping
```

### Webサーバーの起動

```bash
# 開発モード（ホットリロード対応）
npm run server

# 本番モード（ビルド後）
npm run build
npm run server:prod
```

ブラウザで `http://localhost:3000` を開いて使用開始！

## 使い方

### Webインターフェース（初心者におすすめ）

1. **サーバーを起動**
   ```bash
   npm run server
   ```

2. **ブラウザで開く**
   - `http://localhost:3000` にアクセス

3. **タスクを実行**
   - プロンプトを入力（例: "TypeScriptで配列を操作するユーティリティ関数を生成してください"）
   - タスクタイプを選択（コード生成、チャット、コード補完、一般、**スライド生成**）
   - 実行するエージェントを選択（Codex、Claude、Gemini）
   - 「実行」ボタンをクリック

4. **結果を確認**
   - 各エージェントの実行結果がリアルタイムで表示されます
   - スライド生成の場合は、リアルタイムでスライドが更新されます
   - スライドプレビューからHTMLをダウンロード可能

### スライド生成機能

**スライド生成の使い方:**

1. Web UIでタスクタイプに「スライド生成」を選択
2. プロンプトを入力（例: "マルチエージェントシステムについて16枚のスライドを作成してください"）
3. エージェントを選択（Codex推奨、リアルタイムストリーミング対応）
4. 「実行」をクリック
5. スライドが文字単位でリアルタイムに生成されます
6. スライドプレビューで確認・ダウンロード可能

**スライド形式:**
- Markdown形式で生成
- `## Slide Title` でスライドタイトル
- `---` でスライド区切り
- HTML形式でプレビュー・ダウンロード可能

### CLIコマンド（上級者向け）

#### Codex CLI実行

```bash
# コード生成
node dist/cli.js run codex generate prompt="TypeScriptの関数を生成" language=typescript maxTokens=1000

# コード補完
node dist/cli.js run codex complete code="function hello(" language=typescript
```

#### Claude CLI実行

```bash
# チャット
node dist/cli.js run claude chat message="こんにちは" model=claude-3-opus

# コード生成
node dist/cli.js run claude generate prompt="Reactコンポーネントを生成" language=typescript
```

#### Gemini CLI実行

```bash
# チャット
node dist/cli.js run gemini chat message="こんにちは" model=gemini-pro

# コード生成
node dist/cli.js run gemini generate prompt="Pythonの関数を生成" language=python
```

### PM2による並列実行（大量処理向け）

#### 16並列実行の開始

```bash
# PM2で16並列ワーカーを起動（8プロセス × 2並列度）
npm run start:16

# または
QEZU_CONCURRENCY=2 QEZU_PROCS=8 npm start
```

#### PM2管理コマンド

```bash
# ステータス確認
npm run status

# ログ確認
npm run logs

# 再起動
npm run restart

# 停止
npm run stop
```

#### 並列実行テスト

```bash
# マルチエージェント並列実行テスト（各10件ずつ）
npm run test:multi 10

# Codex並列実行テスト（16件）
npm run test:codex 16

# Claude並列実行テスト（16件）
npm run test:claude 16

# Gemini並列実行テスト（16件）
npm run test:gemini 16
```

### Flowise連携（オプション）

Flowiseを使用する場合:

1. **Flowiseの起動**
   ```bash
   npx flowise start
   ```

2. **Flowiseでフローを作成**
   - ブラウザで `http://localhost:3000` を開く
   - フローを作成し、「Save」→「API」からエンドポイントを有効化
   - Flow IDをメモ

3. **qezuから実行**
   ```bash
   node dist/cli.js run flowise flow_abc123 topic="生成AIの歴史" mode=prompt
   ```

## トラブルシューティング

### ポートが使用中エラー（EADDRINUSE）

```bash
# ポート3000を解放
npm run kill-port 3000

# または別のポートを使用
PORT=3001 npm run server
```

### Redis接続エラー

```bash
# Redisが起動しているか確認
redis-cli ping

# Redisを起動
redis-server

# macOS (Homebrew)
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis
```

### CLIツールが見つからないエラー

```bash
# CLIツールがインストールされているか確認
which codex
which claude
which gemini

# インストールされていない場合
npm install -g @codex/cli
npm install -g @anthropic/claude-cli
npm install -g @google/gemini-cli

# .envファイルにパスを設定
CODEX_CLI_PATH=/path/to/codex
CLAUDE_CLI_PATH=/path/to/claude
GEMINI_CLI_PATH=/path/to/gemini
```

### Gemini APIキーエラー

```
Gemini APIキーが設定されていません。環境変数 GEMINI_API_KEY を設定するか、~/.gemini/settings.json を設定してください。
```

**解決方法:**
```bash
# 環境変数に設定
export GEMINI_API_KEY="your-api-key"

# または .envファイルに追加
echo "GEMINI_API_KEY=your-api-key" >> .env

# または ~/.gemini/settings.json に設定
mkdir -p ~/.gemini
cat > ~/.gemini/settings.json << EOF
{
  "apiKey": "your-api-key"
}
EOF
```

### PM2ワーカーが起動しない

```bash
# PM2の状態を確認
pm2 status

# ログを確認
pm2 logs qezu-worker

# 再起動
pm2 restart qezu-worker

# 完全に削除して再起動
pm2 delete qezu-worker
npm run start:16
```

### ビルドエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install

# 再度ビルド
npm run build
```

## よくある質問

### Q: どのエージェントを使えばいいですか？

A: 
- **Codex**: コード生成に最適、スライド生成もリアルタイムストリーミング対応
- **Claude**: 長文の生成やチャットに適している
- **Gemini**: 汎用的なタスクに使用可能（APIキー設定が必要）

複数のエージェントを同時に実行して結果を比較することをおすすめします。

### Q: 並列実行数はどのくらいが適切ですか？

A: 
- **デフォルト**: 16並列（8プロセス × 2並列度）
- **CPUコア数に応じて調整**: CPUコア数 × 2 程度が目安
- **リソース使用量を監視**: `pm2 monit` でCPU/メモリ使用量を確認

### Q: スライド生成が遅いです

A: 
- Codexを使用するとリアルタイムストリーミングで文字単位で表示されます
- 他のエージェントは完了まで待つ必要があります
- PM2の並列度を上げることで処理速度が向上します

### Q: Flowiseは必須ですか？

A: 
いいえ、Flowiseはオプションです。Codex、Claude、GeminiのCLIツールだけで使用できます。

### Q: エラーログはどこで確認できますか？

A: 
```bash
# PM2のログ
npm run logs

# または
pm2 logs qezu-worker

# サーバーのログ（ターミナルに表示）
npm run server
```

### Q: カスタムポートを使用したい

A: 
```bash
# 環境変数で指定
PORT=3001 npm run server

# または .envファイルに追加
PORT=3001
```

## ライセンス

MIT

## 貢献

プルリクエストやイシューの報告を歓迎します！

## サポート

問題が発生した場合は、[Issues](https://github.com/your-username/qezu/issues) で報告してください。
