import React, { useState } from "react";
import { Table, Search, LogOut, ShieldAlert, ShieldCheck, Database } from "lucide-react";
import { TableSchema } from "../types";

interface SidebarProps {
  tables: TableSchema[];
  selectedTable: TableSchema | null;
  onSelectTable: (table: TableSchema) => void;
  onLogout: () => void;
  loading: boolean;
  username: string;
}

export default function Sidebar({
  tables,
  selectedTable,
  onSelectTable,
  onLogout,
  loading,
  username,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col h-screen shrink-0 text-slate-100">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-900/80 bg-slate-950/90">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-950/50">
            <Database className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-[15px] tracking-tight leading-none bg-gradient-to-r from-white to-slate-200 bg-clip-text">
              Supabase 汎用
            </h1>
            <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase block mt-1">
              VIEWER & EDITOR
            </span>
          </div>
        </div>
        <p className="text-[10.5px] text-slate-400 break-all leading-normal flex items-center gap-1 bg-slate-900/60 p-2 rounded-lg border border-slate-900">
          <span className="font-semibold text-slate-500 shrink-0">UID:</span>
          <span className="font-mono text-slate-300 select-all truncate">5fb13a09-5ce3-4aec-bb4e-8e357070b76b</span>
        </p>
      </div>

      {/* Table Search */}
      <div className="p-4 border-b border-slate-900 bg-slate-950/40">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="テーブルを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-slate-850 rounded-xl bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-slate-900 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          テーブル一覧 ({filteredTables.length})
        </div>

        {loading ? (
          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            ロード中...
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            テーブルが見つかりません。
          </div>
        ) : (
          filteredTables.map((table) => {
            const isSelected = selectedTable?.name === table.name;
            return (
              <button
                key={table.name}
                onClick={() => onSelectTable(table)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all duration-150 border cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-950/40 border-indigo-500"
                    : "text-slate-300 hover:text-white hover:bg-slate-900/80 border-transparent hover:border-slate-900"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Table
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                      isSelected ? "text-white scale-110" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate font-mono">
                      {table.name}
                    </div>
                    <div
                      className={`text-[9.5px] mt-0.5 ${
                        isSelected ? "text-indigo-200" : "text-slate-500"
                      }`}
                    >
                      {table.columns.length} カラム
                    </div>
                  </div>
                </div>

                {/* user_id Column Security Badge */}
                <div title={table.hasUserId ? "自動 user_id フィルタ有効（データ保護）" : "フィルタなし（全公開）"}>
                  {table.hasUserId ? (
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        isSelected ? "text-white" : "text-emerald-500"
                      }`}
                    />
                  ) : (
                    <ShieldAlert
                      className={`w-4 h-4 ${
                        isSelected ? "text-indigo-300" : "text-slate-600"
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-900 bg-slate-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10.5px] text-slate-400 font-semibold tracking-wide">
            ADMIN SESSION
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-950 hover:border-rose-900 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          ログアウト
        </button>
      </div>
    </div>
  );
}
