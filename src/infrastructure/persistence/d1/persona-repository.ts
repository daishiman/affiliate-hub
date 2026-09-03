import { and, asc, eq } from "drizzle-orm";
import type { EditorialPersonaRepositoryPort } from "@/application/ports/authoring";
import type { PageRequest } from "@/application/ports/common";
import type { AudiencePersona, AuthorPersona } from "@/domain/authoring";
import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type WorkspaceId,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  type AudiencePersonaRow,
  type AuthorPersonaRow,
  audiencePersonas,
  authorPersonas,
} from "@/db/schema";
import {
  SAMPLE_AUDIENCE_PERSONAS,
  SAMPLE_AUTHOR_PERSONAS,
} from "../sample/content-editorial-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 書き手と読者像の保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約（`PersonaRepositoryPort`）を
 * 満たす、実際に保存する実装。
 *
 * --- なぜ今これを本物にしたか ---
 *
 * 保存先を本物にする順番には、この作業場所の決めごとがある。
 * **入れる口が無いものを先に本物にすると、一生埋まらない空の画面ができる。**
 * だからここでは、同じ変更のなかで `/admin/personas/new` と
 * `/admin/personas/audiences/new`（＝入れる口）を先に用意している。
 * 読む口だけを本物にしていない。
 *
 * --- 列の切り方 ---
 *
 * `site_drafts` と同じ決めごとに従う。**一覧が絞り込みと並べ替えに使うものだけを
 * 列にする。** 文体の 6 軸・使ってよい言い回し・事実の範囲・読者の判断基準は
 * 項目が増え続けるので JSON 1 列にまとめた。軸を 1 つ足すたびに保存先の
 * 作り直しが要る形にすると、書き手の設計そのものが保存先の都合で歪む。
 *
 * --- 見本を消さない ---
 *
 * 保存された分の**後ろへ**見本を重ねる（`mergeWithSamples`）。
 * 1 人も登録していない状態で一覧が空になると、「まだ作っていない」のか
 * 「壊れている」のかを画面から見分けられない。
 * 重ねる向きは「保存された分が先」。逆にすると、見本と同じ ID を
 * 保存し直しても古い見本が返り、直したはずの設定が次に開くと元へ戻る。
 */

/** 行 → ドメイン。ID の作り方を知っているのはこの層だけ。 */
function toAuthor(row: AuthorPersonaRow): AuthorPersona {
  const stored = JSON.parse(row.personaJson) as Omit<AuthorPersona, "id" | "workspaceId">;
  return {
    ...stored,
    id: taggedString<"AuthorPersonaId">(row.id) as AuthorPersonaId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
  };
}

function toAudience(row: AudiencePersonaRow): AudiencePersona {
  const stored = JSON.parse(row.personaJson) as Omit<AudiencePersona, "id" | "workspaceId">;
  return {
    ...stored,
    id: taggedString<"AudiencePersonaId">(row.id) as AudiencePersonaId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
  };
}

export function createD1PersonaRepository(db: DrizzleD1): EditorialPersonaRepositoryPort {
  return markEditorial({
    async findAuthor(workspaceId: WorkspaceId, id: AuthorPersonaId) {
      try {
        const rows = await db
          .select()
          .from(authorPersonas)
          .where(
            and(
              eq(authorPersonas.workspaceId, String(workspaceId)),
              eq(authorPersonas.id, String(id)),
            ),
          )
          .limit(1);
        if (rows.length > 0) return ok(toAuthor(rows[0]));
        // 保存先に無ければ見本を見る。見本の書き手を選んだ記事が、
        // 保存先をつないだ日に「書き手が見つかりません」で開けなくなるのを防ぐ。
        return ok(SAMPLE_AUTHOR_PERSONAS.find((a) => a.id === id) ?? null);
      } catch (cause) {
        return storageFailure("書き手の読み出し", cause);
      }
    },

    async findAudience(workspaceId: WorkspaceId, id: AudiencePersonaId) {
      try {
        const rows = await db
          .select()
          .from(audiencePersonas)
          .where(
            and(
              eq(audiencePersonas.workspaceId, String(workspaceId)),
              eq(audiencePersonas.id, String(id)),
            ),
          )
          .limit(1);
        if (rows.length > 0) return ok(toAudience(rows[0]));
        return ok(SAMPLE_AUDIENCE_PERSONAS.find((a) => a.id === id) ?? null);
      } catch (cause) {
        return storageFailure("読者像の読み出し", cause);
      }
    },

    async listAuthors(workspaceId: WorkspaceId, page: PageRequest) {
      try {
        const rows = await db
          .select()
          .from(authorPersonas)
          .where(eq(authorPersonas.workspaceId, String(workspaceId)))
          // 名前順。更新順にすると、直すたびに並びが変わって
          // 「増えたのか同じものなのか」が読めなくなる。
          .orderBy(asc(authorPersonas.displayName));
        const merged = mergeWithSamples(rows.map(toAuthor), SAMPLE_AUTHOR_PERSONAS);
        return ok({ items: merged.slice(0, page.limit), nextCursor: null });
      } catch (cause) {
        return storageFailure("書き手の一覧の読み出し", cause);
      }
    },

    async listAudiences(workspaceId: WorkspaceId, page: PageRequest) {
      try {
        const rows = await db
          .select()
          .from(audiencePersonas)
          .where(eq(audiencePersonas.workspaceId, String(workspaceId)))
          .orderBy(asc(audiencePersonas.name));
        const merged = mergeWithSamples(rows.map(toAudience), SAMPLE_AUDIENCE_PERSONAS);
        return ok({ items: merged.slice(0, page.limit), nextCursor: null });
      } catch (cause) {
        return storageFailure("読者像の一覧の読み出し", cause);
      }
    },

    async saveAuthor(persona: AuthorPersona) {
      const { id, workspaceId, ...rest } = persona;
      try {
        await db
          .insert(authorPersonas)
          .values({
            id: String(id),
            workspaceId: String(workspaceId),
            displayName: persona.displayName,
            updatedAt: new Date(),
            personaJson: JSON.stringify(rest),
          })
          // 同じ書き手を直したら差し替える。**弾かない。**
          // 弾くと、名前を変える以外に直す手段が無くなる。
          .onConflictDoUpdate({
            target: authorPersonas.id,
            set: {
              displayName: persona.displayName,
              updatedAt: new Date(),
              personaJson: JSON.stringify(rest),
            },
          });
        return ok(persona);
      } catch (cause) {
        return storageFailure("書き手の保存", cause);
      }
    },

    async saveAudience(persona: AudiencePersona) {
      const { id, workspaceId, ...rest } = persona;
      try {
        await db
          .insert(audiencePersonas)
          .values({
            id: String(id),
            workspaceId: String(workspaceId),
            name: persona.name,
            updatedAt: new Date(),
            personaJson: JSON.stringify(rest),
          })
          .onConflictDoUpdate({
            target: audiencePersonas.id,
            set: {
              name: persona.name,
              updatedAt: new Date(),
              personaJson: JSON.stringify(rest),
            },
          });
        return ok(persona);
      } catch (cause) {
        return storageFailure("読者像の保存", cause);
      }
    },
  });
}
