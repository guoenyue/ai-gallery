import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";

function formatPemForEnv(pem) {
  return pem.trim().replace(/\n/g, "\\n");
}

export function generateRsaKeyPairEnvLines() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    }
  });

  return [
    "# 后台登录 RSA 私钥，直接复制到根目录 .env",
    `ADMIN_LOGIN_RSA_PRIVATE_KEY=${formatPemForEnv(privateKey)}`,
    "",
    "# 后台登录 RSA 公钥，直接复制到根目录 .env；如不想手动维护，可留空",
    `ADMIN_LOGIN_RSA_PUBLIC_KEY=${formatPemForEnv(publicKey)}`
  ];
}

function runCli() {
  process.stdout.write(`${generateRsaKeyPairEnvLines().join("\n")}\n`);
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFilePath) {
  runCli();
}
