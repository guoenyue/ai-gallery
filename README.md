# AI Gallery

一个基于 `Next.js + NestJS + MongoDB` 的开源 AI 生图画廊，保留文生图、图生图、作品历史、示例作品展示和可选后台管理。

## AppDock

如果你不想自己准备 OpenAI 兼容接口，可以直接访问 [AppDock](https://sub.appdock.cn) 获取可用于本项目的 API Key 和 Base URL。项目默认的 `OPENAI_IMAGE_BASE_URL` 是 `https://sub.appdock.cn/v1`，前端系统配置里也可以为每个账号单独设置。

## 功能

- 用户注册/登录后保存个人作品与默认生图配置
- 支持 OpenAI 兼容 `/images/generations` 与 `/images/edits`
- 支持 SSE 流式生成进度
- 支持本地上传目录存储，配置七牛云后自动上传对象存储
- 后台管理员可查看用户作品、复制提示词、设置首页示例图

## 技术栈

- `apps/web`：Next.js + React + Tailwind CSS
- `apps/api`：NestJS + MongoDB + Mongoose

## 环境要求

- Node.js `18.17+`
- `pnpm 10+`
- MongoDB `6+` 或 `7+`

## 快速开始

```bash
cp .env.example .env
pnpm install
pnpm gen:rsa
```

把 `pnpm gen:rsa` 输出的 `ADMIN_LOGIN_RSA_PRIVATE_KEY` 和 `ADMIN_LOGIN_RSA_PUBLIC_KEY` 写入 `.env`，再按需配置：

- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY`，或让用户在前端个人配置里填写自己的 API Key
- `OPENAI_IMAGE_BASE_URL`，默认是 `https://sub.appdock.cn/v1`

启动 MongoDB：

```bash
docker compose up -d
```

启动开发环境：

```bash
pnpm dev
```

默认地址：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:4000`

## 常用命令

```bash
pnpm build
pnpm test
pnpm --filter @ai-gallery/api test
pnpm --filter @ai-gallery/web test
pnpm --filter @ai-gallery/api start
pnpm --filter @ai-gallery/web start
```

## 环境变量

参考 [.env.example](.env.example)。对象存储相关变量全部留空时，图片会保存到 `LOCAL_UPLOAD_DIR`，并通过 `PUBLIC_API_BASE_URL/uploads/...` 访问。

## 生产部署

构建后可以用 PM2 启动：

```bash
pnpm build
pm2 start ecosystem.config.cjs
```

进程名：

- `ai-gallery-api`
- `ai-gallery-web`

也可以使用仓库里的部署脚本：

```bash
pnpm deploy:remote -- --host x.x.x.x --user deploy --path /srv/ai-gallery
pnpm deploy:server -- --first --repo https://github.com/guoenyue/ai-gallery.git --path /srv/ai-gallery
```
