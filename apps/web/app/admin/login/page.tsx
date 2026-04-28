"use client";

import { useRouter } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";

export default function AdminLoginPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,170,255,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(177,209,255,0.22),transparent_32%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 ">

        <AdminLoginForm onSuccess={() => router.replace("/admin/dashboard")} />
      </div>
    </main>
  );
}
