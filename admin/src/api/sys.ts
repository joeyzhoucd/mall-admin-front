import { request, fetchPage, fetchData } from './client'
import type { Id, PageResult } from './types'
import type { NavResponse } from '@/types/menu'

/**
 * ⚠️ 这一组接口的<b>筛选参数名每个都不一样</b>，传错会被静默忽略、返回全量：
 *
 *     /sys/user/list    → username
 *     /sys/role/list    → roleName
 *     /sys/config/list  → paramKey
 *     /sys/log/list     → key          ← 只有这一个叫 key
 *     /sys/menu/list    → （没有筛选参数，返回全部）
 *
 * 五个接口四种命名。所以每个 fetch 函数的参数类型都写死了对应的那个名字，
 * 而不是共用一个 { key?: string } —— 共用的话，写错了 TypeScript 不会报，
 * 表现是「搜索框能输入、点查询没反应、结果还是全部」。
 * 2026-09-05 逐个读控制器源码确认（mall-admin 有自己的鉴权，探不了接口）。
 */

/**
 * 系统级接口。这是 P2「105 个接口的类型化客户端」的第一批 ——
 * 外壳需要的三个，先在 P1 落地，其余在 P2 按模块补齐。
 */

export interface LoginRequest {
  username: string
  password: string
  /** 客户端生成的验证码会话 id，要和取验证码图片时用的那个一致。 */
  uuid: string
  captcha: string
}

interface LoginResponse {
  code: number
  msg?: string
  token: string
  expire?: number
}

/**
 * 登录。
 *
 * 这个接口在网关上是<b>豁免鉴权</b>的（AdminAuthFilter.EXEMPT_PATHS 里的
 * /api/sys/login）—— 显然必须如此，否则永远拿不到令牌。
 * 同样豁免的还有 /api/captcha.jpg。
 */
export async function login(req: LoginRequest): Promise<string> {
  const res = await request<LoginResponse>('/sys/login', {
    method: 'POST',
    body: req,
  })
  if (!res.token) {
    // code===0 但没有 token —— 后端契约变了。这种情况必须显式失败，
    // 否则会存一个 undefined 令牌，然后每个请求都 401，而排查会指向鉴权。
    throw new Error('登录接口返回 code=0 但没有 token，后端契约可能变了')
  }
  return res.token
}

/**
 * 拉当前用户的菜单树和权限串。
 *
 * 返回的 menuList 是<b>动态路由的唯一来源</b>：哪些页面存在、挂在什么路径上，
 * 全由它决定（见 routing/buildRoutes.ts）。permissions 则是 isAuth 的数据源。
 */
export async function fetchNav(): Promise<{
  menuList: NavResponse['menuList']
  permissions: string[]
}> {
  const res = await request<NavResponse>('/sys/menu/nav')
  return {
    menuList: res.menuList ?? [],
    permissions: res.permissions ?? [],
  }
}

/**
 * 后台用户。
 *
 * <h3>筛选参数叫 username，不是 key</h3>
 * 其它服务的列表接口大多用 key，mall-admin 这边是
 * `@RequestParam("username")`，传 key 会被**静默忽略**、返回全量。
 * 和品牌那个坑同一类，只是这次是参数名不同而不是压根没实现。
 *
 * <h3>口令哈希不会带出来</h3>
 * 后端 SysUserService.page() 里显式把 password 和 salt 置空了
 * （2026-09-05 读过源码确认），所以这里的类型也不声明它们 ——
 * 声明了会诱使别人去用一个永远是 null 的字段。
 */
export interface SysUser {
  userId: Id
  username: string
  email: string | null
  mobile: string | null
  /** 1 正常 / 0 禁用。 */
  status: number
  createTime: string | null
}

export function fetchSysUsers(
  q: { page: number; limit: number; username?: string },
  signal?: AbortSignal
): Promise<PageResult<SysUser>> {
  return fetchPage<SysUser>('/sys/user/list', { ...q }, { signal })
}

export function fetchSysUser(userId: Id, signal?: AbortSignal): Promise<SysUser & { roleIdList: Id[] }> {
  return fetchData<SysUser & { roleIdList: Id[] }>(`/sys/user/info/${userId}`, { signal })
}

/** 新增用户。password 只在新增时传；改密码是另一回事，编辑表单里留空表示不改。 */
export function createSysUser(
  u: { username: string; password: string; email?: string; mobile?: string; status: number; roleIdList: Id[] }
): Promise<unknown> {
  return request('/sys/user/save', {
    method: 'POST',
    body: { ...u, roleIdList: u.roleIdList.map(Number) },
  })
}

export function updateSysUser(
  u: { userId: Id; username: string; password?: string; email?: string; mobile?: string; status: number; roleIdList: Id[] }
): Promise<unknown> {
  const body: Record<string, unknown> = {
    ...u, userId: Number(u.userId), roleIdList: u.roleIdList.map(Number),
  }
  // 【留空表示不改密码】必须把字段整个删掉，不能传空串。
  // 传空串的话后端会把它当成新密码去 encode，结果是把用户的密码改成了空串 ——
  // 而且不报错，要等那个人登不上来才发现。
  if (!u.password) delete body.password
  return request('/sys/user/update', { method: 'POST', body })
}

export function deleteSysUsers(userIds: Id[]): Promise<unknown> {
  return request('/sys/user/delete', { method: 'POST', body: userIds.map(Number) })
}

// ---------------------------------------------------------------------------
// 角色
// ---------------------------------------------------------------------------

export interface SysRole {
  roleId: Id
  roleName: string
  remark: string | null
  createUserId: Id | null
  createTime: string | null
}

