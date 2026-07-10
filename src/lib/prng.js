/*
 * 再現性のある擬似乱数（線形合同法）。
 * 架空サンプルデータの決定論的生成に使う。
 * ※ 予測生成そのものには Math.random を使う（毎回異なる結果にするため）。
 */
export function makePrng(seed = 123456789) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
