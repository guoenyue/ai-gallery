# 非 Docker 部署

如果服务器已有 MongoDB，可以不使用 `docker compose`。

## 1. 准备环境

安装：

- Node.js `18.17+`
- pnpm `10+`
- MongoDB `6+` 或 `7+`
- PM2，可选但推荐

## 2. 配置

```bash
cp .env.example .env
pnpm gen:rsa
```

编辑 `.env`：

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_LOGIN_RSA_PRIVATE_KEY`
- `ADMIN_LOGIN_RSA_PUBLIC_KEY`
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_BASE_URL`
- `PUBLIC_API_BASE_URL`

如果不配置七牛云，图片会保存到 `LOCAL_UPLOAD_DIR`。

## 3. 启动

```bash
pnpm install
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
```

常用命令：

```bash
pm2 logs ai-gallery-api
pm2 logs ai-gallery-web
pm2 restart ai-gallery-api
pm2 restart ai-gallery-web
```

## 4. 反向代理

推荐把前端代理到 `127.0.0.1:3000`，后端 `/api/` 代理到 `127.0.0.1:4000`。前端在非 localhost 环境下默认请求同域 `/api`。
