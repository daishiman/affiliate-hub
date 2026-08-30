/**
 * @tier 1
 * @req REQ-FD06
 * @types equivalence, boundary
 *
 * 開発機に入れる見本データが、**画面の分かれ目を全部作っていること**。
 *
 * --- なぜ要るか ---
 *
 * 見本データは「動くことを確かめる材料」であって、飾りではない。
 * だから足りないときの症状は、**画面が壊れることではなく、
 * 壊れていても気づかないこと**になる。
 *
 * 実例を 2 つ。2026-08-28 まで、記事は 4 本で公開されていない記事は下書き 1 本だけ、
 * ヘッダーとフッターの枠は 4 種のうち 1 種ずつしか入っていなかった。
 * どちらも画面は正しく見える——「下書きだけを弾く実装」でも、
 * 「残り 3 種の枠を描けていない実装」でも、見えるものは同じだった。
 *
 * --- ここで見る形 ---
 *
 * 「一覧に在るものが、見本データに全部出ているか」を見る。
 * 期待値の一覧は `@/domain/blogops` から取っている。**一覧が縮めばこの検査も緩む**が、
 * 一覧そのものは別の検査（`tests/domain/` の品ぞろえの節）が仕様の写しで押さえている。
 * ここで一覧を二重に書き写すと、仕様が動いたときに直す場所が増えるだけになる。
 */

import { describe, expect, it } from "vitest";
import { SITE_DOCUMENT_ONLY_STORAGE_KINDS } from "@/domain/authoring";
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_TEMPLATES,
  BLOG_ARTICLE_STATUSES,
  DELIVERY_PARTS,
  FIXED_PAGE_KINDS,
  SLOT_KEYS_BY_REGION,
  LAYOUT_REGIONS,
  TOP_BANDS,
} from "@/domain/blogops";
import {
  SEED_AFFILIATE_LINKS,
  SEED_AFFILIATE_PLACEMENTS,
  SEED_AFFILIATE_PROGRAMS,
  SEED_ARTICLES,
  SEED_HUB_SLUG,
  SEED_SUB_SLUG,
  buildSeedSql,
  seedArticleBlocks,
} from "../../scripts/seed/local-seed-data";

const SQL = buildSeedSql(Math.floor(new Date("2026-08-28T00:00:00.000Z").getTime() / 1000));
const TEXT = SQL.join("\n");

/** 見本データの記事すべてが持つ部品の種類。 */
const SEEDED_BLOCK_KINDS = new Set(SEED_ARTICLES.flatMap((a) => seedArticleBlocks(a).map((b) => b.kind)));

