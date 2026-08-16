import type { ActorContext, DomainError, Result } from "@/domain/shared";

/**
 * ユースケースの共通の形。
 *
 * すべてのユースケースは
 *   1. 実行主体 (ActorContext) を第一引数で受け取る
 *   2. 失敗を Result で返す (throw しない)
 * の 2 つを守る。
 *
 * これを守ると、画面・REST API・WebMCP・バックエンド MCP の 4 経路が
 * 同じ関数を呼ぶだけで、同じ権限判定と同じ失敗表示になる。
 * 経路ごとにロジックを書き直さないための土台。
 */
export type UseCase<Input, Output> = {
  execute(actor: ActorContext, input: Input): Promise<Result<Output, DomainError>>;
};

/** 依存を受け取ってユースケースを組み立てる関数の形。 */
export type UseCaseFactory<Deps, Input, Output> = (deps: Deps) => UseCase<Input, Output>;
