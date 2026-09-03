/**
 * 不由菜单驱动的子页面路由。
 *
 * <h3>为什么需要这一层，以及它和旧应用那批硬编码路由的区别</h3>
 * 绝大多数页面由 {@code sys_menu} 驱动（见 buildRoutes）。但有几个页面
 * <b>本来就不该出现在菜单里</b>：它们是从父页面点进去的，比如
 * 「商品管理 → 发布商品」、「商品管理 → 某个 SPU 的规格」。
 * 给它们配菜单项等于让运营在侧边栏里看到一个「发布商品」——
 * 而点它是没有上下文的（不知道要发布哪个商品的哪个分类）。
 * <p>
 * 旧应用的 router/index.js 里也有一批硬编码路由，注释写着
 * 「手动注册的业务路由（避免依赖后台菜单也能直达）」。
 * <b>那是另一回事</b>：它把「商品管理」「库存系统」这些<b>本该在菜单里</b>的页面
 * 也硬编码进去了，因为菜单表当时是不全的。结果是「哪些页面存在」有两个来源，
 * 而其中一个是错的 —— 后台里点不到「上架商品」正是这么来的。
 * <p>
 * 那个问题在 2026-09-03 用一次菜单迁移修掉了
 * （mall-deploy/data-seed/migration-2026-09-03-admin-menu.sql，
 * 补了商品管理/秒杀活动/库存系统四页，并删掉指向已删除 renren-fast 的死链）。
 * 所以这个文件里<b>只放真正的子页面</b>，不当作「菜单不全」的补丁用。
 * 往这里加东西之前先问一句：它是不是该出现在侧边栏里？是的话改菜单表。
 */
export interface StaticChildRoute {
  /** 路由路径（不带前导斜杠）。带参数的写成 React Router 的形式，如 `:id`。 */
  path: string
  /** 组件在 pageRegistry 里的键，即菜单 url 那套形式（`product/spu-add`）。 */
  menuUrl: string
  /** 标签页上显示的标题。沿用旧 router/index.js 里 meta.title 的原始叫法。 */
  title: string
}

export const STATIC_CHILD_ROUTES: StaticChildRoute[] = [
  // 从「商品管理」页点「新增」进入的发布流程。
  { path: 'product-spu-add', menuUrl: 'product/spu-add', title: '发布商品' },
  // 某个 SPU 的规格维护。带 id 参数 —— 这也是它不能是菜单项的原因之一：
  // 菜单里没有地方放这个 id。
  { path: 'product-spu-spec/:id', menuUrl: 'product/spu-spec', title: 'SPU规格' },
]
