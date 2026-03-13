import { useState } from "react";
import { useGrantStatus } from "../hooks/useGrants";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { data: status } = useGrantStatus();

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        {status && (
          <div className="mb-2">
            最終更新: {formatDate(status.lastUpdated)}
            <span className="mx-1.5">·</span>
            {status.grants}件収集 / {status.analyzed}件解析済み
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => setAboutOpen(!aboutOpen)}
            className="cursor-pointer hover:text-gray-600 transition-colors"
          >
            About {aboutOpen ? "▾" : "▸"}
          </button>
          <span className="mx-2">·</span>
          <span>Built by circulart</span>
        </div>
        {aboutOpen && (
          <div className="mx-auto mt-3 max-w-lg text-left text-xs leading-relaxed text-gray-500">
            <p>
              全省庁の補助金情報をjGrants APIから毎日自動取得し、AIが太良町との相性を判定するシステムです。
              ランクA（直接活用可能）・B（間接的に活用可能）の補助金を一覧表示しています。
            </p>
            <p className="mt-2">
              データは毎朝自動更新されます。掲載情報はAIによる判定のため、正確性は公式サイトでご確認ください。
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}
