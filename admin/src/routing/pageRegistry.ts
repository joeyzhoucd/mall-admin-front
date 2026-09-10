import type { ComponentType } from 'react'

/**
 * 菜单 url → 页面组件 的注册表。
 *
 * 后端菜单里的 url 形如 `product/brand`，对应文件 `src/pages/modules/product/brand.tsx`。
 * 这个映射关系和旧应用完全一致（旧的是 `_import(\`modules/${url}\`)`），
 * 所以<b>数据库里的菜单数据不用改</b> —— 那张表有几十行，改它等于给自己加一次迁移。
 *
 * 【为什么用 import.meta.glob 而不是一张手写的映射表】
 * 手写表会和文件系统漂移：新增一个页面忘了登记，表现是菜单点了没反应，
 * 而不是编译错误。glob 是构建时展开的，文件在就一定在表里。
 * 它也保留了按需加载 —— 每个页面是独立的 chunk，不会因为 glob 就全打进主包。
 */
const modules = import.meta.glob<{ default: ComponentType }>('../pages/modules/**/*.tsx')

/** `../pages/modules/product/brand.tsx` → `product/brand` */
function pathToMenuUrl(filePath: string): string {
  return filePath.replace('../pages/modules/', '').replace(/\.tsx$/, '')
}

const registry = new Map<string, () => Promise<{ default: ComponentType }>>()
for (const [filePath, loader] of Object.entries(modules)) {
  registry.set(pathToMenuUrl(filePath), loader)
}

/** 菜单 url 有没有对应的页面实现。 */
export function hasPage(menuUrl: string): boolean {
  return registry.has(normalize(menuUrl))
}

export function loadPage(
  menuUrl: string
): (() => Promise<{ default: ComponentType }>) | undefined {
  return registry.get(normalize(menuUrl))
}

/** 后端的 url 可能带前导斜杠（旧代码就先 replace 掉了），这里统一处理。 */
function normalize(menuUrl: string): string {
  return menuUrl.replace(/^\//, '')
}

