# package.json 声明 node >= 8.11.1（Vue2.5.16+Webpack3.6+Babel6 那套 2017 年的老工具链），
# 但实测用 node:8 构建会失败：package.json 里的 sass（Dart Sass ^1.32.0，不是老式的
# node-sass）编译产物用了 globalThis，这是 Node 12+ 才有的东西，Node 8 里
# "ReferenceError: globalThis is not defined"。反而是新版 Node 没问题——本地用 Node 18
# 跑 npm run build 完全正常，所以构建阶段用 node:18，不用 package.json 声明的最低版本。
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
