import React, { useState, useEffect } from "react";
import { TableSchema } from "./types";
import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import MainViewer from "./components/MainViewer";
import RecordModal from "./components/RecordModal";
import { Database, ShieldAlert, AlertCircle, ChevronRight } from "lucide-react";

export default function App() {
  const [password, setPassword] = useState<string | null>(null);
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableSchema | null>(null);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-login from local storage
  useEffect(() => {
    const savedPassword = localStorage.getItem("supabase_viewer_password");
    if (savedPassword) {
      verifyAndLogin(savedPassword);
    }
  }, []);

  const verifyAndLogin = async (pwd: string) => {
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${pwd}`,
        },
      });

      if (res.ok) {
        setPassword(pwd);
        fetchSchemas(pwd);
      } else {
        localStorage.removeItem("supabase_viewer_password");
      }
    } catch (err) {
      console.error("Auto-login error:", err);
    }
  };

  const handleLoginSuccess = (pwd: string) => {
    setPassword(pwd);
    fetchSchemas(pwd);
  };

  const handleLogout = () => {
    localStorage.removeItem("supabase_viewer_password");
    setPassword(null);
    setTables([]);
    setSelectedTable(null);
  };

  const fetchSchemas = async (pwd: string) => {
    setLoadingTables(true);
    setError(null);
    try {
      const res = await fetch("/api/schema", {
        headers: {
          "Authorization": `Bearer ${pwd}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        // Auto-select first table if available
        if (data.tables && data.tables.length > 0) {
          setSelectedTable(data.tables[0]);
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "スキーマの取得に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "テーブル定義のロード中にエラーが発生しました。");
    } finally {
      setLoadingTables(false);
    }
  };

  const handleEditRecord = (record: Record<string, any> | null) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (
    formData: Record<string, any>,
    originalData: Record<string, any> | null
  ) => {
    if (!selectedTable || !password) return;

    const isEdit = !!originalData;
    const url = isEdit
      ? `/api/table/${selectedTable.name}/update`
      : `/api/table/${selectedTable.name}/insert`;

    const body: any = {};

    if (isEdit) {
      // Setup matching criteria (primary key ID or entire row)
      const match: any = {};
      const colNames = selectedTable.columns.map((c) => c.name);
      if (colNames.includes("id")) {
        match.id = originalData.id;
      } else {
        // Fallback to complete record match
        Object.assign(match, originalData);
      }

      // Gather modified columns only to save bandwidth & trigger proper database defaults
      const changes: any = {};
      selectedTable.columns.forEach((col) => {
        if (col.name === "id" || col.name === "user_id") return;
        const originalVal = originalData[col.name];
        const newVal = formData[col.name];

        if (String(originalVal) !== String(newVal)) {
          // Normalize empty strings back to null
          changes[col.name] = newVal === "" ? null : newVal;
        }
      });

      body.match = match;
      body.changes = changes;
      body.hasUserId = selectedTable.hasUserId;
    } else {
      // Gather insertion records
      const record: any = {};
      selectedTable.columns.forEach((col) => {
        if (col.name === "id") return; // Let serial auto-increment
        record[col.name] = formData[col.name] === "" ? null : formData[col.name];
      });

      body.record = record;
      body.hasUserId = selectedTable.hasUserId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${password}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "データベース操作の書き込みに失敗しました。");
    }

    // Success - trigger data list refresh
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!password) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Sidebar selection */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
        isSidebarCollapsed ? "w-0 border-r-0 opacity-0" : "w-80 opacity-100"
      }`}>
        <Sidebar
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
          onLogout={handleLogout}
          loading={loadingTables}
          username="shalom777br"
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
        />
      </div>

      {/* Main Workspace Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => fetchSchemas(password)}
              className="underline font-semibold hover:text-rose-900 transition ml-auto"
            >
              再読込
            </button>
          </div>
        )}

        {selectedTable ? (
          <MainViewer
            table={selectedTable}
            password={password}
            onEditRecord={handleEditRecord}
            refreshTrigger={refreshTrigger}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        ) : (
          <div className="flex-1 bg-slate-50 flex flex-col justify-center items-center p-8 relative">
            {isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="absolute left-6 top-6 p-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="テーブル一覧を表示"
              >
                <ChevronRight className="w-4 h-4" />
                テーブル一覧を表示
              </button>
            )}
            <Database className="w-16 h-16 text-slate-300 animate-pulse mb-4" />
            <h3 className="font-bold text-slate-800 text-base">
              管理用テーブルがありません
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
              Supabase 接続情報を設定し、アクティブな公開テーブルがデータベースに存在することを確認してください。
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Record Modal */}
      {selectedTable && isModalOpen && (
        <RecordModal
          isOpen={isModalOpen}
          table={selectedTable}
          record={editingRecord}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveRecord}
        />
      )}
    </div>
  );
}
