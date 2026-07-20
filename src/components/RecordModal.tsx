import React, { useState, useEffect } from "react";
import { X, Eraser, Save, AlertCircle, RefreshCw, PlusCircle, Check } from "lucide-react";
import { TableSchema, TableColumn } from "../types";

interface RecordModalProps {
  isOpen: boolean;
  table: TableSchema;
  record: Record<string, any> | null; // null means CREATE mode
  onClose: () => void;
  onSave: (formData: Record<string, any>, originalData: Record<string, any> | null) => Promise<void>;
}

export default function RecordModal({
  isOpen,
  table,
  record,
  onClose,
  onSave,
}: RecordModalProps) {
  const isEditMode = !!record;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For storing diff check
  const [showDiffConfirm, setShowDiffConfirm] = useState(false);
  const [diffs, setDiffs] = useState<{ col: string; from: any; to: any }[]>([]);

  // Initialize form
  useEffect(() => {
    if (isEditMode && record) {
      setFormData({ ...record });
    } else {
      // Create empty form based on schema
      const initial: Record<string, any> = {};
      table.columns.forEach((col) => {
        if (col.name === "user_id") {
          initial[col.name] = "5fb13a09-5ce3-4aec-bb4e-8e357070b76b";
        } else {
          initial[col.name] = "";
        }
      });
      setFormData(initial);
    }
    setShowDiffConfirm(false);
    setError(null);
  }, [record, table, isEditMode]);

  if (!isOpen) return null;

  const handleInputChange = (colName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [colName]: value,
    }));
  };

  const handleClearColumn = (colName: string) => {
    const confirmClear = window.confirm(`このカラム「${colName}」の値を削除（NULLに設定）してよろしいですか？`);
    if (confirmClear) {
      handleInputChange(colName, null);
    }
  };

  const calculateDiffs = () => {
    const list: { col: string; from: any; to: any }[] = [];
    table.columns.forEach((col) => {
      if (col.name === "user_id") return; // skip checking automated user_id

      const originalVal = isEditMode && record ? record[col.name] : undefined;
      const newVal = formData[col.name];

      // Deep compare
      const isOriginalEmpty = originalVal === undefined || originalVal === null;
      const isNewEmpty = newVal === undefined || newVal === null || newVal === "";

      if (isOriginalEmpty && isNewEmpty) return;

      if (String(originalVal) !== String(newVal)) {
        list.push({
          col: col.name,
          from: originalVal === null ? "NULL" : originalVal,
          to: newVal === null || newVal === "" ? "NULL" : newVal,
        });
      }
    });
    return list;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const calculated = calculateDiffs();
    if (calculated.length === 0 && isEditMode) {
      setError("変更箇所がありません。");
      return;
    }

    setDiffs(calculated);
    setShowDiffConfirm(true);
  };

  const handleConfirmSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave(formData, record);
      onClose();
    } catch (err: any) {
      setError(err.message || "レコードの保存に失敗しました。");
      setShowDiffConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {table.name}
            </span>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              {isEditMode ? (
                <>
                  レコードの編集
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    ID: {record?.id ?? "N/A"}
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-slate-600" />
                  新規レコードの追加
                </>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Review Mode */}
        {showDiffConfirm ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">差分の確認</h3>
                <p>保存する前に、以下の変更内容を確認してください。</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="px-4 py-3">カラム名</th>
                    <th className="px-4 py-3">元の値</th>
                    <th className="px-4 py-3">新しい値</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {isEditMode ? (
                    diffs.map((d) => (
                      <tr key={d.col} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-700">{d.col}</td>
                        <td className="px-4 py-3 text-rose-600 bg-rose-50/30 truncate max-w-xs" title={String(d.from)}>
                          {d.from === null ? <span className="text-slate-400">NULL</span> : String(d.from)}
                        </td>
                        <td className="px-4 py-3 text-emerald-600 bg-emerald-50/30 truncate max-w-xs" title={String(d.to)}>
                          {d.to === null ? <span className="text-slate-400">NULL</span> : String(d.to)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    table.columns
                      .filter((col) => col.name !== "user_id" && formData[col.name] !== "")
                      .map((col) => (
                        <tr key={col.name}>
                          <td className="px-4 py-3 font-semibold text-slate-700">{col.name}</td>
                          <td className="px-4 py-3 text-slate-400">-</td>
                          <td className="px-4 py-3 text-emerald-600 bg-emerald-50/30 truncate max-w-xs" title={String(formData[col.name])}>
                            {formData[col.name] === null ? <span className="text-slate-400">NULL</span> : String(formData[col.name])}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDiffConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition"
              >
                編集に戻る
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    変更を確定して保存
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Form Inputs Mode */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {table.columns.map((col) => {
                  const isPrimaryKey = col.name === "id";
                  const isUserId = col.name === "user_id";
                  const val = formData[col.name];

                  // Decide input type
                  const isLongText = col.name === "content" || col.name === "description" || col.name === "chat_history";
                  const isNumber = col.type === "integer" || col.type === "number" || col.type === "numeric";

                  return (
                    <div key={col.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <span className="font-mono">{col.name}</span>
                          {col.required && <span className="text-rose-500 font-bold">*</span>}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({col.type})
                          </span>
                        </label>

                        {/* Column actions */}
                        <div className="flex items-center gap-1.5">
                          {isUserId && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 font-semibold px-2 py-0.5 rounded-full">
                              固定: 5fb13a09...
                            </span>
                          )}
                          {!isPrimaryKey && !isUserId && (
                            <button
                              type="button"
                              onClick={() => handleClearColumn(col.name)}
                              title="この値をNULLに設定"
                              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition flex items-center gap-1 text-[10px] font-medium"
                            >
                              <Eraser className="w-3 h-3" />
                              クリア (NULL)
                            </button>
                          )}
                        </div>
                      </div>

                      {isUserId ? (
                        <input
                          type="text"
                          value="5fb13a09-5ce3-4aec-bb4e-8e357070b76b"
                          disabled
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-mono text-xs text-slate-500 cursor-not-allowed"
                        />
                      ) : isPrimaryKey ? (
                        <input
                          type="text"
                          value={val || "自動採番(シリアルID)"}
                          disabled
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-mono text-xs text-slate-500 cursor-not-allowed"
                        />
                      ) : isLongText ? (
                        <textarea
                          rows={4}
                          value={val === null ? "" : String(val)}
                          onChange={(e) => handleInputChange(col.name, e.target.value)}
                          placeholder={val === null ? "NULL (空の値)" : "テキストを入力..."}
                          className={`w-full px-3 py-2 border rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all ${
                            val === null ? "bg-slate-50 border-dashed border-slate-200 placeholder-slate-400" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      ) : (
                        <input
                          type={isNumber ? "number" : "text"}
                          value={val === null ? "" : String(val)}
                          onChange={(e) => handleInputChange(col.name, isNumber ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                          placeholder={val === null ? "NULL (空の値)" : "値を入力..."}
                          className={`w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all ${
                            val === null ? "bg-slate-50 border-dashed border-slate-200 placeholder-slate-400" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-100/50 transition cursor-pointer"
              >
                <Save className="w-4 h-4 text-indigo-200" />
                保存する
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
