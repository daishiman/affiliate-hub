/**
 * GitHub Actions の**口座全体**の月間使用量を見張る。
 *
 * ## nightly.yml の「所要時間」との役割の違い
 *
 * `.github/workflows/nightly.yml` の「所要時間」は**深い門 1 ジョブ分**の実測である。
 * ここで見るのは**口座（利用者）全体の月間合計**で、対象が違う。
 * 1 ジョブが軽くても、口座全体では枠に当たり得る。逆に口座に余裕があっても、
 * 1 ジョブが 3 時間かかるなら打つ回数の判断は別に要る。
 * **どちらか片方だけでは、枠を使い切る日を当てられない。**
 *
 * ## 公開のあいだ、これは「見張り」ではない
 *
 * 標準ランナーは**公開リポジトリでは無料・無制限**である。分母が無いので
 * 「枠の 70%」という数が作れない。だからここは、公開のあいだ
 * **0% を報告しない**。0% と書けば「余裕がある」と読まれるが、
 * それは余裕ではなく**測っていない**という意味になる。
 * 出すのは「対象が無い」という告知だけである。
 *
 * ## 非公開になった日に、黙って通らない
 *
 * 非公開へ切り替えた日から枠 2,000 分が効き始める。そのとき口座の使用量を
 * 取るには fine-grained token が要る。個人口座は Plan (read)、組織口座は
 * Administration (read) を使う（登録は利用者本人が行う）。
 * **トークンが無いまま非公開になった場合、ここは緑では終わらない**——
 * `::warning::` を出す。武装していない見張りが緑で通ると、
 * 「見ている」と思われたまま誰も見ていない状態が続く。
 *
 * ## 落とさない
 *
 * 終了コードは常に 0 である。使用量の取得に失敗しても、ほかの検査は止めない。
 * ここでマージを止めると、赤を消す最短の道が「この見張りを外す」になる。
 *
 * ```
 * node scripts/actions-usage.mjs
 * ACTIONS_USAGE_MINUTES=1500 node scripts/actions-usage.mjs   # 測定用（必ず告知が出る）
 * ```
 *
 * 規範: tasks/task-actions-usage-monitor.md / docs/product/ci-cd-guide.md §12
 */

import { pathToFileURL } from "node:url";
import { ACTIONS_USAGE } from "../quality-gates.config.mjs";

export { ACTIONS_USAGE };

/**
 * 公開か非公開かで、そもそも見張れるかどうかが決まる。
 *
 * @param {string | undefined} visibility `"public"` / `"private"` / `"internal"`
 * @returns {{ applicable: boolean, reason: string }}
 */
export function judgeVisibility(visibility) {
  const v = String(visibility ?? "").toLowerCase();
  if (v === "public") {
    return {
      applicable: false,
      reason:
        "公開リポジトリでは標準ランナーが無料・無制限のため、枠そのものがありません。" +
        "使用率は出しません（ゼロと書くと「余裕がある」と読まれますが、" +
        "それは余裕ではなく測っていないという意味です）。",
    };
  }
  if (v === "private" || v === "internal") return { applicable: true, reason: "" };
  return {
    applicable: false,
    reason: `公開・非公開のどちらか分かりませんでした（受け取った値: ${JSON.stringify(visibility ?? null)}）。判定しません。`,
  };
}

/**
 * 見張りが**武装しているか**。非公開なのにトークンが無ければ警告する。
 *
 * @param {{ visibility?: string, hasToken: boolean }} input
 * @returns {{ armed: boolean, level: "ok" | "warn" | "skip", message: string | null }}
 */
export function judgeArmed({ visibility, hasToken }) {
  const applicability = judgeVisibility(visibility);
  if (!applicability.applicable) {
    return { armed: false, level: "skip", message: applicability.reason };
  }
  if (!hasToken) {
    return {
      armed: false,
      level: "warn",
      message:
        "非公開になっていますが、使用量を取るトークンが登録されていません。" +
        "枠 2,000 分の見張りは**動いていません**。" +
        "個人口座なら Plan (read)、組織口座なら Administration (read) の" +
        "fine-grained token を利用者本人が作り、" +
        "リポジトリの Secrets に ACTIONS_USAGE_TOKEN として登録してください" +
        "（代行しません。手順は docs/product/ci-cd-guide.md §12）。",
    };
  }
  return { armed: true, level: "ok", message: null };
}

