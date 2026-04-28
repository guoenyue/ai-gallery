"use client";

import { Check, Copy, FileText, Image as ImageIcon, Loader2, LogOut, RefreshCw, Search, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearAdminToken, getAdminToken } from "@/lib/auth-store";
import { apiFetch } from "@/lib/api";

type GalleryPhotoRecord = {
  id: string;
  prompt: string;
  imageUrl?: string;
  status?: "succeeded" | "failed";
  operation?: "generate" | "edit";
  errorMessage?: string;
  storageProvider: "qiniu" | "local" | "none";
  storageKey: string;
  sourcePhotoId?: string;
  sourceImageUrl?: string;
  createdAt: string;
  config: {
    model?: string;
    size?: string;
    aspectRatio?: string;
    layout?: string;
    resolution?: string;
    baseUrl?: string;
  };
  isDemo?: boolean;
  demoOrder?: number;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

type GalleryDashboardPayload = {
  records: GalleryPhotoRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  summary: {
    total: number;
    qiniu: number;
    local: number;
    succeeded?: number;
    failed?: number;
  };
};

export function AdminDashboard() {
  const router = useRouter();
  const galleryLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [galleryKeyword, setGalleryKeyword] = useState("");
  const [galleryDashboard, setGalleryDashboard] = useState<GalleryDashboardPayload | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isRefreshingGallery, setIsRefreshingGallery] = useState(false);
  const [isLoadingMoreGallery, setIsLoadingMoreGallery] = useState(false);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState<GalleryPhotoRecord | null>(null);
  const [selectedGalleryDetail, setSelectedGalleryDetail] = useState<GalleryPhotoRecord | null>(null);
  const [copiedGalleryPromptId, setCopiedGalleryPromptId] = useState<string | null>(null);
  const [updatingDemoId, setUpdatingDemoId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = getAdminToken();

    if (!storedToken) {
      router.replace("/admin/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  function buildGalleryQuery(page = 1) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "20"
    });

    if (galleryKeyword.trim()) {
      query.set("keyword", galleryKeyword.trim());
    }

    return query;
  }

  async function loadGallery(
    signal?: AbortSignal,
    options: {
      manual?: boolean;
      page?: number;
      append?: boolean;
    } = {}
  ) {
    if (!token) {
      return;
    }

    const page = options.page ?? 1;
    const append = options.append ?? false;

    if (options.manual && !append) {
      setIsRefreshingGallery(true);
    }
    if (append) {
      setIsLoadingMoreGallery(true);
    }

    try {
      const response = await apiFetch<GalleryDashboardPayload>(`/admin/gallery/photos?${buildGalleryQuery(page).toString()}`, {
        method: "GET",
        token,
        signal
      });
      setGalleryDashboard((current) => {
        if (!append || !current) {
          return response;
        }

        const knownIds = new Set(current.records.map((record) => record.id));
        const nextRecords = [...current.records, ...response.records.filter((record) => !knownIds.has(record.id))];

        return {
          ...response,
          records: nextRecords
        };
      });
      setGalleryError(null);
    } catch (dashboardError) {
      if (!signal?.aborted) {
        setGalleryError(dashboardError instanceof Error ? dashboardError.message : "加载失败");
      }
    } finally {
      if (options.manual && !append) {
        setIsRefreshingGallery(false);
      }
      if (append) {
        setIsLoadingMoreGallery(false);
      }
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    void loadGallery(controller.signal, { page: 1 });

    return () => controller.abort();
  }, [galleryKeyword, token]);

  const galleryRecords = galleryDashboard?.records ?? [];
  const galleryHasMore = Boolean(galleryDashboard && galleryRecords.length < galleryDashboard.pagination.total);

  useEffect(() => {
    const sentinel = galleryLoadMoreRef.current;

    if (!sentinel || !token || !galleryHasMore || isRefreshingGallery || isLoadingMoreGallery) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !galleryDashboard) {
          return;
        }

        void loadGallery(undefined, {
          page: galleryDashboard.pagination.page + 1,
          append: true
        });
      },
      {
        rootMargin: "240px 0px"
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [galleryDashboard, galleryHasMore, galleryRecords.length, isLoadingMoreGallery, isRefreshingGallery, token]);

  async function copyGalleryPrompt(record: GalleryPhotoRecord) {
    try {
      await navigator.clipboard.writeText(record.prompt);
      setCopiedGalleryPromptId(record.id);
      window.setTimeout(() => {
        setCopiedGalleryPromptId((current) => (current === record.id ? null : current));
      }, 1600);
    } catch (copyError) {
      setGalleryError(copyError instanceof Error ? copyError.message : "提示词复制失败");
    }
  }

  function formatGalleryStorage(record: GalleryPhotoRecord) {
    if (record.storageProvider === "qiniu") {
      return "七牛云";
    }
    if (record.storageProvider === "local") {
      return "服务器本地";
    }

    return "无图片";
  }

  async function toggleGalleryDemo(record: GalleryPhotoRecord) {
    if (!token || !record.imageUrl || record.status === "failed") {
      return;
    }

    setUpdatingDemoId(record.id);
    setGalleryError(null);

    try {
      const updated = await apiFetch<GalleryPhotoRecord>(`/admin/gallery/photos/${record.id}/demo`, {
        method: "POST",
        token,
        body: JSON.stringify({
          isDemo: !record.isDemo,
          demoOrder: record.demoOrder ?? 0
        })
      });

      setGalleryDashboard((current) =>
        current
          ? {
              ...current,
              records: current.records.map((item) => (item.id === record.id ? { ...item, ...updated, user: item.user } : item))
            }
          : current
      );
      setSelectedGalleryDetail((current) => (current?.id === record.id ? { ...current, ...updated, user: current.user } : current));
    } catch (demoError) {
      setGalleryError(demoError instanceof Error ? demoError.message : "示例状态更新失败");
    } finally {
      setUpdatingDemoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 border-[rgba(255,255,255,0.74)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(87,72,185,0.12)] bg-[#ecebff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#5748b9]">
            <ImageIcon className="h-3.5 w-3.5" />
            画廊后台
          </p>
          <CardTitle className="text-3xl text-[#1d2740]">生图记录管理</CardTitle>
          <CardDescription className="mt-3 max-w-2xl text-[15px] text-[#58637c]">
            查看普通用户生成的图片、提示词、模型、尺寸、存储位置与生成时间，不展示用户密钥。
          </CardDescription>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            clearAdminToken();
            router.replace("/admin/login");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </Card>

      <Card className="space-y-5 border-[rgba(255,255,255,0.74)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(87,72,185,0.12)] bg-[#ecebff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#5748b9]">
              <ImageIcon className="h-3.5 w-3.5" />
              生图审计
            </p>
            <CardTitle className="text-2xl text-[#1d2740]">普通用户生图记录</CardTitle>
            <CardDescription className="mt-2 text-[15px] text-[#58637c]">
              查看所有普通用户生成的图片、提示词、模型、尺寸、存储位置与生成时间，不展示用户密钥。
            </CardDescription>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center md:min-w-[360px]">
            <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">总数</p>
              <p className="mt-1 text-2xl font-bold text-[#1d2740]">{galleryDashboard?.summary.total ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">成功</p>
              <p className="mt-1 text-2xl font-bold text-[#1d2740]">{galleryDashboard?.summary.succeeded ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">七牛</p>
              <p className="mt-1 text-2xl font-bold text-[#1d2740]">{galleryDashboard?.summary.qiniu ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">失败</p>
              <p className="mt-1 text-2xl font-bold text-[#b24820]">{galleryDashboard?.summary.failed ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="搜索提示词、模型或存储位置" value={galleryKeyword} onChange={(event) => setGalleryKeyword(event.target.value)} />
          </div>
          <Button type="button" variant="outline" disabled={isRefreshingGallery} onClick={() => loadGallery(undefined, { manual: true, page: 1 })}>
            {isRefreshingGallery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
        </div>
        {galleryError ? <p className="text-sm text-[#b24820]">{galleryError}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/60">
          <div className="grid grid-cols-[88px_1.3fr_0.9fr_0.8fr_0.8fr] gap-4 border-b border-[rgba(130,139,158,0.18)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">
            <span>图片</span>
            <span>提示词</span>
            <span>用户</span>
            <span>配置</span>
            <span>存储/时间</span>
          </div>
          <div className="divide-y divide-[rgba(130,139,158,0.14)]">
            {galleryRecords.map((record) => (
              <div key={record.id} className="grid grid-cols-[88px_1.3fr_0.9fr_0.8fr_0.8fr] gap-4 px-4 py-4 text-sm text-[#2f3a55]">
                {record.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setSelectedGalleryPhoto(record)}
                    className="block h-16 w-16 overflow-hidden rounded-xl border border-[rgba(130,139,158,0.22)] bg-white transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5748b9]"
                    title="预览图片"
                  >
                    <img src={record.imageUrl} alt={record.prompt} className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#f0c9ba] bg-[#fff4ef] text-xs font-bold text-[#b24820]">失败</div>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-6">{record.prompt}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">
                    {record.isDemo ? "展示示例 · " : ""}
                    {record.errorMessage || record.storageKey || (record.operation === "edit" ? "图生图编辑" : "文生图")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyGalleryPrompt(record)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[rgba(87,72,185,0.16)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#5748b9] transition hover:bg-[#ecebff]"
                    >
                      {copiedGalleryPromptId === record.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedGalleryPromptId === record.id ? "已复制" : "复制提示词"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGalleryDetail(record)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[rgba(130,139,158,0.2)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#2f3a55] transition hover:bg-white"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      查看详情
                    </button>
                    {record.imageUrl && record.status !== "failed" ? (
                      <button
                        type="button"
                        disabled={updatingDemoId === record.id}
                        onClick={() => void toggleGalleryDemo(record)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[rgba(201,94,29,0.18)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#a74a14] transition hover:bg-[#fff2e8] disabled:opacity-60"
                      >
                        {updatingDemoId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                        {record.isDemo ? "取消示例" : "设为示例"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{record.user.displayName || "未命名用户"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{record.user.email || record.user.id}</p>
                </div>
                <div>
                  <p className="font-semibold">{record.config.model || "默认模型"}</p>
                  <p className="mt-1 text-xs text-[#6f7890]">{(record.config.resolution || record.config.size)?.replace("x", " x ") || "默认分辨率"}</p>
                  <p className="mt-1 text-xs text-[#6f7890]">{record.config.aspectRatio || "默认比例"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{record.config.baseUrl || "默认接口"}</p>
                </div>
                <div>
                  <p className="font-semibold">{formatGalleryStorage(record)}</p>
                  <p className="mt-1 text-xs text-[#6f7890]">{new Date(record.createdAt).toLocaleString("zh-CN")}</p>
                </div>
              </div>
            ))}
            {galleryRecords.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#6f7890]">暂无生图记录</div>
            ) : null}
            <div ref={galleryLoadMoreRef} className="px-4 py-5 text-center text-xs font-semibold text-[#6f7890]">
              {isLoadingMoreGallery ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载更多
                </span>
              ) : galleryHasMore ? (
                "上滑加载更多"
              ) : galleryRecords.length > 0 ? (
                "已加载全部记录"
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {selectedGalleryDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/72 p-6 backdrop-blur-sm">
          <button type="button" aria-label="关闭详情" onClick={() => setSelectedGalleryDetail(null)} className="absolute inset-0 cursor-default" />
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#fffaf4] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(130,139,158,0.18)] px-6 py-5">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgba(87,72,185,0.12)] bg-[#ecebff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#5748b9]">
                  <FileText className="h-3.5 w-3.5" />
                  生图详情
                </p>
                <CardTitle className="text-2xl text-[#1d2740]">{selectedGalleryDetail.operation === "edit" ? "图生图编辑" : "文生图记录"}</CardTitle>
              </div>
              <button type="button" onClick={() => setSelectedGalleryDetail(null)} className="rounded-xl p-2 text-[#6f7890] transition hover:bg-white hover:text-[#1d2740]" title="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-6">
              <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                <div className="overflow-hidden rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white">
                  {selectedGalleryDetail.imageUrl ? (
                    <button type="button" onClick={() => setSelectedGalleryPhoto(selectedGalleryDetail)} className="block aspect-square w-full bg-white">
                      <img src={selectedGalleryDetail.imageUrl} alt={selectedGalleryDetail.prompt} className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-[#fff4ef] text-sm font-bold text-[#b24820]">生成失败</div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">完整提示词</p>
                      <button
                        type="button"
                        onClick={() => void copyGalleryPrompt(selectedGalleryDetail)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[rgba(87,72,185,0.16)] bg-white px-2.5 py-1 text-xs font-semibold text-[#5748b9] transition hover:bg-[#ecebff]"
                      >
                        {copiedGalleryPromptId === selectedGalleryDetail.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedGalleryPromptId === selectedGalleryDetail.id ? "已复制" : "复制"}
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#2f3a55]">{selectedGalleryDetail.prompt}</p>
                  </div>

                  {selectedGalleryDetail.errorMessage ? (
                    <div className="rounded-2xl border border-[#f0c9ba] bg-[#fff4ef] p-4">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b24820]">失败原因</p>
                      <p className="break-words text-sm leading-6 text-[#8f3b1c]">{selectedGalleryDetail.errorMessage}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">用户</p>
                  <p className="mt-2 truncate font-semibold text-[#1d2740]">{selectedGalleryDetail.user.displayName || "未命名用户"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{selectedGalleryDetail.user.email || selectedGalleryDetail.user.id}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">配置</p>
                  <p className="mt-2 truncate font-semibold text-[#1d2740]">{selectedGalleryDetail.config.model || "默认模型"}</p>
                  <p className="mt-1 text-xs text-[#6f7890]">{(selectedGalleryDetail.config.resolution || selectedGalleryDetail.config.size)?.replace("x", " x ") || "默认分辨率"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{selectedGalleryDetail.config.aspectRatio || "默认比例"} · {selectedGalleryDetail.config.layout || "默认排版"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{selectedGalleryDetail.config.baseUrl || "默认接口"}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">状态</p>
                  <p className="mt-2 font-semibold text-[#1d2740]">{selectedGalleryDetail.status === "failed" ? "失败" : "成功"}</p>
                  <p className="mt-1 text-xs text-[#6f7890]">{selectedGalleryDetail.operation === "edit" ? "图生图编辑" : "文生图"} · {selectedGalleryDetail.isDemo ? "展示示例" : "非示例"}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">存储</p>
                  <p className="mt-2 font-semibold text-[#1d2740]">{formatGalleryStorage(selectedGalleryDetail)}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{selectedGalleryDetail.storageKey || "无"}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">生成时间</p>
                  <p className="mt-2 text-sm font-semibold text-[#1d2740]">{new Date(selectedGalleryDetail.createdAt).toLocaleString("zh-CN")}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(130,139,158,0.18)] bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f7890]">参考图</p>
                  <p className="mt-2 truncate font-semibold text-[#1d2740]">{selectedGalleryDetail.sourceImageUrl ? "有参考图" : "无"}</p>
                  <p className="mt-1 truncate text-xs text-[#6f7890]">{selectedGalleryDetail.sourcePhotoId || selectedGalleryDetail.sourceImageUrl || "无"}</p>
                </div>
              </div>

              {selectedGalleryDetail.imageUrl && selectedGalleryDetail.status !== "failed" ? (
                <div className="mt-5">
                  <Button type="button" variant="outline" disabled={updatingDemoId === selectedGalleryDetail.id} onClick={() => void toggleGalleryDemo(selectedGalleryDetail)}>
                    {updatingDemoId === selectedGalleryDetail.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                    {selectedGalleryDetail.isDemo ? "取消展示示例" : "设为展示示例"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedGalleryPhoto?.imageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/78 p-6 backdrop-blur-sm">
          <button type="button" aria-label="关闭预览" onClick={() => setSelectedGalleryPhoto(null)} className="absolute inset-0 cursor-default" />
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-[#111827] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9c3ff]">{selectedGalleryPhoto.operation === "edit" ? "图生图编辑" : "文生图"}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-white">{selectedGalleryPhoto.prompt}</p>
              </div>
              <button type="button" onClick={() => setSelectedGalleryPhoto(null)} className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white" title="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-4">
              <img src={selectedGalleryPhoto.imageUrl} alt={selectedGalleryPhoto.prompt} className="max-h-[72vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
