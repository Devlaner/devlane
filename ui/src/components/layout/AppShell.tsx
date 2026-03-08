import { Outlet } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-screen)] p-3">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-container)]">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-canvas)]">
          <PageHeader />
          <div className="main-content-scroll min-h-0 flex-1 overflow-auto p-[var(--padding-page)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
