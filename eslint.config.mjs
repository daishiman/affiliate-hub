import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // wrangler / opennext が生成するもの
    "cloudflare-env.d.ts",
    ".open-next/**",
    ".wrangler/**",
    // HarnessHub からベンダリングしたプラグイン。上流が真実源で本リポジトリでは編集しない
    // (更新は .claude/scripts/sync-plugins.sh)。lint して直すと次の同期で消える。
    ".claude/plugins/**",
  ]),

  // `_` 始まりは「今は使わないが、契約上そこにある引数」を表す。
  // たたき台のスタブでは、本実装で使う引数を先に受け取っておくことが多い。
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // 依存方向の境界。編集中に気づけるよう lint でも止める。
  // 取りこぼしのない検査は tests/architecture/dependency-direction.test.ts が行う。
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "drizzle-orm",
                "drizzle-orm/*",
                "@opennextjs/cloudflare",
                "better-auth",
                "better-auth/*",
                "cloudflare:*",
                "@/application/*",
                "@/infrastructure/*",
                "@/presentation/*",
                "@/components/*",
                "@/lib/*",
                "@/db/*",
                "@/app/*",
              ],
              message:
                "domain 層は外側に依存できません。必要な処理は application のポートとして宣言し、実装は infrastructure に置いてください。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/ranking/**/*.ts", "src/application/usecases/ranking/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*monetization*", "*affiliate*"],
              message:
                "ランキングに報酬・広告主の情報を入れることはできません (仕様の中核制約)。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/*", "@/presentation/*", "@/components/*", "@/app/*", "@/db/*"],
              message:
                "application 層は実装ではなくポート (インターフェース) に依存します。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/presentation/*", "@/components/*", "@/app/*"],
              message:
                "infrastructure は入口 (画面・API) を知りません。組み立ては src/presentation/composition.ts が行います。",
            },
          ],
        },
      ],
    },
  },
  {
    // presentation の中で実装を選んでよいのは composition.ts だけ。
    // 画面や API ルートが実装を直接読むと、差し替えが全画面の書き換えになる。
    files: ["src/presentation/**/*.ts", "src/presentation/**/*.tsx"],
    ignores: ["src/presentation/composition.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/*"],
              message:
                "実装の選択は src/presentation/composition.ts に集約します。画面や API からは直接読まないでください。",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
