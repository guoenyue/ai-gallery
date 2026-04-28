"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { apiFetch, apiStream } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  clearGalleryUserSession,
  getGalleryUserSession,
  type GalleryUserSession,
  saveGalleryUserSession
} from "@/lib/user-auth-store";

interface Photo {
  id: string;
  prompt: string;
  imageUrl?: string;
  createdAt: Date | string;
  status?: "succeeded" | "failed";
  operation?: "generate" | "edit";
  errorMessage?: string;
  storageProvider?: "qiniu" | "local" | "none";
    storageKey?: string;
  sourcePhotoId?: string;
  sourceImageUrl?: string;
  config?: {
    model?: string;
    size?: string;
    aspectRatio?: string;
    layout?: string;
    resolution?: string;
    baseUrl?: string;
  };
  isDemo?: boolean;
  demoOrder?: number;
}

interface AIConfig {
  model: string;
  size: string;
  apiKey: string;
  baseUrl: string;
}

interface GenerationConfig {
  model: string;
  size: string;
  aspectRatio: string;
  layout: string;
}

interface SelectOption {
  label: string;
  value: string;
  hint?: string;
}

const IMAGE_SIZE_OPTIONS = [
  { label: "自动", value: "auto", hint: "OpenAI auto" },
  { label: "方图", value: "1024x1024", hint: "1024 x 1024" },
  { label: "竖图", value: "1024x1536", hint: "1024 x 1536" },
  { label: "横图", value: "1536x1024", hint: "1536 x 1024" }
];

const IMAGE_MODEL_OPTIONS = [{ label: "gpt-image-2", value: "gpt-image-2", hint: "OpenAI 图像模型" }];

const ASPECT_RATIO_OPTIONS = [
  { label: "默认", value: "", hint: "模型自定" },
  { label: "1:1", value: "1:1", hint: "方图" },
  { label: "2:3", value: "2:3", hint: "官方竖图" },
  { label: "3:2", value: "3:2", hint: "官方横图" },
  { label: "9:16", value: "9:16", hint: "提示词增强" },
  { label: "16:9", value: "16:9", hint: "提示词增强" }
];
const LAYOUT_OPTIONS = [
  { label: "默认", value: "", hint: "模型自定" },
  { label: "居中主体", value: "centered single-subject composition", hint: "主体突出" },
  { label: "海报排版", value: "poster layout with clear visual hierarchy", hint: "标题留白" },
  { label: "产品构图", value: "product showcase layout with clean negative space", hint: "商品展示" },
  { label: "电影分镜", value: "cinematic composition with foreground and background depth", hint: "空间层次" },
  { label: "俯视平铺", value: "top-down flat lay layout", hint: "平铺视角" }
];
const GENERATION_SIZE_OPTIONS = [{ label: "默认", value: "", hint: "使用个人配置" }, ...IMAGE_SIZE_OPTIONS];
const GENERATION_MODEL_OPTIONS = [{ label: "默认", value: "", hint: "使用个人配置" }, ...IMAGE_MODEL_OPTIONS];

const EXTERNAL_LINKS = {
  openaiApiKeys: "https://sub.appdock.cn"
};

const DEFAULT_AI_CONFIG: AIConfig = {
  model: IMAGE_MODEL_OPTIONS[0].value,
  size: "1024x1024",
  apiKey: "",
  baseUrl: "https://sub.appdock.cn/v1"
};

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  model: "",
  size: "",
  aspectRatio: "",
  layout: ""
};
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

function CustomSelect({
  value,
  options,
  onChange,
  compact = false
}: {
  value?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "w-full border border-slate-800 bg-slate-950 text-left text-slate-300 shadow-inner shadow-black/20 outline-none transition-all hover:border-slate-700 focus:ring-2 focus:ring-indigo-500",
          compact ? "rounded-xl px-3 py-2 text-xs" : "rounded-2xl px-4 py-3 text-sm font-mono"
        )}
      >
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className={cn("block truncate", compact ? "font-bold" : "font-semibold text-emerald-400")}>
              {selected.label}
            </span>
            {!compact && selected.hint && (
              <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-600">{selected.hint}</span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-slate-500 transition-transform", isOpen && "rotate-180 text-indigo-400")} />
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-[160] mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl"
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === selected.value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  isSelected ? "bg-indigo-500/15 text-indigo-200" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block truncate text-[10px] text-slate-600">{option.hint}</span>}
                </span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-indigo-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isPhotoSucceeded(photo: Photo) {
  return (photo.status || "succeeded") === "succeeded" && Boolean(photo.imageUrl);
}

