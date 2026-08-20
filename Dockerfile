# mall-admin-front 是 Vue2.5.16 + Webpack3.6 + Babel6 这套 2017 年代的老工具链，
# package.json 声明 node >= 8.11.1；用新版 Node 直接 npm run build 大概率会踩到
# OpenSSL3/webpack3 的已知兼容性问题（"error:0308010C:digital envelope routines"），
# 所以构建阶段特意钉住 node:8，只在这一层用，最终镜像不带它。
FROM node:8-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
