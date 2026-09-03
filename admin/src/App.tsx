import { Box, Typography, Alert, Stack, Chip } from '@mui/material'
import { readSiteConfig } from './site-config'

/**
 * P0 的骨架页：只验证「构建通得过、运行时配置读得到、MUI 主题生效」。
 * P1 会把它换成真正的外壳（登录 / 动态菜单 / 动态路由 / 权限 / 标签页）。
 */
export function App() {
  let baseUrl: string
  let configError: string | null = null
  try {
    baseUrl = readSiteConfig().baseUrl
  } catch (e) {
    baseUrl = '(读不到)'
    configError = e instanceof Error ? e.message : String(e)
  }

  return (
    <Box sx={{ p: 4, maxWidth: 720 }}>
      <Typography variant="h5" gutterBottom>
        mall 后台管理
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        React 重写版 · P0 骨架
      </Typography>

      {configError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {configError}
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mt: 2 }}>
          运行时配置已读到，后端前缀 <code>{baseUrl}</code>
        </Alert>
      )}

      {/* flexWrap 要放进 sx —— MUI 9 的 Stack 不把它作为直接 prop 接受。
          不加 TypeScript 的话这里会静默变成一个不生效的属性。 */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 3, flexWrap: 'wrap' }}>
        <Chip label="Vite 8" size="small" />
        <Chip label="React 19" size="small" />
        <Chip label="TypeScript" size="small" />
        <Chip label="MUI 9" size="small" />
        <Chip label="TanStack Query" size="small" />
        <Chip label="React Router 8" size="small" />
      </Stack>
    </Box>
  )
}
