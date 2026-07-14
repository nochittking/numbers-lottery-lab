import { useMemo, useRef, useState } from "react";
import { T, cardStyle, actionBtn } from "../theme";
import { engineFor } from "../lib/draws";
import { decodeCsvBuffer, parseCsvText, parseOcrText } from "../lib/csv";
import { mergeDraws, applyMergeResult, sortByRound, importedRange } from "../lib/merge";
import { buildDraw, drawNumbersText } from "../lib/validate";
import { roundKey } from "../lib/text";

/*
 * 過去データの取込＆管理パネル（両ゲーム種共通）。
 *  - テキスト貼り付け / CSVファイル（みずほ形式・Shift_JIS対応） / 画像OCR の3系統の取込
 *  - 回号キーの二重取込防止（同一はスキップ、数字違いは上書き確認）
 *  - 取込済み範囲の常時表示、一覧での編集・削除・全削除
 * すべてブラウザ内で完結し、外部送信は行わない。
 */
export default function DataPanel({ spec, draws, onChange }) {
  const engine = engineFor(spec);
  const color = spec.color;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("text");
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null); // 上書き確認待ち { res, parseErrors }
  const [ocr, setOcr] = useState(null);

  const usingSample = engine.isSample(draws);
  const range = usingSample ? null : importedRange(draws);

  // ─── マージ（二重取込防止）フロー ───
  const finalize = (res, overwrite, parseErrors) => {
    const { draws: next, added, skipped, overwritten } = applyMergeResult(res, overwrite);
    onChange(next);
    const errNote = parseErrors.length ? `（読み取れない行 ${parseErrors.length} 件）` : "";
    setMsg({
      type: "ok",
      text: `取込結果: 新規 ${added} 件・スキップ ${skipped} 件・上書き ${overwritten} 件 ${errNote}`,
      detail: parseErrors.slice(0, 5),
    });
    setPending(null);
  };

  const runMerge = (incoming, parseErrors = []) => {
    const base = usingSample ? [] : draws;
    const res = mergeDraws(base, incoming, spec);
    if (res.conflicts.length) { setPending({ res, parseErrors }); setMsg(null); }
    else finalize(res, false, parseErrors);
  };

  // ─── 各取込ハンドラ ───
  const handleTextImport = () => {
    const { draws: parsed, errors } = engine.parseDraws(importText, spec);
    if (!parsed.length) {
      setMsg({ type: "err", text: errors[0] || "有効なデータが見つかりませんでした。" });
      return;
    }
    setImportText("");
    runMerge(parsed, errors);
  };

  const handleCsvFiles = async (fileList) => {
    const all = [];
    const errs = [];
    for (const f of Array.from(fileList)) {
      try {
        const text = decodeCsvBuffer(await f.arrayBuffer());
        const r = parseCsvText(text, spec);
        all.push(...r.draws);
        errs.push(...r.errors.map((e) => `${f.name} ${e}`));
      } catch (e) {
        errs.push(`${f.name}: ファイルを読み込めませんでした`);
      }
    }
    if (!all.length) {
      setMsg({ type: "err", text: errs[0] || "CSVから有効な行が見つかりませんでした。", detail: errs.slice(1, 5) });
      return;
    }
    runMerge(all, errs);
  };

  const handleImageFile = async (fileList) => {
    const file = Array.from(fileList).find((f) => f.type.startsWith("image/"));
    if (!file) { setMsg({ type: "err", text: "画像ファイルを選択してください。" }); return; }
    setMsg(null);
    setOcr({ status: "running", progress: 0 });
    try {
      const { recognizeImage } = await import("../lib/ocr");
      const text = await recognizeImage(file, (p) => setOcr({ status: "running", progress: p }));
      const rows = parseOcrText(text, spec).map((r) => ({
        raw: r.raw,
        message: r.message,
        include: !!r.draw,
        fields: drawToFields(r.draw, spec),
        errors: [],
      }));
      if (!rows.length) setOcr({ status: "error", message: "画像から当せん行を読み取れませんでした。より鮮明なスクリーンショットでお試しください。" });
      else setOcr({ status: "review", rows });
    } catch (e) {
      setOcr({ status: "error", message: "OCRの初期化に失敗しました。ページを再読み込みして再度お試しください。" });
    }
  };

  const handleClearAll = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm("取込済みデータをすべて削除して、架空のサンプルに戻します。よろしいですか？")) {
      onChange(engine.makeSample(spec));
      setMsg({ type: "ok", text: "すべて削除し、架空のサンプルに戻しました。" });
    }
  };

  const switchTab = (t) => { setTab(t); setMsg(null); setPending(null); };

  const tabs = [
    ["text", "📋 テキスト"],
    ["csv", "📄 CSV"],
    ["ocr", "📷 画像OCR"],
    ["manage", "🗂 一覧・編集"],
  ];

  return (
    <div style={cardStyle}>
      {/* ヘッダー（取込済み範囲は常時表示） */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 9, color: T.textSub, letterSpacing: 3 }}>💾 過去データ取込・管理</div>
          <div style={{ fontSize: 9, color: usingSample ? T.hot : T.green, marginTop: 4 }}>
            {usingSample
              ? "※ 現在は架空のサンプル（実在の当選番号ではありません）"
              : range
                ? `取込済み: 第${range.min}回〜第${range.max}回（計${range.count}件）`
                : `取込済み: 計${draws.length}件`}
          </div>
        </div>
        <button onClick={() => { setOpen((v) => !v); setMsg(null); setPending(null); }} style={{
          background: color + "18", border: `1px solid ${color}66`, color, borderRadius: 8,
          padding: "7px 12px", fontSize: 9, fontFamily: "inherit", letterSpacing: 1, cursor: "pointer", flexShrink: 0,
        }}>{open ? "閉じる" : "開く"}</button>
      </div>

      {open && (
        <div style={{ animation: "fadeDown 0.2s ease" }}>
          {/* タブ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
            {tabs.map(([key, label]) => {
              const on = tab === key;
              return (
                <button key={key} onClick={() => switchTab(key)} style={{
                  padding: "8px 2px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 8.5, fontWeight: on ? 700 : 400, letterSpacing: 0.5,
                  background: on ? color + "1a" : T.cardInner,
                  border: `1px solid ${on ? color + "bb" : T.border}`,
                  color: on ? color : T.textSub,
                }}>{label}</button>
              );
            })}
          </div>

          <div style={{ fontSize: 9, color: T.textSub, lineHeight: 1.7, marginBottom: 10 }}>
            公式サイト等で確認した過去の当選番号を取り込めます。外部送信は一切行わず、
            お使いのブラウザ内（LocalStorage）にのみ保存します。取込済みの回号は自動でスキップします。
          </div>

          {tab === "text" && (
            <TextImport spec={spec} color={color} value={importText}
              onChange={setImportText} onImport={handleTextImport} />
          )}
          {tab === "csv" && (
            <FileZone color={color} accept=".csv,.txt,text/csv" multiple onFiles={handleCsvFiles}
              title="みずほ銀行等のCSVファイルをここにドラッグ＆ドロップ"
              sub="またはタップしてファイルを選択（複数可・Shift_JIS/UTF-8自動判定）" />
          )}
          {tab === "ocr" && (
            <OcrSection color={color} spec={spec} ocr={ocr} setOcr={setOcr}
              onFiles={handleImageFile} onConfirm={(parsedDraws) => { setOcr(null); runMerge(parsedDraws); }} />
          )}
          {tab === "manage" && (
            <ManageTable spec={spec} color={color} draws={draws} usingSample={usingSample}
              onChange={onChange} onClearAll={handleClearAll} setMsg={setMsg} />
          )}

          {/* 上書き確認 */}
          {pending && (
            <ConflictCard pending={pending} spec={spec}
              onOverwrite={() => finalize(pending.res, true, pending.parseErrors)}
              onSkip={() => finalize(pending.res, false, pending.parseErrors)} />
          )}

          {/* 結果メッセージ */}
          {msg && (
            <div style={{
              marginTop: 10, padding: "8px 10px", borderRadius: 8, fontSize: 9.5, lineHeight: 1.6,
              background: (msg.type === "ok" ? T.green : T.hot) + "15",
              border: `1px solid ${(msg.type === "ok" ? T.green : T.hot)}55`,
              color: msg.type === "ok" ? T.green : T.hot,
            }}>
              {msg.text}
              {msg.detail && msg.detail.length > 0 && (
                <div style={{ marginTop: 4, color: T.textSub, fontSize: 8.5 }}>
                  {msg.detail.map((d, i) => <div key={i}>・{d}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── テキスト貼り付け ───────────────────────────────────
function TextImport({ spec, color, value, onChange, onImport }) {
  const hint = spec.type === "combination"
    ? `形式: 回号, 日付, 本数字×${spec.pick}${spec.bonus ? `, ボーナス×${spec.bonus}` : ""}`
    : `形式: 回号, 日付, 当選番号（${spec.digits}桁）`;
  const placeholder = spec.type === "combination"
    ? `例:\n500, 2023-01-06, ${Array.from({ length: spec.pick }, (_, i) => spec.min + i * 2).join(", ")}${spec.bonus ? ", " + Array.from({ length: spec.bonus }, (_, i) => spec.min + 1 + i * 2).join(", ") : ""}`
    : `例:\n1000, 2023-01-06, ${"1".repeat(spec.digits)}\n1001, 2023-01-07, ${"7".repeat(spec.digits)}`;
  return (
    <div>
      <div style={{ fontSize: 9, color, marginBottom: 6 }}>{hint}（1行1回ぶん）</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{
        width: "100%", minHeight: 100, resize: "vertical",
        background: T.cardInner, border: `1px solid ${T.border}`, borderRadius: 10,
        color: T.text, fontFamily: "monospace", fontSize: 11, padding: "10px",
        outline: "none", lineHeight: 1.5,
      }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onImport} style={actionBtn(color)}>取り込む（重複は自動スキップ）</button>
      </div>
    </div>
  );
}

// ─── ドラッグ＆ドロップ対応ファイル選択 ─────────────────
function FileZone({ color, accept, multiple, onFiles, title, sub }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      style={{
        border: `2px dashed ${over ? color : T.border}`, borderRadius: 12, cursor: "pointer",
        padding: "26px 12px", textAlign: "center", background: over ? color + "0d" : T.cardInner,
      }}
    >
      <div style={{ fontSize: 10, color: over ? color : T.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 8.5, color: T.textSub }}>{sub}</div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} data-testid="file-input"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// ─── 上書き確認カード ───────────────────────────────────
function ConflictCard({ pending, spec, onOverwrite, onSkip }) {
  const { conflicts } = pending.res;
  return (
    <div style={{
      marginTop: 10, padding: "10px 12px", borderRadius: 10,
      background: T.hot + "10", border: `1px solid ${T.hot}66`,
    }}>
      <div style={{ fontSize: 10, color: T.hot, fontWeight: 700, marginBottom: 6 }}>
        ⚠ 同じ回号で数字が異なるデータが {conflicts.length} 件あります。上書きしますか？
      </div>
      <div style={{ fontSize: 8.5, color: T.textSub, lineHeight: 1.8, marginBottom: 8 }}>
        {conflicts.slice(0, 5).map((c) => (
          <div key={c.key}>
            第{c.key}回: 取込済み「{drawNumbersText(c.existing, spec)}」 → 新データ「{drawNumbersText(c.incoming, spec)}」
          </div>
        ))}
        {conflicts.length > 5 && <div>…ほか {conflicts.length - 5} 件</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onOverwrite} style={actionBtn(T.hot)}>上書きして取り込む</button>
        <button onClick={onSkip} style={actionBtn(T.textSub)}>上書きせず取り込む</button>
      </div>
    </div>
  );
}

// ─── OCR 取込（確認・修正画面つき）─────────────────────
function OcrSection({ color, spec, ocr, setOcr, onFiles, onConfirm }) {
  if (!ocr) {
    return (
      <div>
        <FileZone color={color} accept="image/*" onFiles={onFiles}
          title="当選結果一覧のスクリーンショット画像をここにドラッグ＆ドロップ"
          sub="またはタップして画像を選択（処理はすべて端末内・画像の外部送信なし）" />
        <div style={{ fontSize: 8.5, color: T.textSub, marginTop: 8, lineHeight: 1.7 }}>
          読み取り結果は必ず確認画面に表示され、修正してから保存します。
          初回はOCRエンジン（同梱）の読み込みに数秒かかります。
        </div>
      </div>
    );
  }
  if (ocr.status === "running") {
    const pct = Math.round((ocr.progress || 0) * 100);
    return (
      <div style={{ padding: "18px 10px", textAlign: "center" }}>
        <div style={{ fontSize: 10, color, marginBottom: 10 }}>画像を解析中… {pct}%</div>
        <div style={{ height: 6, background: T.cardInner, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.2s" }} />
        </div>
      </div>
    );
  }
  if (ocr.status === "error") {
    return (
      <div>
        <div style={{ fontSize: 9.5, color: T.hot, marginBottom: 8 }}>{ocr.message}</div>
        <button onClick={() => setOcr(null)} style={actionBtn(color)}>別の画像で再試行</button>
      </div>
    );
  }
  // 確認・修正画面
  return <OcrReview color={color} spec={spec} rows={ocr.rows} setOcr={setOcr} onConfirm={onConfirm} />;
}

function OcrReview({ color, spec, rows, setOcr, onConfirm }) {
  const updateRow = (i, patch) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setOcr({ status: "review", rows: next });
  };
  const setField = (i, name, value) => {
    const fields = { ...rows[i].fields, [name]: value };
    const { errors } = buildDraw(fields, spec);
    updateRow(i, { fields, errors });
  };

  const included = rows.filter((r) => r.include);
  const invalidCount = included.filter((r) => buildDraw(r.fields, spec).errors.length > 0).length;

  const confirm = () => {
    const parsedDraws = included.map((r) => buildDraw(r.fields, spec).draw);
    onConfirm(parsedDraws);
  };

  return (
    <div>
      <div style={{ fontSize: 9.5, color, marginBottom: 8 }}>
        📝 読み取り結果の確認・修正（{rows.length} 行検出）
      </div>
      <div style={{ fontSize: 8.5, color: T.textSub, marginBottom: 8, lineHeight: 1.6 }}>
        OCRは誤認識があり得ます。内容を確認・修正してから「確定して取り込む」を押してください。
        チェックを外した行は取り込まれません。
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const errors = r.include ? buildDraw(r.fields, spec).errors : [];
          const failed = !r.include && r.message;
          return (
            <div key={i} style={{
              background: T.cardInner, borderRadius: 10, padding: "8px 10px",
              border: `1px solid ${failed ? T.hot + "66" : errors.length ? T.hot + "66" : T.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <input type="checkbox" checked={r.include}
                  onChange={(e) => updateRow(i, { include: e.target.checked })}
                  style={{ accentColor: color }} />
                <span style={{ fontSize: 8, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  元テキスト: {r.raw}
                </span>
              </div>
              {r.message && (
                <div style={{ fontSize: 8.5, color: T.hot, marginBottom: 6 }}>⚠ 読み取れませんでした（{r.message}）。手入力で補正できます。</div>
              )}
              <DrawFieldsEditor spec={spec} color={color} fields={r.fields}
                onField={(name, value) => setField(i, name, value)} />
              {r.include && errors.length > 0 && (
                <div style={{ fontSize: 8.5, color: T.hot, marginTop: 4 }}>{errors.join("／")}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={confirm} disabled={!included.length || invalidCount > 0}
          style={{ ...actionBtn(color), opacity: !included.length || invalidCount > 0 ? 0.4 : 1 }}>
          確定して取り込む（{included.length} 行）
        </button>
        <button onClick={() => setOcr(null)} style={actionBtn(T.textSub)}>やり直す</button>
      </div>
      {invalidCount > 0 && (
        <div style={{ fontSize: 8.5, color: T.hot, marginTop: 6 }}>
          エラーのある行が {invalidCount} 行あります。修正するかチェックを外してください。
        </div>
      )}
    </div>
  );
}

// ─── 回号/日付/数字の編集フォーム（OCR確認・一覧編集で共用）──
function DrawFieldsEditor({ spec, color, fields, onField }) {
  const inputStyle = {
    background: "#0a0a12", border: `1px solid ${T.border}`, borderRadius: 7,
    color: T.text, fontFamily: "monospace", fontSize: 10.5, padding: "6px 8px",
    outline: "none", width: "100%",
  };
  const label = (t) => <div style={{ fontSize: 7.5, color: T.textSub, marginBottom: 2 }}>{t}</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: spec.type === "combination" ? "56px 90px 1fr 64px" : "64px 96px 1fr", gap: 6 }}>
      <div>
        {label("回号")}
        <input value={fields.round} onChange={(e) => onField("round", e.target.value)} style={inputStyle} />
      </div>
      <div>
        {label("日付")}
        <input value={fields.date} onChange={(e) => onField("date", e.target.value)} style={inputStyle} />
      </div>
      <div>
        {label(spec.type === "combination" ? `本数字（${spec.pick}個）` : `当選番号（${spec.digits}桁）`)}
        <input value={fields.numbers} onChange={(e) => onField("numbers", e.target.value)} style={inputStyle} />
      </div>
      {spec.type === "combination" && (
        <div>
          {label(`ボーナス`)}
          <input value={fields.bonus} onChange={(e) => onField("bonus", e.target.value)} style={inputStyle} />
        </div>
      )}
    </div>
  );
}

// ─── 取込済みデータの一覧・編集・削除 ────────────────────
function ManageTable({ spec, color, draws, usingSample, onChange, onClearAll, setMsg }) {
  const [editKey, setEditKey] = useState(null); // 編集中の行（draws内のオブジェクト参照）
  const [editFields, setEditFields] = useState(null);
  const [editErrors, setEditErrors] = useState([]);

  const sorted = useMemo(
    () => (usingSample ? [] : sortByRound(draws).reverse()), // 新しい回が上
    [draws, usingSample]
  );

  const startEdit = (d) => {
    setEditKey(d);
    setEditFields(drawToFields(d, spec));
    setEditErrors([]);
  };

  const saveEdit = () => {
    const { draw, errors } = buildDraw(editFields, spec);
    const newKey = roundKey(draw.round);
    const dup = draws.some((d) => d !== editKey && roundKey(d.round) === newKey);
    const all = [...errors, ...(dup ? ["この回号は既に存在します"] : [])];
    if (all.length) { setEditErrors(all); return; }
    onChange(sortByRound(draws.map((d) => (d === editKey ? draw : d))));
    setEditKey(null);
    setMsg({ type: "ok", text: `第${newKey}回を更新しました。` });
  };

  const remove = (d) => {
    onChange(draws.filter((x) => x !== d));
    setMsg({ type: "ok", text: `第${roundKey(d.round) ?? d.round}回を削除しました。` });
  };

  if (usingSample) {
    return (
      <div style={{ fontSize: 9.5, color: T.textSub, lineHeight: 1.8, padding: "8px 0" }}>
        現在は架空のサンプルデータを表示しています。テキスト・CSV・画像OCRから
        実際の当選番号を取り込むと、ここで一覧・編集・削除ができます。
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 8.5, color: T.textSub, marginBottom: 6 }}>回号の新しい順（{draws.length} 件）</div>
      <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
        {sorted.map((d, i) => {
          const editing = editKey === d;
          return (
            <div key={`${roundKey(d.round) ?? d.round}-${i}`} style={{
              padding: "7px 10px", fontSize: 9.5,
              borderBottom: i < sorted.length - 1 ? `1px solid ${T.border}` : "none",
              background: editing ? color + "0d" : "transparent",
            }}>
              {editing ? (
                <div>
                  <DrawFieldsEditor spec={spec} color={color} fields={editFields}
                    onField={(name, value) => setEditFields((f) => ({ ...f, [name]: value }))} />
                  {editErrors.length > 0 && (
                    <div style={{ fontSize: 8.5, color: T.hot, marginTop: 4 }}>{editErrors.join("／")}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={saveEdit} style={{ ...actionBtn(T.green), flex: "none", padding: "6px 14px" }}>保存</button>
                    <button onClick={() => setEditKey(null)} style={{ ...actionBtn(T.textSub), flex: "none", padding: "6px 14px" }}>キャンセル</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color, fontWeight: 700, width: 64, flexShrink: 0 }}>第{roundKey(d.round) ?? d.round}回</span>
                  <span style={{ color: T.textSub, width: 76, flexShrink: 0, fontSize: 8.5 }}>{d.date || "—"}</span>
                  <span style={{ color: T.text, flex: 1, fontFamily: "monospace" }}>{drawNumbersText(d, spec)}</span>
                  <button onClick={() => startEdit(d)} title="編集" style={iconBtn(color)}>✎</button>
                  <button onClick={() => remove(d)} title="削除" style={iconBtn(T.hot)}>🗑</button>
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ padding: 12, fontSize: 9, color: T.textSub }}>取込済みデータはありません。</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onClearAll} style={actionBtn(T.hot)}>全削除（サンプルに戻す）</button>
      </div>
    </div>
  );
}

const iconBtn = (c) => ({
  background: "transparent", border: `1px solid ${c}55`, color: c, borderRadius: 6,
  padding: "4px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
});

// draw → 編集フォーム文字列
function drawToFields(draw, spec) {
  if (!draw) return { round: "", date: "", numbers: "", bonus: "" };
  if (spec.type === "combination") {
    return {
      round: draw.round ?? "",
      date: draw.date ?? "",
      numbers: (draw.numbers || []).join(" "),
      bonus: (draw.bonus || []).join(" "),
    };
  }
  return { round: draw.round ?? "", date: draw.date ?? "", numbers: (draw.digits || []).join(""), bonus: "" };
}
