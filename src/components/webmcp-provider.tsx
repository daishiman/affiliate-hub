"use client";

import { useEffect } from "react";

import { registerWebMcpTools } from "@/lib/webmcp/client";

/**
 * ページ内 AI エージェント向けに WebMCP ツールを公開するだけのコンポーネント。
 * DOM は描画しない。
 */
export function WebMcpProvider() {
  useEffect(() => registerWebMcpTools(), []);
  return null;
}
