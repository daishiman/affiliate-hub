import type { DomainError, Result, WorkspaceId } from "@/domain/shared";
import { err, ok, validationError } from "@/domain/shared";

type WorkspaceOwned = {
  readonly workspaceId: WorkspaceId;
};

/**
 * 入力された ID が、現在の作業場所に属する実在データを指すことを確かめる。
 *
 * 見つからない場合と別の作業場所にある場合を同じ断りへ畳むのは、
 * 他社データの存在そのものを入力者へ漏らさないためである。
 */
export function ensureOwnedReference<T extends WorkspaceOwned>(
  found: Result<T | null, DomainError>,
  workspaceId: WorkspaceId,
  field: string,
  message: string,
): Result<T, DomainError> {
  if (!found.ok) return found;
  if (found.value === null || found.value.workspaceId !== workspaceId) {
    return err(validationError(message, field));
  }
  return ok(found.value);
}
