/**
 * Claude CLIアダプタ
 * Claude CLIを実行して結果を取得する
 * 
 * @module adapters/claude
 */

import { execa } from "execa";

/**
 * Claude CLIを実行する
 * 
 * @param command Claude CLIのコマンド（例: "chat", "complete"）
 * @param args コマンド引数
 * @param options オプション設定
 * @returns Claude CLIの実行結果
 * @throws エラー発生時は詳細なエラーメッセージを出力
 */
export async function callClaude(
  command: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const claudeCmd = process.env.CLAUDE_CLI_PATH || "claude";
  // コマンドが空の場合は引数のみを使用
  const fullArgs = command ? [command, ...args] : args;

  try {
    const result = await execa(claudeCmd, fullArgs, {
      cwd: options?.cwd || process.cwd(),
      env: {
        ...process.env,
        ...options?.env,
      },
      timeout: options?.timeout || 1200000, // デフォルト20分（スライド生成を考慮）
      shell: false,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr || "",
      exitCode: result.exitCode || 0,
    };
  } catch (error: any) {
    const errorMessage = `Claude CLI実行エラー [command=${command}, args=${JSON.stringify(args)}, error=${error.message}, exitCode=${error.exitCode}]`;
    throw new Error(errorMessage);
  }
}

/**
 * Claude CLIでチャットを実行する
 * 
 * @param message メッセージ
 * @param options オプション設定
 * @returns Claudeの応答
 */
export async function chatWithClaude(
  message: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    cwd?: string;
    timeout?: number;
  }
): Promise<string> {
  const args: string[] = ["--print"];

  if (options?.model) {
    args.push("--model", options.model);
  }

  // Claudeは直接プロンプトを引数として受け取る
  args.push(message);

  const result = await callClaude("", args, { 
    cwd: options?.cwd,
    timeout: options?.timeout || 1200000, // デフォルト20分
  });
  return result.stdout;
}

/**
 * Claude CLIでコード生成を実行する
 * 
 * @param prompt 生成プロンプト
 * @param options オプション設定
 * @returns 生成されたコード
 */
export async function generateCodeWithClaude(
  prompt: string,
  options?: {
    language?: string;
    model?: string;
    maxTokens?: number;
    cwd?: string;
  }
): Promise<string> {
  const args: string[] = ["--print"];

  if (options?.model) {
    args.push("--model", options.model);
  }

  // コード生成のプロンプト
  const codePrompt = options?.language
    ? `Generate ${options.language} code: ${prompt}`
    : `Generate code: ${prompt}`;

  args.push(codePrompt);

  const result = await callClaude("", args, { cwd: options?.cwd });
  return result.stdout;
}

