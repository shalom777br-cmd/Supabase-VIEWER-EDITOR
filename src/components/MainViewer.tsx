import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Trash2,
  RefreshCw,
  Edit3,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  X,
  Eraser,
} from "lucide-react";
import { TableSchema, TableColumn, QueryResult, DuplicateScanResult } from "../types";

interface MainViewerProps {
  table: TableSchema;
  password: string;
  onEditRecord: (record: Record<string, any> | null) => void;
  refreshTrigger: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function MainViewer({
  table,
  password,
  onEditRecord,
  refreshTrigger,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: MainViewerProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unfilteredCount, setUnfilteredCount] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [availableFilters, setAvailableFilters] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<any[]>([]);

  // Duplicates State
  const [duplicateScan, setDuplicateScan] = useState<DuplicateScanResult | null>(null);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);

  // Inline cell editing/deleting state
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colName: string;
    originalRow: Record<string, any>;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingCell, setSavingCell] = useState<boolean>(false);

  // Bypass user_id filter toggle state
  const [bypassUserIdFilter, setBypassUserIdFilter] = useState<boolean>(false);

  // Load target columns for filtering
  useEffect(() => {
    const colNames = table.columns.map((c) => c.name);
    // Find columns named category, importance, status, type, etc.
    const targets = ["category", "importance", "status", "type"].filter((name) =>
      colNames.includes(name)
    );
    setAvailableFilters(targets);
    setActiveFilters({});
    setPage(1);
    setSelectedIds([]);
    setDuplicateScan(null);
    setShowDuplicatePanel(false);
    setEditingCell(null);
    setBypassUserIdFilter(false);
  }, [table]);

  const isReadOnlyColumn = (colName: string) => {
    return ["id", "created_at", "updated_at", "user_id"].includes(colName);
  };

  const handleSaveCellInline = async () => {
    if (!editingCell) return;
    setSavingCell(true);
    try {
      const { originalRow, colName } = editingCell;
      
      const match: any = {};
      const colNames = table.columns.map((c) => c.name);
      if (colNames.includes("id")) {
        match.id = originalRow.id;
      } else {
        Object.assign(match, originalRow);
      }

      const columnDef = table.columns.find((c) => c.name === colName);

      // Convert editValue based on column type
      let finalVal: any = editValue;
      if (editValue === "") {
        finalVal = null; // Clear content / Set to NULL
      } else if (columnDef?.type === "boolean") {
        finalVal = editValue === "true";
      } else if (["integer", "numeric", "number"].includes(columnDef?.type || "")) {
        finalVal = Number(editValue);
      }

      const changes = {
        [colName]: finalVal,
      };

      const res = await fetch(`/api/table/${table.name}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
        body: JSON.stringify({
          match,
          changes,
          hasUserId: bypassUserIdFilter ? false : table.hasUserId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "セルの更新に失敗しました。");
      }

      // Success: refresh local data list
      await fetchTableData();
      setEditingCell(null);
    } catch (err: any) {
      alert(`更新エラー: ${err.message}`);
    } finally {
      setSavingCell(false);
    }
  };

  const handleDeleteCellInline = async () => {
    if (!editingCell) return;
    const confirmMsg = `このセル「${editingCell.colName}」の値を削除（NULLに設定）してよろしいですか？`;
    if (!window.confirm(confirmMsg)) return;

    setSavingCell(true);
    try {
      const { originalRow, colName } = editingCell;
      
      const match: any = {};
      const colNames = table.columns.map((c) => c.name);
      if (colNames.includes("id")) {
        match.id = originalRow.id;
      } else {
        Object.assign(match, originalRow);
      }

      const changes = {
        [colName]: null,
      };

      const res = await fetch(`/api/table/${table.name}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
        body: JSON.stringify({
          match,
          changes,
          hasUserId: bypassUserIdFilter ? false : table.hasUserId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "セルの削除に失敗しました。");
      }

      // Success: refresh local data list
      await fetchTableData();
      setEditingCell(null);
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    } finally {
      setSavingCell(false);
    }
  };

  // Fetch unique filter values dynamically
  useEffect(() => {
    if (availableFilters.length === 0) return;

    const fetchFilterOptions = async () => {
      const results: Record<string, string[]> = {};
      for (const col of availableFilters) {
        try {
          const res = await fetch(`/api/table/${table.name}/unique-values`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${password}`,
            },
            body: JSON.stringify({
              columnName: col,
              hasUserId: bypassUserIdFilter ? false : table.hasUserId,
            }),
          });
          if (res.ok) {
            const valData = await res.json();
            results[col] = valData.values || [];
          }
        } catch (err) {
          console.error("Failed to fetch filter values", err);
        }
      }
      setFilterValues(results);
    };

    fetchFilterOptions();
  }, [availableFilters, table, password, refreshTrigger, bypassUserIdFilter]);

  // Fetch paginated table rows
  const fetchTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/table/${table.name}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
        body: JSON.stringify({
          page,
          pageSize,
          search,
          filters: activeFilters,
          columns: table.columns,
          hasUserId: bypassUserIdFilter ? false : table.hasUserId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "データの取得に失敗しました。");
      }

      const queryRes: QueryResult = await res.json();
      setData(queryRes.data);
      setTotalCount(queryRes.count);
      setUnfilteredCount(queryRes.unfilteredCount);
    } catch (err: any) {
      setError(err.message || "予期せぬエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever dependency parameters change
  useEffect(() => {
    fetchTableData();
  }, [table, page, activeFilters, refreshTrigger, bypassUserIdFilter]);

  // Keypress or search trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTableData();
  };

  // Delete handler for single or multiple items
  const handleDeleteRecords = async (recordsToDelete: Record<string, any>[]) => {
    const isMultiple = recordsToDelete.length > 1;
    const confirmMsg = isMultiple
      ? `選択された ${recordsToDelete.length} 件のレコードを完全に削除してよろしいですか？この操作は取り消せません。`
      : `このレコードを完全に削除してよろしいですか？この操作は取り消せません。`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // Find the primary keys for delete match
      const colNames = table.columns.map((c) => c.name);
      const rowsToDelete = recordsToDelete.map((row) => {
        // Prefer id, or other unique identifier if id doesn't exist
        if (colNames.includes("id")) {
          return { id: row.id };
        } else {
          // Fallback to match using all available columns if no primary key exists
          return row;
        }
      });

      const res = await fetch(`/api/table/${table.name}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
        body: JSON.stringify({
          rows: rowsToDelete,
          hasUserId: bypassUserIdFilter ? false : table.hasUserId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "レコードの削除に失敗しました。");
      }

      setSelectedIds([]);
      await fetchTableData();
      alert("削除が完了しました。");
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Run database-wide duplication scan
  const handleScanDuplicates = async () => {
    setScanningDuplicates(true);
    try {
      const res = await fetch(`/api/table/${table.name}/scan-duplicates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
        body: JSON.stringify({
          columns: table.columns,
          hasUserId: bypassUserIdFilter ? false : table.hasUserId,
        }),
      });

      if (res.ok) {
        const scanRes: DuplicateScanResult = await res.json();
        setDuplicateScan(scanRes);
        setShowDuplicatePanel(true);
      } else {
        alert("重複のスキャンに失敗しました。");
      }
    } catch (err: any) {
      alert(`スキャンエラー: ${err.message}`);
    } finally {
      setScanningDuplicates(false);
    }
  };

  // Helper to check if row has in-page duplicate content or title
  const checkInPageDuplicate = (row: Record<string, any>) => {
    const fieldsToCheck = ["content", "title"].filter((name) =>
      table.columns.some((c) => c.name === name)
    );

    let isDuplicated = false;
    let dupColumn = "";

    for (const field of fieldsToCheck) {
      const currentVal = row[field];
      if (currentVal !== null && currentVal !== undefined && String(currentVal).trim() !== "") {
        const matchCount = data.filter(
          (r) => String(r[field]).trim() === String(currentVal).trim()
        ).length;
        if (matchCount > 1) {
          isDuplicated = true;
          dupColumn = field;
          break;
        }
      }
    }

    return { isDuplicated, dupColumn };
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(data.map((row) => row.id || row));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (rowId: any, isChecked: boolean) => {
    if (isChecked) {
      setSelectedIds((prev) => [...prev, rowId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== rowId));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
      {/* Table Title / Header Actions */}
      <div className="px-8 py-5 border-b border-slate-200/80 bg-white flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition mr-0.5 cursor-pointer flex items-center justify-center border border-slate-200/80 shadow-sm bg-white"
                title={isSidebarCollapsed ? "テーブル一覧を表示" : "テーブル一覧を非表示"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                )}
              </button>
            )}
            <span className="font-mono text-xl font-extrabold text-slate-900 tracking-tight">
              {table.name}
            </span>
            {table.hasUserId && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm border transition-all ${
                  bypassUserIdFilter 
                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                    : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                }`}>
                  <ShieldCheck className={`w-3.5 h-3.5 ${bypassUserIdFilter ? "text-amber-600 animate-pulse" : "text-emerald-600"}`} />
                  {bypassUserIdFilter ? "user_id フィルタ解除中" : "自動 user_id フィルタ適用中"}
                </span>
                
                <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold px-2.5 py-1 rounded-full shadow-sm select-none transition-all">
                  <input
                    type="checkbox"
                    checked={bypassUserIdFilter}
                    onChange={(e) => {
                      setBypassUserIdFilter(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>すべてのレコードを表示 (合計: {unfilteredCount !== undefined ? unfilteredCount : "..."}件)</span>
                </label>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">
            現在のビュー内に <strong className="text-slate-800 font-bold">{totalCount} 件</strong> のレコードがあります
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Duplicate Finder Button */}
          <button
            onClick={handleScanDuplicates}
            disabled={scanningDuplicates}
            className="text-xs font-semibold px-4 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 bg-white rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            {scanningDuplicates ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
            重複一括チェック
          </button>

          <button
            onClick={() => onEditRecord(null)}
            className="text-xs font-bold px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl flex items-center gap-2 shadow-md shadow-indigo-100 transition duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-100" />
            新規データ追加
          </button>
        </div>
      </div>

      {/* Search & Filters Rail */}
      <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4 shrink-0">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="キーワードで検索 (ilike)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
          >
            検索
          </button>
        </form>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-3">
          {availableFilters.map((col) => (
            <div key={col} className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium capitalize flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                {col}:
              </span>
              <select
                value={activeFilters[col] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveFilters((prev) => {
                    const updated = { ...prev };
                    if (val === "") {
                      delete updated[col];
                    } else {
                      updated[col] = val;
                    }
                    return updated;
                  });
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                <option value="">すべて</option>
                {(filterValues[col] || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            onClick={() => {
              setSearch("");
              setActiveFilters({});
              setPage(1);
              fetchTableData();
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-200 rounded-lg bg-white transition"
          >
            クリア
          </button>
        </div>
      </div>

      {/* Duplicate Helper Header Alert */}
      {data.some((row) => checkInPageDuplicate(row).isDuplicated) && (
        <div className="px-8 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>ページ内重複あり</strong>: `content` または `title` が完全一致しているレコードが黄色で強調表示されています。
            </span>
          </div>
        </div>
      )}

      {/* Duplicate Panel drawer layout */}
      {showDuplicatePanel && duplicateScan && (
        <div className="bg-amber-50 border-b border-amber-200 px-8 py-4 space-y-3 text-xs max-h-48 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              テーブル内重複スキャン結果 (最大2000行スキャン)
            </h4>
            <button
              onClick={() => setShowDuplicatePanel(false)}
              className="text-amber-700 hover:text-amber-950 font-bold"
            >
              閉じる
            </button>
          </div>

          {Object.keys(duplicateScan.duplicates).length === 0 ? (
            <p className="text-slate-600">重複レコードは見つかりませんでした！🎉</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(duplicateScan.duplicates) as [string, any[]][]).map(([col, items]) => (
                <div key={col} className="space-y-1.5">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    カラム「{col}」の重複 ({items.length}件のグループ)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.slice(0, 10).map((group, idx) => (
                      <div key={idx} className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-1 shadow-sm">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {group.count} 回重複
                          </span>
                          <span className="text-slate-400 font-mono">
                            ID群: {group.ids.join(", ")}
                          </span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 italic text-[11px] font-mono break-all leading-normal bg-slate-50/50 p-1 rounded">
                          "{group.value}"
                        </p>
                      </div>
                    ))}
                    {items.length > 10 && (
                      <div className="text-slate-500 italic p-2">他 {items.length - 10} 件の重複があります...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid Content */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        {loading ? (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-900" />
              <span className="text-xs text-slate-500 font-medium">ロード中...</span>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="p-8 text-center">
            <div className="inline-flex flex-col items-center max-w-md bg-white border border-rose-200 p-6 rounded-2xl shadow-sm text-sm">
              <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
              <h3 className="font-bold text-slate-800 mb-1">エラーが発生しました</h3>
              <p className="text-slate-500 text-xs leading-normal mb-4">{error}</p>
              <button
                onClick={fetchTableData}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition"
              >
                再読込する
              </button>
            </div>
          </div>
        )}

        {!error && data.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center h-full max-w-xl mx-auto">
            <HelpCircle className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
            <p className="font-bold text-base text-slate-800 mb-1">レコードが存在しません</p>
            
            {table.hasUserId && unfilteredCount !== undefined && unfilteredCount > 0 ? (
              <div className="mt-4 p-5 bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl text-xs text-left space-y-3 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  重要：user_id フィルタ適用中
                </p>
                <p>
                  このテーブルには全体で <strong>{unfilteredCount} 件</strong> のレコードが存在しますが、現在のログインセッション用
                  <code>user_id</code> (<code>5fb13a09-5ce3-4aec-bb4e-8e357070b76b</code>)
                  に一致するレコードがありません。
                </p>
                <p>
                  右上の<strong>「新規データ追加」</strong>ボタンから新しいレコードを作成すると、自動的にあなたの <code>user_id</code> が割り当てられ、即座にここに表示・管理できるようになります。
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-amber-200/50">
                  <span className="text-[11px] text-amber-800/80 font-medium">他のユーザーのレコードも含めて、すべてのデータを確認・編集しますか？</span>
                  <button
                    onClick={() => {
                      setBypassUserIdFilter(true);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition cursor-pointer shrink-0"
                  >
                    すべてのレコード ({unfilteredCount}件) を表示する
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">新規レコードを追加するか、検索条件をクリアしてください。</p>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-max text-xs bg-white">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 border-b border-slate-200">
              <tr className="font-bold text-slate-700">
                {/* Bulk Select Checkbox */}
                <th className="px-5 py-4 w-12 text-center bg-slate-50/95">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                </th>
                {/* Columns */}
                {table.columns.map((col) => (
                  <th key={col.name} className="px-5 py-4 font-mono font-bold tracking-tight text-slate-800 bg-slate-50/95">
                    <div className="flex flex-col">
                      <span>{col.name}</span>
                      <span className="text-[9px] text-slate-400 font-normal italic mt-0.5">
                        {col.type}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Actions column */}
                <th className="px-5 py-4 text-center w-28 font-bold text-slate-800 bg-slate-50/95">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, idx) => {
                const rowId = row.id || row;
                const isSelected = selectedIds.includes(rowId);
                const { isDuplicated, dupColumn } = checkInPageDuplicate(row);

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/80 transition-all ${
                      isDuplicated
                        ? "bg-amber-50/60 hover:bg-amber-50/90 border-l-2 border-l-amber-400"
                        : isSelected
                        ? "bg-indigo-50/30 hover:bg-indigo-50/50 border-l-2 border-l-indigo-600"
                        : "border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Checkbox column */}
                    <td className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Values columns */}
                    {table.columns.map((col) => {
                      const val = row[col.name];
                      const isTargetDup = isDuplicated && col.name === dupColumn;
                      const readOnly = isReadOnlyColumn(col.name);
                      const isEditing = editingCell?.rowIdx === idx && editingCell?.colName === col.name;

                      return (
                        <td
                          key={col.name}
                          className={`px-5 py-3.5 font-mono truncate max-w-sm text-slate-700 transition-all ${
                            isTargetDup ? "bg-amber-100/50 font-bold text-amber-900" : ""
                          } ${
                            !readOnly && !isEditing
                              ? "cursor-pointer hover:bg-slate-100/90 hover:text-slate-900 group/cell relative"
                              : ""
                          }`}
                          onClick={() => {
                            if (!readOnly && !isEditing) {
                              setEditingCell({
                                rowIdx: idx,
                                colName: col.name,
                                originalRow: row,
                              });
                              setEditValue(val === null ? "" : String(val));
                            }
                          }}
                          title={isEditing ? undefined : (val === null ? "NULL (クリックして編集)" : `${String(val)} (クリックして編集)`)}
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                              {col.type === "boolean" ? (
                                <select
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-sans"
                                  autoFocus
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                  <option value="">null</option>
                                </select>
                              ) : (
                                <input
                                  type={["integer", "numeric", "number"].includes(col.type) ? "number" : "text"}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveCellInline();
                                    } else if (e.key === "Escape") {
                                      setEditingCell(null);
                                    }
                                  }}
                                />
                              )}
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={handleSaveCellInline}
                                  disabled={savingCell}
                                  title="保存 (Enter)"
                                  className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded transition shadow-sm cursor-pointer"
                                >
                                  {savingCell ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  onClick={handleDeleteCellInline}
                                  disabled={savingCell}
                                  title="値を削除 (NULLに設定)"
                                  className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded transition shadow-sm cursor-pointer"
                                >
                                  <Eraser className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  disabled={savingCell}
                                  title="キャンセル (Esc)"
                                  className="p-1 bg-slate-100 text-slate-500 hover:bg-slate-500 hover:text-white rounded transition shadow-sm cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1">
                              <span>
                                {val === null ? (
                                  <span className="text-slate-300 italic font-sans text-[10px]">null</span>
                                ) : typeof val === "boolean" ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-sans text-[9px] font-bold ${
                                      val
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        : "bg-slate-100 text-slate-600 border border-slate-200"
                                    }`}
                                  >
                                    {String(val)}
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </span>
                              {!readOnly && (
                                <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity ml-1 shrink-0 text-[10px] text-slate-400 font-sans font-normal border border-slate-200 bg-slate-50 rounded px-1 py-0.5 shadow-sm">
                                  編集
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions buttons */}
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onEditRecord(row)}
                          title="詳細 / 編集"
                          className="p-2 bg-indigo-50/80 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all duration-100 cursor-pointer shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecords([row])}
                          title="削除"
                          className="p-2 bg-rose-50/80 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all duration-100 cursor-pointer shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Grid Footer Controls (Bulk actions / Pagination) */}
      <div className="px-8 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-slate-500 font-medium">
        {/* Bulk Action Panel */}
        <div>
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-800 font-bold bg-slate-100 px-2 py-1 rounded">
                {selectedIds.length} 件選択中
              </span>
              <button
                onClick={() => {
                  const selectedRows = data.filter((row) => selectedIds.includes(row.id || row));
                  handleDeleteRecords(selectedRows);
                }}
                className="px-3 py-1.5 border border-rose-300 hover:border-rose-400 bg-rose-50 text-rose-700 rounded-lg flex items-center gap-1 text-[11px] transition-all font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                選択行を一括削除
              </button>
            </div>
          ) : (
            <span>
              1ページあたり最大 {pageSize} 件を表示しています
            </span>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:border-slate-200 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800">
              {page} / {totalPages} ページ
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:border-slate-200 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
