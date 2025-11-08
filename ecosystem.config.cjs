/**
 * PM2設定ファイル（CommonJS形式）
 * qezuワーカーを並列実行するための設定
 */
require("dotenv").config();

const concurrency = parseInt(process.env.QEZU_CONCURRENCY || "2", 10);
const instances = process.env.QEZU_PROCS || "max";

module.exports = {
  apps: [
    {
      name: "qezu-worker",
      script: "./dist/worker.js",
      instances: instances,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        QEZU_CONCURRENCY: concurrency.toString(),
        // 環境変数を.envから読み込む
        REDIS_HOST: process.env.REDIS_HOST || "localhost",
        REDIS_PORT: process.env.REDIS_PORT || "6379",
        REDIS_DB: process.env.REDIS_DB || "0",
        QEZU_FLOWISE_URL: process.env.QEZU_FLOWISE_URL || "http://localhost:3000/api/v1/prediction/",
        QEZU_FLOWISE_KEY: process.env.QEZU_FLOWISE_KEY || "",
        CODEX_CLI_PATH: process.env.CODEX_CLI_PATH || "/Users/tacyan/.npm-global/bin/codex",
        CLAUDE_CLI_PATH: process.env.CLAUDE_CLI_PATH || "/Users/tacyan/.npm-global/bin/claude",
        GEMINI_CLI_PATH: process.env.GEMINI_CLI_PATH || "/Users/tacyan/.npm-global/bin/gemini",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "1G",
    },
    {
      name: "qezu-server",
      script: "./dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
        // 環境変数を.envから読み込む
        CODEX_CLI_PATH: process.env.CODEX_CLI_PATH || "/Users/tacyan/.npm-global/bin/codex",
        CLAUDE_CLI_PATH: process.env.CLAUDE_CLI_PATH || "/Users/tacyan/.npm-global/bin/claude",
        GEMINI_CLI_PATH: process.env.GEMINI_CLI_PATH || "/Users/tacyan/.npm-global/bin/gemini",
      },
      error_file: "./logs/pm2-server-error.log",
      out_file: "./logs/pm2-server-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};

