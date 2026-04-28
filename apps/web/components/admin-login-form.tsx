"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Shield } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { saveAdminToken } from "@/lib/auth-store";
import { encryptLoginCredentials } from "@/lib/rsa";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码")
});

type LoginValues = z.infer<typeof loginSchema>;

export function AdminLoginForm({ onSuccess }: { onSuccess?: (token: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);

    try {
      const keyResponse = await apiFetch<{ publicKey: string }>("/auth/public-key", {
        method: "GET"
      });
      const encryptedCredentials = await encryptLoginCredentials(keyResponse.publicKey, values);
      const response = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          encryptedCredentials
        })
      });
      saveAdminToken(response.accessToken);
      onSuccess?.(response.accessToken);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    }
  });

  return (
    <Card className="mx-auto w-full max-w-md border-[rgba(255,255,255,0.72)]">
      <div className="mb-8">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(96,64,167,0.12)] bg-[#efe8ff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#6040a7]">
          <Shield className="h-3.5 w-3.5" />
          卡密管理系统
        </p>
        <CardTitle className="text-3xl text-[#23142f]">后台登录</CardTitle>
        {/* <CardDescription className="mt-3 text-[15px] text-[#65556f]">
          卡密管理系统
        </CardDescription> */}
      </div>

      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="username" className="text-[15px] text-[#2f1b3f]">用户名</Label>
          <Input id="username" {...form.register("username")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[15px] text-[#2f1b3f]">密码</Label>
          <Input id="password" type="password" {...form.register("password")} />
        </div>

        {error ? <p className="rounded-2xl border border-[rgba(178,72,32,0.14)] bg-[rgba(255,243,239,0.88)] px-4 py-3 text-sm text-[#b24820]">{error}</p> : null}

        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          登录后台
        </Button>
      </form>
    </Card>
  );
}
