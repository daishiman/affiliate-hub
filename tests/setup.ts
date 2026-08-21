import { afterEach, vi } from "vitest";
import { resetTestCookies } from "./support/cookie-jar";

/**
 * Next.js の「要求ごとの入れ物」をテストの中で用意する。
 *
 * `cookies()` は本来、届いた要求の中でしか呼べない。
 * 画面をそのまま描くと `cookies was called outside a request scope` で落ちるが、
 * これは画面の不具合ではなく**実行の文脈が無い**だけである。
 *
 * ここで差し替えるものを 2 つに絞っているのは、差し替えを増やすほど
 * 「テストでは通るが本番では落ちる」隙間が広がるため。
 * 差し替えたいものが 3 つ目に増えたときは、まず
 * **画面が実行環境に触りすぎていないか**を疑うこと。
 *
 * 規範: docs/architecture/testing-architecture.md §8
 */

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("./support/cookie-jar");
  const store = {
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
    has: (name: string) => cookieJar.has(name),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  };
  return {
    cookies: async () => store,
    headers: async () => new Headers(),
    draftMode: async () => ({ isEnabled: false }),
  };
});

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  // 画面の移動そのもの（`redirect`）は本物のまま残す。
  // 差し替えると「移動したつもり」のテストが書けてしまい、
  // 移動先を間違えていても緑になる。
  const noop = () => undefined;
  return {
    ...actual,
    useRouter: () => ({
      push: noop,
      replace: noop,
      refresh: noop,
      back: noop,
      forward: noop,
      prefetch: noop,
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  };
});

afterEach(() => {
  resetTestCookies();
});
