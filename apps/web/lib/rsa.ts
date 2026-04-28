function pemToArrayBuffer(pem: string) {
  const normalizedPem = pem.replace(/\\n/g, "\n");
  const base64 = normalizedPem.replace(/-----BEGIN PUBLIC KEY-----/g, "").replace(/-----END PUBLIC KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return bytes.buffer;
}

export async function encryptLoginCredentials(publicKeyPem: string, credentials: { username: string; password: string }) {
  const subtleCrypto = window.crypto?.subtle;

  if (!subtleCrypto) {
    if (window.isSecureContext === false) {
      throw new Error("当前访问环境不支持安全加密登录，请使用 localhost 或 HTTPS 访问后台。");
    }

    throw new Error("当前浏览器不支持安全加密登录，请更换现代浏览器后重试。");
  }

  let importedKey: CryptoKey;
  try {
    importedKey = await subtleCrypto.importKey(
      "spki",
      pemToArrayBuffer(publicKeyPem),
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      false,
      ["encrypt"]
    );
  } catch {
    throw new Error("登录公钥无效，请联系管理员检查后台 RSA 配置。");
  }

  try {
    const encrypted = await subtleCrypto.encrypt(
      {
        name: "RSA-OAEP"
      },
      importedKey,
      new TextEncoder().encode(JSON.stringify(credentials))
    );

    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  } catch {
    throw new Error("登录加密失败，请刷新页面后重试。");
  }
}
