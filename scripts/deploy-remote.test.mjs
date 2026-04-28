import assert from "node:assert/strict";
import test from "node:test";
import { buildRemoteDeployCommand, parseDeployArgs, shouldRunLocalCommandInShell } from "./deploy-remote.mjs";

test("parseDeployArgs parses required deploy arguments", () => {
  const parsed = parseDeployArgs([
    "--host",
    "example.com",
    "--user",
    "deploy",
    "--path",
    "/srv/ai-gallery"
  ]);

  assert.equal(parsed.host, "example.com");
  assert.equal(parsed.user, "deploy");
  assert.equal(parsed.port, 22);
  assert.equal(parsed.path, "/srv/ai-gallery");
});

test("buildRemoteDeployCommand includes pnpm install and pm2 reload flow", () => {
  const command = buildRemoteDeployCommand({
    remotePath: "/srv/ai-gallery",
    archiveName: "deploy.tar.gz"
  });

  assert.match(command, /mkdir -p '\/srv\/ai-gallery'/);
  assert.match(command, /tar -xzf '\/tmp\/deploy\.tar\.gz' -C '\/srv\/ai-gallery'/);
  assert.match(command, /CI=true pnpm install --prod --frozen-lockfile --config\.confirmModulesPurge=false/);
  assert.match(command, /pm2 startOrReload ecosystem\.config\.cjs --update-env/);
});

test("local commands run through shell on Windows", () => {
  assert.equal(shouldRunLocalCommandInShell("win32"), true);
  assert.equal(shouldRunLocalCommandInShell("linux"), false);
});
