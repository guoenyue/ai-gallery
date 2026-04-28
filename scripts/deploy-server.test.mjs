import assert from "node:assert/strict";
import test from "node:test";
import { buildServerDeployCommand, parseServerDeployArgs } from "./deploy-server.mjs";

test("parseServerDeployArgs parses first deploy arguments", () => {
  const parsed = parseServerDeployArgs([
    "--repo",
    "git@github.com:example/project.git",
    "--path",
    "/srv/ai-gallery",
    "--first"
  ]);

  assert.equal(parsed.repo, "git@github.com:example/project.git");
  assert.equal(parsed.path, "/srv/ai-gallery");
  assert.equal(parsed.first, true);
});

test("buildServerDeployCommand builds first deploy flow", () => {
  const command = buildServerDeployCommand({
    repo: "git@github.com:example/project.git",
    deployPath: "/srv/ai-gallery",
    first: true,
    registry: "https://registry.npmmirror.com"
  });

  assert.match(command, /git clone 'git@github\.com:example\/project\.git' '\/srv\/ai-gallery'/);
  assert.match(command, /cp \.env\.example \.env/);
  assert.match(command, /pnpm install --store-dir \/tmp\/pnpm-store --registry https:\/\/registry\.npmmirror\.com/);
  assert.match(command, /pm2 start ecosystem\.config\.cjs --update-env/);
});

test("buildServerDeployCommand builds update flow", () => {
  const command = buildServerDeployCommand({
    deployPath: "/srv/ai-gallery",
    first: false,
    registry: "https://registry.npmmirror.com"
  });

  assert.doesNotMatch(command, /git clone/);
  assert.match(command, /cd '\/srv\/ai-gallery'/);
  assert.match(command, /git pull/);
  assert.match(command, /pm2 startOrReload ecosystem\.config\.cjs --update-env/);
});
