/**
 * 改善層の協力者たち。
 *
 * 保存の性質 (置き換え・根拠必須・下書き止まり) は
 * `persistence/d1/seo-assessment-repository.ts` が持ち、**何を指摘とみなすか**
 * と**どこを引用単位とみなすか**をここが持つ。後者は差し替えたくなるが、
 * 前者は差し替えたくない。だから分けてある。
 */
export { createArticleSeoAnalyzer } from "./article-seo-analyzer";
export { createAnswerUnitExtractor } from "./answer-unit-extractor";
export { createSeoFixDrafter } from "./seo-fix-drafter";
