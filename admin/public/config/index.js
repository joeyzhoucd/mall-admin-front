/*
 * 运行时配置。这个文件【不参与打包】，构建后原样出现在 dist/config/index.js，
 * 部署时可以直接替换 —— 一份镜像多环境靠它。
 *
 * baseUrl 为什么是 '/api'：
 * 网关上 /api/** 是管理端流量的专用前缀，并且从 2026-09-03 起那个前缀
 * 由 AdminAuthFilter 校验管理端 JWT。前台商城的路径不走这个前缀。
 */
window.SITE_CONFIG = {
  baseUrl: '/api',
  // 开发期 vite 会把 /api 代到网关（见 vite.config.ts 的 server.proxy）
}
