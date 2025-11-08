/**
 * Webサーバー
 * Express.jsでREST APIとWeb UIを提供
 * 
 * @module server
 */

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { executeMultiAgent, MultiAgentOptions } from "./services/agent-orchestrator.js";
import { parseSlidesFromMarkdown, generateSlideHTML, generateMarpMarkdown, SlideDeck } from "./services/slide-generator.js";
import { IncrementalSlideParser } from "./services/incremental-slide-parser.js";

// 環境変数を読み込み
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイルの配信
app.use(express.static(join(__dirname, "../public")));

/**
 * ヘルスチェックエンドポイント
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * マルチエージェント実行エンドポイント（ストリーミング版）
 * 
 * POST /api/execute/stream
 * Body: {
 *   prompt: string,
 *   taskType?: "code-generation" | "chat" | "code-completion" | "general" | "slide",
 *   language?: string,
 *   agents?: ("codex" | "claude" | "gemini")[],
 *   model?: { codex?: string, claude?: string, gemini?: string },
 *   timeout?: number
 * }
 */
app.post("/api/execute/stream", async (req, res) => {
  try {
    const { prompt, taskType, language, agents, model, timeout } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "prompt is required and must be a string",
      });
    }

    const options: MultiAgentOptions = {
      taskType: taskType || "general",
      language,
      model,
      agents: agents || ["codex", "claude", "gemini"],
      timeout: timeout || 300000,
    };

    // SSE設定
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log(`[Server] マルチエージェント実行開始（ストリーミング） [prompt=${prompt.substring(0, 50)}..., agents=${options.agents?.join(",")}]`);

    sendEvent("start", { message: "マルチエージェント実行を開始しました", prompt, options });

    const startTime = Date.now();
    const agentResults: any[] = [];
    const slideParsers = new Map<string, IncrementalSlideParser>();

    // 各エージェントを並列実行
    const agentPromises = options.agents?.map(async (agentName) => {
      // スライド生成の場合はインクリメンタルパーサーを初期化
      if (taskType === "slide") {
        slideParsers.set(agentName, new IncrementalSlideParser());
      }
      const agentStartTime = Date.now();
      sendEvent("agent-start", { agent: agentName, message: `${agentName}の実行を開始しました` });

      try {
        let result: string;
        const agentOptions = { language, cwd: process.cwd() };

        if (agentName === "codex") {
          const { generateCode, generateCodeStream } = await import("./adapters/codex.js");
          if (taskType === "slide") {
            // スライド生成の場合はストリーミングで実行
            let streamedResult = "";
            const slidePrompt = `Create a slide deck presentation about: ${prompt}. Format each slide with ## Slide Title followed by content. Use --- to separate slides.`;
            const parser = slideParsers.get(agentName);
            
            try {
              for await (const chunk of generateCodeStream(slidePrompt, {
                ...agentOptions,
                maxTokens: 4000,
              })) {
                streamedResult += chunk;
                // インクリメンタルパーサーでスライドを更新
                if (parser) {
                  const partialSlides = parser.append(chunk);
                  if (partialSlides.length > 0) {
                    const partialSlideDeck = parser.getSlideDeck(prompt.substring(0, 50) + "...");
                    // Marp形式のMarkdownを生成
                    partialSlideDeck.marpMarkdown = generateMarpMarkdown(partialSlideDeck);
                    sendEvent("slide-stream", {
                      agent: agentName,
                      chunk,
                      currentText: streamedResult,
                      slideDeck: partialSlideDeck,
                    });
                  }
                }
              }
              result = streamedResult;
            } catch (streamError: any) {
              // ストリーミングが失敗した場合は通常の方法で実行
              console.error(`[Server] ストリーミングエラー [agent=${agentName}, error=${streamError.message}]`);
              result = await generateCode(slidePrompt, {
                ...agentOptions,
                maxTokens: 4000,
              });
            }
          } else {
            result = await generateCode(prompt, {
              ...agentOptions,
              maxTokens: 2000,
            });
          }
        } else if (agentName === "claude") {
          const { chatWithClaude, generateCodeWithClaude } = await import("./adapters/claude.js");
          if (taskType === "slide") {
            result = await chatWithClaude(`Create a slide deck presentation about: ${prompt}. Format each slide with ## Slide Title followed by content. Use --- to separate slides. Generate 10-16 slides.`, {
              model: model?.claude || "claude-3-opus",
              cwd: process.cwd(),
            });
          } else if (taskType === "code-generation") {
            result = await generateCodeWithClaude(prompt, {
              ...agentOptions,
              model: model?.claude || "claude-3-opus",
            });
          } else {
            result = await chatWithClaude(prompt, {
              model: model?.claude || "claude-3-opus",
              cwd: process.cwd(),
            });
          }
        } else if (agentName === "gemini") {
          const { chatWithGemini, generateCodeWithGemini } = await import("./adapters/gemini.js");
          try {
            if (taskType === "slide") {
              result = await chatWithGemini(`Create a slide deck presentation about: ${prompt}. Format each slide with ## Slide Title followed by content. Use --- to separate slides. Generate 10-16 slides.`, {
                model: model?.gemini || "gemini-pro",
                cwd: process.cwd(),
              });
            } else if (taskType === "code-generation") {
              result = await generateCodeWithGemini(prompt, {
                ...agentOptions,
                model: model?.gemini || "gemini-pro",
              });
            } else {
              result = await chatWithGemini(prompt, {
                model: model?.gemini || "gemini-pro",
                cwd: process.cwd(),
              });
            }
          } catch (error: any) {
            // GeminiのAPIキーエラーの場合、より分かりやすいメッセージを表示
            if (error.message.includes("Auth method") || error.message.includes("GEMINI_API_KEY")) {
              throw new Error("Gemini APIキーが設定されていません。環境変数 GEMINI_API_KEY を設定するか、~/.gemini/settings.json を設定してください。");
            }
            throw error;
          }
        } else {
          throw new Error(`Unknown agent: ${agentName}`);
        }

        const executionTime = Date.now() - agentStartTime;
        const agentResult = {
          agent: agentName,
          success: true,
          result,
          executionTime,
        };

        agentResults.push(agentResult);
        sendEvent("agent-complete", {
          agent: agentName,
          message: `${agentName}の実行が完了しました`,
          executionTime,
          result: result.substring(0, 200) + (result.length > 200 ? "..." : ""),
        });

        // スライド生成の場合、最初の成功した結果でスライドを生成
        if (taskType === "slide") {
          try {
            const slides = parseSlidesFromMarkdown(result);
            if (slides.length > 0) {
              const slideDeck: SlideDeck = {
                title: prompt.substring(0, 50) + "...",
                slides,
                createdAt: new Date().toISOString(),
              };
              // Marp形式のMarkdownを生成
              slideDeck.marpMarkdown = generateMarpMarkdown(slideDeck);
              sendEvent("slide-generated", {
                message: `${agentName}からスライドが生成されました（${slides.length}枚）`,
                agent: agentName,
                slideDeck,
              });
            }
          } catch (error: any) {
            console.error(`[Server] スライド生成エラー [agent=${agentName}, error=${error.message}]`);
          }
        }

        return agentResult;
      } catch (error: any) {
        const executionTime = Date.now() - agentStartTime;
        const agentResult = {
          agent: agentName,
          success: false,
          error: error.message,
          executionTime,
        };

        agentResults.push(agentResult);
        sendEvent("agent-error", {
          agent: agentName,
          message: `${agentName}の実行でエラーが発生しました`,
          error: error.message,
          executionTime,
        });

        return agentResult;
      }
    }) || [];

    // すべてのエージェントの完了を待つ
    await Promise.all(agentPromises);

    const totalTime = Date.now() - startTime;
    const successfulResults = agentResults.filter((r) => r.success && r.result);
    const aggregated = successfulResults
      .map((r, idx) => `## ${r.agent.toUpperCase()}\n\n${r.result}`)
      .join("\n\n---\n\n");

    const summary = {
      total: agentResults.length,
      success: successfulResults.length,
      failed: agentResults.length - successfulResults.length,
      averageTime:
        agentResults.reduce((sum, r) => sum + r.executionTime, 0) / agentResults.length || 0,
      totalExecutionTime: totalTime,
    };

    // スライド生成の場合、スライドを生成
    let slideDeck: SlideDeck | null = null;
    if (taskType === "slide" && successfulResults.length > 0) {
      try {
        const bestResult = successfulResults[0]; // 最初の成功した結果を使用
        const slides = parseSlidesFromMarkdown(bestResult.result);
        slideDeck = {
          title: prompt.substring(0, 50) + "...",
          slides,
          createdAt: new Date().toISOString(),
        };
        // Marp形式のMarkdownを生成
        slideDeck.marpMarkdown = generateMarpMarkdown(slideDeck);
        sendEvent("slide-generated", {
          message: "スライドが生成されました",
          slideDeck,
        });
      } catch (error: any) {
        console.error(`[Server] スライド生成エラー [error=${error.message}]`);
      }
    }

    sendEvent("complete", {
      message: "すべてのエージェントの実行が完了しました",
      results: agentResults,
      aggregated,
      summary,
      slideDeck,
    });

    // 最終結果も送信（クライアント側で処理しやすくするため）
    sendEvent("final", {
      results: agentResults,
      aggregated,
      summary,
      slideDeck,
    });

    res.end();
  } catch (error: any) {
    console.error(`[Server] エラー [error=${error.message}]`);
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * マルチエージェント実行エンドポイント
 * 
 * POST /api/execute
 * Body: {
 *   prompt: string,
 *   taskType?: "code-generation" | "chat" | "code-completion" | "general",
 *   language?: string,
 *   agents?: ("codex" | "claude" | "gemini")[],
 *   model?: { codex?: string, claude?: string, gemini?: string },
 *   timeout?: number
 * }
 */
app.post("/api/execute", async (req, res) => {
  try {
    const { prompt, taskType, language, agents, model, timeout } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "prompt is required and must be a string",
      });
    }

    const options: MultiAgentOptions = {
      taskType: taskType || "general",
      language,
      model,
      agents: agents || ["codex", "claude", "gemini"],
      timeout: timeout || 300000,
    };

    console.log(`[Server] マルチエージェント実行開始 [prompt=${prompt.substring(0, 50)}..., agents=${options.agents?.join(",")}]`);

    const startTime = Date.now();
    const result = await executeMultiAgent(prompt, options);
    const totalTime = Date.now() - startTime;

    console.log(`[Server] マルチエージェント実行完了 [totalTime=${totalTime}ms, success=${result.summary.success}/${result.summary.total}]`);

    res.json({
      success: true,
      prompt,
      options,
      results: result.results,
      aggregated: result.aggregated,
      summary: {
        ...result.summary,
        totalExecutionTime: totalTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[Server] エラー [error=${error.message}]`);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * エージェント一覧取得エンドポイント
 */
app.get("/api/agents", (req, res) => {
  res.json({
    agents: [
      {
        id: "codex",
        name: "Codex",
        description: "OpenAI Codex - コード生成に特化",
        capabilities: ["code-generation", "code-completion"],
      },
      {
        id: "claude",
        name: "Claude",
        description: "Anthropic Claude - 汎用AIアシスタント",
        capabilities: ["code-generation", "chat", "general"],
      },
      {
        id: "gemini",
        name: "Gemini",
        description: "Google Gemini - マルチモーダルAI",
        capabilities: ["code-generation", "chat", "general"],
      },
    ],
  });
});

/**
 * スライドHTML生成エンドポイント
 */
app.post("/api/slides/generate", async (req, res) => {
  try {
    const { slideDeck } = req.body;
    if (!slideDeck || !slideDeck.slides) {
      return res.status(400).json({ error: "slideDeck is required" });
    }
    const html = generateSlideHTML(slideDeck);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    console.error(`[Server] スライド生成エラー [error=${error.message}]`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * サーバー起動
 */
const server = app.listen(PORT, () => {
  console.log(`[Server] サーバー起動 [port=${PORT}]`);
  console.log(`[Server] Web UI: http://localhost:${PORT}`);
  console.log(`[Server] ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`[Server] API実行: http://localhost:${PORT}/api/execute`);
  console.log(`[Server] エージェント一覧: http://localhost:${PORT}/api/agents`);
});

/**
 * サーバーエラーハンドリング
 */
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[Server] エラー: ポート ${PORT} は既に使用されています`);
    console.error(`[Server] 解決方法: ポート ${PORT} を使用しているプロセスを停止するか、環境変数 PORT で別のポートを指定してください`);
    console.error(`[Server] 例: PORT=3001 npm run server`);
    console.error(`[Server] または: npm run kill-port ${PORT}`);
    process.exit(1);
  } else {
    console.error(`[Server] エラー: ${error.message}`);
    process.exit(1);
  }
});

// グレースフルシャットダウン
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM受信、サーバーを停止します");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT受信、サーバーを停止します");
  process.exit(0);
});
