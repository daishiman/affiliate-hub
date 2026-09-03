# 実ブラウザ証跡

## 自動 E2E

対象: `src/app/admin` の全86 route。危険操作は `/admin/distribution/pub_own_site_ready`、`/admin/affiliate/links`、`/admin/inbox`、`/admin/feedback/fb_sample_sort` の隔離fixtureも実走。

- 375 / 768 / 1280 / 1600 CSS px: 全86管理routeで PASS
- 200% 相当: 全86管理routeを384px CSS viewport（768pxの200%相当）で表示し、2次元scroll強制0
- keyboard: skip linkから台帳のrole / accessible name / occurrenceで名指した主要対象へ実Tab到達。内部GETはEnter完了、`no-control` 成功扱い0
- table: column header と primary key が `position: sticky`
- ホーム: `AI から使える操作`、`endpoint`、`tool catalog` の可視テキスト 0
- 状態: 暫定・確定・母数不足の3枝を可視文字と読み上げ名で検査
- 安全確認: 公開は影響説明とcheckboxが揃うまで実行不可。成果リンクは旧行停止→広告主/商品選択→新行登録→両行の影響までdesktopで実書込確認
- 開示: 根拠、読者像、改善要望のsummaryに種類+件数があり、全detailsがclosedで開始
- undo: desktopで通常操作を書き込み、取り消して初期状態へ復元。mobileは共有D1への二重mutationを避ける意図skip

コマンド:

```bash
pnpm exec playwright test tests/e2e/admin-cognitive-load-ui.spec.ts --workers=1
# 22 passed / 2 intentional skip / 0 failed
# 全体前回: 492 passed / 2 intentional skip / 0 failed
# AC11強化後 all-admin: 86 passed / 0 failed
```

## Workers preview診断

- `/admin` LCP 149ms（TTFB 78ms / render delay 71ms）、CLS 0.00
- Lighthouse: Accessibility 100 / Best Practices 100 / SEO 100 / Agentic Browsing 100（54 passed / 0 failed）
- console error / warning / issue: 0
- network: 46 requests、失敗0
- accessibility treeでnavigation / banner / main / 状態説明 / h1 / 主要linkを確認

## 手動確認手順

1. `http://127.0.0.1:3000/signin` を開く。
2. `owner@local.test として入る` を選ぶ。
3. `/admin` で「要確認」と主要 action が先に見え、内部 API 情報がないことを確認する。
4. `/admin/ai-usage` で要約 → 比較グラフ → 正確値の表の順を確認する。
5. `/admin/ui-catalog` で Tab 移動、6 状態、要約、グラフ、sticky 表を確認する。
6. DevTools を 375 / 768 / 1280 / 1600 px と 200% にし、横・縦の二次元 scroll を強いないことを確認する。
7. `/admin/distribution/pub_own_site_ready` で「公開前の内容と影響を確認する」を押し、明示checkboxまでは公開buttonが無効なことを確認する（実公開は押さない）。
8. `/admin/affiliate/links` の「ローカル確認用の成果リンク」で、登録し直す説明・理由・確認checkboxが揃うまで停止buttonが無効なことを確認する（実停止は押さない）。
9. `/admin/feedback/fb_sample_sort` で「対応しない」を理由付きで決め、「扱いを取り消して元に戻す」で入力状態へ戻ることを確認する。