/** <b>筛选参数叫 roleName</b>，不是 key、也不是 username。见本文件顶部的说明。 */
export function fetchSysRoles(
  q: { page: number; limit: number; roleName?: string },
  signal?: AbortSignal
): Promise<PageResult<SysRole>> {
  return fetchPage<SysRole>('/sys/role/list', { ...q }, { signal })
}

/** 不分页的全部角色，给用户表单的多选用。 */
export function fetchAllSysRoles(signal?: AbortSignal): Promise<SysRole[]> {
  return fetchData<SysRole[]>('/sys/role/select', { signal })
}

export function fetchSysRole(roleId: Id, signal?: AbortSignal): Promise<SysRole & { menuIdList: Id[] }> {
  return fetchData<SysRole & { menuIdList: Id[] }>(`/sys/role/info/${roleId}`, { signal })
}

export function createSysRole(r: { roleName: string; remark?: string; menuIdList: Id[] }): Promise<unknown> {
  return request('/sys/role/save', { method: 'POST', body: { ...r, menuIdList: r.menuIdList.map(Number) } })
}

export function updateSysRole(
  r: { roleId: Id; roleName: string; remark?: string; menuIdList: Id[] }
): Promise<unknown> {
  return request('/sys/role/update', {
    method: 'POST',
    body: { ...r, roleId: Number(r.roleId), menuIdList: r.menuIdList.map(Number) },
  })
}

export function deleteSysRoles(roleIds: Id[]): Promise<unknown> {
  return request('/sys/role/delete', { method: 'POST', body: roleIds.map(Number) })
}

// ---------------------------------------------------------------------------
// 菜单
// ---------------------------------------------------------------------------

/**
 * 菜单/权限项。
 *
 * type：0 目录 / 1 菜单 / 2 按钮。
 * 按钮型没有 url，只有 perms（权限标识），它决定界面上某个操作能不能点。
 */
export interface SysMenu {
  menuId: Id
  parentId: Id
  name: string
  url: string | null
  perms: string | null
  type: number
  icon: string | null
  orderNum: number | null
  parentName?: string | null
  /** 后端在树形接口里用 list 装子节点，不是 children。 */
  list?: SysMenu[]
}

export const MENU_TYPE_TEXT: Record<number, string> = { 0: '目录', 1: '菜单', 2: '按钮' }

/** <b>没有筛选参数</b>，返回全部菜单（扁平）。 */
export function fetchSysMenus(signal?: AbortSignal): Promise<SysMenu[]> {
  return fetchData<SysMenu[]>('/sys/menu/list', { signal })
}

/** 可作为父节点的菜单（目录和菜单，不含按钮），树形。 */
export function fetchSysMenuSelect(signal?: AbortSignal): Promise<SysMenu[]> {
  return fetchData<SysMenu[]>('/sys/menu/select', { signal })
}

export function fetchSysMenu(menuId: Id, signal?: AbortSignal): Promise<SysMenu> {
  return fetchData<SysMenu>(`/sys/menu/info/${menuId}`, { signal })
}

export function createSysMenu(m: Omit<SysMenu, 'menuId' | 'list'>): Promise<unknown> {
  return request('/sys/menu/save', { method: 'POST', body: { ...m, parentId: Number(m.parentId) } })
}

export function updateSysMenu(m: Omit<SysMenu, 'list'>): Promise<unknown> {
  return request('/sys/menu/update', {
    method: 'POST',
    body: { ...m, menuId: Number(m.menuId), parentId: Number(m.parentId) },
  })
}

/** <b>单个删除，id 在路径上</b> —— 和其它 sys 接口的「请求体传数组」不一样。 */
export function deleteSysMenu(menuId: Id): Promise<unknown> {
  return request(`/sys/menu/delete/${menuId}`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// 参数配置
// ---------------------------------------------------------------------------

export interface SysConfig {
  id: Id
  paramKey: string
  paramValue: string
  status: number
  remark: string | null
}

/** <b>筛选参数叫 paramKey</b>。 */
export function fetchSysConfigs(
  q: { page: number; limit: number; paramKey?: string },
  signal?: AbortSignal
): Promise<PageResult<SysConfig>> {
  return fetchPage<SysConfig>('/sys/config/list', { ...q }, { signal })
}

export function fetchSysConfig(id: Id, signal?: AbortSignal): Promise<SysConfig> {
  return fetchData<SysConfig>(`/sys/config/info/${id}`, { signal })
}

export function createSysConfig(c: Omit<SysConfig, 'id'>): Promise<unknown> {
  return request('/sys/config/save', { method: 'POST', body: c })
}

export function updateSysConfig(c: SysConfig): Promise<unknown> {
  return request('/sys/config/update', { method: 'POST', body: { ...c, id: Number(c.id) } })
}

export function deleteSysConfigs(ids: Id[]): Promise<unknown> {
  return request('/sys/config/delete', { method: 'POST', body: ids.map(Number) })
}

// ---------------------------------------------------------------------------
// 操作日志
// ---------------------------------------------------------------------------

export interface SysLog {
  id: Id
  username: string | null
  operation: string | null
  method: string | null
  /** 调用参数，可能很长。 */
  params: string | null
  /** 耗时，毫秒。 */
  time: number | null
  ip: string | null
  createDate: string | null
}

/** <b>这一个才是叫 key</b>。同一组接口里四个不同的参数名，见本文件顶部说明。 */
export function fetchSysLogs(
  q: { page: number; limit: number; key?: string },
  signal?: AbortSignal
): Promise<PageResult<SysLog>> {
  return fetchPage<SysLog>('/sys/log/list', { ...q }, { signal })
}
