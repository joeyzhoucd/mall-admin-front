import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Paper, Stack, Button, Typography, Chip, IconButton, Tooltip, Snackbar,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress,
} from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  fetchSysMenus, createSysMenu, updateSysMenu, deleteSysMenu,
  MENU_TYPE_TEXT, type SysMenu,
} from '@/api/sys'
import type { Id } from '@/api/types'

type Node = SysMenu & { children: Node[] }

/**
 * 菜单管理。
 *
 * 接口对照 BASELINE.md（menu.vue + menu-add-or-update.vue，5 个）：
 * <pre>
 *   /sys/menu/list        全部菜单（扁平，<b>没有筛选参数</b>）
 *   /sys/menu/info/{}     详情   ← 有意不用，list 已返回完整实体
 *   /sys/menu/select      可作为父节点的菜单 ← 有意不用，见下
 *   /sys/menu/{}          新增/修改
 *   /sys/menu/delete/{}   <b>单个</b>删除，id 在路径上（其它 sys 接口是请求体传数组）
 * </pre>
 *
 * <h3>select 有意不用</h3>
 * 它返回的是「目录和菜单」的树，用来做父节点下拉。
 * 但 list 已经把全部菜单都拿回来了，在前端过滤掉按钮型即可 ——
 * 再发一次请求拿一份子集，只是多一次往返。
 *
 * <h3>这一页改错会把人锁在外面</h3>
 * 后台的页面集合完全由这张表驱动（前端按菜单树注册路由）。
 * 删掉一个菜单，对应的页面就<b>再也点不到</b>；
 * 改错 url，点进去是 404。所以删除要说清楚后果，
 * 而且带子节点的目录不允许直接删。
 */