describe("記事の軸が全部そろっている", () => {
  it("状態 4 種が全部ある（読者側に出ない側を 1 種しか置かない、が起きていない）", () => {
    const seeded = new Set(SEED_ARTICLES.map((a) => a.status));
    for (const status of BLOG_ARTICLE_STATUSES) {
      expect(seeded, `状態 ${status} の記事が見本データにありません`).toContain(status);
    }
  });

  it("記事型 4 種が全部ある", () => {
    const seeded = new Set(SEED_ARTICLES.map((a) => a.template));
    for (const template of ARTICLE_TEMPLATES) {
      expect(seeded, `記事型 ${template} の記事がありません`).toContain(template);
    }
  });

  it("部品 15 種が、どこかの記事に 1 度は出ている", () => {
    for (const kind of ARTICLE_BLOCK_KINDS) {
      expect(
        SEEDED_BLOCK_KINDS,
        `部品 ${kind} がどの記事にも入っていません。入れないと、この部品は一度も画面に出ません`,
      ).toContain(kind);
    }
  });

  it("票の数が、目安の出る側と出ない側の両方にある", () => {
    const counts = SEED_ARTICLES.map((a) => a.ratings.length);
    // 0 件・1〜4 件・5 件以上。5 件が目安を出す境目なので、3 つとも要る。
    expect(counts, "票 0 件の記事がありません").toContain(0);
    expect(counts.some((n) => n > 0 && n < 5), "票が 1〜4 件の記事がありません").toBe(true);
    expect(counts.some((n) => n >= 5), "票が 5 件以上の記事がありません").toBe(true);
  });

  it("鮮度が、新しい側と 1 年以上前の両方にある", () => {
    const days = SEED_ARTICLES.map((a) => a.daysAgo);
    expect(days.some((d) => d < 30), "最近の記事がありません").toBe(true);
    expect(
      days.some((d) => d > 365),
      "1 年以上前の記事がありません。「更新されていません」の一言が一度も出ません",
    ).toBe(true);
  });

  it("必須部品が欠けた記事がある（公開しようとして断られる側）", () => {
    expect(
      SEED_ARTICLES.some((a) => a.missing.length > 0),
      "必須を欠く記事がありません。断り文が一度も画面に出ません",
    ).toBe(true);
  });

  it("タグの付いた記事と、付いていない記事の両方がある", () => {
    const tagged = SEED_ARTICLES.filter((a) => a.site !== "sub" && a.tagIds?.length !== 0);
    const untagged = SEED_ARTICLES.filter((a) => a.tagIds?.length === 0);
    expect(tagged.length, "タグの付いた記事がありません").toBeGreaterThan(0);
    expect(untagged.length, "タグ無しの記事がありません").toBeGreaterThan(0);
  });

  it("中心のブログと子のブログの両方に記事がある", () => {
    expect(
      SEED_ARTICLES.some((a) => a.site !== "sub"),
      "中心のブログに記事がありません",
    ).toBe(true);
    expect(
      SEED_ARTICLES.some((a) => a.site === "sub"),
      "子のブログに記事がありません。姉妹サイトの帯が空で出ます",
    ).toBe(true);
  });
});

describe("版面が、両方のブログに全種そろっている", () => {
  for (const site of [SEED_HUB_SLUG, SEED_SUB_SLUG]) {
    for (const region of LAYOUT_REGIONS) {
      for (const slotKey of SLOT_KEYS_BY_REGION[region]) {
        it(`${site} の ${region} に ${slotKey} の行がある`, () => {
          const hit = SQL.some(
            (line) =>
              line.includes("INSERT INTO blog_layout_slot") &&
              line.includes(`'${site}'`) &&
              line.includes(`'${region}'`) &&
              line.includes(`'${slotKey}'`),
          );
          expect(
            hit,
            `行が無いと、この枠は「出ない」側に固定されます。` +
              `描けていないのか行が無いだけなのかが画面から区別できません`,
          ).toBe(true);
        });
      }
    }

    it(`${site} に帯 ${TOP_BANDS.length} 種と配り口 ${DELIVERY_PARTS.length} 種がそろっている`, () => {
      for (const band of TOP_BANDS) {
        expect(
          TEXT.includes(`INSERT INTO blog_layout_band`) &&
            SQL.some((l) => l.includes(`'${site}'`) && l.includes(`'${band}'`)),
          `${site} に帯 ${band} がありません`,
        ).toBe(true);
      }
      for (const part of DELIVERY_PARTS) {
        expect(
          SQL.some(
            (l) =>
              l.includes("INSERT INTO blog_delivery_part") &&
              l.includes(`'${site}'`) &&
              l.includes(`'${part}'`),
          ),
          `${site} に配り口 ${part} がありません`,
        ).toBe(true);
      }
    });

    it(`${site} に固定ページ ${FIXED_PAGE_KINDS.length} 種がそろっている`, () => {
      for (const kind of FIXED_PAGE_KINDS) {
        expect(
          SQL.some(
            (l) =>
              l.includes("INSERT INTO legal_page") &&
              l.includes(`'${site}'`) &&
              l.includes(`'${kind}'`),
          ),
          `${site} に固定ページ ${kind} がありません。法務の入口が片方だけ欠けます`,
        ).toBe(true);
      }
    });

    it(`${site} に専用routeの方針文書 ${SITE_DOCUMENT_ONLY_STORAGE_KINDS.length} 種がそろっている`, () => {
      for (const kind of SITE_DOCUMENT_ONLY_STORAGE_KINDS) {
        expect(
          SQL.some(
            (line) =>
              line.includes("INSERT INTO legal_page") &&
              line.includes(`'${site}'`) &&
              line.includes(`'${kind}'`),
          ),
          `${site} に方針文書 ${kind} がありません`,
        ).toBe(true);
      }
    });
  }
});

