import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Typography, IconButton, Tooltip, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
} from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchSysRoles, fetchSysRole, createSysRole, updateSysRole, deleteSysRoles,
  fetchSysMenus, MENU_TYPE_TEXT, type SysRole, type SysMenu,
} from '@/api/sys'
import type { Id } from '@/api/types'

/**
 * 角色管理。
 *
 * 接口对照 BASELINE.md（role.vue + role-add-or-update.vue，5 个）：
 * <pre>
 *   /sys/role/list      列表（筛选参数是 <b>roleName</b>）
 *   /sys/role/info/{}   编辑时取详情（menuIdList 只有它才有）
 *   /sys/role/{}        新增/修改
 *   /sys/role/delete    批量删除
 *   /sys/menu/list      权限树
 * </pre>
 *
 * <h3>权限勾选是「所见即所得」，不做父子联动</h3>
 * 勾了父节点不会自动勾上子节点。看起来不够聪明，但联动会带来一个更坏的问题：
 * 后端保存的是<b>勾选到的那一份 id 列表</b>，联动出来的勾选会把
 * 管理员并没有想授予的权限一起存进去，而界面上看不出哪些是自己点的、
 * 哪些是被联动带上的。权限这种东西，宁可多点几下。
 */
export default function SysRolePage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<Id | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<SysRole | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['sys-roles', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchSysRoles({ page, limit: pageSize, roleName: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['sys-roles'] })
    void qc.invalidateQueries({ queryKey: ['sys-roles-select'] })
    setToast({ msg, severity: 'success' })
  }

  const deleteMutation = useMutation({
    mutationFn: (r: SysRole) => deleteSysRoles([r.roleId]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<SysRole>[]>(() => [
    { accessorKey: 'roleId', header: 'ID', meta: { width: 70 } },
    { accessorKey: 'roleName', header: '角色名', meta: { width: 180 } },
    {
      accessorKey: 'remark',
      header: '备注',
      cell: ({ row }) =>
        row.original.remark ?? <Typography variant="caption" color="text.secondary">未填写</Typography>,
    },
    {
      accessorKey: 'createTime',
      header: '创建时间',
      meta: { width: 150 },
      cell: ({ row }) => <Typography variant="caption">{row.original.createTime ?? '-'}</Typography>,
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="修改">
            <IconButton size="small" onClick={() => setEditingId(row.original.roleId)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => setConfirmDelete(row.original)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<SysRole>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(r) => r.roleId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的角色` : '还没有角色'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按角色名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 200 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditingId(null)}>新增</Button>
          </Stack>
        }
      />

      {editingId !== undefined && (
        <RoleForm
          roleId={editingId}
          onCancel={() => setEditingId(undefined)}
          onDone={(msg) => { setEditingId(undefined); afterWrite(msg) }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除角色</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            确定删除「{confirmDelete?.roleName}」吗？
          </Typography>
          <Alert severity="warning" variant="outlined">
            拥有这个角色的用户会<b>立即失去它带来的所有权限</b>。
            如果那是他们唯一的角色，他们登录后将看不到任何菜单。
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

/** 把扁平菜单按 parentId 拼成树。后端 /sys/menu/list 返回的是扁平列表。 */
function buildTree(flat: SysMenu[]): (SysMenu & { children: SysMenu[] })[] {
  const byId = new Map<string, SysMenu & { children: SysMenu[] }>()
  for (const m of flat) byId.set(String(m.menuId), { ...m, children: [] })
  const roots: (SysMenu & { children: SysMenu[] })[] = []
  for (const node of byId.values()) {
    const parent = byId.get(String(node.parentId))
    // parentId 指向一个不存在的菜单时当根处理 —— 否则那个节点会整个消失，
    // 表现是「权限树里少了几项」而没有任何提示。
    if (parent && String(node.parentId) !== String(node.menuId)) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (ns: (SysMenu & { children: SysMenu[] })[]) => {
    ns.sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
    ns.forEach((n) => sort(n.children as (SysMenu & { children: SysMenu[] })[]))
  }
  sort(roots)
  return roots
}

function RoleForm({
  roleId, onCancel, onDone, onError,
}: {
  roleId: Id | null
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (e: unknown) => void
}) {
  const isEdit = roleId !== null

  const detailQuery = useQuery({
    queryKey: ['sys-role', roleId],
    queryFn: ({ signal }) => fetchSysRole(roleId!, signal),
    enabled: isEdit,
  })

  const menuQuery = useQuery({
    queryKey: ['sys-menus-flat'],
    queryFn: ({ signal }) => fetchSysMenus(signal),
    staleTime: 5 * 60 * 1000,
  })

  const [form, setForm] = useState({ roleName: '', remark: '' })
  const [menuIds, setMenuIds] = useState<Set<string>>(new Set())
  const [loadedFor, setLoadedFor] = useState<Id | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])

  if (isEdit && detailQuery.data && loadedFor !== roleId) {
    const d = detailQuery.data
    setForm({ roleName: d.roleName, remark: d.remark ?? '' })
    setMenuIds(new Set((d.menuIdList ?? []).map(String)))
    setLoadedFor(roleId)
  }

  const tree = useMemo(() => buildTree(menuQuery.data ?? []), [menuQuery.data])

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateSysRole({ roleId: roleId!, roleName: form.roleName, remark: form.remark, menuIdList: [...menuIds] })
        : createSysRole({ roleName: form.roleName, remark: form.remark, menuIdList: [...menuIds] }),
    onSuccess: () => onDone('保存成功'),
    onError,
  })

  const toggle = (id: string) =>
    setMenuIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderNodes = (nodes: (SysMenu & { children: SysMenu[] })[]) =>
    nodes.map((n) => {
      const id = String(n.menuId)
      return (
        <TreeItem
          key={id}
          itemId={id}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
              <input
                type="checkbox"
                checked={menuIds.has(id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle(id)}
              />
              <Typography variant="body2">{n.name}</Typography>
              <Chip
                size="small" variant="outlined"
                label={MENU_TYPE_TEXT[n.type] ?? n.type}
                sx={{ height: 17, fontSize: 10 }}
              />
              {n.perms && (
                <Typography variant="caption" color="text.secondary">{n.perms}</Typography>
              )}
            </Box>
          }
        >
          {n.children.length > 0 && renderNodes(n.children as (SysMenu & { children: SysMenu[] })[])}
        </TreeItem>
      )
    })

  const nameBad = form.roleName.trim() === ''
  const loading = (isEdit && detailQuery.isLoading) || menuQuery.isLoading

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{isEdit ? '修改角色' : '新增角色'}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : detailQuery.error || menuQuery.error ? (
          <Alert severity="error">
            {(detailQuery.error ?? menuQuery.error) instanceof Error
              ? (detailQuery.error ?? menuQuery.error as Error).message
              : '加载失败'}
            {detailQuery.error && ' —— 现在保存会把该角色的权限清空，所以先别保存。'}
          </Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="角色名" fullWidth autoFocus value={form.roleName}
              error={nameBad} helperText={nameBad ? '请填写角色名' : ' '}
              onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}
            />
            <TextField
              label="备注" fullWidth value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
            />

            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2">授权</Typography>
                <Chip size="small" label={`已选 ${menuIds.size}`} sx={{ height: 18, fontSize: 11 }} />
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" onClick={() => setExpanded(tree.map((n) => String(n.menuId)))}>
                  展开一级
                </Button>
                <Button size="small" onClick={() => setExpanded([])}>收起</Button>
              </Stack>
              <Box sx={{ maxHeight: 320, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <SimpleTreeView
                  expandedItems={expanded}
                  onExpandedItemsChange={(_e, ids) => setExpanded(ids)}
                >
                  {renderNodes(tree)}
                </SimpleTreeView>
              </Box>
              <Typography variant="caption" color="text.secondary">
                勾选是所见即所得：勾父节点<b>不会</b>自动勾上子节点。
                联动会把管理员没打算授予的权限一起存进去，而界面上分不清哪些是自己点的。
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained"
          disabled={loading || !!detailQuery.error || nameBad || mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
