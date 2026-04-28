import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptFilePath = fileURLToPath(import.meta.url);

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function run(command, args) {
  execFileSync(command, args, {
    stdio: "inherit"
  });
}

export function parseServerDeployArgs(argv) {
  const parsed = {
    path: "/srv/ai-gallery",
    registry: "https://registry.npmmirror.com",
    first: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--repo") {
      parsed.repo = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--path") {
      parsed.path = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--registry") {
      parsed.registry = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--first") {
      parsed.first = true;
      continue;
    }
  }

  if (parsed.first && !parsed.repo) {
    throw new Error("首次部署必须提供 --repo 仓库地址。");
  }

  return parsed;
}

export function buildServerDeployCommand({ repo, deployPath, first, registry }) {
  const installCommand = `pnpm install --store-dir /tmp/pnpm-store --registry ${registry}`;
  const buildCommand = "pnpm build";
  const saveCommand = "pm2 save";

  if (first) {
    return [
      "set -e",
      `git clone ${shellEscape(repo)} ${shellEscape(deployPath)}`,
      `cd ${shellEscape(deployPath)}`,
      "cp .env.example .env",
      installCommand,
      buildCommand,
      "pm2 start ecosystem.config.cjs --update-env",
      saveCommand
    ].join(" && ");
  }

  return [
    "set -e",
    `cd ${shellEscape(deployPath)}`,
    "git pull",
    installCommand,
    buildCommand,
    "pm2 startOrReload ecosystem.config.cjs --update-env",
    saveCommand
  ].join(" && ");
}

function printUsage() {
  console.log(`用法：
pnpm deploy:server -- [--first --repo 仓库地址] [--path /srv/ai-gallery] [--registry https://registry.npmmirror.com]

示例：
pnpm deploy:server -- --first --repo git@github.com:example/project.git --path /srv/ai-gallery
pnpm deploy:server -- --path /srv/ai-gallery
`);
}

function deployOnServer() {
  let parsed;
  try {
    parsed = parseServerDeployArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "服务器部署参数解析失败。");
    printUsage();
    process.exit(1);
  }

  const command = buildServerDeployCommand({
    repo: parsed.repo,
    deployPath: parsed.path,
    first: parsed.first,
    registry: parsed.registry
  });

  run("/bin/bash", ["-lc", command]);
}

if (process.argv[1] === scriptFilePath) {
  deployOnServer();
}
