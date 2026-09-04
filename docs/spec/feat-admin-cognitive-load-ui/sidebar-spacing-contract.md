# サイドバー間隔契約

- アイコンと文字の間隔は `--layout-nav-icon-label-gap` だけを正本とし、既定値は `--space-3`。
- `.navLink` は `gap: var(--layout-nav-icon-label-gap)` を使い、画面・項目ごとの margin で調整しない。
- アイコン枠は `--icon-md`、操作面は `--tap-target-min` 以上。文字は 2 行まで折り返せる。
- 折りたたみ時は文字を視覚的に隠しても DOM と accessible name に残し、全項目のアイコンを一意にする。
- 375 / 768 / 1280 / 1600px と 200% zoom で icon/text の重なり、切断、focus ring の欠落を起こさない。
