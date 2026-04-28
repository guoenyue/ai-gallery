const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: "ai-gallery-api",
      cwd: rootDir,
      script: "pnpm",
      args: "--filter @ai-gallery/api start",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      }
    },
    {
      name: "ai-gallery-web",
      cwd: rootDir,
      script: "pnpm",
      args: "--filter @ai-gallery/web start",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
