import type { ReactNode } from "react";

export type DescriptionTimeProps = {
  readonly label: ReactNode;
  readonly dateTime: string;
  readonly children: ReactNode;
  readonly className?: string;
};

/**
 * 定義リスト中の「名前 + 時刻」を正しい語彙で描く。
 * 日付の表示形式は呼び出し元が決め、機械可読値だけを `dateTime` で分ける。
 */
export function DescriptionTime({ label, dateTime, children, className }: DescriptionTimeProps) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>
        <time dateTime={dateTime}>{children}</time>
      </dd>
    </div>
  );
}
