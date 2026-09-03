import { Alert, AlertTitle, Box, Chip, Link, Stack, Typography } from '@mui/material'
import { useAuth } from '@/auth/AuthProvider'
import { implementedPages } from '@/routing/pageRegistry'

/** 首页。P1 阶段兼作迁移进度看板 —— 这个数字是文件系统的真实状态，不是手工维护的清单。 */
export function Home() {
  const { dynamicRoutes } = useAuth()
  const done = implementedPages()
  const total = dynamicRoutes.filter((r) => !r.externalUrl).length

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>概览</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>重写进度</AlertTitle>
        菜单里共 <b>{total}</b> 个页面，已实现 <b>{done.length}</b> 个。
        这两个数都是运行时算出来的：页面数来自后端菜单树，
        已实现数来自 <code>src/pages/modules/</code> 下真实存在的文件
        （<code>import.meta.glob</code>），不是手工维护的勾选清单。
      </Alert>
      {done.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {done.map((p) => <Chip key={p} label={p} size="small" />)}
        </Stack>
      )}
    </Box>
  )
}

/**
 * 菜单里有这一项、但页面还没重写。
 *
 * 【为什么要有这个页面，而不是干脆不注册路由】
 * 不注册的话表现是「点菜单没反应」或者落到 404，看起来像坏了。
 * 明确说出「这一页还没迁」，才能把「未完成」和「出故障」区分开 ——
 * 这两件事在界面上很容易长得一样。
 */
export function NotImplemented({ menuUrl, title }: { menuUrl: string; title: string }) {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="warning">
        <AlertTitle>{title} —— 这一页还没重写</AlertTitle>
        菜单地址 <code>{menuUrl}</code>，对应的组件应当在{' '}
        <code>src/pages/modules/{menuUrl}.tsx</code>。
        <br />
        旧版这一页的行为（调了哪些接口、有哪些动作）在仓库根的{' '}
        <code>BASELINE.md</code> 里，重写时对照它逐条验收。
      </Alert>
    </Box>
  )
}

/** 菜单里配了 http(s) 地址的项。旧应用用 iframe 嵌，本次重写不支持。 */
export function ExternalNotSupported({ url, title }: { url: string; title: string }) {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="warning">
        <AlertTitle>{title} —— 外部链接</AlertTitle>
        菜单里配的是外部地址 <code>{url}</code>。旧版会用 iframe 嵌进来，
        本次重写没有实现 iframe 容器（当前菜单里没有这类项；真需要时再加）。
        <br />
        <Link href={url} target="_blank" rel="noreferrer">在新标签页打开</Link>
      </Alert>
    </Box>
  )
}

export function NotFound() {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">
        <AlertTitle>404</AlertTitle>
        这个地址不在菜单里。如果你确信它应该存在，检查后端 <code>/sys/menu/nav</code>{' '}
        返回的菜单树里有没有对应的项 —— 页面是由菜单驱动的，不在菜单里就没有路由。
      </Alert>
    </Box>
  )
}
