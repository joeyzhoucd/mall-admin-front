import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import {
  AppBar, Toolbar, Typography, Box, Drawer, IconButton, Button, Tabs, Tab,
  Menu, MenuItem, Divider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import AccountCircle from '@mui/icons-material/AccountCircle'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/auth/AuthProvider'
import { STATIC_CHILD_ROUTES } from '@/routing/staticRoutes'

const DRAWER_WIDTH = 220

interface OpenTab {
  /** 路由路径，不带前导斜杠，例如 `product-brand`。 */
  path: string
  title: string
}

/**
 * 已登录后的布局外壳：侧边栏 + 顶栏 + 标签页 + 内容区。
 *
 * <h3>标签页为什么自己实现</h3>
 * 旧应用有这个能力（mainTabs，4 个组件协同），后台用户依赖它在多个页面间来回切
 * 而不丢表单状态。MUI 没有现成的「路由标签页」组件，所以自己做一层薄的：
 * 标签集合由<b>访问过的路由</b>推出来，当前标签跟着 location 走。
 *
 * 【和旧版一个刻意的差别】旧版把标签状态存进 vuex 并持久化，刷新后标签还在。
 * 这里不持久化 —— 刷新后只保留当前页。理由：持久化的标签集合会和菜单权限漂移
 * （权限被收走之后，标签还在、点了 404），而这个问题旧版就有。
 * 要做持久化的话得在恢复时按当前菜单过滤一遍，那是额外的复杂度，
 * 收益只有「刷新后标签不丢」。
 */
export function Shell() {
  const { logout, dynamicRoutes } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [userMenu, setUserMenu] = useState<HTMLElement | null>(null)

  const current = location.pathname.replace(/^\//, '')

  // 访问一个页面就把它加进标签集合。首页不进标签（它是外壳的一部分，不是"一个页面"）。
  useEffect(() => {
    if (!current || current === 'home') return
    const title = resolveTitle(current, dynamicRoutes)
    if (!title) return
    setTabs((prev) =>
      prev.some((t) => t.path === current) ? prev : [...prev, { path: current, title }]
    )
  }, [current, dynamicRoutes])

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path)
        const next = prev.filter((t) => t.path !== path)
        // 关掉的是当前标签时，跳到它左边那个；没有左边就回首页。
        // 不这么做会留在一个已经没有标签的路由上，界面看起来像卡住了。
        if (path === current) {
          const fallback = next[Math.max(0, idx - 1)]
          navigate(fallback ? `/${fallback.path}` : '/home')
        }
        return next
      })
    },
    [current, navigate]
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <IconButton
            color="inherit" edge="start" onClick={() => setDrawerOpen((v) => !v)}
            sx={{ mr: 1, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/home')}>
            mall 后台管理
          </Typography>
          <IconButton color="inherit" onClick={(e) => setUserMenu(e.currentTarget)}>
            <AccountCircle />
          </IconButton>
          <Menu anchorEl={userMenu} open={!!userMenu} onClose={() => setUserMenu(null)}>
            <MenuItem disabled sx={{ opacity: 1 }}>
              <Typography variant="caption" color="text.secondary">
                令牌有效期 12 小时，登出不会让它立即失效（服务端无黑名单）
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setUserMenu(null); logout() }}>登出</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* 宽屏常驻，窄屏抽屉 */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH, flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH, boxSizing: 'border-box',
            bgcolor: 'grey.900', color: 'grey.100',
          },
        }}
      >
        <Toolbar variant="dense" />
        <Sidebar />
      </Drawer>
      <Drawer
        variant="temporary" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'grey.900', color: 'grey.100' },
        }}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar variant="dense" />
        {tabs.length > 0 && (
          <Tabs
            value={tabs.some((t) => t.path === current) ? current : false}
            variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}
          >
            {tabs.map((t) => (
              <Tab
                key={t.path} value={t.path} sx={{ minHeight: 36, py: 0 }}
                onClick={() => navigate(`/${t.path}`)}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {t.title}
                    <CloseIcon
                      fontSize="inherit"
                      onClick={(e) => { e.stopPropagation(); closeTab(t.path) }}
                      sx={{ fontSize: 14, '&:hover': { color: 'error.main' } }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        )}
        {tabs.length > 1 && (
          <Box sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
            <Button size="small" onClick={() => { setTabs([]); navigate('/home') }}>
              关闭全部标签
            </Button>
          </Box>
        )}
        <Outlet />
      </Box>
    </Box>
  )
}

/**
 * 由当前路径求标签标题。
 *
 * 三种来源都要覆盖，少一种就表现为「打开了页面但没有标签」：
 * 1. 菜单驱动的页面 —— 路径和 DynamicRoute.path 精确相等
 * 2. 静态子页面（如「发布商品」）—— 和 StaticChildRoute.path 精确相等
 * 3. 带参数的静态子页面（如 `product-spu-spec/:id`）——
 *    实际路径是 `product-spu-spec/123`，和模式字符串不相等，
 *    所以要拿 `:` 之前的那段做前缀匹配。
 *    不处理第 3 种的话，SPU 规格页会打开但顶部没有标签，用户没法切回去。
 *
 * 返回 undefined 表示「这个路径不是一个已知页面」（比如 404），此时不建标签。
 */
function resolveTitle(current: string, dynamicRoutes: { path: string; title: string }[]): string | undefined {
  const dyn = dynamicRoutes.find((r) => r.path === current)
  if (dyn) return dyn.title

  const exact = STATIC_CHILD_ROUTES.find((r) => r.path === current)
  if (exact) return exact.title

  const withParam = STATIC_CHILD_ROUTES.find((r) => {
    const i = r.path.indexOf('/:')
    if (i < 0) return false
    return current.startsWith(r.path.slice(0, i) + '/')
  })
  return withParam?.title
}
