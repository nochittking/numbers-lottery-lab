import { useState, useEffect, useMemo, useCallback } from "react";
import {
  parseDraws, computeStats, generatePrediction, makeSample, isSample, STRATEGIES,
} from "../engine/digits";
import { loadDraws, saveDraws } from "../lib/storage";
import { T, cardStyle } from "../theme";
import { NumberBall, MetricTile, ImportPanel } from "../components/common";

export default function DigitsView({ spec }) {
  const [draws, setDraws] = useState([]);
  const [strategy, setStrategy] = useState("uniform");
  const [prediction, setPrediction] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const saved = loadDraws(spec.id);
    setDraws(saved && saved.length ? saved : makeSample(spec));
    setPrediction(null);
    setShowImport(false);
    setImportText("");
    setMsg(null);
  }, [spec]);

  const persist = useCallback((next) => { setDraws(next); saveDraws(spec.id, next); }, [spec.id]);
  const stats = useMemo(() => computeStats(draws, spec), [draws, spec]);
  const usingSample = isSample(draws);
  const color = spec.color;

  const handleImport = (mode) => {
    const { draws: parsed, errors } = parseDraws(importText, spec);
    if (!parsed.length) {
      setMsg({ type: "err", text: errors[0] || "有効なデータが見つかりませんでした。" });
      return;
    }
    const base = mode === "append" ? draws.filter((d) => !isSample([d])) : [];
    persist([...base, ...parsed]);
    setImportText("");
    setMsg({ type: "ok", text: `${parsed.length} 件を取り込みました。${errors.length ? `（${errors.length} 行スキップ）` : ""}` });
  };
  const handleReset = () => { persist(makeSample(spec)); setMsg({ type: "ok", text: "架空のサンプルに戻しました。" }); };
  const handleGenerate = () => setPrediction(generatePrediction(strategy, stats, spec));

  return (
    <>
      {/* 予測生成 */}
      <div style={{ ...cardStyle, boxShadow: `0 0 40px ${color}0c` }}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>
          🎲 数字を生成（{stats.total} 回分を参照 ／ {spec.digits}桁 各0〜9）
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
          minHeight: 56, display: "flex", gap: 10, justifyContent: "center", alignItems: "center",
          marginBottom: 14, padding: 8, background: T.cardInner, borderRadius: 12,
        }}>
          {prediction
            ? prediction.map((d, i) => <div key={i} style={{ animation: "pop 0.25s ease" }}><NumberBall n={d} size={46} color={color} /></div>)
            : <span style={{ fontSize: 10, color: T.textSub }}>下のボタンで生成します</span>}
        </div>
        <button onClick={handleGenerate} style={{
          width: "100%", padding: "14px 0", background: `radial-gradient(circle, ${color}28, ${color}0c)`,
          border: `2px solid ${color}bb`, color, borderRadius: 14, fontFamily: "inherit",
          fontWeight: 900, fontSize: 13, letterSpacing: 3, cursor: "pointer", textShadow: `0 0 10px ${color}88`,
        }}>この数字で生成する</button>
      </div>

      {/* サマリー */}
      <div style={cardStyle}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>📊 傾向サマリー</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
          <MetricTile label="各数字の理論出現" value={stats.expectedPerDigit.toFixed(1)} unit="回/桁" color={color} />
          <MetricTile label="当選番号の合計平均" value={stats.avgSum.toFixed(1)} unit="" color={color} />
        </div>
      </div>

      {/* 桁×数字 ヒートマップ */}
      <div style={cardStyle}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 4 }}>🔢 桁ごとの数字出現回数</div>
        <div style={{ fontSize: 8.5, color: T.textSub, marginBottom: 12 }}>
          縦＝桁の位置、横＝数字0〜9（色が濃いほど多く出ている）
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto repeat(10,1fr)", gap: 4, alignItems: "center" }}>
          <div />
          {Array.from({ length: 10 }, (_, d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.textSub }}>{d}</div>
          ))}
          {stats.freqPos.map((row, pos) => {
            const [r, g, b] = hexToRgb(color);
            return (
              <FragRow key={pos}>
                <div style={{ fontSize: 9, color: T.textSub, paddingRight: 4 }}>{pos + 1}桁目</div>
                {row.map((freq, d) => {
                  const intensity = stats.maxPos ? freq / stats.maxPos : 0;
                  return (
                    <div key={d} style={{
                      aspectRatio: "1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `rgba(${r},${g},${b},${0.08 + intensity * 0.55})`, border: `1px solid ${T.border}`,
                      fontSize: 8, color: T.textSub,
                    }}>{freq}</div>
                  );
                })}
              </FragRow>
            );
          })}
        </div>
      </div>

      {/* 全体頻度 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3, marginBottom: 12 }}>🔥 桁を問わない出現ランキング</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {stats.overallByFreq.map(({ d, freq }) => (
            <div key={d} style={{
              display: "flex", alignItems: "center", gap: 5, background: T.cardInner,
              borderRadius: 20, padding: "4px 8px", border: `1px solid ${T.border}`,
            }}>
              <NumberBall n={d} size={24} color={color} />
              <span style={{ fontSize: 9, color: T.textSub }}>{freq}回</span>
            </div>
          ))}
        </div>
      </div>

      {/* データ管理 */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showImport ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3 }}>💾 過去データ管理</div>
            <div style={{ fontSize: 9, color: usingSample ? T.hot : T.green, marginTop: 4 }}>
              {usingSample ? "※ 現在は架空のサンプル（実在の当選番号ではありません）" : `${stats.total} 件の取り込みデータを使用中`}
            </div>
          </div>
          <button onClick={() => { setShowImport((v) => !v); setMsg(null); }} style={{
            background: color + "18", border: `1px solid ${color}66`, color, borderRadius: 8,
            padding: "7px 12px", fontSize: 9, fontFamily: "inherit", letterSpacing: 1, cursor: "pointer", flexShrink: 0,
          }}>{showImport ? "閉じる" : "取り込む"}</button>
        </div>
        {showImport && (
          <ImportPanel
            color={color}
            hint={`形式: 回号, 日付, 当選番号（${spec.digits}桁）`}
            placeholder={`例:\n1000, 2023-01-06, ${"1".repeat(spec.digits)}\n1001, 2023-01-07, ${"7".repeat(spec.digits)}`}
            value={importText} onChange={(e) => setImportText(e.target.value)}
            onReplace={() => handleImport("replace")} onAppend={() => handleImport("append")}
            onReset={handleReset} msg={msg}
          />
        )}
      </div>
    </>
  );
}

// grid の行をまとめて配置するためのフラグメント（display:contents）
function FragRow({ children }) {
  return <div style={{ display: "contents" }}>{children}</div>;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
