/**
 * Codex CLIアダプタ
 * Codex CLIを実行して結果を取得する
 * 
 * @module adapters/codex
 */

import { execa } from "execa";

/**
 * Codex CLIを実行する
 * 
 * @param command Codex CLIのコマンド（例: "generate", "complete"）
 * @param args コマンド引数
 * @param options オプション設定
 * @returns Codex CLIの実行結果
 * @throws エラー発生時は詳細なエラーメッセージを出力
 */
export async function callCodex(
  command: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const codexCmd = process.env.CODEX_CLI_PATH || "codex";
  // コマンドが空の場合は引数のみを使用
  const fullArgs = command ? [command, ...args] : args;

  try {
    const result = await execa(codexCmd, fullArgs, {
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
    const errorMessage = `Codex CLI実行エラー [command=${command}, args=${JSON.stringify(args)}, error=${error.message}, exitCode=${error.exitCode}]`;
    throw new Error(errorMessage);
  }
}

/**
 * Codex CLIでコード生成を実行する
 * 
 * @param prompt 生成プロンプト
 * @param options オプション設定
 * @returns 生成されたコード
 */
export async function generateCode(
  prompt: string,
  options?: {
    language?: string;
    maxTokens?: number;
    temperature?: number;
    cwd?: string;
  }
): Promise<string> {
  // Codex CLIは直接プロンプトを受け取るか、execコマンドを使用
  // オプションは --config で設定
  const args: string[] = ["--skip-git-repo-check"];

  if (options?.language) {
    args.push("--config", `language=${options.language}`);
  }
  if (options?.maxTokens) {
    args.push("--config", `maxTokens=${options.maxTokens}`);
  }
  if (options?.temperature !== undefined) {
    args.push("--config", `temperature=${options.temperature}`);
  }

  // Codexは直接プロンプトを引数として受け取る
  args.push(prompt);

  const result = await callCodex("exec", args, { cwd: options?.cwd });
  return result.stdout;
}

/**
 * Codex CLIでストリーミング実行（文字単位で出力を取得）
 */
export async function* generateCodeStream(
  prompt: string,
  options?: {
    language?: string;
    maxTokens?: number;
    temperature?: number;
    cwd?: string;
  }
): AsyncGenerator<string, void, unknown> {
  const { execa } = await import("execa");
  const codexCmd = process.env.CODEX_CLI_PATH || "codex";
  const args: string[] = ["exec", "--skip-git-repo-check"];

  if (options?.language) {
    args.push("--config", `language=${options.language}`);
  }
  if (options?.maxTokens) {
    args.push("--config", `maxTokens=${options.maxTokens}`);
  }
  if (options?.temperature !== undefined) {
    args.push("--config", `temperature=${options.temperature}`);
  }

  args.push(prompt);

  const childProcess = execa(codexCmd, args, {
    cwd: options?.cwd || process.cwd(),
    env: {
      ...process.env,
    },
    timeout: options?.maxTokens ? options.maxTokens * 100 : 300000,
    shell: false,
  });

  // stdoutをストリーミングで読み取る
  if (childProcess.stdout) {
    // Node.jsのReadableストリームを非同期イテレータとして扱う
    for await (const chunk of childProcess.stdout) {
      const text = chunk.toString();
      // 1文字ずつ送信
      for (const char of text) {
        yield char;
      }
    }
  }

  await childProcess;
}

/**
 * Codex CLIでコード補完を実行する
 * 
 * @param code 補完対象のコード
 * @param options オプション設定
 * @returns 補完されたコード
 */
export async function completeCode(
  code: string,
  options?: {
    language?: string;
    maxTokens?: number;
    cwd?: string;
  }
): Promise<string> {
  const args: string[] = ["--skip-git-repo-check"];

  if (options?.language) {
    args.push("--config", `language=${options.language}`);
  }
  if (options?.maxTokens) {
    args.push("--config", `maxTokens=${options.maxTokens}`);
  }

  // コード補完のプロンプト
  args.push(`Complete this code: ${code}`);

  const result = await callCodex("exec", args, { cwd: options?.cwd });
  return result.stdout;
}

