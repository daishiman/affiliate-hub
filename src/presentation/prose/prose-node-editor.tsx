"use client";
import { CALLOUT_TONES, CTA_TONES, type ProseCalloutTone, type ProseCtaTone, type ProseNode, assertNever, safeEmbedUrl, safeHref } from "@/domain/blogops";
import { Icon } from "@/presentation/ui";
import { RichText } from "./rich-text";
import { CALLOUT_PRESENTATION, CTA_PRESENTATION } from "./prose-presentation";
import { PlainField, UrlField } from "./prose-fields";
import { ItemsEditor, ChecklistEditor, CodeEditor, TableEditor } from "./prose-collection-editors";
import { ProductPicker, ImageField, ImageRowEditor, type ProductPick } from "./prose-asset-fields";
import styles from "./prose.module.css";

export function NodeEditor({
  node,
  onChange,
  onSlash,
  onSlashClosed,
  onSearchProducts,
  onUploadImage,
  onSplit,
  productOptions,
}: {
  readonly node: ProseNode;
  readonly onChange: (next: ProseNode | ((current: ProseNode) => ProseNode)) => void;
  readonly onSplit: (before: string, after: string) => void;
  readonly productOptions?: readonly ProductPick[];
  readonly onSlash: (query: string) => void;
  readonly onSlashClosed: () => void;
  readonly onSearchProducts?: (query: string) => Promise<readonly ProductPick[]>;
  readonly onUploadImage?: (file: File) => Promise<string>;
}) {
  switch (node.kind) {
    case "paragraph":
      return (
        <RichText
          ariaLabel="段落"
          onSlash={onSlash}
          onSlashClosed={onSlashClosed}
          onSplit={onSplit}
          onValueChange={(text) => onChange({ kind: "paragraph", text })}
          placeholder="ここに本文を書きます（/ で部品を足せます）"
          value={node.text}
        />
      );

    case "heading":
      return (
        <div className={styles.proseEditorInline}>
          {/*
            選べるのは 3 と 4 だけ。節の見出しは 2 で固定されていて、
            この欄からは触れない (FRONT-REQ-008)。
          */}
          <select
            aria-label="小見出しの深さ"
            className={styles.proseEditorSelect}
            onChange={(e) => onChange({ ...node, level: e.target.value === "4" ? 4 : 3 })}
            value={String(node.level)}
          >
            <option value="3">大きい小見出し</option>
            <option value="4">小さい小見出し</option>
          </select>
          <RichText
            ariaLabel="小見出しの文言"
            className={
              node.level === 3 ? styles.proseEditorHeading3 : styles.proseEditorHeading4
            }
            onValueChange={(text) => onChange({ ...node, text })}
            placeholder="小見出し"
            value={node.text}
          />
        </div>
      );

    case "bullet-list":
    case "ordered-list":
      return (
        <ItemsEditor
          items={node.items}
          onItemsChange={(items) => onChange({ ...node, items })}
          ordered={node.kind === "ordered-list"}
        />
      );

    case "quote":
      return (
        <RichText
          ariaLabel="引用"
          className={styles.proseEditorQuote}
          multiline
          onValueChange={(text) => onChange({ kind: "quote", text })}
          placeholder="引用する文"
          value={node.text}
        />
      );

    case "callout":
      return (
        <div className={[styles.proseCallout, styles.proseEditorCallout, CALLOUT_PRESENTATION[node.tone].className].join(" ")}>
          <Icon name={CALLOUT_PRESENTATION[node.tone].icon} size="md" />
          <div>
            <div className={styles.proseEditorInline}>
              <select
                aria-label="注意書きの調子"
                className={styles.proseEditorSelect}
                onChange={(e) =>
                  onChange({ ...node, tone: e.target.value as ProseCalloutTone })
                }
                value={node.tone}
              >
                {CALLOUT_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {CALLOUT_PRESENTATION[tone].label}
                  </option>
                ))}
              </select>
              <RichText
                ariaLabel="注意書きの題名"
                className={styles.proseEditorHeading4}
                onValueChange={(title) => onChange({ ...node, title })}
                placeholder="題名"
                value={node.title}
              />
            </div>
            <RichText
              ariaLabel="注意書きの本文"
              multiline
              onValueChange={(text) => onChange({ ...node, text })}
              placeholder="伝えたいこと"
              value={node.text}
            />
          </div>
        </div>
      );

    case "product-card":
      return (
        <ProductPicker
          onPick={(id) => onChange({ kind: "product-card", productId: id })}
          onSearch={onSearchProducts}
          productId={node.productId}
          productOptions={productOptions}
        />
      );

    case "comparison-table":
    case "table":
      return <TableEditor node={node} onChange={onChange} />;

    case "image":
      return (
        <ImageField
          alt={node.alt}
          ariaPrefix="画像"
          onChange={(image) => onChange((current) => current.kind === "image" ? { ...current, ...image } : current)}
          onUpload={onUploadImage}
          src={node.src}
        />
      );

    case "divider":
      return <hr className={styles.proseDivider} />;

    case "code":
      return <CodeEditor node={node} onChange={onChange} />;

    case "image-row":
      return (
        <ImageRowEditor
          images={node.images}
          onImagesChange={(update) => onChange((current) => current.kind === "image-row" ? { ...current, images: update(current.images) } : current)}
          onUpload={onUploadImage}
        />
      );

    case "toggle":
      return (
        <div className={styles.proseEditorStack}>
          <RichText
            ariaLabel="折りたたみの見出し"
            className={styles.proseEditorHeading4}
            onValueChange={(title) => onChange({ ...node, title })}
            placeholder="開く前に見える言葉"
            value={node.title}
          />
          <RichText
            ariaLabel="折りたたみの中身"
            multiline
            onValueChange={(text) => onChange({ ...node, text })}
            placeholder="開いたら見える言葉"
            value={node.text}
          />
        </div>
      );

    case "checklist":
      return (
        <ChecklistEditor
          items={node.items}
          onItemsChange={(items) => onChange({ ...node, items })}
        />
      );

    case "embed":
      return (
        <div className={styles.proseEditorStack}>
          <UrlField
            ariaLabel="埋め込みの宛先"
            check={safeEmbedUrl}
            hint="YouTube・Vimeo・Spotify・Google マップだけを埋め込めます。"
            onValueChange={(url) => onChange({ ...node, url })}
            placeholder="https://www.youtube.com/embed/..."
            value={node.url}
          />
          <PlainField
            ariaLabel="埋め込みの名前（読み上げに使われます）"
            onValueChange={(title) => onChange({ ...node, title })}
            placeholder="何の埋め込みか"
            value={node.title}
          />
        </div>
      );

    case "cta-button":
      return (
        <div className={styles.proseEditorStack}>
          <UrlField
            ariaLabel="ボタンの行き先"
            check={safeHref}
            hint="行き先が無いボタンは保存されません。"
            onValueChange={(href) => onChange({ ...node, href })}
            placeholder="/s/... または https://..."
            value={node.href}
          />
          <PlainField
            ariaLabel="ボタンの文言"
            onValueChange={(label) => onChange({ ...node, label })}
            placeholder="詳しく見る"
            value={node.label}
          />
          <select
            aria-label="ボタンの目立ち方"
            className={styles.proseEditorSelect}
            onChange={(e) => onChange({ ...node, tone: e.target.value as ProseCtaTone })}
            value={node.tone}
          >
            {CTA_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {CTA_PRESENTATION[tone].label}
              </option>
            ))}
          </select>
        </div>
      );

    case "link-card":
      return (
        <div className={styles.proseEditorStack}>
          <UrlField
            ariaLabel="リンクカードの行き先"
            check={safeHref}
            hint="見出しと説明は自分で書きます（相手のページからは取ってきません）。"
            onValueChange={(url) => onChange({ ...node, url })}
            placeholder="https://..."
            value={node.url}
          />
          <PlainField
            ariaLabel="リンクカードの見出し"
            onValueChange={(title) => onChange({ ...node, title })}
            placeholder="行き先の見出し"
            value={node.title}
          />
          <PlainField
            ariaLabel="リンクカードの説明"
            onValueChange={(description) => onChange({ ...node, description })}
            placeholder="どんなページか"
            value={node.description}
          />
        </div>
      );

    case "columns":
      return (
        <div className={styles.proseEditorColumns}>
          <RichText
            ariaLabel="左の段"
            multiline
            onValueChange={(left) => onChange({ ...node, left })}
            placeholder="左に置く文章"
            value={node.left}
          />
          <RichText
            ariaLabel="右の段"
            multiline
            onValueChange={(right) => onChange({ ...node, right })}
            placeholder="右に置く文章"
            value={node.right}
          />
        </div>
      );
  }
  return assertNever(node, "編集できない本文断片です");
}
