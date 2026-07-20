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
    <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="bg-slate-900 text-white p-2 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-none">
              Supabase 汎用
            </h1>
            <span className="text-[10px] text-slate-500 font-medium">
              VIEWER & EDITOR
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 break-all leading-normal">
          User ID: <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded">5fb13a09...</span>
        </p>
      </div>

      {/* Table Search */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="テーブルを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          テーブル一覧 ({filteredTables.length})
        </div>

        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400">
            ロード中...
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            テーブルが見つかりません。
          </div>
        ) : (
          filteredTables.map((table) => {
            const isSelected = selectedTable?.name === table.name;
            return (
              <button
                key={table.name}
                onClick={() => onSelectTable(table)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition group ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Table
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate font-mono">
                      {table.name}
                    </div>
                    <div
                      className={`text-[9px] ${
                        isSelected ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {table.columns.length} 列
                    </div>
                  </div>
                </div>

                {/* user_id Column Security Badge */}
                <div title={table.hasUserId ? "user_id絞り込み有効" : "絞り込みなし(user_id列なし)"}>
                  {table.hasUserId ? (
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${
                        isSelected ? "text-emerald-400" : "text-emerald-500"
                      }`}
                    />
                  ) : (
                    <ShieldAlert
                      className={`w-3.5 h-3.5 ${
                        isSelected ? "text-slate-400" : "text-slate-400"
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
      <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
          管理者セッション中
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 flex items-center gap-1.5 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          ログアウト
        </button>
      </div>
    </div>
  );
}
