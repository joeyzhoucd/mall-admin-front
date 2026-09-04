# 这个镜像里同时装了两个后台前端：
#
#   /        旧的 Vue 2 + element-ui 后台（30 个页面，仍然是主入口）
#   /next/   新的 React 19 + MUI 后台（重写中，见 admin/）
#
# 【为什么不直接把 / 换成新的】
# 旧后台 30 个页面都能用，新的目前只完成 8 个（商品域）。
# 直接切过去会让另外 22 个页面变成占位页 —— 那是功能倒退，不是升级。
# 等页面补齐再把 / 翻过来，那时这个文件只需要交换两行 COPY。
#
# 【为什么新应用能直接放在子目录里，不用改一行代码】
# - admin/vite.config.ts 里 base 是 './'（相对），资源引用不写死绝对路径
# - 路由用的是 hash 路由（#/product-brand），子目录不影响
# - index.html 用 './config/index.js' 加载运行时配置，会解析到 /next/config/index.js
# - 那份配置里 baseUrl 是 '/api'（绝对），而 /api/ 由下面的 nginx 直接代到网关
# 这四条任意一条不成立都会需要额外改动，所以放在这里记一下。

# ---------------------------------------------------------------------------
# 旧 Vue 后台
# ---------------------------------------------------------------------------
# package.json 声明 node >= 8.11.1（Vue2.5.16+Webpack3.6+Babel6 那套 2017 年的老工具链），
# 但实测用 node:8 构建会失败：package.json 里的 sass（Dart Sass ^1.32.0，不是老式的
# node-sass）编译产物用了 globalThis，这是 Node 12+ 才有的东西，Node 8 里
# "ReferenceError: globalThis is not defined"。反而是新版 Node 没问题——本地用 Node 18
# 跑 npm run build 完全正常，所以构建阶段用 node:18，不用 package.json 声明的最低版本。
FROM node:18-alpine AS build-legacy
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
# admin/ 有自己的构建，不该被这一阶段的 webpack 扫到，也没必要拷进来。
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# 新 React 后台
# ---------------------------------------------------------------------------
# admin/package.json 的 engines 要求 node >= 22.22.0（Vite 8 + TypeScript 7 那套）。
# 这里必须是独立的一个阶段：两个应用的依赖树完全不兼容，
# 放在同一个 node_modules 里装会互相打架。
FROM node:22-alpine AS build-next
WORKDIR /app
COPY admin/package.json admin/package-lock.json ./
# 用 npm ci 而不是 npm install：锁文件在，ci 才是可复现的那个。
# 已在本地用 `npm ci --dry-run` 确认锁文件和 package.json 同步 ——
# 不同步时 npm ci 会直接失败，而 npm install 会默默改掉锁文件。
RUN npm ci
COPY admin/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# 运行时
# ---------------------------------------------------------------------------
FROM nginx:1.25-alpine
COPY --from=build-legacy /app/dist/ /usr/share/nginx/html/
# 注意顺序：新应用要在旧应用【之后】拷，否则会被上面那一行连目录一起覆盖掉。
COPY --from=build-next /app/dist/ /usr/share/nginx/html/next/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
