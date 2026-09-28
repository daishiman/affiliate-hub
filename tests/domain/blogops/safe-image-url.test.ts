/**
 * @tier 1
 *
 * 絵の在り処として通してよい文字列かどうか。
 *
 * この関門は**アイキャッチ欄の最後の砦**である。あの欄は「`<img>` で入ることも、
 * URL がそのまま入ることもある」ので、運営者が説明文を書いた日も同じ道を通る。
 *
 * 2026-09-05 まで、ここは危ない仕組み 3 つを弾くだけで、URL の形をしているかを
 * 見ていなかった。見本のアイキャッチに入っていた説明文
 * 「机の上に道具を並べて、置き場所ごとに測っている様子。」がそのまま
 * `<img src>` になり、相対 URL として `/admin/blog/机の上に…` を取りに行って
 * 404 を出していた（`/admin/blog/articles` で実測）。
 *
 * **相対 URL は画面ごとに違う場所を指す。**同じ記事の同じ絵が、一覧では
 * `/admin/blog/…`、読者面では `/s/<site>/…` を取りに行く。管理面では 404 が
 * console.error として見えたが、読者面では黙って絵が欠けるだけである。
 */

import { describe, expect, it } from "vitest";
import { firstImageUrlInBody, safeImageUrl } from "@/domain/blogops/thumbnail";

describe("safeImageUrl", () => {
  it("絶対 URL（http / https）は通す", () => {
    expect(safeImageUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(safeImageUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
  });

  it("このサイト内の道は通す", () => {
    expect(safeImageUrl("/media/a.png")).toBe("/media/a.png");
  });

  it("実行に化ける仕組みは通さない", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("  JavaScript:alert(1)")).toBeNull();
    expect(safeImageUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeImageUrl("data:image/png;base64,AAAA")).toBeNull();
  });

  it("説明文は絵の在り処ではない", () => {
    // 実際にこれが `<img src>` になっていた。
    expect(safeImageUrl("机の上に道具を並べて、置き場所ごとに測っている様子。")).toBeNull();
    expect(safeImageUrl("まだ絵はありません")).toBeNull();
  });

  it("相対の道は通さない（画面ごとに別の場所を指すため）", () => {
    expect(safeImageUrl("media/a.png")).toBeNull();
    expect(safeImageUrl("../a.png")).toBeNull();
  });

  it("別ホストへ連れて行く `//` の形は通さない", () => {
    expect(safeImageUrl("//example.com/a.png")).toBeNull();
  });

  it("空・空白・未指定は通さない", () => {
    expect(safeImageUrl("")).toBeNull();
    expect(safeImageUrl("   ")).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
    expect(safeImageUrl(undefined)).toBeNull();
  });

  it("`<img>` から抜いた src も同じ関門を通る", () => {
    expect(firstImageUrlInBody('<img src="/media/a.png" alt="x">')).toBe("/media/a.png");
    // 抜けはするが、URL の形をしていないので通らない。
    expect(firstImageUrlInBody('<img src="説明の文" alt="x">')).toBeNull();
    expect(firstImageUrlInBody('<img src="javascript:alert(1)">')).toBeNull();
    expect(firstImageUrlInBody("絵の入っていない本文")).toBeNull();
  });
});

/**
 * **保存されている形で読めること。**
 *
 * 本文は拡張 Markdown の文字列で保存され、画像は `![alt](src)` になる
 * （`prose-format.ts`）。`<img>` だけを見ていた間、本文エディタで書いた記事の
 * 画像は 1 枚も候補に上がらなかった。`body_first_image`（「本文の先頭画像」）は
 * 選択肢として画面に並んでいるのに、到達しない枝だった。
 *
 * 単に動いていないより悪い。選択肢が出ているので、運営者は
 * 「本文に画像を置けば表紙になる」と読む。読み方が正しいのに結果が伴わない。
 */
describe("本文の先頭画像 — Markdown の書き方", () => {
  it("`![alt](src)` から在り処を拾う", () => {
    expect(firstImageUrlInBody("![机の全体](/media/a.png)")).toBe("/media/a.png");
  });

  it("寸法つき（`![a](/x.png \"640x360\")`）でも在り処だけを拾う", () => {
    // 題名の場所は URL ではない。付けたまま通すと、取りに行けない住所が `img` に入る。
    expect(firstImageUrlInBody('![机](/media/a.png "640x360")')).toBe("/media/a.png");
  });

  it("寸法として読めない題名でも、在り処だけを拾う", () => {
    // `prose-format` はこの題名を捨てずに残す（往復のため）。ここは目的が違う。
    expect(firstImageUrlInBody('![机](/media/a.png "撮影 2026 年")')).toBe("/media/a.png");
  });

  it("Markdown で書いた危ない在り処も、同じ関門で落ちる", () => {
    // 記法が増えても関門は 1 か所のまま。増やした読み口だけが素通りするのが怖い。
    expect(firstImageUrlInBody("![x](javascript:alert(1))")).toBeNull();
    expect(firstImageUrlInBody("![x](data:image/png;base64,AAAA)")).toBeNull();
    expect(firstImageUrlInBody("![x](説明の文)")).toBeNull();
    expect(firstImageUrlInBody("![x]()")).toBeNull();
  });

  it("段落の途中にある絵も拾う", () => {
    expect(firstImageUrlInBody("道具を並べた様子 ![机](/media/a.png) を見てください。")).toBe(
      "/media/a.png",
    );
  });

  it("両方あるときは、本文に先に現れたほうを採る", () => {
    /*
      優先するのは記法ではなく**順序**である。読者が上から読んで最初に
      出会う絵と、一覧の表紙を一致させたい。記法で優先を付けると、
      同じ記事でも書き方を変えた日に表紙が入れ替わる。
    */
    expect(firstImageUrlInBody('<img src="/media/html.png">\n\n![m](/media/md.png)')).toBe(
      "/media/html.png",
    );
    expect(firstImageUrlInBody('![m](/media/md.png)\n\n<img src="/media/html.png">')).toBe(
      "/media/md.png",
    );
  });

  it("`<img>` で書かれた本文の挙動は変わらない", () => {
    expect(firstImageUrlInBody('<img src="/media/a.png" alt="x">')).toBe("/media/a.png");
    expect(firstImageUrlInBody("![壊れた記法](/media/a.png")).toBeNull();
  });
});