describe("成果リンクの判断に必要な分かれ目がそろっている", () => {
  it("稼働中・期限切れ・停止済みの3状態がある", () => {
    expect(new Set(SEED_AFFILIATE_LINKS.map((link) => link.state))).toEqual(
      new Set(["usable", "expired", "disabled"]),
    );
  });

  it("提携先が複数ある", () => {
    expect(new Set(SEED_AFFILIATE_PROGRAMS.map((program) => program.asp)).size).toBeGreaterThan(1);
  });

  it("最終確認は新しい・古い・未確認の3種がある", () => {
    const checked = SEED_AFFILIATE_LINKS.map((link) => link.lastCheckedDaysAgo);
    expect(checked).toContain(null);
    expect(checked.some((days) => days !== null && days <= 7)).toBe(true);
    expect(checked.some((days) => days !== null && days >= 30)).toBe(true);
  });

  it("稼働中・掲載終了・リンクID未登録の旧形式を比較できる", () => {
    expect(SEED_AFFILIATE_PLACEMENTS.some((placement) => placement.status === "active")).toBe(true);
    expect(SEED_AFFILIATE_PLACEMENTS.some((placement) => placement.status === "removed")).toBe(true);
    expect(SEED_AFFILIATE_PLACEMENTS.some((placement) => placement.affiliateLinkId === null)).toBe(
      true,
    );
  });

  it("価格・通貨・取得方法・正規URLの写しがある", () => {
    for (const link of SEED_AFFILIATE_LINKS) {
      expect(link.canonicalUrl).toMatch(/^https:\/\//);
      expect(link.merchantName).not.toBe("");
      expect(link.priceMinor).toBeGreaterThan(0);
      expect(link.currency).toBe("JPY");
      expect(link.sourceMethod).not.toBe("");
    }
  });
});

describe("入れる SQL そのものの決まり", () => {
  it("同じ行の id が 2 度出てこない", () => {
    // 2 度当てても増えないように先に消しているが、1 回の中で id がぶつかると
    // 当てた時点で失敗する。両方のブログへ敷くようになってから起きやすくなった。
    const ids = SQL.flatMap((line) => {
      // `id` 列を持たない中間表の先頭値（workspace_id）は ID ではない。
      // 列一覧の先頭が実際に `id` の INSERT だけを数える。
      const m = /INSERT INTO (\w+) \(id,[^)]*\)\s*\n?\s*VALUES \('([^']+)'/.exec(line);
      return m === null ? [] : [`${m[1]}:${m[2]}`];
    });
    const seen = new Set<string>();
    const duplicated = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(duplicated, "同じ id を 2 度入れようとしています").toEqual([]);
  });

  it("部品の位置が 0 から続き番号になっている", () => {
    for (const article of SEED_ARTICLES) {
      const positions = seedArticleBlocks(article).map((b) => b.position);
      expect(positions, `${article.id} の位置が飛んでいます`).toEqual(
        positions.map((_, index) => index),
      );
    }
  });

  it("見出しか本文のどちらかが入った部品が、記事ごとに 1 つ以上ある", () => {
    // 種類と位置だけ入れて中身を空にすると、枠の並びは検証できても
    // 「文章が入ったときにどう見えるか」は一度も確かめられない。
    for (const article of SEED_ARTICLES) {
      const written = seedArticleBlocks(article).filter(
        (b) => b.heading.trim() !== "" || b.body.trim() !== "",
      );
      expect(written.length, `${article.id} の部品が全部空です`).toBeGreaterThan(0);
    }
  });
});
