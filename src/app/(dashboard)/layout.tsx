import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 ml-52 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-hidden" style={{ background: "var(--bg-base)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
