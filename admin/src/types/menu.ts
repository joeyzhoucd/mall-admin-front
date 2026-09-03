/**
 * 后端 /sys/menu/nav 的响应形状。
 *
 * 这些字段名不是猜的，是从旧应用 router/index.js 的
 * fnAddDynamicMenuRoutes 里读出来的 —— 那段代码是唯一的事实来源。
 */
export interface MenuNode {
  menuId: number
  name: string
  /**
   * 页面地址，形如 `product/brand`。
   * - 有值且非空 → 这是一个叶子页面
   * - 以 http(s):// 开头 → 旧应用用 iframe 展示（本次重写不支持，见 buildRoutes）
   */
  url?: string | null
  /** 图标名（renren 用的是 element 的图标 class 名，React 版会做一次映射）。 */
  icon?: string | null
  /** 子菜单。非空则本节点是目录而不是页面。 */
  list?: MenuNode[] | null
  /** 1=菜单 0=目录 2=按钮。旧代码没用它做判断，靠的是 list/url，这里保持一致。 */
  type?: number
}

export interface NavResponse {
  code: number
  msg?: string
  menuList?: MenuNode[]
  /** 权限串数组，isAuth(key) 就是在这里面查。 */
  permissions?: string[]
}
