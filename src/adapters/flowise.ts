/**
 * Flowiseアダプタ
 * Flowiseの公開エンドポイントをcurlで呼び出す
 * 
 * @module adapters/flowise
 */

import { execa } from "execa";

/**
 * curlコマンドの引数を構築する
 * @param url FlowiseのエンドポイントURL
 * @param body リクエストボディ（JSONオブジェクト）
 * @param apiKey FlowiseのAPIキー（オプション）
 * @returns curlコマンドの引数配列
 */
function buildCurlArgs(url: string, body: any, apiKey?: string): string[] {
  const args = [
    "-sS",
    "-X",
    "POST",
    url,
    "-H",
    "content-type: application/json",
    "-d",
    JSON.stringify(body),
  ];

  if (apiKey) {
    args.push("-H", `Authorization: Bearer ${apiKey}`);
  }

  return args;
}

/**
 * Flowiseの公開エンドポイントを叩く（curl 子プロセスでAPI不要の方針を維持）
 * 
 * @param flowId Flowise側で公開されたフローID
 * @param variables フローに渡すパラメータ（変数）
 * @param options mode: 提供UIに合わせて "chat" | "prompt" など。未指定なら "prompt"
 * @returns Flowiseのレスポンス（rawとtextを抽出）
 * @throws エラー発生時は詳細なエラーメッセージを出力
 */
export async function callFlowise(
  flowId: string,
  variables: Record<string, any>,
  options?: { mode?: string }
): Promise<{ raw: any; text: string }> {
  const base = process.env.QEZU_FLOWISE_URL || "http://127.0.0.1:3000/api/v1/prediction/";
  const apiKey = process.env.QEZU_FLOWISE_KEY;
  const url = `${base}${flowId}`;

  // Flowiseのtypical body（必要に応じて合わせてください）
  const body: any = {
    question:
      options?.mode === "chat"
        ? variables.question ?? JSON.stringify(variables)
        : JSON.stringify(variables),
    overrideConfig: {}, // Model設定上書きしたい場合はここに
    // metadata: { ... }  // 必要に応じて
  };

  try {
    const { stdout, stderr } = await execa("curl", buildCurlArgs(url, body, apiKey));

    if (stderr && !stdout) {
      throw new Error(
        `Flowise呼び出しエラー [flowId=${flowId}, url=${url}, stderr=${stderr}]`
      );
    }

    // Flowiseのレスポンス形式に合わせて抽出
    try {
      const json = JSON.parse(stdout);
      // 代表的なケース： { text: "...", ... } または { data: "...", ... }
      const text = json.text ?? json.data ?? stdout;
      return { raw: json, text: String(text) };
    } catch (parseError) {
      // JSONパース失敗時はstdoutをそのまま返す
      return { raw: stdout, text: stdout };
    }
  } catch (error: any) {
    const errorMessage = `callFlowiseエラー [flowId=${flowId}, url=${url}, variables=${JSON.stringify(variables)}, mode=${options?.mode}, error=${error.message}]`;
    throw new Error(errorMessage);
  }
}

