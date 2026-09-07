"use client";
import { useEffect, useId, useRef, useState } from "react";
import { IMAGE_ROW_MAX, IMAGE_ROW_MIN, safeImageSrc, type ProseImage } from "@/domain/blogops";
import { Icon } from "@/presentation/ui";
import { PickList } from "./pick-list";
import { IconButton, PlainField, ProseInputGroup } from "./prose-fields";
import styles from "./prose.module.css";

/** 商品検索の結果 1 件。**本文へ焼き付けるのは id だけ**で、名前や価格は持ち帰らない。 */
export type ProductPick = {
  readonly id: string;
  readonly name: string;
};

/**
 * 商品カードの中身。**id を打つ欄は無い** (受け入れ A4)。
 *
 * 探して選ぶ以外の入り口を作らないので、本文に入る id は
 * 必ずこの作業場に在る商品の id になる。
 */
export function ProductPicker({
  productId,
  onPick,
  onSearch,
  productOptions,
}: {
  readonly productId: string;
  readonly onPick: (id: string) => void;
  readonly onSearch?: (query: string) => Promise<readonly ProductPick[]>;
  readonly productOptions?: readonly ProductPick[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly ProductPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<ProductPick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (onSearch === undefined) return;
    const needle = query.trim();
    if (needle === "") return;
    /*
      打つたびに問い合わせない。**1 文字ごとに投げると、
      打ち終わる頃には要らない返事が何本も返ってくる。**
      片付け関数で待ち時間を取り消すので、最後の 1 本だけが残る。
    */
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      setBusy(true);
      setError(null);
      onSearch(needle)
        .then((found) => {
          if (alive) setHits(found);
        })
        .catch((cause: unknown) => {
          if (alive) {
            setHits([]);
            setError(
              cause instanceof Error && cause.message.trim() !== ""
                ? cause.message
                : "商品を探せませんでした。",
            );
          }
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, onSearch]);

  if (onSearch === undefined) {
    /*
      **探せないなら挿せない。**id を打てる欄をここへ出すと、
      「探せないときだけ手打ち」という抜け道が常設される。
    */
    return <p className={styles.hint}>この画面では商品を探せないため、商品カードは挿せません。</p>;
  }

  if (productId !== "") {
    return (
      <div className={styles.proseEditorInline}>
        <Icon name="proseProductCard" size="md" />
        <span>{productOptions?.find((product) => product.id === productId)?.name ?? (picked?.id === productId ? picked.name : "選択済みの商品")}</span>
        <IconButton
          icon="removeItem"
          label="選んだ商品を外す"
          onClick={() => {
            onPick("");
            setPicked(null);
          }}
        />
      </div>
    );
  }

  return (
    <ProseInputGroup control={{
        "aria-label": "商品を探す",
        id: inputId,
        onChange: (e) => {
          const next = e.target.value;
          setQuery(next);
          setHits([]);
          setError(null);
          setBusy(next.trim() !== "");
        },
        placeholder: "商品の名前で探します", type: "search", value: query,
      }} alert={error !== null} feedback={busy ? "探しています…" : error ?? (query.trim() !== "" && hits.length === 0 ? "見つかりませんでした。" : null)}>
      <PickList
        onPick={(id) => {
          onPick(id);
          setPicked(hits.find((hit) => hit.id === id) ?? null);
        }}
        options={hits.map((hit) => ({
          key: hit.id,
          label: hit.name,
          leading: <Icon name="proseProductCard" size="sm" />,
        }))}
      />
    </ProseInputGroup>
  );
}

/**
 * 画像 1 枚。**URL を打つ欄は無い** (受け入れ A5)。
 *
 * 選んだファイルはブラウザから直に置き場へ送られ、返ってきた場所だけを
 * 本文が持つ。よそのサイトの絵を指せないので、相手が消した日に
 * 記事から絵が消えることがない。
 */
export function ImageField({
  src,
  alt,
  ariaPrefix,
  onChange,
  onUpload,
}: {
  readonly src: string;
  readonly alt: string;
  readonly ariaPrefix: string;
  readonly onChange: (image: ProseImage) => void;
  readonly onUpload?: (file: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const latest = useRef({ onChange, alt });
  useEffect(() => { latest.current = { onChange, alt }; }, [onChange, alt]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  if (onUpload === undefined) {
    return <p className={styles.hint}>この画面では画像を送れないため、画像は挿せません。</p>;
  }

  return (
    <div className={styles.proseEditorStack}>
      {src.trim() === "" ? (
        <ProseInputGroup control={{
            accept: "image/*",
            "aria-label": `${ariaPrefix}に使うファイル`,
            disabled: busy,
            id: inputId,
            onChange: (e) => {
              const file = e.target.files?.[0];
              if (file === undefined) return;
              setBusy(true);
              setError(null);
              onUpload(file)
                .then((url) => { if (mounted.current) latest.current.onChange({ src: url, alt: latest.current.alt }); })
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error && cause.message.trim() !== ""
                      ? cause.message
                      : "送れませんでした。もう一度試してください。",
                  ),
                )
                .finally(() => { if (mounted.current) setBusy(false); });
              e.target.value = "";
            },
            type: "file",
          }} feedback={busy ? "送っています…" : error} alert={error !== null} />
      ) : (
        <>
          {/* 運営者入力の URL は寸法も許可ホストも事前確定できないため、最適化 API を経由しない。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {safeImageSrc(src) !== null ? <img alt={alt} className={styles.proseImage} src={safeImageSrc(src)!} /> : <p className={styles.hint}>この画像は表示できません。画像を外して選び直してください。</p>}
          <IconButton
            icon="removeItem"
            label={`${ariaPrefix}を外す`}
            onClick={() => onChange({ src: "", alt })}
          />
        </>
      )}
      <PlainField
        ariaLabel={`${ariaPrefix}の説明（見えない人へ伝わる言葉）`}
        onValueChange={(next) => onChange({ src, alt: next })}
        placeholder="この絵に何が写っているか"
        value={alt}
      />
    </div>
  );
}

/** 画像の横並び。枚数は 2〜4 (FRONT-REQ-005)。 */
export function ImageRowEditor({
  images,
  onImagesChange,
  onUpload,
}: {
  readonly images: readonly ProseImage[];
  readonly onImagesChange: (update: (images: readonly ProseImage[]) => readonly ProseImage[]) => void;
  readonly onUpload?: (file: File) => Promise<string>;
}) {
  return (
    <div className={styles.proseEditorStack}>
      <div className={styles.proseEditorColumns}>
        {images.map((image, i) => (
          <ImageField
            alt={image.alt}
            ariaPrefix={`${i + 1} 枚目`}
            // biome-ignore lint/suspicious/noArrayIndexKey: 枚は順序が同一性
            key={i}
            onChange={(next) =>
              onImagesChange((current) => current.map((image, j) => (j === i ? next : image)))
            }
            onUpload={onUpload}
            src={image.src}
          />
        ))}
      </div>
      <div className={styles.proseEditorInline}>
        <IconButton
          disabled={images.length >= IMAGE_ROW_MAX}
          icon="addItem"
          label="並べる絵を 1 枚足す"
          onClick={() => onImagesChange((current) => [...current, { src: "", alt: "" }])}
        />
        <IconButton
          disabled={images.length <= IMAGE_ROW_MIN}
          icon="removeItem"
          label="いちばん右の絵を外す"
          onClick={() => onImagesChange((current) => current.slice(0, -1))}
        />
      </div>
    </div>
  );
}
