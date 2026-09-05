import { request, fetchPage } from './client'
import type { Id, PageResult } from './types'
import type { NavResponse } from '@/types/menu'

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
