# 后台前端镜像：React 19 + MUI 后台（源码在 admin/）。
#
# ---------------------------------------------------------------------------
# 2026-09-11：切换完成，旧的 Vue 2 + element-ui 后台已删除
# ---------------------------------------------------------------------------
# 这个文件之前同时装两个应用（/ 是旧 Vue、/next/ 是新 React），
# 当时不切的理由写的是「旧后台 30 个页面都能用，新的只完成 8 个，
# 直接切会让另外 22 个页面变成占位页 —— 那是功能倒退」。
#
# 那个理由现在不成立了。切之前按【菜单驱动】核对过（2026-09-11）：
# 数据库 sys_menu 里 type=1（页面项）共 25 条，React 的 pageRegistry
# 全部命中，没有一条会落到 NotImplemented。
# 也就是说侧边栏能点到的页面，一个都不会退化。
#
# 【两个没有带过来的页面，记在这里】
# 旧应用的 router/index.js 里有一批不在菜单里、只能手敲 URL 才进得去的
# 硬编码路由（gulimall 教程遗留）。其中这两个 React 没有对应页面：
#   /member-level   会员等级   modules/member/level.vue
#   /product-sku    SKU管理    modules/product/sku.vue
# 它们在旧后台里同样进不去（侧边栏是菜单驱动的，菜单里没有这两项），
# 所以这不是"切换造成的丢失"，而是"一直没接上菜单的两个页面随旧应用一起走了"。
# 要补的话源码在 git 历史里，BASELINE.md 也记着旧应用的页面清单。
# 其余硬编码路由（spu-add / spu-spec / ware-info / ware-sku / purchase /
# purchase-detail）React 都有；/theme 和两个 demo 页不需要。
#
# ---------------------------------------------------------------------------
# 构建
# ---------------------------------------------------------------------------
# admin/package.json 的 engines 要求 node >= 22.22.0（Vite 8 + TypeScript 7）。
FROM node:22-alpine AS build
WORKDIR /app
COPY admin/package.json admin/package-lock.json ./
# 用 npm ci 而不是 npm install：锁文件在，ci 才是可复现的那个。
# 不同步时 npm ci 会直接失败，而 npm install 会默默改掉锁文件。
RUN npm ci
COPY admin/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# 运行时
# ---------------------------------------------------------------------------
# 【base 是相对路径，所以放在 / 和放在 /next/ 都成立】
# admin/vite.config.ts 里 base: './'，index.html 用 './config/index.js'
# 加载运行时配置 —— 在 / 下解析成 /config/index.js，正是
# admin/public/config/index.js 构建出来的位置。
# 路由是 hash 路由（#/product-brand），也不依赖挂载路径。
FROM nginx:1.25-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
