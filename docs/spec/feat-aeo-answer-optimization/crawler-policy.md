# クローラの扱い — 回答エンジン最適化 (feat-aeo-answer-optimization)

P02 の成果物。受入条件 7。
正本は `src/application/seo/feeds.ts` の `buildRobotsTxt`。

## 方針

**AI クローラに読ませる。遮断の仕組みは持たない。**

```ts
export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;
```

## 出力の形

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

# llms.txt: https://example.com/s/blog/llms.txt

Sitemap: https://example.com/s/blog/sitemap.xml
```

## 既定で全許可なのに 4 種を明示する理由

`User-agent: *` が `Allow: /` なので、
技術的には 4 行を書かなくても結果は同じである。

それでも書くのは、
**「AI に読まれることを選んでいる」ことを残す**ため。

robots.txt は人も読む。
明示が無いと「AI のことを考えていない」のか
「考えた上で許可した」のか区別できない。

半年後に方針を見直す人が、
そこに判断があったことを知れる。

## 遮断（Disallow）を 1 行も書かない

```ts
// 遮断の行はこの関数からは出さない（遮断はこのプロダクトの方針の外）。
```

`feeds.test.ts` の「遮断（Disallow）を 1 行も書かない」で固定してある。

### なぜ持たないか

このプロダクトは AEO を feature として持つ。
**AI クローラに読ませて、回答として引用されたい**側に立っている。

同じ製品に「読ませる仕組み」と「読ませない仕組み」を両方置くと、
どちらが効いているのか運用者が追えなくなる。

ブログごとに片方だけ遮断できると、
「引用されないのは遮断のせいか、記事の形のせいか」が
分からない状態が生まれる。

**これは `feat-seo-assessment-reflection` の受入条件 8 を
満たさない判断と同じもの**である。
あちらの `acceptance-report.md` に未達として記録した。

### 必要になったら

方針の側から決め直すべきで、
関数に枝を足して済ませる話ではない。

遮断を入れるなら、AEO 側の期待値も同時に変える必要がある。

## 順序に意味がある

```
Sitemap の行は最後に来る（注記の中に埋もれない）
既定の User-agent: * が Allow: / で始まる（4 種の前に、全部への許可がある）
```

- `User-agent: *` を先頭に置くのは、
  一部のクローラが最初のブロックしか読まないことがあるため
- `Sitemap:` を最後に置くのは、
  `# llms.txt:` のコメントの中に埋もれて見えなくなるのを避けるため

どちらもテストで固定してある。

## llms.txt の注記

```ts
if (options.emitLlmsTxt) {
  // robots.txt に llms.txt の公式な項目は無いので、
  // 人と AI の両方が読める注記で置く。
  lines.push(`# llms.txt: ${origin}${basePath}/llms.txt`, ``);
}
```

`llms.txt` は robots.txt の正式な項目ではない。

コメント行として置いているのは、
**規格に無いものを規格の項目のふりをして書かない**ため。

`Llms:` のような独自の行を足すと、
厳格に読むクローラが robots.txt 全体を解析できなくなる可能性がある。
コメントなら必ず無視される。

出すかどうかはブログごとの設定
（`emitLlmsTxt`）で切り替わる。

`feeds.test.ts`「llms.txt を出すブログでは在り処の注記が付き、
出さないブログでは付かない」。