/**
 * 使用量の判定。**これだけが「何%で何を言うか」を知っている。**
 *
 * 境目は「超えたら」であって「以上」ではない。ちょうど 70% を警告にすると、
 * 宣言した 70% が実質 69.99% になる。
 *
 * @param {{ minutesUsed: number, includedMinutes?: number, warnPercent?: number, failPercent?: number }} input
 * @returns {{ percent: number, level: "ok" | "warn" | "error", message: string, annotation: string | null }}
 */
export function judgeUsage({
  minutesUsed,
  includedMinutes = ACTIONS_USAGE.includedMinutes,
  warnPercent = ACTIONS_USAGE.warnPercent,
  failPercent = ACTIONS_USAGE.failPercent,
}) {
  if (!Number.isFinite(minutesUsed) || minutesUsed < 0) {
    throw new TypeError(`使用量が数ではありません: ${JSON.stringify(minutesUsed)}`);
  }
  if (!Number.isFinite(includedMinutes) || includedMinutes <= 0) {
    throw new TypeError(`枠が数ではありません: ${JSON.stringify(includedMinutes)}`);
  }
  const percent = Math.round((minutesUsed / includedMinutes) * 1000) / 10;
  const head = `月間使用量 ${minutesUsed} 分 / 枠 ${includedMinutes} 分（${percent}%）`;
  if (percent > failPercent) {
    return {
      percent,
      level: "error",
      message: `${head}。枠の ${failPercent}% を超えました。`,
      annotation: `::error::${head}。枠の ${failPercent}% を超えました。使い切ると検査も公開も止まります。重い門を打つ回数を減らすか、枠を買ってください。**検査を減らして数字を下げないこと。**`,
    };
  }
  if (percent > warnPercent) {
    return {
      percent,
      level: "warn",
      message: `${head}。枠の ${warnPercent}% を超えました。`,
      annotation: `::warning::${head}。枠の ${warnPercent}% を超えました。今月の残りは ${Math.max(0, includedMinutes - minutesUsed)} 分です。`,
    };
  }
  return { percent, level: "ok", message: `${head}。枠の ${warnPercent}% 以内です。`, annotation: null };
}

/**
 * 使用量を外から与える口（測定用）。
 *
 * 無いと、しきい値を超える枝を**誰も踏めない**。`REQ-CI12` で同じ形を作った
 * （`VERIFY_ELAPSED_SECONDS`）のと同じ理由である。
 *
 * @param {Record<string, string | undefined> | undefined} env
 * @returns {{ invalid: true, raw: string } | { invalid: false, minutes: number } | null}
 */
export function readUsageOverride(env) {
  const raw = env?.ACTIONS_USAGE_MINUTES;
  if (raw === undefined || raw === "") return null;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) return { invalid: true, raw: String(raw) };
  return { invalid: false, minutes };
}

/**
 * 外から与えたことの告知。**出さない経路を作らない。**
 *
 * @param {ReturnType<typeof readUsageOverride>} override
 * @returns {string | null}
 */
export function describeOverride(override) {
  if (!override || override.invalid) return null;
  return (
    `**使用量を外から与えています（測定用）: ${override.minutes} 分。**\n` +
    "この行が出ているときの数字は、口座の実際の使用量ではありません。\n"
  );
}

/**
 * 1 回分の判定をまとめる。**終了コードは常に 0。**
 *
 * @param {{ visibility?: string, hasToken: boolean, minutesUsed?: number | null, override?: ReturnType<typeof readUsageOverride>, fetchError?: string | null }} input
 * @returns {{ lines: string[], level: "ok" | "warn" | "error" | "skip", exitCode: 0 }}
 */
