// 共通テーマ（ダーク基調）。アクセント色は各ゲームの color を使う。
export const T = {
  bg: "radial-gradient(ellipse at 30% 10%, #12131c 0%, #0a0a10 55%, #050508 100%)",
  card: "#12121b",
  cardInner: "#0c0c14",
  text: "#e9e9f4",
  textSub: "#7a7a95",
  border: "#26263a",
  hot: "#FF5D5D",
  cold: "#5DA9FF",
  green: "#4FE08A",
};

export const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  padding: "16px 14px",
  marginBottom: 12,
};

export function actionBtn(color) {
  return {
    flex: 1, padding: "10px 0",
    background: color + "16", border: `1px solid ${color}66`, color,
    borderRadius: 9, fontFamily: "inherit", fontSize: 9, letterSpacing: 1,
    cursor: "pointer",
  };
}
