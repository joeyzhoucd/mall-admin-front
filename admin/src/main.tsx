import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { theme } from './theme'
import { App } from './App'

/**
 * 服务端状态统一交给 TanStack Query，所以这个应用【没有全局 store】。
 *
 * 旧应用用 vuex 存了菜单树和标签页状态。菜单树本质是服务端数据（来自
 * /sys/menu/nav），交给 Query 更合适：它自带缓存和失效，不需要手动同步到
 * sessionStorage 再读回来（旧代码就是那么做的，而那份副本会和真实菜单漂移）。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 后台数据不需要窗口聚焦就重新拉 —— 那会在切回浏览器时突然刷新表格，
      // 正在看的行会跳走。
      refetchOnWindowFocus: false,
      // 失败重试 1 次。默认 3 次会让「接口 404」这类确定性错误等很久才报出来。
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