export function judgeRun({ visibility, hasToken, minutesUsed = null, override = null, fetchError = null }) {
  /** @type {string[]} */
  const lines = [];
  const notice = describeOverride(override);
  if (notice) lines.push(notice);

  const used = override && !override.invalid ? override.minutes : minutesUsed;
  const armed = judgeArmed({ visibility, hasToken: hasToken || Boolean(override) });

  if (armed.level === "skip") {
    lines.push(`::notice::見張りの対象がありません。${armed.message}`);
    return { lines, level: "skip", exitCode: 0 };
  }
  if (armed.level === "warn") {
    lines.push(`::warning::${armed.message}`);
    return { lines, level: "warn", exitCode: 0 };
  }
  if (fetchError) {
    lines.push(
      `::warning::使用量を取れませんでした（${fetchError}）。ほかの検査は止めません。次回の実行で取れなければ、トークンの期限を確認してください。`,
    );
    return { lines, level: "warn", exitCode: 0 };
  }
  if (used === null) {
    lines.push("::warning::使用量が空でした。ほかの検査は止めません。");
    return { lines, level: "warn", exitCode: 0 };
  }

  const verdict = judgeUsage({ minutesUsed: used });
  lines.push(verdict.annotation ?? verdict.message);
  return { lines, level: verdict.level, exitCode: 0 };
}

/**
 * 口座全体の使用量を取りに行く。**トークンは受け取るだけで、1 度も表示しない。**
 *
 * @param {{ owner: string, ownerType: string, token: string, fetchImpl?: typeof fetch }} input
 * @returns {Promise<{ minutesUsed: number | null, error: string | null }>}
 */
export async function fetchAccountUsage({ owner, ownerType, token, fetchImpl = fetch }) {
  try {
    const encodedOwner = encodeURIComponent(owner);
    const type = String(ownerType).toLowerCase();
    const accountPath =
      type === "user"
        ? `users/${encodedOwner}`
        : type === "organization"
          ? `organizations/${encodedOwner}`
          : null;
    if (accountPath === null) {
      return {
        minutesUsed: null,
        error: `口座種別が User / Organization ではありません: ${JSON.stringify(ownerType)}`,
      };
    }
    const res = await fetchImpl(
      `https://api.github.com/${accountPath}/settings/billing/usage`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2026-03-10",
        },
      },
    );
    if (!res.ok) return { minutesUsed: null, error: `HTTP ${res.status}` };
    const body = await res.json();
    if (!Array.isArray(body?.usageItems)) {
      return { minutesUsed: null, error: "usageItems がありません" };
    }
    let minutes = 0;
    for (const item of body.usageItems) {
      if (
        String(item?.product).toLowerCase() !== "actions" ||
        String(item?.unitType).toLowerCase() !== "minutes"
      ) {
        continue;
      }
      const quantity = Number(item?.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        return { minutesUsed: null, error: "Actions の quantity が分数ではありません" };
      }
      minutes += quantity;
    }
    return { minutesUsed: minutes, error: null };
  } catch (e) {
    // 例外の中身にトークンが混ざる経路を作らない。型の名前だけ出す。
    return { minutesUsed: null, error: `取得に失敗しました（${e instanceof Error ? e.name : "unknown"}）` };
  }
}

/** 実行側。判断は 1 つも持たない。 */
async function main() {
  const env = process.env;
  const override = readUsageOverride(env);
  if (override?.invalid) {
    process.stdout.write(
      `::warning::ACTIONS_USAGE_MINUTES に分数でないものが入っています: ${override.raw}\n`,
    );
  }
  const visibility = env.REPO_VISIBILITY;
  const token = env.ACTIONS_USAGE_TOKEN ?? "";
  const owner = env.GITHUB_REPOSITORY_OWNER ?? "";
  const ownerType = env.GITHUB_REPOSITORY_OWNER_TYPE ?? "";

  /** @type {number | null} */
  let minutesUsed = null;
  /** @type {string | null} */
  let fetchError = null;
  const applicable = judgeVisibility(visibility).applicable;
  if (applicable && token && owner && !override) {
    const got = await fetchAccountUsage({ owner, ownerType, token });
    minutesUsed = got.minutesUsed;
    fetchError = got.error;
  }

  const verdict = judgeRun({
    visibility,
    hasToken: Boolean(token),
    minutesUsed,
    override: override?.invalid ? null : override,
    fetchError,
  });
  for (const line of verdict.lines) process.stdout.write(`${line}\n`);

  const summary = env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      summary,
      ["### GitHub Actions の月間使用量（口座全体）", "", ...verdict.lines, ""].join("\n"),
    );
  }
  process.exit(verdict.exitCode);
}

// 直に叩かれたときだけ走らせる。取り込まれたときは判定だけを渡す。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
