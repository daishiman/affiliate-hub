"use client";

import { useEffect } from "react";
import {
  registerWebMcpTools,
  webMcpToolsFrom,
  type ModelContextLike,
  type WebMcpDescriptor,
} from "../tools/webmcp-adapter";

/**
 * ページを開いている AI に、そのページでできることを知らせる。
 *
 * 何も描画しない。ブラウザが対応していなければ何もしないので、
 * 通常の画面操作はそのまま使える（対応していないと壊れる、を作らない）。
 *
 * 正規の登録先は `document.modelContext`（ブログ層 §14.1）。
 * `navigator.modelContext` は Chrome 150 で非推奨になった旧経路で、
 * 古いブラウザを救うためだけに後ろへ置く。
 */
declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
  /** @deprecated Chrome 150 で非推奨。互換検出のためだけに宣言する。 */
  interface Navigator {
    modelContext?: ModelContextLike;
  }
}

function resolveModelContext(): ModelContextLike | undefined {
  if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
  if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
  return undefined;
}

export function WebMcpProvider({
  /**
   * このページで使えるものだけを渡す。
   * サーバー側で読み取り専用・上限件数まで絞った一覧が来る。
   */
  descriptors,
}: {
  readonly descriptors: readonly WebMcpDescriptor[];
}) {
  useEffect(() => {
    return registerWebMcpTools(resolveModelContext(), webMcpToolsFrom(descriptors));
  }, [descriptors]);
  return null;
}