export default function SysMenuPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string[]>([])
  const [editing, setEditing] = useState<{ node: SysMenu | null; parent: SysMenu | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Node | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const menuQuery = useQuery({
    queryKey: ['sys-menus-flat'],
    queryFn: ({ signal }) => fetchSysMenus(signal),
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['sys-menus-flat'] })
    // 侧边栏是按 /sys/menu/nav 渲染的，菜单改了它也要跟着变
    void qc.invalidateQueries({ queryKey: ['nav'] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (m: SysMenu) =>
      m.menuId
        ? updateSysMenu(m)
        : createSysMenu({
            parentId: m.parentId, name: m.name, url: m.url, perms: m.perms,
            type: m.type, icon: m.icon, orderNum: m.orderNum,
          }),
    onSuccess: () => { setEditing(null); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (m: Node) => deleteSysMenu(m.menuId),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const tree = useMemo<Node[]>(() => {
    const flat = menuQuery.data ?? []
    const byId = new Map<string, Node>()
    for (const m of flat) byId.set(String(m.menuId), { ...m, children: [] })
    const roots: Node[] = []
    for (const n of byId.values()) {
      const parent = byId.get(String(n.parentId))
      // parentId 指向不存在的菜单时当根处理 —— 否则那个节点整个消失，
      // 表现是「菜单树里少了几项」而没有任何提示。
      if (parent && String(n.parentId) !== String(n.menuId)) parent.children.push(n)
      else roots.push(n)
    }
    const sort = (ns: Node[]) => {
      ns.sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
      ns.forEach((n) => sort(n.children))
    }
    sort(roots)
    return roots
  }, [menuQuery.data])

  const renderNodes = (nodes: Node[], parent: SysMenu | null) =>
    nodes.map((n) => (
      <TreeItem
        key={String(n.menuId)}
        itemId={String(n.menuId)}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
            <Typography variant="body2">{n.name}</Typography>
            <Chip size="small" variant="outlined" label={MENU_TYPE_TEXT[n.type] ?? n.type}
              sx={{ height: 17, fontSize: 10 }} />
            {n.url && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {n.url}
              </Typography>
            )}
            {n.perms && (
              <Chip size="small" label={n.perms} sx={{ height: 17, fontSize: 10 }} />
            )}

            <Box sx={{ flexGrow: 1 }} />
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex' }}>
              {/* 按钮型下面不能再挂东西 */}
              {n.type !== 2 && (
                <Tooltip title="在下面新增">
                  <IconButton size="small" onClick={() => setEditing({ node: null, parent: n })}>
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="修改">
                <IconButton size="small" onClick={() => setEditing({ node: n, parent })}>
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title={n.children.length > 0 ? '先删掉下面的子项' : '删除'}>
                <span>
                  <IconButton size="small" color="error" disabled={n.children.length > 0}
                    onClick={() => setConfirmDelete(n)}>
                    <DeleteIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        }
      >
        {n.children.length > 0 && renderNodes(n.children, n)}
      </TreeItem>
    ))

  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
        后台能打开哪些页面<b>完全由这张表决定</b>（前端按菜单树注册路由）。
        删掉一个菜单，对应的页面就再也点不到；改错 url，点进去是 404。
      </Alert>

      <Paper variant="outlined">
        <Stack direction="row" spacing={1}
          sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}>
          <Button size="small" variant="contained" startIcon={<AddIcon />}
            onClick={() => setEditing({ node: null, parent: null })}>
            新增一级
          </Button>
          <Button size="small" onClick={() => setExpanded(tree.map((n) => String(n.menuId)))}>
            展开一级
          </Button>
          <Button size="small" onClick={() => setExpanded([])}>收起</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary">
            共 {(menuQuery.data ?? []).length} 项
          </Typography>
        </Stack>

        <Box sx={{ p: 1.5, minHeight: 200 }}>
          {menuQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : menuQuery.error ? (
            <Alert severity="error" action={
              <Button color="inherit" size="small" onClick={() => void menuQuery.refetch()}>重试</Button>
            }>
              {menuQuery.error instanceof Error ? menuQuery.error.message : '菜单加载失败'}
            </Alert>
          ) : tree.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              还没有菜单
            </Typography>
          ) : (
            <SimpleTreeView
              expandedItems={expanded}
              onExpandedItemsChange={(_e, ids) => setExpanded(ids)}
            >
              {renderNodes(tree, null)}
            </SimpleTreeView>
          )}
        </Box>
      </Paper>

      {editing && (
        <MenuForm
          node={editing.node}
          parent={editing.parent}
          all={menuQuery.data ?? []}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(m) => saveMutation.mutate(m)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除菜单</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            删除「{confirmDelete?.name}」
            {confirmDelete?.url ? `（${confirmDelete.url}）` : ''}。
          </Typography>
          <Alert severity="warning" variant="outlined">
            {confirmDelete?.type === 2
              ? '这是一个权限点。删掉之后，所有角色对它的授权都会失效，界面上对应的操作会消失。'
              : '删掉之后这个页面就再也点不到了。页面代码还在，只是没有入口 —— 要恢复得把菜单加回来。'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button color="error" disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.severity === 'error' ? null : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function MenuForm({
  node, parent, all, submitting, onCancel, onSubmit,
}: {
  node: SysMenu | null
  parent: SysMenu | null
  all: SysMenu[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (m: SysMenu) => void
}) {
  const isEdit = node !== null
  const [form, setForm] = useState<SysMenu>(
    node
      ? { ...node, url: node.url ?? '', perms: node.perms ?? '', icon: node.icon ?? '' }
      : {
          menuId: '', parentId: parent ? parent.menuId : '0', name: '',
          url: '', perms: '', type: parent ? 1 : 0, icon: '', orderNum: 0,
        }
  )

  /**
   * 父节点候选：只有目录和菜单能当父节点，按钮不能。
   * 编辑时还要排掉自己 —— 把菜单挂到自己下面会做出一个环，
   * 而递归建树的地方会栈溢出。
   *
   * 用 list 在前端过滤，不额外调 /sys/menu/select：
   * 那个接口返回的就是这份子集，再发一次请求只是多一次往返。
   */
  const parentOptions = useMemo(
    () => all.filter((m) => m.type !== 2 && String(m.menuId) !== String(node?.menuId ?? '')),
    [all, node]
  )

  const nameBad = form.name.trim() === ''
  // 菜单型必须有 url，否则点了没反应；按钮型必须有 perms，否则授权没有意义。
  const urlBad = form.type === 1 && (form.url ?? '').trim() === ''
  const permsBad = form.type === 2 && (form.perms ?? '').trim() === ''

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>
        {isEdit ? `修改菜单 · ${node.name}` : parent ? `在「${parent.name}」下新增` : '新增一级菜单'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select label="类型" fullWidth value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value) }))}
            helperText="目录只用来分组；菜单对应一个页面；按钮是权限点，控制某个操作能不能用"
          >
            {Object.entries(MENU_TYPE_TEXT).map(([v, t]) => (
              <MenuItem key={v} value={Number(v)}>{t}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="名称" fullWidth autoFocus value={form.name}
            error={nameBad} helperText={nameBad ? '请填写名称' : ' '}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <TextField
            select label="上级" fullWidth value={String(form.parentId)}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value as Id }))}
          >
            <MenuItem value="0">（一级）</MenuItem>
            {parentOptions.map((m) => (
              <MenuItem key={String(m.menuId)} value={String(m.menuId)}>
                {m.name}（{MENU_TYPE_TEXT[m.type]}）
              </MenuItem>
            ))}
          </TextField>

          {form.type !== 2 && (
            <TextField
              label="路由地址" fullWidth value={form.url ?? ''}
              error={urlBad}
              helperText={
                urlBad ? '菜单必须有路由地址，否则点了没反应'
                  : '如 product/brand —— 前端会把它转成 /product-brand'
              }
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          )}

          {form.type !== 0 && (
            <TextField
              label="权限标识" fullWidth value={form.perms ?? ''}
              error={permsBad}
              helperText={
                permsBad ? '按钮必须有权限标识，否则授权没有意义'
                  : '如 product:brand:save，菜单型可留空'
              }
              onChange={(e) => setForm((f) => ({ ...f, perms: e.target.value }))}
            />
          )}

          <Stack direction="row" spacing={2}>
            <TextField
              label="排序" fullWidth value={form.orderNum ?? 0}
              helperText="数字越小越靠前"
              onChange={(e) => setForm((f) => ({ ...f, orderNum: Number(e.target.value) || 0 }))}
            />
            <TextField
              label="图标" fullWidth value={form.icon ?? ''}
              helperText="可留空"
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            />
          </Stack>

          {form.type === 1 && (
            <Alert severity="info" variant="outlined">
              新增菜单后，前端需要有一个同名的页面文件才能真正打开
              （<code>src/pages/modules/{form.url || '…'}.tsx</code>）。
              没有的话会落到占位页 —— 不会报错，但也什么都没有。
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained"
          disabled={submitting || nameBad || urlBad || permsBad}
          onClick={() => onSubmit(form)}>
          {submitting ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
