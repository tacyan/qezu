/**
 * マルチエージェントオーケストレーター
 * 複数のエージェント（Codex、Claude、Gemini）を並列で実行し、結果を統合する
 * 
 * @module services/agent-orchestrator
 */

import { generateCode } from "../adapters/codex.js";
import { chatWithClaude, generateCodeWithClaude } from "../adapters/claude.js";
import { chatWithGemini, generateCodeWithGemini } from "../adapters/gemini.js";

/**
 * エージェントの実行結果
 */
export interface AgentResult {
  agent: string;
  success: boolean;
  result?: string;
  error?: string;
  executionTime: number;
}

/**
 * タスクの種類
 */
export type TaskType = "code-generation" | "chat" | "code-completion" | "general" | "slide";

/**
 * マルチエージェント実行オプション
 */
export interface MultiAgentOptions {
  taskType?: TaskType;
  language?: string;
  model?: {
    codex?: string;
    claude?: string;
    gemini?: string;
  };
  agents?: ("codex" | "claude" | "gemini")[];
  timeout?: number;
}

/**
 * マルチエージェントを並列実行して結果を統合する
 * 
 * @param prompt 実行するプロンプト
 * @param options 実行オプション
 * @returns 各エージェントの結果と統合結果
 */
export async function executeMultiAgent(
  prompt: string,
  options: MultiAgentOptions = {}
): Promise<{
  results: AgentResult[];
  aggregated: string;
  summary: {
    total: number;
    success: number;
    failed: number;
    averageTime: number;
  };
}> {
  const {
    taskType = "general",
    language,
    model = {},
    agents = ["codex", "claude", "gemini"],
    timeout = 300000,
  } = options;

  const startTime = Date.now();
  const tasks: Promise<AgentResult>[] = [];

  // Codexエージェントの実行
  if (agents.includes("codex")) {
    tasks.push(
      (async (): Promise<AgentResult> => {
        const taskStart = Date.now();
        try {
          let result: string;

          if (taskType === "code-generation" || taskType === "code-completion") {
            result = await generateCode(prompt, {
              language,
              maxTokens: 2000,
              cwd: process.cwd(),
            });
          } else {
            // 一般的なタスクもコード生成として扱う
            result = await generateCode(prompt, {
              language: language || "typescript",
              maxTokens: 2000,
              cwd: process.cwd(),
            });
          }

          return {
            agent: "codex",
            success: true,
            result,
            executionTime: Date.now() - taskStart,
          };
        } catch (error: any) {
          return {
            agent: "codex",
            success: false,
            error: error.message,
            executionTime: Date.now() - taskStart,
          };
        }
      })()
    );
  }

  // Claudeエージェントの実行
  if (agents.includes("claude")) {
    tasks.push(
      (async (): Promise<AgentResult> => {
        const taskStart = Date.now();
        try {
          let result: string;

          if (taskType === "code-generation") {
            result = await generateCodeWithClaude(prompt, {
              language,
              model: model.claude || "claude-3-opus",
              cwd: process.cwd(),
            });
          } else {
            result = await chatWithClaude(prompt, {
              model: model.claude || "claude-3-opus",
              cwd: process.cwd(),
            });
          }

          return {
            agent: "claude",
            success: true,
            result,
            executionTime: Date.now() - taskStart,
          };
        } catch (error: any) {
          return {
            agent: "claude",
            success: false,
            error: error.message,
            executionTime: Date.now() - taskStart,
          };
        }
      })()
    );
  }

  // Geminiエージェントの実行
  if (agents.includes("gemini")) {
    tasks.push(
      (async (): Promise<AgentResult> => {
        const taskStart = Date.now();
        try {
          let result: string;

          if (taskType === "code-generation") {
            result = await generateCodeWithGemini(prompt, {
              language,
              model: model.gemini || "gemini-pro",
              cwd: process.cwd(),
            });
          } else {
            result = await chatWithGemini(prompt, {
              model: model.gemini || "gemini-pro",
              cwd: process.cwd(),
            });
          }

          return {
            agent: "gemini",
            success: true,
            result,
            executionTime: Date.now() - taskStart,
          };
        } catch (error: any) {
          return {
            agent: "gemini",
            success: false,
            error: error.message,
            executionTime: Date.now() - taskStart,
          };
        }
      })()
    );
  }

  // タイムアウト付きで並列実行
  const timeoutPromise = new Promise<AgentResult[]>((resolve) => {
    setTimeout(() => resolve([]), timeout);
  });

  const resultsPromise = Promise.all(tasks);
  const results = await Promise.race([resultsPromise, timeoutPromise]);

  // 結果の統合
  const successfulResults = results.filter((r) => r.success && r.result);
  const aggregated = successfulResults
    .map((r, idx) => `## ${r.agent.toUpperCase()}\n\n${r.result}`)
    .join("\n\n---\n\n");

  const summary = {
    total: results.length,
    success: successfulResults.length,
    failed: results.length - successfulResults.length,
    averageTime:
      results.reduce((sum, r) => sum + r.executionTime, 0) / results.length || 0,
  };

  return {
    results: results as AgentResult[],
    aggregated: aggregated || "すべてのエージェントが失敗しました",
    summary,
  };
}

