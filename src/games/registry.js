/*
 * 対応する数字選択くじの仕様（設定駆動）。
 * ここに1エントリ足すだけで新しいくじに横展開できる。
 *
 * type:
 *   "combination" … 範囲[min,max]から重複なしで pick 個 + ボーナス bonus 個（ロト系）
 *   "digits"      … 各桁 0〜9 を独立に digits 桁（重複可）（ナンバーズ系）
 */
export const GAMES = {
  loto7: {
    id: "loto7", name: "ロト7", type: "combination",
    min: 1, max: 37, pick: 7, bonus: 2, color: "#FFD23F",
    note: "1〜37から異なる7個を選ぶ（＋ボーナス2個）",
  },
  loto6: {
    id: "loto6", name: "ロト6", type: "combination",
    min: 1, max: 43, pick: 6, bonus: 1, color: "#5DA9FF",
    note: "1〜43から異なる6個を選ぶ（＋ボーナス1個）",
  },
  miniloto: {
    id: "miniloto", name: "ミニロト", type: "combination",
    min: 1, max: 31, pick: 5, bonus: 1, color: "#4FE08A",
    note: "1〜31から異なる5個を選ぶ（＋ボーナス1個）",
  },
  numbers3: {
    id: "numbers3", name: "ナンバーズ3", type: "digits",
    digits: 3, color: "#FF8A3D",
    note: "各桁 0〜9 を3桁（同じ数字OK）",
  },
  numbers4: {
    id: "numbers4", name: "ナンバーズ4", type: "digits",
    digits: 4, color: "#C77DFF",
    note: "各桁 0〜9 を4桁（同じ数字OK）",
  },
};

export const GAME_LIST = Object.values(GAMES);
