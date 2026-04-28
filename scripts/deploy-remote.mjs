import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFilePath);
const rootDir = path.resolve(scriptDir, "..");

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function ensureDir(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function copyIntoStage(stageDir, relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(stageDir, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`部署文件缺失：${relativePath}`);
  }

  ensureDir(target);
  fs.cpSync(source, target, { recursive: true });
}

function copyOptionalIntoStage(stageDir, relativePath) {
  const source = path.join(rootDir, relativePath);

  if (!fs.existsSync(source)) {
    return;
  }

  copyIntoStage(stageDir, relativePath);
}

function run(command, args, cwd = rootDir) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit"
  });
}

function runRemoteShell({ user, host, port, command }) {
  run("ssh", [
    "-p",
    String(port),
    `${user}@${host}`,
    `/bin/bash -lc ${shellEscape(command)}`
  ]);
}

function hasCommand(command) {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(probe, args, {
    stdio: "ignore",
    shell: process.platform !== "win32"
  });

  return result.status === 0;
}

export function shouldRunLocalCommandInShell(platform = process.platform) {
  return platform === "win32";
}

function runLocal(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: shouldRunLocalCommandInShell()
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function uploadArchive({ archivePath, archiveName, user, host, port }) {
  const remoteTarget = `${user}@${host}:/tmp/${archiveName}`;

  if (hasCommand("rsync")) {
    run("rsync", [
      "-avP",
      "-e",
      `ssh -p ${port} -o ServerAliveInterval=30 -o ServerAliveCountMax=6`,
      archivePath,
      remoteTarget
    ]);
    return;
  }

  run("scp", [
    "-C",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=6",
    "-P",
    String(port),
    archivePath,
    remoteTarget
  ]);
}

export function parseDeployArgs(argv) {
  const parsed = {
    port: 22,
    archiveName: "ai-gallery-deploy.tar.gz",
    skipBuild: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--host") {
      parsed.host = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--user") {
      parsed.user = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--path") {
      parsed.path = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--port") {
      parsed.port = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (current === "--archive-name") {
      parsed.archiveName = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--skip-build") {
      parsed.skipBuild = true;
      continue;
    }
  }

  if (!parsed.host || !parsed.user || !parsed.path) {
    throw new Error("缺少部署参数。请至少提供 --host、--user、--path。");
  }

  if (!Number.isInteger(parsed.port) || parsed.port <= 0) {
    throw new Error("部署端口无效，请通过 --port 提供正确的 SSH 端口。");
  }

  return parsed;
}

export function buildRemoteDeployCommand({ remotePath, archiveName }) {
  const remoteArchivePath = `/tmp/${archiveName}`;
  const pm2ReloadCommand =
    "if pm2 pid ai-gallery-api >/dev/null 2>&1 || pm2 pid ai-gallery-web >/dev/null 2>&1; then pm2 startOrReload ecosystem.config.cjs --update-env; else pm2 start ecosystem.config.cjs --update-env; fi";

  return [
    "set -e",
    `mkdir -p ${shellEscape(remotePath)}`,
    `rm -rf ${shellEscape(path.posix.join(remotePath, "apps/api/dist"))} ${shellEscape(path.posix.join(remotePath, "apps/web/.next"))}`,
    `tar -xzf ${shellEscape(remoteArchivePath)} -C ${shellEscape(remotePath)}`,
    `rm -f ${shellEscape(remoteArchivePath)}`,
    `cd ${shellEscape(remotePath)}`,
    "CI=true pnpm install --prod --frozen-lockfile --config.confirmModulesPurge=false",
    pm2ReloadCommand
  ].join(" && ");
}

function printUsage() {
  console.log(`用法：
pnpm deploy:remote -- --host 服务器地址 --user 登录用户 --path 远端目录 [--port 22] [--archive-name deploy.tar.gz] [--skip-build]

示例：
pnpm deploy:remote -- --host 203.0.113.10 --user deploy --path /srv/ai-gallery
`);
}

function stageDeployFiles(stageDir) {
  const requiredPaths = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    "ecosystem.config.cjs",
    "apps/api/package.json",
    "apps/api/dist",
    "apps/web/package.json",
    "apps/web/next.config.mjs",
    "apps/web/.next"
  ];

  for (const relativePath of requiredPaths) {
    copyIntoStage(stageDir, relativePath);
  }

  const optionalPaths = ["apps/web/public"];

  for (const relativePath of optionalPaths) {
    copyOptionalIntoStage(stageDir, relativePath);
  }
}

function deploy() {
  let parsed;
  try {
    parsed = parseDeployArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "部署参数解析失败。");
    printUsage();
    process.exit(1);
  }

  if (!parsed.skipBuild) {
    runLocal("pnpm", ["build"]);
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-gallery-remote-deploy-"));
  const archivePath = path.join(os.tmpdir(), parsed.archiveName);

  try {
    stageDeployFiles(stageDir);

    run("tar", ["-czf", archivePath, "-C", stageDir, "."]);
    uploadArchive({
      archivePath,
      archiveName: parsed.archiveName,
      user: parsed.user,
      host: parsed.host,
      port: parsed.port
    });

    const remoteCommand = buildRemoteDeployCommand({
      remotePath: parsed.path,
      archiveName: parsed.archiveName
    });

    runRemoteShell({
      user: parsed.user,
      host: parsed.host,
      port: parsed.port,
      command: remoteCommand
    });
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.rmSync(archivePath, { force: true });
  }
}

if (process.argv[1] === scriptFilePath) {
  deploy();
}
