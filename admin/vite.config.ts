import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * 【构建产物必须和现有部署形态兼容】
 * 部署是「build 出 dist/ → 拷进 nginx 镜像」（见仓库根的 Dockerfile）。
 * 所以这里不引入任何需要 Node 运行时的东西 —— 纯静态产物。
 *
 * 【base 用相对路径】
 * 旧应用的 index.html 里是 ./static/... 这样的相对引用，nginx 直接托在根路径下。
 * 保持 './' 让产物不绑定部署路径，将来挂到子路径也不用重新构建。
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    /**
     * 【开发期把 /api 代到网关】
     * 生产环境下 window.SITE_CONFIG.baseUrl 是 '/api'，由 nginx 转给网关；
     * 开发时没有 nginx，所以在这里代理，让同一份代码在两种环境下都走 '/api'。
     *
     * 目标地址是 MetalLB 分给 ingress-nginx 的地址。它【会随宿主机重启变化】
     * （Hyper-V Default Switch 的子网不保证稳定，见 mall-deploy/SETUP.md），
     * 所以从环境变量读，变了改一个环境变量而不是改代码。
     * 不设时的默认值是当前值，本地能直接跑。
     */
    proxy: {
      '/api': {
        // 默认值是本地集群 ingress 的 MetalLB 地址。它会随 Hyper-V Default Switch
        // 换网段而变（2026-09-04 已是第四次：172.17.159.241 → 172.18.95.241），
        // 所以真正该依赖的是 MALL_GATEWAY 环境变量，这个默认值只是图方便。
        // 查当前地址：kubectl get svc -n ingress-nginx ingress-nginx-controller
        target: process.env.MALL_GATEWAY ?? 'http://172.18.95.241',
        changeOrigin: true,
        // 网关按 Host 头选路由（admin.mall.com 那条），所以必须带上，
        // 否则会落到 **.mall.com 的兜底路由上、打到 mall-product 去。
        headers: { Host: 'admin.mall.com' },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    /**
     * 旧应用的产物里带着 6.4MB 的 ueditor，一直打进了 nginx 镜像。
     * 这里设一个明确的告警线，让「体积悄悄涨上去」变成构建时可见的事情。
     */
    chunkSizeWarningLimit: 800,
  },
})
