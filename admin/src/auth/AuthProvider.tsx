import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNav, login as loginApi } from '@/api/sys'
import type { LoginRequest } from '@/api/sys'
import { setUnauthorizedHandler } from '@/api/client'
import { getToken, setToken, clearToken } from './token'
import { buildRoutes } from '@/routing/buildRoutes'
import type { DynamicRoute } from '@/routing/buildRoutes'
import type { MenuNode } from '@/types/menu'

interface AuthState {
  /** 有令牌就算「已登录」。令牌是否真的有效由第一次请求的 401 来判定。 */
  isAuthenticated: boolean
  /** 菜单树。undefined 表示还没拉到。 */
  menuList: MenuNode[] | undefined
  /** 从菜单树推出的动态路由。 */
  dynamicRoutes: DynamicRoute[]
  /** 权限串。isAuth 就是在这里面查。 */
  permissions: string[]
  /** 菜单/权限是否正在加载。 */
  isLoading: boolean
  /** 拉菜单失败时的错误。 */
  error: unknown
  login: (req: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * 登录态、菜单、权限的唯一来源。
 *
 * <h3>为什么菜单不进本地存储</h3>
 * 旧应用把 menuList / permissions / dynamicMenuRoutes 三份都抄进了 sessionStorage，
 * 再从那里读回来。那三份副本会和真实菜单漂移 —— 后台改了某个角色的权限，
 * 用户这边要清缓存或重登才生效，而症状是「明明给了权限却看不到菜单」。
 * 这里交给 TanStack Query：它有缓存（不会每次导航都重拉），
 * 但缓存的失效规则是显式的，而且登出时一并清掉。
 *
 * <h3>401 的接线在这里</h3>
 * api/client 不知道路由的存在（那会让它没法单独测试），
 * 所以由这里把「清令牌 + 让界面回到登录态」注册给它。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    // 必须清掉 —— 否则换账号登录后会短暂看到上一个账号的菜单。
    queryClient.clear()
  }, [queryClient])

  // 令牌失效时（网关返回 401）走同一条路径。
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
      queryClient.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  const nav = useQuery({
    queryKey: ['sys', 'nav'],
    queryFn: fetchNav,
    // 没令牌时不要发这个请求 —— 否则登录页一加载就打一次必然 401 的请求，
    // 日志里会出现一条无意义的鉴权失败。
    enabled: token !== null,
    // 菜单和权限在一次会话里基本不变，但不能设成永不过期：
    // 后台改了权限之后，刷新页面应该能生效。
    staleTime: 5 * 60_000,
    retry: false,
  })

  const login = useCallback(
    async (req: LoginRequest) => {
      const t = await loginApi(req)
      setToken(t)
      setTokenState(t)
      // 上一个账号的缓存要清掉，再让菜单按新令牌重拉。
      queryClient.clear()
    },
    [queryClient]
  )

  const value = useMemo<AuthState>(() => {
    const menuList = nav.data?.menuList ?? undefined
    return {
      isAuthenticated: token !== null,
      menuList,
      dynamicRoutes: menuList ? buildRoutes(menuList) : [],
      permissions: nav.data?.permissions ?? [],
      isLoading: token !== null && nav.isLoading,
      error: nav.error,
      login,
      logout,
    }
  }, [token, nav.data, nav.isLoading, nav.error, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}

/**
 * 权限判断，等价于旧应用的 `isAuth(key)`。
 *
 * 旧实现是 `JSON.parse(sessionStorage.getItem('permissions')).indexOf(key) !== -1`，
 * 每次调用都解析一遍 JSON —— 旧代码里有 22 个调用点，很多在渲染函数里。
 * 这里用 Set 做一次性索引。
 */
export function usePermission(): (key: string) => boolean {
  const { permissions } = useAuth()
  const set = useMemo(() => new Set(permissions), [permissions])
  return useCallback((key: string) => set.has(key), [set])
}
