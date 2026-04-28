import { createPrivateKey, createPublicKey } from "node:crypto";

export function normalizePemKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

export function derivePublicKeyFromPrivateKey(privateKey: string) {
  return createPublicKey(createPrivateKey(normalizePemKey(privateKey))).export({
    type: "spki",
    format: "pem"
  });
}
