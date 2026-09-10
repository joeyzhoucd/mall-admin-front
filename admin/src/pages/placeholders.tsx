import { Alert, AlertTitle, Box, Link, Typography } from '@mui/material'

/**
 * 首页。
 *
 * <h3>这里原来是重写期间的进度看板，2026-09-10 拆掉了</h3>
 * 它把 <code>src/pages/modules/</code> 下的文件名铺成一排 Chip，用来回答
 * "还剩几页没做"。重写做完之后（菜单 25 页 / 实现 27 个文件）这个问题不存在了，
 * 剩下的只是<b>给开发者看的调试信息占着用户的落地页</b>。
 *
 * <h3>为什么不换成一个数据仪表盘</h3>
 * 想过。做一个"今日订单 / 会员数 / 待处理死信"的概览确实比空页面好看，
 * 但它需要一批聚合接口，而 <b>2026-09-10 刚查出 11 个接口的响应键和前端假设不一致</b>
 * （renren 生成器用实体名做键、手写的用 <code>data</code>，前端一律按 <code>data</code> 取）。
 * 在那种情况下拼一个仪表盘，最可能的结果是几个静默显示 0 或 undefined 的数字 ——
 * <b>而一个显示错数字的仪表盘比没有仪表盘糟得多</b>：它看起来在工作。
 *
 * 真要做，前提是每个数据源都单独验证过。那是一件独立的事。
 */
export function Home() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>mall 后台管理</Typography>
      <Alert severity="info" sx={{ maxWidth: 720 }}>
        <AlertTitle>从左侧菜单进入各功能</AlertTitle>
        菜单由后端的 <code>sys_menu</code> 表驱动 —— 页面能不能打开、挂在什么路径上，
        完全取决于那张表。新增页面除了写组件，还要在菜单里加一行，
        否则表现就是"功能不存在"。
        <br />
        <br />
        前台商城：
        <Link href="http://mall.com" target="_blank" rel="noreferrer">mall.com</Link>
        {' · '}
        <Link href="http://seckill.mall.com/promotion.html" target="_blank" rel="noreferrer">
          促销领券
        </Link>
      </Alert>
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
