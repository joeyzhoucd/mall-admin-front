import type { MenuNode } from '@/types/menu'

/** 从菜单树推出来的一个可访问页面。 */
export interface DynamicRoute {
  /** 路由路径，形如 `product-brand`（把 url 里的 / 换成 -）。 */
  path: string
  /** 菜单里的原始 url，形如 `product/brand`。用它去 pageRegistry 找组件。 */
  menuUrl: string
  menuId: number
  title: string
  /** 旧应用支持把 http(s) 的 url 用 iframe 嵌进来。见下面的说明。 */
  externalUrl?: string
}

/** 菜单里带这个前缀的 url 走 iframe（旧应用的行为）。 */
function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * 把后端的菜单树摊平成路由列表。
 *
 * <h3>为什么路径要把 `/` 换成 `-`</h3>
 * 和旧应用保持一致：`product/brand` → `product-brand`。
 * 这样所有动态页面都是<b>同一层</b>的兄弟路由，共用一个布局外壳，
 * 不需要按 url 的层级去构造嵌套路由。数据库里的菜单数据因此不用改。
 *
 * <h3>目录 vs 页面的判定，照抄旧逻辑</h3>
 * 有非空 `list` → 目录，递归进去；否则有非空 `url` → 页面。
 * <b>刻意不看 `type` 字段</b>：旧代码也没看它，如果这里改成看 type，
 * 而数据库里某一行的 type 填得不对（那张表是手工维护的），
 * 结果会是「菜单显示但点不开」，而且和旧版行为不一致。
 * 先保持一致，要改也该是单独一件事。
 */
export function buildRoutes(menuList: MenuNode[]): DynamicRoute[] {
  const out: DynamicRoute[] = []
  const seen = new Set<string>()

  const walk = (nodes: MenuNode[]): void => {
    for (const node of nodes) {
      if (node.list && node.list.length > 0) {
        walk(node.list)
        continue
      }
      const raw = node.url?.trim()
      if (!raw) continue

      if (isExternal(raw)) {
        // 旧应用会用 iframe 嵌外部页面。这里保留这条路径而不是静默丢掉：
        // 丢掉的表现是「菜单里有一项，点了什么都不发生」，很难查。
        const path = `i-${node.menuId}`
        if (!seen.has(path)) {
          seen.add(path)
          out.push({ path, menuUrl: raw, menuId: node.menuId, title: node.name, externalUrl: raw })
        }
        continue
      }

      const menuUrl = raw.replace(/^\//, '')
      const path = menuUrl.replace(/\//g, '-')
      if (seen.has(path)) {
        // 同一个 url 在菜单表里出现两次（手工维护的表会有这种情况）。
        // 后一条丢掉但不静默 —— 重复的路由会让 React Router 只认第一条，
        // 表现为「点第二个菜单跳到了第一个页面」。
        console.warn(`[菜单] 重复的页面 url «${menuUrl}»（menuId=${node.menuId}），已忽略后一条`)
        continue
      }
      seen.add(path)
      out.push({ path, menuUrl, menuId: node.menuId, title: node.name })
    }
  }

  walk(menuList)
  return out
}

/** 菜单 url → 路由路径。侧边栏点击时要用，保持和 buildRoutes 同一套规则。 */
export function menuUrlToPath(menuUrl: string): string {
  return menuUrl.replace(/^\//, '').replace(/\//g, '-')
}
