import { useState, useEffect, useMemo, useCallback } from "react";
import {
  computeStats, generatePrediction, makeSample, STRATEGIES,
} from "../engine/combination";
import { loadDraws, saveDraws } from "../lib/storage";
import { T, cardStyle } from "../theme";
import { NumberBall, MetricTile } from "../components/common";
import DataPanel from "../components/DataPanel";

export default function CombinationView({ spec }) {
  const [draws, setDraws] = useState([]);
  const [strategy, setStrategy] = useState("uniform");
  const [prediction, setPrediction] = useState(null);

  // ゲーム切替時にロード（LocalStorage→なければ架空サンプル）
  useEffect(() => {
    const saved = loadDraws(spec.id);
    setDraws(saved && saved.length ? saved : makeSample(spec));
    setPrediction(null);
  }, [spec]);

  const persist = useCallback((next) => {
    setDraws(next);
    saveDraws(spec.id, next);
  }, [spec.id]);

  const stats = useMemo(() => computeStats(draws, spec), [draws, spec]);
  const color = spec.color;

  const handleGenerate = () => setPrediction(generatePrediction(strategy, stats, spec));

  return (
    <>
      {/* 予測生成 */}
      <div style={{ ...cardStyle, boxShadow: `0 0 40px ${color}0c` }}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>
          🎲 数字を生成（{stats.total} 回分を参照 ／ {spec.min}〜{spec.max} から {spec.pick} 個）
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
          {Object.entries(STRATEGIES).map(([key, s]) => {
            const active = strategy === key;
            return (
              <button key={key} onClick={() => setStrategy(key)} style={{
                padding: "9px 4px",
                background: active ? color + "1a" : T.cardInner,
                border: `1px solid ${active ? color + "bb" : T.border}`,
                borderRadius: 10, color: active ? color : T.textSub,
                fontFamily: "inherit", fontSize: 9.5, fontWeight: active ? 700 : 400, cursor: "pointer",
              }}>{s.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: T.textSub, marginBottom: 14, minHeight: 13 }}>{STRATEGIES[strategy].sub}</div>
        <div style={{
          minHeight: 56, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
          alignItems: "center", marginBottom: 14, padding: 8, background: T.cardInner, borderRadius: 12,
        }}>
          {prediction
            ? prediction.map((n) => <div key={n} style={{ animation: "pop 0.25s ease" }}><NumberBall n={n} size={40} color={color} /></div>)
            : <span style={{ fontSize: 10, color: T.textSub }}>下のボタンで生成します</span>}
        </div>
        <button onClick={handleGenerate} style={{
          width: "100%", padding: "14px 0",
          background: `radial-gradient(circle, ${color}28, ${color}0c)`,
          border: `2px solid ${color}bb`, color, borderRadius: 14,
          fontFamily: "inherit", fontWeight: 900, fontSize: 13, letterSpacing: 3, cursor: "pointer",
          textShadow: `0 0 10px ${color}88`,
        }}>この数字で生成する</button>
      </div>

      {/* 傾向サマリー */}
      <div style={cardStyle}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>📊 傾向サマリー</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <MetricTile label="奇数の平均" value={stats.avgOdd.toFixed(1)} unit={`/${spec.pick}個`} color={color} />
          <MetricTile label={`低位(〜${stats.lowThreshold})平均`} value={stats.avgLow.toFixed(1)} unit={`/${spec.pick}個`} color={color} />
          <MetricTile label="合計値の平均" value={Math.round(stats.avgSum)} unit="" color={color} />
        </div>
      </div>

      {/* Hot / Overdue */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ fontSize: 9, color: T.hot, letterSpacing: 2, marginBottom: 10 }}>🔥 高頻度 TOP5</div>
          {stats.byFreq.slice(0, 5).map((x) => (
            <div key={x.n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <NumberBall n={x.n} size={26} color={T.hot} /><span style={{ fontSize: 10, color: T.textSub }}>{x.freq}回</span>
            </div>
          ))}
        </div>
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ fontSize: 9, color: T.cold, letterSpacing: 2, marginBottom: 10 }}>❄️ ご無沙汰 TOP5</div>
          {stats.byGap.slice(0, 5).map((x) => (
            <div key={x.n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <NumberBall n={x.n} size={26} color={T.cold} /><span style={{ fontSize: 10, color: T.textSub }}>{x.gap}回ぶり</span>
            </div>
          ))}
        </div>
      </div>

      {/* 出現回数ヒートマップ */}
      <div style={cardStyle}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 4 }}>🔢 全数字の出現回数</div>
        <div style={{ fontSize: 8.5, color: T.textSub, marginBottom: 12 }}>
          理論上の平均は {stats.expectedFreq.toFixed(1)} 回（色が濃いほど多く出ている）
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 5 }}>
          {stats.nums.map(({ n, freq }) => {
            const intensity = stats.maxFreq ? freq / stats.maxFreq : 0;
            const [r, g, b] = hexToRgb(color);
            return (
              <div key={n} style={{
                aspectRatio: "1", borderRadius: 7, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: `rgba(${r},${g},${b},${0.08 + intensity * 0.5})`, border: `1px solid ${T.border}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{n}</span>
                <span style={{ fontSize: 7.5, color: T.textSub }}>{freq}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 共起ペア */}
      {stats.topPairs.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>🔗 よく一緒に出た数字ペア</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stats.topPairs.map(({ pair, count }) => {
              const [a, b] = pair.split("-");
              return (
                <div key={pair} style={{
                  display: "flex", alignItems: "center", gap: 4, background: T.cardInner,
                  borderRadius: 20, padding: "4px 8px", border: `1px solid ${T.border}`,
                }}>
                  <NumberBall n={a} size={22} color={color} />
                  <NumberBall n={b} size={22} color={color} />
                  <span style={{ fontSize: 9, color: T.textSub, marginLeft: 2 }}>{count}回</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DataPanel spec={spec} draws={draws} onChange={persist} />
    </>
  );
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
