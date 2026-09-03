# mall 后台管理（React 重写版）

旧的 Vue 2 应用在仓库根目录（`src/`、`build/`、根 `package.json`），
两者**并存**直到迁移完成。这样 CI / 镜像 / ArgoCD 的接线全程不用动，
最后一步只改根目录的 `Dockerfile` 指向这里，再删旧目录。

## 为什么重写而不是把 Vue 2 迁到 Vue 3

先量过：48 个 `.vue`、13030 行、177 处 Vue 3 破坏性写法
（`slot-scope` 63、`slot="x"` 49、`.sync` 34、`.native` 31）、39 种 Element 组件，
工具链是 webpack 3 + Babel 6 + ESLint 3（vue-cli 2 时代）。
迁移约 5–8 天、行为天然保持；重写约 12–17 天、每个边缘情况都要重新发现一遍。
选重写是取「代码完全自己拥有、栈是当前的」，代价是工期翻倍——这是明确的取舍，不是因为迁移做不了。

## 技术栈与选它的理由

| 层 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite 8 | 当前事实标准 |
| 框架 | React 19 + TypeScript 7 | 105 个接口的请求/响应形状必须靠类型对照——重写时最容易错且**不报错**的地方 |
| UI | MUI 9 | 全球用量最大的 React 组件库，非付费层已覆盖后台控件 |
| 表格 | TanStack Table 9 | headless、免费。`category` / `menu` 是树形表格，而 MUI 免费版 DataGrid 的 tree data 是付费功能 |
| 服务端状态 | TanStack Query 5 | 自带缓存/失效/重试，**因此这个应用没有全局 store** |
| 路由 | React Router 8 | 支持按数据库菜单树动态注册路由 |
| 表单 | React Hook Form + Zod | Zod 同时提供运行时校验和类型 |

**刻意没用 Ant Design**：它是蚂蚁/阿里系的，而这个项目的既定约束是"用国际通用方案、不用阿里系"。

## 环境要求

**Node >= 22.22.0**（React Router 8 的下限；Vite 8 要 >= 22.12.0）。
仓库根目录那个旧应用能在 Node 18 上构建，这个不能。
本机用 nvm：`nvm use 22.22.0`。

## 命令

```bash
npm install
npm run dev        # 开发服务器，/api 代理到网关（见 vite.config.ts）
npm run typecheck  # tsc --noEmit
npm run build      # 先 typecheck 再 vite build
```

开发时 `/api` 代理的目标从环境变量 `MALL_GATEWAY` 读，默认是当前
MetalLB 分给 ingress-nginx 的地址。**那个地址会随宿主机重启变化**
（Hyper-V Default Switch 的子网不保证稳定，见 `mall-deploy/SETUP.md`），
变了就设环境变量，不要改代码。

## 部署契约（改动前务必读）

`window.SITE_CONFIG.baseUrl` 由 `public/config/index.js` 提供，**不进 bundle**，
构建后是 `dist/config/index.js`，可以单独替换 ——
所以**一份镜像能指向不同环境的后端**，不需要为每个环境重新构建。

`index.html` 里用 `document.write` 加载它，这一点不能"清理"：
Vite 注入的入口是 `<script type="module">`，module 天然 defer；
`document.write` 写入的经典脚本会阻塞解析并立即执行，顺序才有保证。
改成动态创建 script 或加 defer，会让配置在应用启动时可能还不存在，
表现为间歇性白屏。

## 验收基线

`../BASELINE.md` 是从旧应用源码自动提取的行为清单（由 `../tools/extract-baseline.js` 生成）：
每个页面调了哪些接口、有哪些动作、有哪些对话框，共 **105 个去重接口**。

**每迁完一页，对照那份清单逐条验收。** 界面长得像不代表行为一样，
最容易出的错是「点下去调错了接口或漏了参数」，而且不报错。
这个项目前端没有任何有效的自动化测试（旧应用只有 1 个 jest spec + 废弃的 selenium），
所以这份清单是唯一的验收依据。

提取器的接口数和 `mall-deploy/tools/audit-endpoints.js`（独立实现）**都是 105**，
两个独立实现收敛到同一个数，基线才算可信。

## 写页面时会反复遇到的坑（P0/P1 已经踩过的）

- **MUI 9 的 `Stack` 不再接受系统属性作为直接 prop**（`alignItems`、`flexWrap`、
  `justifyContent`…），必须放进 `sx`。v5–v7 是接受的，所以照网上的旧例子抄会中招。
  没有 TypeScript 的话它会**静默变成一个不生效的属性** —— 这正是这个项目选 TS 的理由。
  `Box` 不受影响（系统属性本来就是它的用途）。
- **TypeScript 7 移除了 `baseUrl`**（TS5102），`paths` 必须写相对路径（TS5090）。
  TS 7 是 Go 重写的原生编译器，不是 5.x 的小版本升级。
- **`@types/node` 的版本号和 Node 运行时版本不是一回事**：Node 22.22 对应的
  `@types/node` 是 22.20.x，写 `^22.22.0` 会 ETARGET。
- **滚更中途新旧 pod 并存**，所以「同一个请求两种响应」通常不是代码 bug。
  判据是 `total == updated == ready == spec.replicas`；只看 `readyReplicas` 会
  在旧 pod 还在服务时就判为完成（P1 验证鉴权时就撞上了这个，误以为过滤器有 bug）。

## 阶段

- [x] **P0** 骨架：构建通、运行时配置读得到、MUI 主题生效
- [x] **P1** 外壳：登录页 + JWT 存取 + 401 两条路径、菜单从 `/sys/menu/nav` 拉、
      按菜单树动态注册路由（`import.meta.glob` 建注册表）、`usePermission`（等价旧的 `isAuth`）、
      侧边栏、标签页导航。
      **未实现的页面会落到一个明确的「还没重写」占位页**，而不是 404 ——
      「未完成」和「出故障」在界面上很容易长得一样。首页兼作迁移进度看板，
      已实现页数来自文件系统真实状态而不是手工清单。
- [ ] **P2** API 层：105 个接口的类型化客户端 + TanStack Query 封装。**必须在 P3 之前**，否则每个页面各写一遍请求
- [ ] **P3** 商品域 10 页 + 秒杀活动页（后端 `/coupon/seckill/scheduler/save` 已就绪，缺界面）
- [ ] **P4** 库存/采购 4 页
- [ ] **P5** 系统管理 9 页
- [ ] **P6** oss 3 + job 3 + member 1
- [ ] **P7** 切 Dockerfile（node:18 → node:22）、归档旧应用、CI 加前端构建校验
