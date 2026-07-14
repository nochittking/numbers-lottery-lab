import { T } from "../theme";

// 数字ボール（ロト用）
export function NumberBall({ n, size = 34, color = T.text, faded = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: faded ? "transparent" : `radial-gradient(circle at 35% 30%, ${color}, ${color}99)`,
      border: `1.5px solid ${color}${faded ? "55" : ""}`,
      color: faded ? color : "#0a0a10",
      fontWeight: 900, fontSize: size * 0.4,
      boxShadow: faded ? "none" : `0 0 10px ${color}55`,
      flexShrink: 0,
    }}>{n}</div>
  );
}

// 免責バナー（全ゲーム共通・必読）
export function Disclaimer({ color, onClose }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${color}66`, borderRadius: 18,
      padding: "16px 14px", marginBottom: 12, animation: "fadeDown 0.2s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 10, color, letterSpacing: 2 }}>⚠ 必ずお読みください</div>
        <button onClick={onClose} style={{
          background: "transparent", border: `1px solid ${T.border}`, color: T.textSub,
          borderRadius: 6, padding: "3px 8px", fontSize: 9, fontFamily: "inherit", cursor: "pointer",
        }}>閉じる</button>
      </div>
      <div style={{ fontSize: 10, lineHeight: 1.7, color: T.textSub }}>
        数字選択くじは<b style={{ color: T.text }}>毎回独立した抽選</b>です。過去の結果から次回を
        当てることは数学的にできません。本ツールの「予測」は当選を保証するものではなく、
        傾向を可視化して数字選びを楽しむための<b style={{ color: T.text }}>娯楽・学習目的</b>です。
        購入は20歳以上・自己責任で、無理のない範囲でお願いします。
      </div>
    </div>
  );
}

// 統計サマリーのメトリクスタイル
export function MetricTile({ label, value, unit, color }) {
  return (
    <div style={{ background: T.cardInner, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 8, color: T.textSub }}>{unit}</div>
      <div style={{ fontSize: 8.5, color: T.textSub, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ※ データ取込UIは components/DataPanel.js に移動（CSV/OCR/一覧管理対応のため）
