import { AuthProvider } from '@/auth/AuthProvider'
import { AppRouter } from '@/routing/AppRouter'

/**
 * AuthProvider 必须包在 AppRouter 外面：路由树是由菜单推出来的，
 * 而菜单在 AuthProvider 里拉 —— 顺序反了就拿不到菜单。
 */
export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
