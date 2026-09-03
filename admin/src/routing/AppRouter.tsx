import { Suspense, lazy, useMemo } from 'react'
import { createHashRouter, RouterProvider, Navigate } from 'react-router'
import type { RouteObject } from 'react-router'
import { Box, CircularProgress, Alert, AlertTitle, Button, Stack } from '@mui/material'
import { useAuth } from '@/auth/AuthProvider'
import { Shell } from '@/shell/Shell'
import { Login } from '@/pages/Login'
import { Home, NotFound, NotImplemented, ExternalNotSupported } from '@/pages/placeholders'
import { loadPage } from './pageRegistry'

/**
 * 路由。<b>页面集合由后端菜单树决定</b>，所以路由树必须在菜单拉到之后才能建。
 *
 * 【为什么用 hash 路由】
 * 和旧应用一致（它是 `mode: 'hash'`）。部署形态是 nginx 托静态文件，
 * 用 history 模式需要 nginx 把所有未命中的路径回退到 index.html ——
 * 那要改 nginx.conf。hash 模式不需要任何服务端配合，
 * 而且 P7 切 Dockerfile 时不会因为漏改 nginx 配置而出现「刷新页面 404」。
 */
export function AppRouter() {
  const { isAuthenticated, isLoading, error, dynamicRoutes, logout } = useAuth()

  const router = useMemo(() => {
    if (!isAuthenticated) {
      return createHashRouter([
        { path: '/login', element: <Login /> },
        { path: '*', element: <Navigate to="/login" replace /> },
      ])
    }

    const children: RouteObject[] = [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <Home /> },
    ]

    for (const route of dynamicRoutes) {
      if (route.externalUrl) {
        children.push({
          path: route.path,
          element: <ExternalNotSupported url={route.externalUrl} title={route.title} />,
        })
        continue
      }
      const loader = loadPage(route.menuUrl)
      if (!loader) {
        // 菜单里有这一项但页面还没重写。明确告知，而不是落到 404 ——
        // 「还没做」和「坏了」在界面上很容易长得一样。
        children.push({
          path: route.path,
          element: <NotImplemented menuUrl={route.menuUrl} title={route.title} />,
        })
        continue
      }
      const Page = lazy(loader)
      children.push({
        path: route.path,
        element: (
          <Suspense fallback={<Centered><CircularProgress size={24} /></Centered>}>
            <Page />
          </Suspense>
        ),
      })
    }

    children.push({ path: '*', element: <NotFound /> })
    return createHashRouter([{ path: '/', element: <Shell />, children }])
  }, [isAuthenticated, dynamicRoutes])

  if (isAuthenticated && isLoading) {
    return <Centered><CircularProgress /></Centered>
  }

  // 拉菜单失败：登录是成功的（有令牌），但没有菜单就没有任何页面。
  // 必须显式说出来 —— 否则表现是「登录后一片空白」，看不出是菜单接口挂了。
  if (isAuthenticated && error) {
    return (
      <Centered>
        <Alert severity="error" sx={{ maxWidth: 560 }}>
          <AlertTitle>菜单加载失败</AlertTitle>
          登录是成功的，但 <code>/sys/menu/nav</code> 没能返回菜单，所以没有任何页面可进。
          <br />
          {error instanceof Error ? error.message : String(error)}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button size="small" variant="outlined" onClick={() => window.location.reload()}>重试</Button>
            <Button size="small" onClick={logout}>退出登录</Button>
          </Stack>
        </Alert>
      </Centered>
    )
  }

  return <RouterProvider router={router} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>{children}</Box>
}
