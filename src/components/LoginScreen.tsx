import React, { useState, useEffect } from "react";
import { Lock, Server, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { ConnectionStatus } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (password: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<ConnectionStatus>({
    status: "checking",
    message: "Verifying systems...",
    url: null,
    tableCount: 0,
    passwordSet: false,
  });

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealth({
        status: "error",
        message: "Failed to connect to the backend server.",
        url: null,
        tableCount: 0,
        passwordSet: false,
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`,
        },
      });

      if (res.ok) {
        localStorage.setItem("supabase_viewer_password", password);
        onLoginSuccess(password);
      } else {
        const data = await res.json();
        setError(data.error || "認証に失敗しました。パスワードを確認してください。");
      }
    } catch (err: any) {
      setError("接続エラーが発生しました。サーバーが起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 font-sans p-6">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Banner header */}
        <div className="bg-slate-900 px-8 py-6 text-white text-center">
          <div className="inline-flex items-center justify-center bg-white/10 p-3 rounded-full mb-3">
            <Lock className="w-6 h-6 text-slate-200" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Supabase 汎用ビューア</h1>
          <p className="text-xs text-slate-400 mt-1">
            Database Administration & Viewer Panel
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8">
          {/* Connection Status Panel */}
          <div className="mb-6 p-4 rounded-xl border text-sm bg-slate-50 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-slate-500" />
                システムステータス
              </span>
              <button
                onClick={checkHealth}
                title="再試行"
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {health.status === "checking" && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                {health.message}
              </div>
            )}

            {health.status === "connected" && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Supabase接続成功 ({health.tableCount}個のテーブルを検出)
                </div>
                <div className="text-slate-400 font-mono text-[10px] break-all truncate">
                  URL: {health.url}
                </div>
              </div>
            )}

            {health.status === "misconfigured" && (
              <div className="space-y-2 text-xs text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-200">
                <div className="flex items-start gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>環境変数未設定</span>
                </div>
                <p className="text-[11px] text-amber-600 leading-normal">
                  `.env`に `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定してください。
                </p>
              </div>
            )}

            {health.status === "error" && (
              <div className="space-y-2 text-xs text-rose-700 bg-rose-50/50 p-2 rounded border border-rose-200">
                <div className="flex items-start gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Supabase接続失敗</span>
                </div>
                <p className="text-[11px] text-rose-600 leading-normal">
                  {health.message}
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2"
              >
                管理者パスワード
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="VIEWER_PASSWORD を入力"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-mono text-center text-lg"
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-slate-950 hover:bg-slate-900 disabled:bg-slate-300 text-white font-medium py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  検証中...
                </>
              ) : (
                "ログイン"
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            ※ セキュリティのため、認証キーはブラウザ側には一切公開されません。<br />
            すべてのクエリは自動的に `user_id` でフィルタリングされます。
          </p>
        </div>
      </motion.div>
    </div>
  );
}
