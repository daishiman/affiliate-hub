import {
  serializeJsonLd,
  type JsonLdObject,
} from "@/application/seo/structured-data";

/**
 * Next.js公式推奨どおり、構造化データをnative scriptとして描く小さな境界。
 * 全呼び出しを `serializeJsonLd` に強制し、`<` を含む値のscript終端注入を防ぐ。
 */
export function JsonLdScript({ value }: { readonly value: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd が < を \u003c に逃がした JSON のみを埋める
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }}
    />
  );
}
