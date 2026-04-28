import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey } from "node:crypto";
import test from "node:test";
import { generateRsaKeyPairEnvLines } from "./generate-rsa-keypair.mjs";

function extractEnvValue(lines, key) {
  const match = lines.find((line) => line.startsWith(`${key}=`));
  assert.ok(match, `未找到 ${key} 输出`);
  return match.slice(key.length + 1);
}

test("generateRsaKeyPairEnvLines outputs valid env-safe RSA keys", () => {
  const lines = generateRsaKeyPairEnvLines();
  const privateKeyValue = extractEnvValue(lines, "ADMIN_LOGIN_RSA_PRIVATE_KEY");
  const publicKeyValue = extractEnvValue(lines, "ADMIN_LOGIN_RSA_PUBLIC_KEY");
  const privateKeyPem = privateKeyValue.replace(/\\n/g, "\n");
  const publicKeyPem = publicKeyValue.replace(/\\n/g, "\n");

  assert.match(privateKeyPem, /BEGIN PRIVATE KEY/);
  assert.match(publicKeyPem, /BEGIN PUBLIC KEY/);
  assert.doesNotThrow(() => createPrivateKey(privateKeyPem));
  assert.doesNotThrow(() => createPublicKey(publicKeyPem));
});
