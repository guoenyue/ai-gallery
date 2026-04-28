import { AdminDashboard } from "@/components/admin-dashboard";

export default function AdminDashboardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,235,255,0.56),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,232,208,0.28),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl">
        <AdminDashboard />
      </div>
    </main>
  );
}
