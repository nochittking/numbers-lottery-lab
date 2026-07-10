import { useState } from "react";
import { GAME_LIST, GAMES } from "./games/registry";
import { T } from "./theme";
import { Disclaimer } from "./components/common";
import CombinationView from "./views/CombinationView";
import DigitsView from "./views/DigitsView";

/*
 * 数字選択くじ 統計分析ラボ
 *  - ロト7/6・ミニロト（組合せ型）、ナンバーズ3/4（桁型）に対応
 *  - 完全クライアントサイド・外部通信なし・エンタメ用途
 *  - STEPN等 他アプリの要素は一切含まない独立プロジェクト
 */
export default function App() {
  const [gameId, setGameId] = useState("loto7");
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const spec = GAMES[gameId];

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex", justifyContent: "center",
      fontFamily: "'Orbitron', monospace", color: T.text,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        button { transition:transform 0.1s; }
        button:active { transform:scale(0.95) !important; }
        @keyframes pop { from{opacity:0;transform:translateY(8px) scale(0.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        textarea::placeholder { color:${T.textSub}; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 440, padding: "20px 14px 56px" }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 8, color: T.textSub, letterSpacing: 5, marginBottom: 4 }}>▶ NUMBERS LOTTERY LAB</div>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: 2, color: spec.color, textShadow: `0 0 20px ${spec.color}55` }}>
            数字選択くじ 統計分析
          </div>
          <div style={{ fontSize: 9, color: T.textSub, marginTop: 4 }}>{spec.note}</div>
        </div>

        {/* くじ種セレクター */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {GAME_LIST.map((g) => {
            const on = g.id === gameId;
            return (
              <button key={g.id} onClick={() => setGameId(g.id)} style={{
                flex: "1 1 28%", padding: "9px 6px", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 11, letterSpacing: 0.5, whiteSpace: "nowrap",
                background: on ? g.color + "1f" : T.card,
                border: `1px solid ${on ? g.color + "aa" : T.border}`,
                color: on ? g.color : T.textSub,
              }}>{g.name}</button>
            );
          })}
        </div>

        {showDisclaimer && <Disclaimer color={spec.color} onClose={() => setShowDisclaimer(false)} />}

        {/* ゲーム種別に応じたビュー（key で切替時に状態リセット）*/}
        {spec.type === "combination"
          ? <CombinationView key={spec.id} spec={spec} />
          : <DigitsView key={spec.id} spec={spec} />}

        <div style={{ fontSize: 8, color: T.textSub, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          本ツールは当選を保証するものではありません。<br />
          ギャンブルは20歳以上・自己責任で、無理のない範囲でお楽しみください。
        </div>
      </div>
    </div>
  );
}
