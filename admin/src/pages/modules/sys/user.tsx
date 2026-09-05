import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Chip, Typography, IconButton, Tooltip, Snackbar,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Switch,
  FormControlLabel, FormGroup, Checkbox, CircularProgress,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchSysUsers, fetchSysUser, createSysUser, updateSysUser, deleteSysUsers,
  fetchAllSysRoles, type SysUser,
} from '@/api/sys'
import type { Id } from '@/api/types'

/**
 * 后台用户。
 *
 * 接口对照 BASELINE.md（user.vue + user-add-or-update.vue，5 个）：
 * <pre>
 *   /sys/user/list      列表（筛选参数是 <b>username</b>，不是 key）
 *   /sys/user/info/{}   编辑时取详情（要拿 roleIdList，列表里没有）
 *   /sys/user/{}        新增/修改
 *   /sys/user/delete    批量删除
 *   /sys/role/select    角色多选
 * </pre>
 *
 * <h3>这里 info/{} 是必须调的</h3>
 * 和分类、仓库那些页不一样：列表接口<b>不返回 roleIdList</b>，
 * 只有 info/{} 才带。不调它的话，编辑保存会把用户的角色<b>清空</b> ——
 * 因为提交的 roleIdList 是空数组，而后端是覆盖式保存。
 */
