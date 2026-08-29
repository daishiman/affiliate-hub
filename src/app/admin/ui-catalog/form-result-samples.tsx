import { Code, FormResult, FormValue, Prose, SubSection, TextLink } from "@/presentation/ui";
import styles from "../admin.module.css";

/**
 * 送ったあとの知らせの見本。
 *
 * --- なぜ見本が要るか ---
 *
 * この骨格は元々 **14 ファイル・18 か所**に写されていて、写しであるあいだに
 * 失敗時の見出しが 4 通り、成功の呼び名が 3 通り、成功時の色が 4 通りに
 * 割れていた（2026-08-22 / `ah-brd`）。`FormResult` に寄せて割れは消えたが、
 * **見本帳に載っていなければ、次に欄を作る人はここに在ることを知らない**。
 * 知らなければまた 4 行を自分で書く。共通化はそこから崩れ直す。
 *
 * --- 何を並べるか ---
 *
 * 3 つの状態（何もしていない・成功・失敗）と、成功の色の使い分けを並べる。
 * 色は好みで選ぶものではなく、**画面ごとに違う事実**を指すためにある。
 */
export function FormResultSamples() {
  return (
    <div className={styles.catalogStack}>
      <SubSection
        title="何もしていない（idle）"
        lead="押す前は何も出ない。「まだ押していない」と「押したが何も返らなかった」を見た目で分けるため、ここに枠を出さない。"
      >
        <FormResult state={{ status: "idle", message: "" }} />
        <Prose>（上に何も出ていないのが正しい状態です。）</Prose>
      </SubSection>

      <SubSection
        title="成功（done）"
        lead="既定の色は success。文は「何が起きたか」を言い切る。「保存しました」で終わらせず、何が保存されたかまで書く。"
      >
        <FormResult
          state={{ status: "done", message: "ブログ「暮らしの道具」の設計図を直しました。" }}
          doneAction={<TextLink href="/admin/sites">このブログを見る</TextLink>}
        />
      </SubSection>

      <SubSection
        title="成功だが、何も変わらなかった（done + info）"
        lead="押した結果が「すでにそうなっていた」とき。失敗ではないので warn にしない。success にすると、直っていないのに直った気になる。"
      >
        <FormResult
          state={{ status: "done", message: "入力した内容は、いま入っている値と同じでした。" }}
          doneTone="info"
        />
      </SubSection>

      <SubSection
        title="成功だが、人が見るべきものが残った（done + warn）"
        lead="進みはしたが、確かめられなかった項目や手で出す先が残るとき。成功の枠に混ぜて消さず、色で残す。"
      >
        <FormResult
          state={{ status: "done", message: "記事を公開しました。" }}
          doneTone="warn"
        />
      </SubSection>

      <SubSection
        title="失敗（failed）"
        lead="見出しを持たない。tone=warn がすでに「うまくいかなかった」を伝えているので、見出しは同じことの二度言いになる。引数の口ごと無くしてある。"
      >
        <FormResult
          state={{
            status: "failed",
            message: "この配信はすでに送られているため、直せません。",
          }}
        />
      </SubSection>

      <SubSection
        title="欄に紐付く失敗は、ここに出さない"
        lead="field が付いている断りは、その欄の下に出す。まとめて上に出すと、どの欄を直せばよいかが分からない。"
      >
        <FormResult
          state={{ status: "failed", message: "3 文字以上で入れてください。", field: "title" }}
        />
        <Prose>（上に何も出ていないのが正しい状態です。断りは「題名」の欄の下に出ます。）</Prose>
      </SubSection>

      <SubSection
        title="送るが見せない値（FormValue）"
        lead="画面が知っていて人が選ばない値を、隠し欄として送る。素の input type=hidden を書かないのは、名前の綴りを画面ごとに書き写すことになるため。"
      >
        {/*
          見えない部品なので、置いてあること自体は目で確かめられない。
          ここに在ることと、何が送られるかを文で示す。
        */}
        <FormValue name="id" value="site_01HZX" />
        <FormValue name="intent" value="update" />
        <Prose>
          上に 2 つ置いてあります（<Code>id=site_01HZX</Code> と <Code>intent=update</Code>）。
          見た目を持たないので画面には出ませんが、送信すると一緒に送られます。
        </Prose>
      </SubSection>
    </div>
  );
}
