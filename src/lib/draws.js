/*
 * ゲーム種別（combination / digits）に応じたエンジンの振り分けファサード。
 * データ管理UIを両ビューで共通化するために使う。
 */
import * as combination from "../engine/combination";
import * as digits from "../engine/digits";

export function engineFor(spec) {
  return spec.type === "combination" ? combination : digits;
}
