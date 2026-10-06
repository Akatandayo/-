/* ギフトコード一覧
 * h はコードのハッシュ（SHA-256）。コード本体はここに書かないこと。
 * 追加方法: デバッグ版の開発者パネル「ギフト」タブ、または tools/make_gift.py で登録行を作って下に貼る。
 *   title   : 受け取り時に表示する名前
 *   from    : この日から有効（YYYY-MM-DD、省略可）
 *   until   : この日まで有効（YYYY-MM-DD、省略可）
 *   rewards : money（銭）/ items {chibi, random, book, scroll} / contracts [{id, lv}]（契約書）/ kodama [{id, lv}]（直接加入）
 * 限定キャラを配る場合は custom.js に special: true（vs なし）で追加し、kodama か contracts で配布する。
 */
window.GK_GIFTS = [
  {"h": "c05ffc8c4add7a25cd0aa637a603fbde54a40418800a8dd9eb508f6896a691b8", "title": "リリース記念", "rewards": {"money": 10000, "items": {"chibi": 3, "scroll": 3}}},
];
