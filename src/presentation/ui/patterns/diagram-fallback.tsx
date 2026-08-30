import styles from "./diagram-fallback.module.css";

/** 第三者の商品写真を複製せず、「リンクの確認」を図で示す。 */
export function DiagramFallback({ label = "成果リンク" }: { readonly label?: string }) {
  return (
    <div className={styles.diagram} role="img" aria-label={`${label}の図解プレビュー`}>
      <svg viewBox="0 0 240 140" aria-hidden="true" focusable="false">
        <rect x="18" y="24" width="68" height="42" rx="10" />
        <rect x="154" y="74" width="68" height="42" rx="10" />
        <path d="M86 45h38c16 0 30 13 30 29" />
        <path d="m145 68 9 10 10-9" />
        <circle cx="52" cy="45" r="8" />
        <path d="M176 94h24M188 82v24" />
      </svg>
      <span>写真の代わりに、独自の図解で確認します</span>
    </div>
  );
}
