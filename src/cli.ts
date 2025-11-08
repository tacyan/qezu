#!/usr/bin/env node

/**
 * qezu CLI
 * Flowiseフローを並列実行するためのコマンドラインインターフェース
 * 
 * @module cli
 */

import { program } from "commander";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { join } from "path";

// 環境変数を読み込み
config();

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
 * BullMQキューインスタンス
 */
const Q = new Queue("qezu-jobs", { connection });

/**
 * JSON文字列をパースする（失敗時はそのまま返す）
 * @param v パース対象の文字列
 * @returns パース結果または元の文字列
 */
function tryParse(v: string): any {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/**
 * qezu CLIのメイン処理
 */
program
  .name("qezu")
  .description("ローカル並列エンジン（PM2×BullMQ）でマルチエージェント（Flowise/Codex/Claude/Gemini）を並列実行")
  .version("1.0.0");

/**
 * run flowise サブコマンド
 * Flowiseフローを実行する
 * 
 * 使用例:
 *   qezu run flowise flow_abc123 topic="生成AIの歴史" mode=prompt
 *   qezu run flowise flow_abc123 topic="生成AIの歴史" format=html
 */
program
  .command("run")
  .argument("<subcommand>", "サブコマンド（flowise など）")
  .argument("[args...]", "追加引数")
  .action(async (sub: string, rest: string[]) => {
    if (sub === "flowise") {
      // 例: qezu run flowise FLOW_ID topic="生成AIの歴史" format=html
      const [flowId, ...kv] = rest;

      if (!flowId) {
        console.error("エラー: usage: qezu run flowise <flowId> [key=value ...] [mode=prompt|chat]");
        process.exit(1);
      }

      // key=value形式の引数をパース
      const vars = Object.fromEntries(
        kv
          .filter((s) => s.includes("=") && !s.startsWith("mode="))
          .map((s) => {
            const [k, v] = s.split("=");
            return [k, tryParse(v)];
          })
      );

      // mode引数を抽出
      const modeArg = kv.find((s) => s.startsWith("mode="));
      const mode = modeArg ? modeArg.split("=")[1] : undefined;

      try {
        await Q.add(
          "task",
          { kind: "flowise", params: { flowId, vars, mode } },
          { priority: 2 }
        );
        console.log({ enqueued: "flowise", flowId, vars, mode });
      } catch (error: any) {
        console.error(
          `エラー: ジョブの投入に失敗しました [error=${error.message}]`
        );
        process.exit(1);
      }

      await connection.quit();
      process.exit(0);
    }

    if (sub === "codex") {
      // 例: qezu run codex generate prompt="TypeScriptの関数を生成" language=typescript
      const [command, ...kv] = rest;

      if (!command) {
        console.error("エラー: usage: qezu run codex <command> [key=value ...]");
        console.error("  例: qezu run codex generate prompt=\"...\" language=typescript");
        process.exit(1);
      }

      const params: any = { command };
      const options: any = {};

      // key=value形式の引数をパース
      for (const kvPair of kv) {
        if (kvPair.includes("=")) {
          const [k, v] = kvPair.split("=");
          const parsed = tryParse(v);

          if (k === "prompt" || k === "code" || k === "message") {
            params[k] = parsed;
          } else if (k === "args") {
            params.args = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            options[k] = parsed;
          }
        } else {
          // 引数として追加
          if (!params.args) params.args = [];
          params.args.push(kvPair);
        }
      }

      params.options = options;

      try {
        await Q.add("task", { kind: "codex", params }, { priority: 2 });
        console.log({ enqueued: "codex", params });
      } catch (error: any) {
        console.error(`エラー: ジョブの投入に失敗しました [error=${error.message}]`);
        process.exit(1);
      }

      await connection.quit();
      process.exit(0);
    }

    if (sub === "claude") {
      // 例: qezu run claude chat message="こんにちは" model=claude-3-opus
      const [command, ...kv] = rest;

      if (!command) {
        console.error("エラー: usage: qezu run claude <command> [key=value ...]");
        console.error("  例: qezu run claude chat message=\"...\" model=claude-3-opus");
        process.exit(1);
      }

      const params: any = { command };
      const options: any = {};

      // key=value形式の引数をパース
      for (const kvPair of kv) {
        if (kvPair.includes("=")) {
          const [k, v] = kvPair.split("=");
          const parsed = tryParse(v);

          if (k === "prompt" || k === "message") {
            params[k] = parsed;
          } else if (k === "args") {
            params.args = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            options[k] = parsed;
          }
        } else {
          // 引数として追加
          if (!params.args) params.args = [];
          params.args.push(kvPair);
        }
      }

      params.options = options;

      try {
        await Q.add("task", { kind: "claude", params }, { priority: 2 });
        console.log({ enqueued: "claude", params });
      } catch (error: any) {
        console.error(`エラー: ジョブの投入に失敗しました [error=${error.message}]`);
        process.exit(1);
      }

      await connection.quit();
      process.exit(0);
    }

    if (sub === "gemini") {
      // 例: qezu run gemini chat message="こんにちは" model=gemini-pro
      const [command, ...kv] = rest;

      if (!command) {
        console.error("エラー: usage: qezu run gemini <command> [key=value ...]");
        console.error("  例: qezu run gemini chat message=\"...\" model=gemini-pro");
        process.exit(1);
      }

      const params: any = { command };
      const options: any = {};

      // key=value形式の引数をパース
      for (const kvPair of kv) {
        if (kvPair.includes("=")) {
          const [k, v] = kvPair.split("=");
          const parsed = tryParse(v);

          if (k === "prompt" || k === "message") {
            params[k] = parsed;
          } else if (k === "args") {
            params.args = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            options[k] = parsed;
          }
        } else {
          // 引数として追加
          if (!params.args) params.args = [];
          params.args.push(kvPair);
        }
      }

      params.options = options;

      try {
        await Q.add("task", { kind: "gemini", params }, { priority: 2 });
        console.log({ enqueued: "gemini", params });
      } catch (error: any) {
        console.error(`エラー: ジョブの投入に失敗しました [error=${error.message}]`);
        process.exit(1);
      }

      await connection.quit();
      process.exit(0);
    }

    // ワークフロー実行（qezu.config.yamlから読み込み）
    if (sub.startsWith("flow-")) {
      try {
        const configPath = join(process.cwd(), "qezu.config.yaml");
        const configContent = readFileSync(configPath, "utf-8");
        const config = parse(configContent) as any;

        const workflowName = sub;
        const workflow = config.workflows?.[workflowName];

        if (!workflow) {
          console.error(`エラー: ワークフロー '${workflowName}' が見つかりません`);
          process.exit(1);
        }

        // ワークフローの各ステップを実行
        for (const step of workflow.steps || []) {
          if (step.agent === "flowise") {
            await Q.add(
              "task",
              {
                kind: "flowise",
                params: {
                  flowId: step.flowId,
                  vars: step.vars || {},
                  mode: step.mode,
                },
              },
              { priority: 2 }
            );
            console.log({
              enqueued: "flowise",
              flowId: step.flowId,
              vars: step.vars,
              mode: step.mode,
            });
          } else if (step.agent === "codex") {
            await Q.add(
              "task",
              {
                kind: "codex",
                params: {
                  command: step.command,
                  prompt: step.prompt,
                  code: step.code,
                  args: step.args,
                  options: step.options || {},
                },
              },
              { priority: 2 }
            );
            console.log({
              enqueued: "codex",
              command: step.command,
              options: step.options,
            });
          } else if (step.agent === "claude") {
            await Q.add(
              "task",
              {
                kind: "claude",
                params: {
                  command: step.command,
                  message: step.message,
                  prompt: step.prompt,
                  args: step.args,
                  options: step.options || {},
                },
              },
              { priority: 2 }
            );
            console.log({
              enqueued: "claude",
              command: step.command,
              options: step.options,
            });
          } else if (step.agent === "gemini") {
            await Q.add(
              "task",
              {
                kind: "gemini",
                params: {
                  command: step.command,
                  message: step.message,
                  prompt: step.prompt,
                  args: step.args,
                  options: step.options || {},
                },
              },
              { priority: 2 }
            );
            console.log({
              enqueued: "gemini",
              command: step.command,
              options: step.options,
            });
          }
        }
      } catch (error: any) {
        console.error(
          `エラー: ワークフローの実行に失敗しました [error=${error.message}]`
        );
        process.exit(1);
      }

      await connection.quit();
      process.exit(0);
    }

    console.error(`エラー: 不明なサブコマンド: ${sub}`);
    console.error("使用可能なコマンド: flowise, codex, claude, gemini, flow-<name>");
    process.exit(1);
  });

/**
 * status コマンド
 * キューの状態を確認する
 */
program
  .command("status")
  .description("キューの状態を確認する")
  .action(async () => {
    try {
      const waiting = await Q.getWaitingCount();
      const active = await Q.getActiveCount();
      const completed = await Q.getCompletedCount();
      const failed = await Q.getFailedCount();

      console.log({
        waiting,
        active,
        completed,
        failed,
      });
    } catch (error: any) {
      console.error(`エラー: ステータスの取得に失敗しました [error=${error.message}]`);
      process.exit(1);
    }

    await connection.quit();
    process.exit(0);
  });

program.parse();

