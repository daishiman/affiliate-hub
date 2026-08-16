/**
 * WebMCP (W3C 提案中の `document.modelContext`) の最小型定義。
 *
 * ブログ層仕様 §14.1 に従い、正規の取得先は `document.modelContext` とする。
 * `navigator.modelContext` は Chrome 150 で非推奨になった旧経路で、
 * 互換のためだけに legacy fallback として残している (新規実装では使わない)。
 *
 * 仕様が固まっておらずブラウザ実装も限定的なため、@types には存在しない。
 * 実装差分を吸収できるよう registerTool / provideContext の両方を任意にしている。
 */
export type WebMcpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>;
};

export type ModelContext = {
  /** ツールを1件ずつ登録する。戻り値は登録解除用の関数(実装により異なる)。 */
  registerTool?: (tool: WebMcpTool) => (() => void) | void;
  /** ツール一覧をまとめて宣言する。 */
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }

  /** @deprecated Chrome 150 で非推奨。互換検出のためだけに宣言する。 */
  interface Navigator {
    modelContext?: ModelContext;
  }
}