export default function SysUserPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<Id | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<SysUser | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['sys-users', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchSysUsers({ page, limit: pageSize, username: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['sys-users'] })
    void qc.invalidateQueries({ queryKey: ['sys-users-all'] })
    setToast({ msg, severity: 'success' })
  }

  const deleteMutation = useMutation({
    mutationFn: (u: SysUser) => deleteSysUsers([u.userId]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<SysUser>[]>(() => [
    { accessorKey: 'userId', header: 'ID', meta: { width: 70 } },
    { accessorKey: 'username', header: '用户名', meta: { width: 140 } },
    {
      accessorKey: 'email',
      header: '邮箱',
      cell: ({ row }) => row.original.email ?? <Typography variant="caption" color="text.secondary">未填写</Typography>,
    },
    {
      accessorKey: 'mobile',
      header: '手机号',
      meta: { width: 130 },
      cell: ({ row }) => row.original.mobile ?? <Typography variant="caption" color="text.secondary">未填写</Typography>,
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 80, align: 'center' },
      cell: ({ row }) =>
        row.original.status === 1
          ? <Chip size="small" color="success" label="正常" sx={{ height: 20 }} />
          : <Chip size="small" color="error" variant="outlined" label="禁用" sx={{ height: 20 }} />,
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
      cell: ({ row }) => {
        // admin 是超级管理员，删掉它就没人能进后台了。
        const isSuper = row.original.userId === '1' || row.original.username === 'admin'
        return (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            <Tooltip title="修改">
              <IconButton size="small" onClick={() => setEditingId(row.original.userId)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isSuper ? '超级管理员不能删除' : '删除'}>
              <span>
                <IconButton size="small" color="error" disabled={isSuper}
                  onClick={() => setConfirmDelete(row.original)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<SysUser>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(u) => u.userId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的用户` : '还没有用户'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按用户名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 200 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            {search && (
              <Chip size="small" label={`已筛选：${search}`}
                onDelete={() => { setKeyword(''); setSearch(''); setPage(1) }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditingId(null)}>新增</Button>
          </Stack>
        }
      />

      {editingId !== undefined && (
        <UserForm
          userId={editingId}
          onCancel={() => setEditingId(undefined)}
          onDone={(msg) => { setEditingId(undefined); afterWrite(msg) }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除用户</DialogTitle>
        <DialogContent>
          确定删除「{confirmDelete?.username}」吗？该用户将无法再登录后台。
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

function UserForm({
  userId, onCancel, onDone, onError,
}: {
  /** null 表示新增。 */
  userId: Id | null
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (e: unknown) => void
}) {
  const isEdit = userId !== null

  // 编辑时必须拉详情 —— 列表接口不返回 roleIdList，
  // 不拉的话保存会把角色清空（后端是覆盖式保存）。
  const detailQuery = useQuery({
    queryKey: ['sys-user', userId],
    queryFn: ({ signal }) => fetchSysUser(userId!, signal),
    enabled: isEdit,
  })

  const rolesQuery = useQuery({
    queryKey: ['sys-roles-select'],
    queryFn: ({ signal }) => fetchAllSysRoles(signal),
    staleTime: 5 * 60 * 1000,
  })

  const [form, setForm] = useState({
    username: '', password: '', email: '', mobile: '', status: 1,
  })
  const [roleIds, setRoleIds] = useState<Set<Id>>(new Set())
  const [loadedFor, setLoadedFor] = useState<Id | null>(null)

  // 详情到达时填一次表单。用 loadedFor 记住填的是哪个用户，
  // 避免每次 render 都覆盖掉用户正在输入的内容。
  if (isEdit && detailQuery.data && loadedFor !== userId) {
    const d = detailQuery.data
    setForm({
      username: d.username,
      password: '',
      email: d.email ?? '',
      mobile: d.mobile ?? '',
      status: d.status,
    })
    setRoleIds(new Set((d.roleIdList ?? []).map(String)))
    setLoadedFor(userId)
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateSysUser({
            userId: userId!, username: form.username, password: form.password || undefined,
            email: form.email, mobile: form.mobile, status: form.status,
            roleIdList: [...roleIds],
          })
        : createSysUser({
            username: form.username, password: form.password,
            email: form.email, mobile: form.mobile, status: form.status,
            roleIdList: [...roleIds],
          }),
    onSuccess: () => onDone('保存成功'),
    onError,
  })

  const nameBad = form.username.trim() === ''
  const pwdBad = !isEdit && form.password.trim() === ''
  const loading = isEdit && detailQuery.isLoading

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{isEdit ? '修改用户' : '新增用户'}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : detailQuery.error ? (
          <Alert severity="error">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '详情加载失败'}
            —— 现在保存会把该用户的角色清空，所以先别保存。
          </Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="用户名" fullWidth autoFocus value={form.username}
              error={nameBad} helperText={nameBad ? '请填写用户名' : ' '}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
            <TextField
              label={isEdit ? '新密码' : '密码'} type="password" fullWidth value={form.password}
              error={pwdBad}
              helperText={
                pwdBad ? '新增用户必须设置密码'
                  : isEdit ? '留空表示不修改密码' : ' '
              }
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="邮箱" fullWidth value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <TextField
                label="手机号" fullWidth value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </Stack>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>角色</Typography>
              {rolesQuery.isLoading ? (
                <CircularProgress size={18} />
              ) : (rolesQuery.data ?? []).length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  还没有角色 —— 去「角色管理」建一个
                </Typography>
              ) : (
                <FormGroup row>
                  {(rolesQuery.data ?? []).map((r) => (
                    <FormControlLabel
                      key={r.roleId}
                      label={r.roleName}
                      control={
                        <Checkbox
                          size="small"
                          checked={roleIds.has(String(r.roleId))}
                          onChange={() =>
                            setRoleIds((prev) => {
                              const next = new Set(prev)
                              const k = String(r.roleId)
                              if (next.has(k)) next.delete(k)
                              else next.add(k)
                              return next
                            })
                          }
                        />
                      }
                    />
                  ))}
                </FormGroup>
              )}
              {roleIds.size === 0 && (
                <Typography variant="caption" color="warning.main">
                  没有任何角色的用户能登录，但看不到任何菜单
                </Typography>
              )}
            </Box>

            <FormControlLabel
              label={form.status === 1 ? '正常' : '禁用'}
              control={
                <Switch checked={form.status === 1}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 1 : 0 }))} />
              }
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          disabled={loading || !!detailQuery.error || nameBad || pwdBad || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
