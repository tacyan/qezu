/**
 * Gemini CLIアダプタ
 * Gemini CLIを実行して結果を取得する
 * 
 * @module adapters/gemini
 */

import { execa } from "execa";

/**
 * Gemini CLIを実行する
 * 
 * @param command Gemini CLIのコマンド（例: "chat", "generate"）
 * @param args コマンド引数
 * @param options オプション設定
 * @returns Gemini CLIの実行結果
 * @throws エラー発生時は詳細なエラーメッセージを出力
 */
export async function callGemini(
  command: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const geminiCmd = process.env.GEMINI_CLI_PATH || "gemini";
  // コマンドが空の場合は引数のみを使用
  const fullArgs = command ? [command, ...args] : args;

  try {
    const result = await execa(geminiCmd, fullArgs, {
      cwd: options?.cwd || process.cwd(),
      env: {
        ...process.env,
        ...options?.env,
      },
      timeout: options?.timeout || 300000, // デフォルト5分
      shell: false,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr || "",
      exitCode: result.exitCode || 0,
    };
  } catch (error: any) {
    const errorMessage = `Gemini CLI実行エラー [command=${command}, args=${JSON.stringify(args)}, error=${error.message}, exitCode=${error.exitCode}]`;
    throw new Error(errorMessage);
  }
}

/**
 * Gemini CLIでチャットを実行する
 * 
 * @param message メッセージ
 * @param options オプション設定
 * @returns Geminiの応答
 */
export async function chatWithGemini(
  message: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    cwd?: string;
  }
): Promise<string> {
  const args: string[] = [];

  if (options?.model) {
    args.push("--model", options.model);
  }

  // Geminiは直接プロンプトを引数として受け取る
  args.push(message);

  const result = await callGemini("", args, { cwd: options?.cwd });
  return result.stdout;
}

/**
 * Gemini CLIでコード生成を実行する
 * 
 * @param prompt 生成プロンプト
 * @param options オプション設定
 * @returns 生成されたコード
 */
export async function generateCodeWithGemini(
  prompt: string,
  options?: {
    language?: string;
    model?: string;
    maxTokens?: number;
    cwd?: string;
  }
): Promise<string> {
  const args: string[] = [];

  if (options?.model) {
    args.push("--model", options.model);
  }

  // コード生成のプロンプト
  const codePrompt = options?.language
    ? `Generate ${options.language} code: ${prompt}`
    : `Generate code: ${prompt}`;

  args.push(codePrompt);

  const result = await callGemini("", args, { cwd: options?.cwd });
  return result.stdout;
}

