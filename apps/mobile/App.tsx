import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { createApiClient, getDefaultApiBaseUrl } from "./src/api-client";

type User = {
  id: string;
  email: string;
  displayName: string;
};

type Session = {
  accessToken: string;
  user: User;
};

type GalleryConfig = {
  model: string;
  size: string;
  apiKey: string;
  baseUrl: string;
};

type Photo = {
  id: string;
  prompt: string;
  imageUrl?: string;
  status?: "succeeded" | "failed";
  errorMessage?: string;
  createdAt?: string;
  config?: {
    model?: string;
    size?: string;
    baseUrl?: string;
  };
};

const DEFAULT_CONFIG: GalleryConfig = {
  model: "gpt-image-2",
  size: "1024x1024",
  apiKey: "",
  baseUrl: "https://sub.appdock.cn/v1"
};

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(getDefaultApiBaseUrl());
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl }), [apiBaseUrl]);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [config, setConfig] = useState<GalleryConfig>(DEFAULT_CONFIG);
  const [prompt, setPrompt] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    void Promise.all([loadConfig(session.accessToken), loadPhotos(session.accessToken)]);
  }, [session]);

  async function authenticate() {
    setError("");
    setIsBusy(true);

    try {
      const nextSession = await api.request<Session>(authMode === "login" ? "/users/login" : "/users/register", {
        method: "POST",
        body:
          authMode === "login"
            ? { email, password }
            : {
                email,
                password,
                displayName: displayName || email.split("@")[0] || "User"
              }
      });

      setSession(nextSession);
      setPassword("");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "登录失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadConfig(token = session?.accessToken) {
    if (!token) {
      return;
    }

    try {
      const data = await api.request<GalleryConfig>("/gallery/config", { token });
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
        apiKey: data.apiKey || "",
        baseUrl: data.baseUrl || DEFAULT_CONFIG.baseUrl
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "配置读取失败");
    }
  }

  async function saveConfig() {
    if (!session) {
      return;
    }

    setError("");
    setIsBusy(true);

    try {
      const data = await api.request<GalleryConfig>("/gallery/config", {
        method: "POST",
        token: session.accessToken,
        body: config
      });
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
        apiKey: data.apiKey || "",
        baseUrl: data.baseUrl || DEFAULT_CONFIG.baseUrl
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "配置保存失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadPhotos(token = session?.accessToken) {
    if (!token) {
      return;
    }

    try {
      const data = await api.request<Photo[]>("/gallery/photos", { token });
      setPhotos(data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "作品读取失败");
    }
  }

  async function generatePhoto() {
    if (!session || !prompt.trim()) {
      return;
    }

    setError("");
    setIsBusy(true);

    try {
      const photo = await api.request<Photo>("/gallery/photos/generate", {
        method: "POST",
        token: session.accessToken,
        body: {
          prompt: prompt.trim()
        }
      });
      setPrompt("");
      setPhotos((current) => [photo, ...current]);
      if (photo.status === "failed") {
        setError(photo.errorMessage || "图片生成失败");
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "图片生成失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function retryPhoto(photo: Photo) {
    if (!session) {
      return;
    }

    setError("");
    setIsBusy(true);

    try {
      const nextPhoto = await api.request<Photo>(`/gallery/photos/${photo.id}/retry`, {
        method: "POST",
        token: session.accessToken
      });
      setPhotos((current) => [nextPhoto, ...current]);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "重试失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!session) {
      return;
    }

    Alert.alert("删除作品", "删除后无法恢复。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void api
            .request(`/gallery/photos/${photo.id}`, {
              method: "DELETE",
              token: session.accessToken
            })
            .then(() => setPhotos((current) => current.filter((item) => item.id !== photo.id)))
            .catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "删除失败"));
        }
      }
    ]);
  }

  function openPhoto(photo: Photo) {
    if (!photo.imageUrl) {
      setError("当前作品没有可打开的图片");
      return;
    }

    void Linking.openURL(photo.imageUrl).catch(() => setError("无法打开图片链接"));
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.brand}>AI Gallery</Text>
            <Text style={styles.title}>移动生图工作台</Text>
            <Text style={styles.subtitle}>登录后同步 Web 端配置、历史作品和生成记录。</Text>

            <View style={styles.segment}>
              <SegmentButton label="登录" selected={authMode === "login"} onPress={() => setAuthMode("login")} />
              <SegmentButton label="注册" selected={authMode === "register"} onPress={() => setAuthMode("register")} />
            </View>

            <Field label="API 地址" value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCapitalize="none" />
            <Field label="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            {authMode === "register" ? <Field label="昵称" value={displayName} onChangeText={setDisplayName} /> : null}
            <Field label="密码" value={password} onChangeText={setPassword} secureTextEntry />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton label={isBusy ? "处理中..." : authMode === "login" ? "登录" : "注册"} disabled={isBusy} onPress={authenticate} />
          </ScrollView>
        </KeyboardAvoidingView>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.content}>
            <View style={styles.header}>
              <View>
                <Text style={styles.brand}>AI Gallery</Text>
                <Text style={styles.headerTitle}>{session.user.displayName || session.user.email}</Text>
              </View>
              <Pressable style={styles.ghostButton} onPress={() => setSession(null)}>
                <Text style={styles.ghostButtonText}>退出</Text>
              </Pressable>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>系统配置</Text>
              <Field label="模型" value={config.model} onChangeText={(model) => setConfig((current) => ({ ...current, model }))} />
              <Field label="尺寸" value={config.size} onChangeText={(size) => setConfig((current) => ({ ...current, size }))} />
              <Field label="Base URL" value={config.baseUrl} onChangeText={(baseUrl) => setConfig((current) => ({ ...current, baseUrl }))} autoCapitalize="none" />
              <Field label="API Key" value={config.apiKey} onChangeText={(apiKey) => setConfig((current) => ({ ...current, apiKey }))} secureTextEntry autoCapitalize="none" />
              <PrimaryButton label="保存配置" disabled={isBusy} onPress={saveConfig} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>生成图片</Text>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="描述你想生成的画面"
                placeholderTextColor="#64748b"
                multiline
                style={[styles.input, styles.promptInput]}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label={isBusy ? "生成中..." : "开始生成"} disabled={isBusy || !prompt.trim()} onPress={generatePhoto} />
              <Pressable style={styles.refreshButton} onPress={() => void loadPhotos()}>
                <Text style={styles.refreshButtonText}>刷新作品历史</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>作品历史</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isBusy ? <ActivityIndicator color="#a5b4fc" /> : <Text style={styles.emptyText}>暂无作品</Text>}
          </View>
        }
        renderItem={({ item }) => <PhotoCard photo={item} onOpen={() => openPhoto(item)} onRetry={() => void retryPhoto(item)} onDelete={() => void deletePhoto(item)} />}
        contentContainerStyle={styles.listContent}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, selected && styles.segmentButtonSelected]} onPress={onPress}>
      <Text style={[styles.segmentButtonText, selected && styles.segmentButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "url";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        keyboardType={props.keyboardType || "default"}
        placeholderTextColor="#64748b"
        style={styles.input}
      />
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function PhotoCard({ photo, onOpen, onRetry, onDelete }: { photo: Photo; onOpen: () => void; onRetry: () => void; onDelete: () => void }) {
  const succeeded = (photo.status || "succeeded") === "succeeded" && Boolean(photo.imageUrl);

  return (
    <View style={styles.photoCard}>
      {succeeded ? (
        <Pressable onPress={onOpen}>
          <Image source={{ uri: photo.imageUrl }} style={styles.photoImage} />
        </Pressable>
      ) : (
        <View style={styles.failedPreview}>
          <Text style={styles.failedText}>生成失败</Text>
        </View>
      )}
      <View style={styles.photoBody}>
        <Text style={styles.promptText}>{photo.prompt}</Text>
        <Text style={styles.metaText}>{photo.config?.model || "gpt-image-2"} · {photo.config?.size || "默认尺寸"}</Text>
        {photo.errorMessage ? <Text style={styles.error}>{photo.errorMessage}</Text> : null}
        <View style={styles.photoActions}>
          <Pressable style={styles.smallButton} onPress={onOpen}>
            <Text style={styles.smallButtonText}>打开原图</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={onRetry}>
            <Text style={styles.smallButtonText}>重试</Text>
          </Pressable>
          <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>删除</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617"
  },
  keyboard: {
    flex: 1
  },
  authContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    gap: 14
  },
  content: {
    padding: 20,
    gap: 18
  },
  listContent: {
    paddingBottom: 32
  },
  brand: {
    color: "#818cf8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 24
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4
  },
  segment: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    flexDirection: "row",
    padding: 4
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: "center"
  },
  segmentButtonSelected: {
    backgroundColor: "#4f46e5"
  },
  segmentButtonText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "700"
  },
  segmentButtonTextSelected: {
    color: "#ffffff"
  },
  panel: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  panelTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800"
  },
  field: {
    gap: 6
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  promptInput: {
    minHeight: 112,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryButtonDisabled: {
    backgroundColor: "#475569"
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800"
  },
  ghostButton: {
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  ghostButtonText: {
    color: "#cbd5e1",
    fontWeight: "800"
  },
  refreshButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center"
  },
  refreshButtonText: {
    color: "#a5b4fc",
    fontWeight: "800"
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800"
  },
  error: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 20
  },
  emptyState: {
    alignItems: "center",
    padding: 32
  },
  emptyText: {
    color: "#94a3b8"
  },
  photoCard: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: "hidden"
  },
  photoImage: {
    aspectRatio: 1,
    backgroundColor: "#020617",
    width: "100%"
  },
  failedPreview: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#450a0a",
    justifyContent: "center",
    width: "100%"
  },
  failedText: {
    color: "#fecaca",
    fontWeight: "800"
  },
  photoBody: {
    gap: 8,
    padding: 14
  },
  promptText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 12
  },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  smallButton: {
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  smallButtonText: {
    color: "#cbd5e1",
    fontWeight: "800"
  },
  deleteButton: {
    borderColor: "#7f1d1d"
  },
  deleteButtonText: {
    color: "#fca5a5",
    fontWeight: "800"
  }
});
