/**
 * WebMCP (W3C 提案中の navigator.modelContext) の最小型定義。
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
  interface Navigator {
    modelContext?: ModelContext;
  }
}
