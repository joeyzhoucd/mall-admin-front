import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import {
  List, ListItemButton, ListItemText, ListItemIcon, Collapse, Box, Typography,
} from '@mui/material'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import { useAuth } from '@/auth/AuthProvider'
import { menuUrlToPath } from '@/routing/buildRoutes'
import type { MenuNode } from '@/types/menu'

/**
 * 侧边栏菜单，直接渲染后端返回的菜单树。
 *
 * 【图标为什么不照搬】
 * 数据库 sys_menu 的 icon 列存的是 Element UI 的图标 class 名（如 `el-icon-s-shop`），
 * 在 MUI 下没有对应物。把几十个名字一一映射到 MUI 图标是纯粹的机械劳动，
 * 而且映射错了没人发现（图标不对不影响功能）。
 * 所以这里只按「目录 / 页面」用两个图标区分层级 —— 信息量和原来基本相同。
 * 真要还原逐个图标，那是单独一件事，不该混在重写里。
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { menuList } = useAuth()
  return (
    <Box sx={{ overflowY: 'auto', height: '100%' }}>
      <Typography variant="caption" sx={{ px: 2, py: 1.5, display: 'block', color: 'grey.400' }}>
        菜单
      </Typography>
      <List dense disablePadding>
        {(menuList ?? []).map((node) => (
          <MenuItem key={node.menuId} node={node} depth={0} onNavigate={onNavigate} />
        ))}
      </List>
    </Box>
  )
}

function MenuItem({
  node, depth, onNavigate,
}: { node: MenuNode; depth: number; onNavigate?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const children = node.list ?? []
  const isDirectory = children.length > 0
  const url = node.url?.trim()

  if (isDirectory) {
    return (
      <>
        <ListItemButton onClick={() => setOpen((v) => !v)} sx={{ pl: 2 + depth * 2 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FolderOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={node.name} />
          {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </ListItemButton>
        <Collapse in={open} unmountOnExit>
          <List dense disablePadding>
            {children.map((c) => (
              <MenuItem key={c.menuId} node={c} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </List>
        </Collapse>
      </>
    )
  }

  // 既不是目录、也没有 url —— 通常是 type=2 的「按钮」权限项，不该出现在菜单里。
  // 静默跳过：它不是错误，只是这张表把按钮权限也挂在菜单树上。
  if (!url) return null

  const path = menuUrlToPath(url)
  const selected = location.pathname === `/${path}`

  return (
    <ListItemButton
      selected={selected}
      onClick={() => {
        navigate(`/${path}`)
        onNavigate?.()
      }}
      sx={{ pl: 2 + depth * 2 }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <DescriptionOutlined fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={node.name} />
    </ListItemButton>
  )
}