function PhotoPreview({ photo, className }: { photo: Photo; className?: string }) {
  if (isPhotoSucceeded(photo)) {
    return <img src={photo.imageUrl} alt={photo.prompt} className={className} referrerPolicy="no-referrer" />;
  }

  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center bg-slate-950 text-red-300", className)}>
      <AlertTriangle className="mb-2 h-6 w-6" />
      <span className="text-[10px] font-black uppercase tracking-widest">生成失败</span>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("参考图读取失败"));
    reader.readAsDataURL(file);
  });
}

function sizeFromAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") {
    return "1024x1024";
  }
  if (aspectRatio === "2:3" || aspectRatio === "9:16") {
    return "1024x1536";
  }
  if (aspectRatio === "3:2" || aspectRatio === "16:9") {
    return "1536x1024";
  }

  return "";
}

export function UserGallery() {
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<GalleryUserSession | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [demoPhotos, setDemoPhotos] = useState<Photo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [retryingPhotoId, setRetryingPhotoId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoPendingDelete, setPhotoPendingDelete] = useState<Photo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [clock, setClock] = useState("");
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(DEFAULT_GENERATION_CONFIG);
  const [editSourcePhoto, setEditSourcePhoto] = useState<Photo | null>(null);
  const [editImageData, setEditImageData] = useState("");
  const [editImagePreview, setEditImagePreview] = useState("");
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const user = session?.user ?? null;

  useEffect(() => {
    setSession(getGalleryUserSession());
    setIsIframe(window.self !== window.top);
    setClock(new Date().toLocaleTimeString("zh-CN"));
    const timer = window.setInterval(() => setClock(new Date().toLocaleTimeString("zh-CN")), 1000);
    void loadDemoPhotos();

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) {
      setPhotos([]);
      setAiConfig(DEFAULT_AI_CONFIG);
      return;
    }

    void loadGalleryState(session.accessToken);
  }, [session]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationSeconds(0);
      return;
    }

    setGenerationSeconds(0);
    const timer = window.setInterval(() => {
      setGenerationSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  async function loadGalleryState(token = session?.accessToken) {
    if (!token) {
      return;
    }

    await Promise.all([loadPhotos(token), loadConfig(token)]);
  }

  async function loadPhotos(token = session?.accessToken) {
    if (!token) {
      return;
    }

    try {
      const data = await apiFetch<Photo[]>("/gallery/photos", { token });
      setPhotos(data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "作品历史读取失败");
    }
  }

  async function loadConfig(token = session?.accessToken) {
    if (!token) {
      return;
    }

    try {
      const data = await apiFetch<AIConfig>("/gallery/config", { token });
      setAiConfig({
        ...DEFAULT_AI_CONFIG,
        ...data,
        apiKey: data.apiKey || "",
        baseUrl: data.baseUrl || DEFAULT_AI_CONFIG.baseUrl
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "个人配置读取失败");
    }
  }

  async function loadDemoPhotos() {
    try {
      const data = await apiFetch<Photo[]>("/gallery/demos");
      setDemoPhotos(data || []);
    } catch {
      setDemoPhotos([]);
    }
  }

  async function saveConfig() {
    if (!session) {
      setAuthMode("login");
      setIsAuthModalOpen(true);
      return;
    }

    setIsSavingConfig(true);
    setError(null);

    try {
      const data = await apiFetch<AIConfig>("/gallery/config", {
        method: "POST",
        token: session.accessToken,
        body: JSON.stringify(aiConfig)
      });
      setAiConfig({
        ...DEFAULT_AI_CONFIG,
        ...data,
        apiKey: data.apiKey || "",
        baseUrl: data.baseUrl || DEFAULT_AI_CONFIG.baseUrl
      });
      setIsSettingsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "个人配置保存失败");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleEmailAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setError(null);

    try {
      const nextSession = await apiFetch<GalleryUserSession>(authMode === "login" ? "/users/login" : "/users/register", {
        method: "POST",
        body: JSON.stringify(
          authMode === "login"
            ? { email, password }
            : {
                email,
                password,
                displayName
              }
        )
      });

      saveGalleryUserSession(nextSession);
      setSession(nextSession);
      setIsAuthModalOpen(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setError(null);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "身份验证失败");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    clearGalleryUserSession();
    setSession(null);
    setPhotos([]);
    setAiConfig(DEFAULT_AI_CONFIG);
    setGenerationConfig(DEFAULT_GENERATION_CONFIG);
    clearEditSource();
  }

  function clearEditSource() {
    setEditSourcePhoto(null);
    setEditImageData("");
    setEditImagePreview("");
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();

    if (!session) {
      setAuthMode("login");
      setIsAuthModalOpen(true);
      return;
    }

    if (!prompt.trim() || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const photo = await apiStream<Photo>("/gallery/photos/generate-stream", {
        method: "POST",
        token: session.accessToken,
        onEvent: (streamEvent) => {
          if (streamEvent.type === "ping" && typeof streamEvent.elapsedSeconds === "number") {
            setGenerationSeconds(streamEvent.elapsedSeconds);
          }
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          ...(generationConfig.model ? { model: generationConfig.model } : {}),
          ...(generationConfig.size ? { size: generationConfig.size } : {}),
          ...(generationConfig.aspectRatio ? { aspectRatio: generationConfig.aspectRatio } : {}),
          ...(generationConfig.layout ? { layout: generationConfig.layout } : {}),
          ...(editSourcePhoto ? { sourcePhotoId: editSourcePhoto.id } : {}),
          ...(editImageData ? { sourceImageData: editImageData } : {})
        })
      });

      if (photo.status === "failed") {
        setError(photo.errorMessage || "图片生成失败，已保存失败记录。");
      } else {
        setPrompt("");
        clearEditSource();
      }
      setPhotos((current) => [photo, ...current]);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "图片生成失败，请调整提示词后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRetry(photo: Photo) {
    if (!session || isGenerating || retryingPhotoId) {
      return;
    }

    setIsGenerating(true);
    setRetryingPhotoId(photo.id);
    setError(null);

    try {
      const retryPhoto = await apiFetch<Photo>(`/gallery/photos/${photo.id}/retry`, {
        method: "POST",
        token: session.accessToken
      });

      if (retryPhoto.status === "failed") {
        setError(retryPhoto.errorMessage || "重试失败，已保存失败记录。");
      }
      setPhotos((current) => [retryPhoto, ...current]);
      setSelectedPhoto(retryPhoto);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "重试失败");
    } finally {
      setRetryingPhotoId(null);
      setIsGenerating(false);
    }
  }

  async function handleEditImageUpload(file?: File) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      clearEditSource();
      setError("请上传图片文件作为参考图。");
      return;
    }

    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      clearEditSource();
      setError("参考图大小不能超过 2MB，请压缩后重新上传。");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditSourcePhoto(null);
      setEditImageData(dataUrl);
      setEditImagePreview(dataUrl);
      setError(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "参考图读取失败");
    }
  }

  async function copyPrompt(photo: Photo) {
    try {
      await navigator.clipboard.writeText(photo.prompt);
      setCopiedPromptId(photo.id);
      window.setTimeout(() => setCopiedPromptId((current) => (current === photo.id ? null : current)), 1600);
    } catch {
      setError("提示词复制失败");
    }
  }

  async function confirmDeletePhoto() {
    if (!session || !photoPendingDelete) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await apiFetch<{ success: boolean }>(`/gallery/photos/${photoPendingDelete.id}`, {
        method: "DELETE",
        token: session.accessToken
      });
      setPhotos((current) => current.filter((photo) => photo.id !== photoPendingDelete.id));
      setSelectedPhoto((current) => (current?.id === photoPendingDelete.id ? null : current));
      setPhotoPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownload(photo: Photo) {
    if (!isPhotoSucceeded(photo)) {
      setError("失败记录没有可下载图片。");
      return;
    }

    try {
      const response = await fetch(photo.imageUrl!);

      if (!response.ok) {
        throw new Error("图片下载失败");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";

      link.href = objectUrl;
      link.download = `vision-${photo.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "图片下载失败");
    }
  }


  const filteredPhotos = useMemo(
    () => photos.filter((photo) => photo.prompt.toLowerCase().includes(searchQuery.toLowerCase())),
    [photos, searchQuery]
  );
  const featuredPhoto = filteredPhotos[0];
  const gridPhotos = filteredPhotos.slice(1);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-950 font-sans text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200">
      <h1 className="sr-only">灵感画廊</h1>
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">灵感画廊</span>
        </div>

        <div className={cn("flex items-center gap-6", isIframe && "pr-[120px]")}>
          <div className="group relative hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索作品..."
              className="w-64 rounded-full border border-slate-700 bg-slate-800 py-1.5 pl-10 pr-4 text-sm transition-all placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="mx-1 h-6 w-px bg-slate-800" />

          {!isIframe && (
            <>
              <a
                href={EXTERNAL_LINKS.openaiApiKeys}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 rounded-full border border-emerald-500/20 px-3 py-1.5 text-emerald-400 shadow-lg shadow-emerald-500/5 transition-all hover:bg-emerald-400/10"
                title="打开 OpenAI API Keys"
              >
                <ExternalLink className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">API Keys</span>
              </a>
              <div className="mx-1 h-6 w-px bg-slate-800" />
            </>
          )}

          {isIframe && (
            <>
              <button
                onClick={() => window.open(window.location.href, "_blank")}
                className="group flex items-center gap-2 rounded-full border border-amber-500/20 px-3 py-1.5 text-amber-400 shadow-lg shadow-amber-500/5 transition-all hover:bg-amber-400/10"
                title="在新标签页打开"
              >
                <ExternalLink className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">新窗口</span>
              </button>
              <div className="mx-1 h-6 w-px bg-slate-800" />
            </>
          )}

          <button
            onClick={() => {
              setIsDemoOpen(true);
              void loadDemoPhotos();
            }}
            className="group flex items-center gap-2 rounded-full border border-emerald-500/20 px-3 py-1.5 text-emerald-400 shadow-lg shadow-emerald-500/5 transition-all hover:bg-emerald-400/10"
            title="示例作品"
          >
            <ImageIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">示例</span>
          </button>

          <div className="mx-1 h-6 w-px bg-slate-800" />

          <button
            onClick={() => setIsGuideOpen(true)}
            className="group flex items-center gap-2 rounded-full border border-indigo-500/20 px-3 py-1.5 text-indigo-400 shadow-lg shadow-indigo-500/5 transition-all hover:bg-indigo-400/10"
            title="使用指南"
          >
            <Compass className="h-4 w-4 transition-transform group-hover:rotate-12" />
            <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">指南</span>
          </button>

          <div className="mx-1 h-6 w-px bg-slate-800" />

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="group rounded-full p-2 text-slate-500 transition-all hover:bg-indigo-400/10 hover:text-indigo-400"
            title="设置"
          >
            <SettingsIcon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
          </button>

          <div className="mx-1 h-6 w-px bg-slate-800" />

          {user ? (
            <div className="flex items-center gap-3">
              <button onClick={handleLogout} className="group rounded-full p-2 text-slate-500 transition-all hover:bg-red-400/10 hover:text-red-400" title="退出登录">
                <LogOut className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-white">{user.displayName || "创作者"}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">在线</span>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}`}
                alt="用户头像"
                className="h-8 w-8 rounded-full border border-slate-800 ring-2 ring-emerald-500/20"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>登录</span>
            </button>
          )}
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-12">
        <div className="flex flex-col gap-6 md:col-span-3">
          <section className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">生成作品</h2>
            <form onSubmit={handleGenerate} className="flex flex-1 flex-col space-y-6">
              <div className="flex flex-1 flex-col">
                <label className="mb-2.5 block text-xs font-semibold text-slate-400">描述你的画面</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="h-40 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none transition-all placeholder:text-slate-700 focus:ring-2 focus:ring-indigo-500"
                  placeholder="例如：漂浮在云端的赛博朋克城市，霓虹倒影，细节丰富，电影感构图..."
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-600">比例</label>
                    <CustomSelect
                      value={generationConfig.aspectRatio}
                      onChange={(aspectRatio) =>
                        setGenerationConfig((current) => ({
                          ...current,
                          aspectRatio,
                          size: sizeFromAspectRatio(aspectRatio) || current.size
                        }))
                      }
                      options={ASPECT_RATIO_OPTIONS}
                      compact
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-600">输出尺寸</label>
                    <CustomSelect
                      value={generationConfig.size}
                      onChange={(size) => setGenerationConfig((current) => ({ ...current, size }))}
                      options={GENERATION_SIZE_OPTIONS}
                      compact
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-600">排版</label>
                    <CustomSelect
                      value={generationConfig.layout}
                      onChange={(layout) => setGenerationConfig((current) => ({ ...current, layout }))}
                      options={LAYOUT_OPTIONS}
                      compact
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-600">模型</label>
                    <CustomSelect
                      value={generationConfig.model}
                      onChange={(model) => setGenerationConfig((current) => ({ ...current, model }))}
                      options={GENERATION_MODEL_OPTIONS}
                      compact
                    />
                  </div>
                </div>

                {error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-2 text-xs text-red-400">{error}</p>}

                <button
                  disabled={isGenerating || !prompt.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:bg-slate-800 disabled:text-slate-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>生成中 {generationSeconds}s</span>
                    </>
                  ) : (
                    <>
                      {editSourcePhoto || editImageData ? <Wand2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      <span>{editSourcePhoto || editImageData ? "编辑生成" : "生成图片"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <div className="flex flex-col gap-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-5">
            <input
              ref={editFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleEditImageUpload(event.target.files?.[0])}
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">图生图编辑</p>
                <p className="mt-1 text-[11px] font-medium text-slate-600">上传参考图，或在作品详情中选择已有作品</p>
                <p className="mt-1 text-[11px] font-bold text-amber-400/80">本地参考图限制 2MB 内，超出后不可用于生成</p>
              </div>
              <Wand2 className="h-5 w-5 text-indigo-400" />
            </div>

            {editImagePreview || editSourcePhoto ? (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <div className="aspect-[4/3] overflow-hidden">
                  {editSourcePhoto ? (
                    <PhotoPreview photo={editSourcePhoto} className="h-full w-full object-cover" />
                  ) : (
                    <img src={editImagePreview} alt="图生图参考图" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                  <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                    {editSourcePhoto ? "来自历史作品" : "本地上传参考图"}
                  </p>
                  <button type="button" onClick={clearEditSource} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-red-400" title="移除参考图">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => editFileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 py-3 text-xs font-black text-slate-300 transition hover:border-indigo-500/40 hover:text-indigo-300"
            >
              <Upload className="h-4 w-4" />
              <span>上传参考图</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-6">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 grid-rows-none gap-4">
              {featuredPhoto && (
                <div
                  onClick={() => setSelectedPhoto(featuredPhoto)}
                  className="group relative col-span-2 aspect-[16/10] cursor-pointer overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl sm:aspect-auto sm:h-[400px]"
                >
                  <PhotoPreview photo={featuredPhoto} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  <div className="pointer-events-none absolute inset-0 bg-indigo-500/10 opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="absolute bottom-6 left-6 right-6 flex translate-y-2 items-end justify-between transition-transform duration-300 group-hover:translate-y-0">
                    <div className="max-w-[70%]">
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-indigo-400" />
                        {isPhotoSucceeded(featuredPhoto) ? "精选作品" : "失败留档"}
                      </div>
                      <p className="line-clamp-1 text-lg font-bold leading-tight text-white">{featuredPhoto.prompt}</p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        生成于 {new Date(featuredPhoto.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDownload(featuredPhoto);
                        }}
                        disabled={!isPhotoSucceeded(featuredPhoto)}
                        className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white backdrop-blur-xl transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      {!isPhotoSucceeded(featuredPhoto) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRetry(featuredPhoto);
                          }}
                          disabled={isGenerating}
                          className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300 backdrop-blur-xl transition-all hover:bg-amber-500/30 disabled:opacity-50"
                          title="重试"
                        >
                          {retryingPhotoId === featuredPhoto.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setPhotoPendingDelete(featuredPhoto);
                        }}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-400 backdrop-blur-xl transition-all hover:bg-red-500/30"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {gridPhotos.slice(0, 4).map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl transition-all hover:border-slate-700"
                >
                  <PhotoPreview photo={photo} className="h-full w-full scale-105 object-cover grayscale-[0.2] transition-all duration-500 group-hover:scale-100 group-hover:grayscale-0" />
                  {!isPhotoSucceeded(photo) && (
                    <div className="absolute left-3 top-3 rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">
                      失败
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-slate-950 to-transparent p-4 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setPhotoPendingDelete(photo);
                        }}
                        className="rounded-xl bg-red-400/20 p-2 text-red-400 transition-colors hover:bg-red-400/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDownload(photo);
                        }}
                        disabled={!isPhotoSucceeded(photo)}
                        className="rounded-xl bg-white/20 p-2 text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {!isPhotoSucceeded(photo) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRetry(photo);
                          }}
                          disabled={isGenerating}
                          className="rounded-xl bg-amber-400/20 p-2 text-amber-300 transition-colors hover:bg-amber-400/30 disabled:opacity-50"
                        >
                          {retryingPhotoId === photo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {gridPhotos.length > 4 && (
                <div className="col-span-2 flex cursor-default items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/20 p-6 text-slate-500 transition-all hover:bg-slate-900/40 hover:text-indigo-400">
                  <p className="text-xs font-bold uppercase tracking-[0.2em]">还有 {gridPhotos.length - 4} 张作品</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-800 bg-slate-900/20 p-12 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
                <Camera className="h-10 w-10 text-slate-700" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-200">开始你的画廊</h3>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">当前还没有作品。在左侧输入提示词，生成第一张 AI 图像。</p>
            </div>
          )}
        </div>

        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl md:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/20 p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-400" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">历史记录</h3>
            </div>
            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">{photos.length} 张</span>
          </div>

          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
            {filteredPhotos.map((photo) => (
              <div
                key={`history-${photo.id}`}
                onClick={() => setSelectedPhoto(photo)}
                className="group flex cursor-pointer gap-4 rounded-2xl border border-transparent p-3 transition-all hover:border-slate-700 hover:bg-slate-800"
              >
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 ring-1 ring-white/5 transition-all group-hover:ring-white/20">
                  <PhotoPreview photo={photo} className="h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="flex min-w-0 flex-col justify-center pr-2">
                  <p className={cn("truncate text-[11px] font-semibold leading-tight text-slate-200 transition-colors group-hover:text-indigo-400", !isPhotoSucceeded(photo) && "text-red-200")}>{photo.prompt}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-tighter text-slate-500 group-hover:text-slate-400">
                    {new Date(photo.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })} ·{" "}
                    {new Date(photo.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {filteredPhotos.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-slate-600">
                <Loader2 className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">暂无记录</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-950/20 p-4">
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-slate-600">系统时间：{clock}</p>
          </div>
        </div>
      </main>

      <footer className="flex h-10 items-center justify-between border-t border-slate-800 bg-slate-900/80 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            OpenAI 节点：已连接
          </span>
          <span className="hidden sm:inline">服务端存储环境</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="cursor-default text-indigo-400/80 transition-colors hover:text-indigo-400">© 2026 灵感画廊</span>
          <span className="hidden opacity-50 sm:inline">v1.0.0</span>
        </div>
      </footer>

      {selectedPhoto && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div onClick={() => setSelectedPhoto(null)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl md:flex-row">
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-black">
              <PhotoPreview photo={selectedPhoto} className="h-full w-full object-contain" />
            </div>

            <div className="flex w-full flex-col overflow-y-auto border-l border-slate-800 bg-slate-900 p-8 md:w-[400px]">
              <div className="mb-8 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10">
                    <ImageIcon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">作品详情</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">生成记录</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPhoto(null)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-800">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 space-y-8">
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">提示词</label>
                    <button
                      type="button"
                      onClick={() => void copyPrompt(selectedPhoto)}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 transition hover:bg-indigo-400/10"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedPromptId === selectedPhoto.id ? "已复制" : "复制"}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm font-medium leading-relaxed text-slate-300">{selectedPhoto.prompt}</div>
                </section>

                {!isPhotoSucceeded(selectedPhoto) && (
                  <section className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-300">失败原因</p>
                    <p className="text-xs leading-6 text-red-200">{selectedPhoto.errorMessage || "图片生成失败，已保存该次记录。"}</p>
                  </section>
                )}

                <section className="space-y-4">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">生成配置</label>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">模型</p>
                        <p className="font-mono text-xs text-emerald-400">{selectedPhoto.config?.model || "默认模型"}</p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-slate-500">生成类型</p>
                      <p className="truncate font-mono text-[10px] text-indigo-300">{selectedPhoto.operation === "edit" ? "图生图编辑" : "文生图"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">比例</p>
                        <p className="text-[11px] font-bold text-slate-300">{selectedPhoto.config?.aspectRatio || "默认"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">排版</p>
                        <p className="truncate text-[11px] font-bold text-slate-300">{selectedPhoto.config?.layout || "默认"}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">日期</p>
                        <p className="text-[11px] font-bold text-slate-300">{new Date(selectedPhoto.createdAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                      <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-500">分辨率</p>
                        <p className="text-[11px] font-bold text-slate-300">{(selectedPhoto.config?.resolution || selectedPhoto.config?.size || "1024x1024").replace("x", " x ")}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-10 flex gap-4 border-t border-slate-800 pt-6">
                {isPhotoSucceeded(selectedPhoto) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSourcePhoto(selectedPhoto);
                      setEditImageData("");
                      setEditImagePreview(selectedPhoto.imageUrl || "");
                      setSelectedPhoto(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 transition-all hover:bg-indigo-500/20"
                    title="作为参考图编辑"
                  >
                    <Wand2 className="h-5 w-5" />
                  </button>
                )}
                {!isPhotoSucceeded(selectedPhoto) && (
                  <button
                    type="button"
                    onClick={() => void handleRetry(selectedPhoto)}
                    disabled={isGenerating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 font-black text-slate-950 transition-all hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {retryingPhotoId === selectedPhoto.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    <span>{retryingPhotoId === selectedPhoto.id ? "重试中..." : "重试"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDownload(selectedPhoto)}
                  disabled={!isPhotoSucceeded(selectedPhoto)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-4 font-black text-slate-950 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  <Download className="h-4 w-4" />
                  <span>下载</span>
                </button>
                <button onClick={() => setPhotoPendingDelete(selectedPhoto)} className="flex w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 transition-all hover:bg-red-500/20">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {photoPendingDelete && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div onClick={() => (isDeleting ? undefined : setPhotoPendingDelete(null))} className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="p-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">删除作品</h3>
                  <p className="text-xs font-medium text-slate-500">该操作会从服务端作品记录中移除</p>
                </div>
              </div>
              <div className="mb-8 flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                  <PhotoPreview photo={photoPendingDelete} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-200">{photoPendingDelete.prompt}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    {new Date(photoPendingDelete.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPhotoPendingDelete(null)}
                  className="h-12 flex-1 rounded-2xl border border-slate-700 bg-slate-950 text-sm font-black text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeletePhoto}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-black text-white transition hover:bg-red-400 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isDeleting ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10">
                    <SettingsIcon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">系统配置</h3>
                    <p className="text-xs font-medium text-slate-500">配置 OpenAI 图像生成参数</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">模型名称</label>
                  <CustomSelect value={aiConfig.model} onChange={(model) => setAiConfig((current) => ({ ...current, model }))} options={IMAGE_MODEL_OPTIONS} />
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">输出尺寸</label>
                  <CustomSelect value={aiConfig.size} onChange={(size) => setAiConfig((current) => ({ ...current, size }))} options={IMAGE_SIZE_OPTIONS} />
                </div>
                <div>
                  <div className="mb-2 ml-1 flex items-center justify-between gap-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">OpenAI 密钥</label>
                    {!isIframe && (
                      <a
                        href={EXTERNAL_LINKS.openaiApiKeys}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 transition hover:bg-indigo-400/10"
                      >
                        去获取
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={isApiKeyVisible ? "text" : "password"}
                      value={aiConfig.apiKey}
                      onChange={(event) => setAiConfig((current) => ({ ...current, apiKey: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-4 pr-12 font-mono text-sm text-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setIsApiKeyVisible((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition-all hover:bg-indigo-400/10 hover:text-indigo-400"
                      title={isApiKeyVisible ? "隐藏密钥" : "查看密钥"}
                    >
                      {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="openai-base-url" className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Base URL</label>
                  <input
                    id="openai-base-url"
                    type="url"
                    value={aiConfig.baseUrl}
                    onChange={(event) => setAiConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://sub.appdock.cn/v1"
                  />
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={saveConfig}
                  disabled={isSavingConfig}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-black text-slate-950 shadow-xl shadow-white/5 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{isSavingConfig ? "保存中..." : "保存配置"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDemoOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
          <div onClick={() => setIsDemoOpen(false)} className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">示例作品</h3>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">管理员精选提示词与效果</p>
                </div>
              </div>
              <button onClick={() => setIsDemoOpen(false)} className="rounded-2xl p-3 text-slate-500 transition-colors hover:bg-slate-800">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-8">
              {demoPhotos.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {demoPhotos.map((demo) => (
                    <article key={`demo-${demo.id}`} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
                      <div className="aspect-[4/5] bg-black">
                        <PhotoPreview photo={demo} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-4 p-5">
                        <p className="line-clamp-4 text-sm font-medium leading-6 text-slate-300">{demo.prompt}</p>
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-500">
                          <span className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">{demo.config?.aspectRatio || "默认比例"}</span>
                          <span className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">{(demo.config?.resolution || demo.config?.size || "1k").replace("x", " x ")}</span>
                          <span className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1">{demo.operation === "edit" ? "图生图" : "文生图"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPrompt(demo.prompt);
                            setGenerationConfig((current) => ({
                              ...current,
                              aspectRatio: demo.config?.aspectRatio || "",
                              layout: demo.config?.layout || "",
                              size: demo.config?.size || ""
                            }));
                            setIsDemoOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                        >
                          <Copy className="h-4 w-4" />
                          使用提示词
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-slate-600">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-300">暂无展示示例</h4>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">管理员还没有指定 demo。后续指定成功作品后，这里会展示图片效果和对应提示词。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isGuideOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div onClick={() => setIsGuideOpen(false)} className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="p-10">
              <div className="mb-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
                    <Compass className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white">使用指南</h3>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">快速掌握 AI 画布</p>
                  </div>
                </div>
                <button onClick={() => setIsGuideOpen(false)} className="rounded-2xl p-3 text-slate-500 transition-colors hover:bg-slate-800">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Zap className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">即时生成</h4>
                  <p className="text-xs leading-relaxed text-slate-500">在控制面板输入你的想法。可以加入“超写实”“电影光影”“水彩风格”等描述，让画面更明确。</p>
                </div>
                <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                    <Layers className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">个人作品库</h4>
                  <p className="text-xs leading-relaxed text-slate-500">每次生成都会保存到服务端作品墙。点击任意卡片可查看提示词、模型和生成时间。</p>
                </div>
                <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <SettingsIcon className="h-5 w-5 text-amber-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">接口配置</h4>
                  <p className="text-xs leading-relaxed text-slate-500">在系统配置中填写模型、尺寸、API Key 和 Base URL，配置会跟随当前登录账号同步。</p>
                </div>
                <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                    <MousePointer2 className="h-5 w-5 text-rose-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">快速管理</h4>
                  <p className="text-xs leading-relaxed text-slate-500">使用顶部搜索栏筛选历史作品。支持查看详情、下载图片和删除不需要的记录。</p>
                </div>
              </div>

              <div className="mt-10 flex flex-col items-center gap-4 rounded-[2rem] border border-indigo-500/10 bg-indigo-500/5 p-6 sm:flex-row">
                <div className="flex-1">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-indigo-400">开始创作</p>
                  <p className="text-[11px] font-medium leading-relaxed text-slate-500">从一个清晰的画面开始，例如“午夜霓虹雨林，潮湿空气，电影级光影”。</p>
                </div>
                <button
                  onClick={() => {
                    setIsGuideOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="whitespace-nowrap rounded-2xl bg-white px-8 py-3 font-black text-slate-950 shadow-lg shadow-white/5 transition-all hover:scale-105 active:scale-95"
                >
                  开始使用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div onClick={() => setIsAuthModalOpen(false)} className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10">
                    <Zap className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{authMode === "login" ? "欢迎回来" : "创建账号"}</h3>
                    <p className="text-xs font-medium text-slate-500">进入你的个人画廊</p>
                  </div>
                </div>
                <button onClick={() => setIsAuthModalOpen(false)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {authMode === "signup" && (
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">显示名称</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                      placeholder="你的昵称"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">邮箱地址</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">密码</label>
                  <div className="relative">
                    <input
                      type={isPasswordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-4 pr-12 text-sm text-slate-300 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition-all hover:bg-indigo-400/10 hover:text-indigo-400"
                      title={isPasswordVisible ? "隐藏密码" : "查看密码"}
                    >
                      {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-[10px] text-red-400">{error}</p>}

                <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-black text-white shadow-xl shadow-indigo-600/10 transition-all hover:bg-indigo-500">
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  <span>{authMode === "login" ? "登录" : "创建账号"}</span>
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-4">
                <p className="mt-2 text-center text-xs">
                  <span className="font-medium text-slate-500">{authMode === "login" ? "还没有账号？" : "已有账号？"}</span>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === "login" ? "signup" : "login");
                      setError(null);
                    }}
                    className="font-bold text-indigo-400 transition-colors hover:text-indigo-300"
                  >
                    {authMode === "login" ? "注册" : "登录"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
