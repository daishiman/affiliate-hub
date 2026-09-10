"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ALLOWED_THUMBNAIL_MIME,
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_WIDTHS,
} from "@/domain/blogops";
import {
  Button,
  Field,
  FilePicker,
  FormResult,
  FormValue,
  Note,
  ToolForm,
} from "@/presentation/ui";
import { manageArticleThumbnailAction } from "./article-thumbnail-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * 記事の表紙（サムネイル）を登録する画面。
 *
 * --- 縮小した絵をここ（ブラウザ）で作る理由 ---
 *
 * 置き場（Workers）に画像のデコーダが無い。`wrangler.jsonc` に Images の
 * バインディングも置いていない。つまり**原本 1 枚から縮小版を作れる場所は
 * ここしか無い**。Canvas で 320/640/1280 を作り、原本と一緒に送る。
 *
 * 作れなかった幅は**送らない**。送る側で握りつぶして「作れたことにする」と、
 * 読者の `srcset` に 404 を指す行が並ぶ。落ちても原本 1 枚で成立するので、
 * ここは止めずに進む。
 *
 * 元の絵より大きい幅も作らない。引き伸ばした絵は画質が上がらないのに
 * バイト数だけ増え、読者の通信を無駄に使う。
 */
export function ArticleThumbnailForm({
  articleId,
  current,
}: {
  readonly articleId: string;
  /** いま付いている表紙。無ければ `null`。 */
  readonly current: {
    readonly href: string;
    readonly altText: string;
    readonly derivedWidths: readonly number[];
  } | null;
}) {
  const [state, action, pending] = useActionState(
    manageArticleThumbnailAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [altText, setAltText] = useState(current?.altText ?? "");
  const [picked, setPicked] = useState<{ readonly name: string; readonly preview: string } | null>(
    null,
  );
  const [madeWidths, setMadeWidths] = useState<readonly number[]>([]);
  const [deriveNote, setDeriveNote] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const selection = useRef(0);
  const preparingRef = useRef(false);
  const derivedInputs = useRef(new Map<number, HTMLInputElement | null>());

  useEffect(() => () => { selection.current += 1; }, []);
  useEffect(() => {
    const preview = picked?.preview;
    return () => {
      if (preview !== undefined) URL.revokeObjectURL?.(preview);
    };
  }, [picked?.preview]);

  /**
   * 作った絵を、隠した `input[type=file]` へ入れる。
   *
   * `Blob` は隠し欄の値にできないので、`DataTransfer` を通してファイルの束を
   * 差し替える。こうすると**ふつうのフォーム送信のまま**運べるので、
   * 送信を横取りする必要が無い（横取りすると、AI から同じ口を呼んだときだけ
   * 通らない、という差が生まれる）。
   */
  function putFile(width: number, file: File | null): boolean {
    const input = derivedInputs.current.get(width) ?? null;
    if (input === null) return false;
    if (file === null) input.value = "";
    if (typeof DataTransfer === "undefined") return false;
    const carrier = new DataTransfer();
    if (file !== null) carrier.items.add(file);
    input.files = carrier.files;
    return true;
  }

  async function derive(file: File, version: number): Promise<void> {
    let bitmap: ImageBitmap | null = null;
    const isCurrent = () => selection.current === version;
    const unavailable = "縮小版を作れませんでした。選んだ画像のまま登録できます。";
    try {
      if (typeof createImageBitmap !== "function" || typeof DataTransfer === "undefined") {
        setDeriveNote(unavailable);
        return;
      }
      bitmap = await createImageBitmap(file);
      if (!isCurrent()) return;
      const made: number[] = [];
      for (const width of THUMBNAIL_WIDTHS) {
        if (bitmap.width <= width) continue;
        // 幅ごとの失敗は隔離する。選び直し後は古い結果を送信欄へ入れない。
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = Math.round((bitmap.height * width) / bitmap.width);
          const context = canvas.getContext("2d");
          if (context === null) continue;
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, file.type, 0.82);
          });
          if (!isCurrent()) return;
          // Canvasが別形式へフォールバックした結果を原本のMIMEとして送らない。
          if (blob === null || blob.type !== file.type) continue;
          if (putFile(width, new File([blob], `w${String(width)}`, { type: blob.type }))) {
            made.push(width);
          }
        } catch {
          if (!isCurrent()) return;
        }
      }
      setMadeWidths(made);
      setDeriveNote(made.length > 0 ? null : bitmap.width <= THUMBNAIL_WIDTHS[0]
        ? "元の絵が小さいため、縮小版は作りませんでした。原本 1 枚をそのまま配ります。"
        : unavailable);
    } catch {
      if (isCurrent()) setDeriveNote(unavailable);
    } finally {
      bitmap?.close();
      if (isCurrent()) {
        preparingRef.current = false;
        setPreparing(false);
      }
    }
  }

  function onPick(file: File | undefined): void {
    const version = ++selection.current;
    for (const width of THUMBNAIL_WIDTHS) putFile(width, null);
    setMadeWidths([]);
    setDeriveNote(null);
    preparingRef.current = file !== undefined;
    setPreparing(file !== undefined);
    if (file === undefined) {
      setPicked(null);
      return;
    }
    setPicked({ name: file.name, preview: URL.createObjectURL(file) });
    void derive(file, version);
  }

  return (
    <>
      {current === null ? (
        <Note>
          この記事にはまだ表紙がありません。一覧では本文の画像か、記事に合わせた自動表紙が表示されます。
        </Note>
      ) : (
        <figure>
          {/*
            幅と高さを持たない `img` は、絵が届いた瞬間に下の文章を押し下げる。
            ここは管理画面だが、読者側の 8 画面と同じ作法にしておく。

            `next/image` を使わないのは一覧の升目（`article-thumbnail-cell.tsx`）と
            同じ理由。ここは**いま置き場に在る絵をそのまま確かめる**場所なので、
            最適化を挟むと「上げた絵」と「見えている絵」がずれる。
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.href} alt={current.altText} width={320} height={180} />
          <figcaption>
            <Note>
              {current.derivedWidths.length === 0
                ? "いま付いている表紙。縮小版はありません（原本 1 枚をそのまま配っています）。"
                : `いま付いている表紙。配っている幅: ${current.derivedWidths.join(" / ")}`}
            </Note>
          </figcaption>
        </figure>
      )}

      <ToolForm
        action={action}
        onSubmit={(event) => {
          if (preparingRef.current || pending) event.preventDefault();
        }}
        onReset={(event) => {
          // React は入力エラーを返した Action でも file 欄をリセットする。
          // 失敗時は原本と縮小版を同じ選択のまま残し、説明だけ直して再送できるようにする。
          if (state.status !== "done") {
            event.preventDefault();
            return;
          }
          onPick(undefined);
        }}
        encType="multipart/form-data"
        toolName="set_blog_article_thumbnail"
        toolDescription="記事の表紙の絵を 1 枚登録する（絵の説明つき）"
      >
        <FormValue name="intent" value="set" />
        <FormValue name="articleId" value={articleId} />

        {/* 断りは「形式が違う」（mimeType）と「大きすぎる」（original）の 2 通り。
            どちらも原因はこの 1 つの欄なので、欄そのものへ結び付けて出す。
            画面の下だけに出すと、どの欄を直せばよいか読み上げでは分からない。 */}
        <FilePicker
          label="表紙にする絵"
          name="original"
          accept={ALLOWED_THUMBNAIL_MIME.join(",")}
          onPick={onPick}
          disabled={pending}
          hint={`${ALLOWED_THUMBNAIL_MIME.join(" / ")} のいずれか、${String(
            MAX_THUMBNAIL_BYTES / 1024 / 1024,
          )}MB まで。縮小版（${THUMBNAIL_WIDTHS.join(" / ")}）はこの画面で作って一緒に送ります。`}
          error={
            state.field === "original" || state.field === "mimeType" ? state.message : null
          }
          toolParamDescription="記事の表紙にする画像の原本。JPEG / PNG / WebP のいずれか"
        />

        {picked === null ? null : (
          <figure>
            {/* 選んだ絵の下見。**説明文はまだ無いので `alt` は空にする。**
                ここに「選んだ絵」と書くと、読み上げでは絵の中身ではなく
                操作の説明が読まれ、下の説明欄を書く手がかりにならない。

                `next/image` は使えない。これは `blob:` の下見で、
                最適化の通り道（サーバ）からは読めない場所に在る。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picked.preview} alt="" width={320} height={180} />
            <figcaption>
              <Note>
                {preparing ? "画像を準備しています。画像は選び直せます。" : deriveNote ??
                  `${picked.name} — 縮小版 ${madeWidths.join(" / ")} を一緒に送ります。`}
              </Note>
            </figcaption>
          </figure>
        )}

        {THUMBNAIL_WIDTHS.map((width) => (
          <input
            key={width}
            ref={(node) => {
              derivedInputs.current.set(width, node);
            }}
            type="file"
            name={`derived-${String(width)}`}
            hidden
            aria-hidden="true"
            tabIndex={-1}
          />
        ))}

        <Field
          label="絵の説明"
          value={altText}
          onValueChange={setAltText}
          name="altText"
          disabled={pending}
          error={state.field === "altText" ? state.message : null}
          hint="絵が出ないときと、読み上げで聞く読者に、ここだけが届きます。何が写っているかを書いてください。"
          toolParamDescription="サムネイル画像の代替テキスト。何が写っているかを一文で書く"
        />

        <FormResult state={state} />
        <Button type="submit" busy={pending || preparing} busyLabel={preparing ? "画像を準備しています" : "登録しています"}>
          この絵を表紙にする
        </Button>
      </ToolForm>

      {current === null ? null : (
        <ToolForm
          action={action}
          toolName="remove_blog_article_thumbnail"
          toolDescription="記事の表紙の絵を外す（記事そのものは消さない）"
        >
          <FormValue name="intent" value="remove" />
          <FormValue name="articleId" value={articleId} />
          <Button type="submit" tone="secondary" busy={pending} busyLabel="外しています">
            表紙を外す
          </Button>
        </ToolForm>
      )}
    </>
  );
}
