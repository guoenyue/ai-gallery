import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感画廊",
  description: "开源 AI 生图画廊，支持文生图、图生图、作品管理与本地/对象存储。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
