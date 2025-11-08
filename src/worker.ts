/**
 * qezuワーカー
 * BullMQを使用してジョブを並列処理する
 * 
 * @module worker
 */

import { config } from "dotenv";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { callFlowise } from "./adapters/flowise.js";
import { callCodex, generateCode, completeCode } from "./adapters/codex.js";
import { callClaude, chatWithClaude, generateCodeWithClaude } from "./adapters/claude.js";
import { callGemini, chatWithGemini, generateCodeWithGemini } from "./adapters/gemini.js";

// 環境変数を読み込み
config();

/**
 * ジョブのペイロード型定義
 */
type Payload = {
  kind: string;
  params: any;
  meta?: any;
};

/**
 * Redis接続設定
 */
const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null,
});

/**
 * 並列実行数（環境変数から取得、デフォルトは2）
 */
const concurrency = parseInt(process.env.QEZU_CONCURRENCY || "2", 10);

/**
 * ワーカーインスタンス
 * qezu:jobsキューからジョブを取得して処理する
 */
const w = new Worker<Payload>(
  "qezu-jobs",
  async (job: Job<Payload>) => {
    const { kind, params, meta } = job.data;

    console.log(`[Worker] ジョブ開始 [kind=${kind}, jobId=${job.id}]`);

    try {
      if (kind === "flowise") {
        // params.flowId と params.vars を想定
        const res = await callFlowise(params.flowId, params.vars || {}, {
          mode: params.mode,
        });
        console.log(`[Worker] Flowise完了 [flowId=${params.flowId}, jobId=${job.id}]`);
        return { ok: true, text: res.text, raw: res.raw };
      }

      if (kind === "codex") {
        // Codex CLIを実行
        const { command, args, options } = params;
        let result;

        if (command === "generate") {
          result = await generateCode(params.prompt, options);
        } else if (command === "complete") {
          result = await completeCode(params.code, options);
        } else {
          result = await callCodex(command, args || [], options);
        }

        console.log(`[Worker] Codex完了 [command=${command}, jobId=${job.id}]`);
        return { ok: true, result };
      }

      if (kind === "claude") {
        // Claude CLIを実行
        const { command, args, options } = params;
        let result;

        if (command === "chat") {
          result = await chatWithClaude(params.message, options);
        } else if (command === "generate") {
          result = await generateCodeWithClaude(params.prompt, options);
        } else {
          result = await callClaude(command, args || [], options);
        }

        console.log(`[Worker] Claude完了 [command=${command}, jobId=${job.id}]`);
        return { ok: true, result };
      }

      if (kind === "gemini") {
        // Gemini CLIを実行
        const { command, args, options } = params;
        let result;

        if (command === "chat") {
          result = await chatWithGemini(params.message, options);
        } else if (command === "generate") {
          result = await generateCodeWithGemini(params.prompt, options);
        } else {
          result = await callGemini(command, args || [], options);
        }

        console.log(`[Worker] Gemini完了 [command=${command}, jobId=${job.id}]`);
        return { ok: true, result };
      }

      // 既存のエージェント（slides/code/mcp）は後で追加可能
      // if (kind === "slides") return await runSlidesLocal(params, meta);
      // if (kind === "code")   return await runCodeLocal(params, meta);
      // if (kind === "mcp")    return await callMCP(params.server, params.serverArgs || [], params.method, params.params);

      throw new Error(`unknown agent kind: ${kind}`);
    } catch (error: any) {
      const errorMessage = `ワーカーエラー [kind=${kind}, jobId=${job.id}, error=${error.message}, stack=${error.stack}]`;
      console.error(`[Worker] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },
  {
    connection,
    concurrency,
    stalledInterval: 30000,
    lockDuration: 90000,
    removeOnComplete: {
      age: 3600, // 1時間後に完了ジョブを削除
      count: 1000, // 最大1000件まで保持
    },
    removeOnFail: {
      age: 86400, // 24時間後に失敗ジョブを削除
    },
  }
);

/**
 * ワーカーのイベントハンドラ
 */
w.on("completed", (job: Job) => {
  console.log(`[Worker] ジョブ完了 [jobId=${job.id}, kind=${job.data.kind}]`);
});

w.on("failed", (job: Job | undefined, error: Error) => {
  console.error(
    `[Worker] ジョブ失敗 [jobId=${job?.id}, kind=${job?.data.kind}, error=${error.message}]`
  );
});

w.on("error", (error: Error) => {
  console.error(`[Worker] ワーカーエラー [error=${error.message}]`);
});

console.log(`[Worker] ワーカー起動 [concurrency=${concurrency}]`);

// グレースフルシャットダウン
process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM受信、ワーカーを停止します");
  await w.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Worker] SIGINT受信、ワーカーを停止します");
  await w.close();
  await connection.quit();
  process.exit(0);
});

