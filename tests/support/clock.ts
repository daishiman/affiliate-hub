/**
 * 時刻・乱数・ID を固定する。
 *
 * 「たまに落ちるテスト」の原因はほぼこの 3 つで、
 * **たまに落ちるテストは、無視されるようになった時点で存在しないのと同じ**になる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §4
 */

/**
 * テストの基準時刻。
 *
 * 見本データの日付と揃えてある。ここがずれると「本日の投稿」「◯日前」のような
 * 相対表示が実行日によって変わり、日をまたいだだけでテストが落ちる。
 */
export const NOW = new Date("2026-08-17T09:00:00.000Z");

/** 何日ずらした時刻か。境界値テストで「上限ちょうど」「上限+1」を作るのに使う。 */
export function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/** 何時間ずらした時刻か。価格の鮮度（24 時間）のような境界に使う。 */
export function hoursFrom(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

/**
 * 進めることのできる時計。
 *
 * `Date.now()` を直に呼ぶ実装はドメインに置けない決まりなので（layers.md）、
 * 時刻はここから注入する。
 */
export function fixedClock(start: Date = NOW) {
  let current = start;
  return {
    now: () => current,
    advanceHours(h: number) {
      current = hoursFrom(current, h);
      return current;
    },
    advanceDays(d: number) {
      current = daysFrom(current, d);
      return current;
    },
    reset() {
      current = start;
    },
  };
}

/**
 * 順番に決まった ID を返す生成器。
 *
 * 本物は `crypto.randomUUID()` を使うため、出力をそのまま突き合わせられない。
 * ID が毎回変わると、結果の比較で ID を除外する処理を各テストが書くことになり、
 * その除外が**本当に見たい差分まで隠す**。
 */
export function sequentialIds(prefix = "id"): { generate(): string; issued(): readonly string[] } {
  let n = 0;
  const issued: string[] = [];
  return {
    generate() {
      n += 1;
      const id = `${prefix}-${String(n).padStart(4, "0")}`;
      issued.push(id);
      return id;
    },
    issued: () => issued,
  };
}

/**
 * 決まった順で値を返す乱数。
 *
 * 「たまたま通った」を作らないため、テストでは乱数を使わず、
 * **見たい分岐に入る値を明示的に並べる**。
 */
export function scriptedRandom(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v ?? 0;
  };
}
