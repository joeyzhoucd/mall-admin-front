import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Chip, Typography, IconButton, Tooltip, Snackbar,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchSysConfigs, createSysConfig, updateSysConfig, deleteSysConfigs,
  type SysConfig,
} from '@/api/sys'

/**
 * 参数配置。
 *
 * 接口对照 BASELINE.md（config.vue + config-add-or-update.vue，4 个）：
 * <pre>
 *   /sys/config/list      列表（筛选参数是 <b>paramKey</b>）
 *   /sys/config/info/{}   详情   ← 有意不用，list 已返回完整实体（5 个字段）
 *   /sys/config/{}        新增/修改
 *   /sys/config/delete    批量删除
 * </pre>
 *
 * <h3>参数值默认打码</h3>
 * 这张表历史上装过对象存储的 accessKey 之类的东西
 * （sys_config 里就有一条 remark 是「云存储配置信息」）。
 * 值直接铺在列表里，等于任何能打开这一页的人、以及任何一次截图或投屏
 * 都能看到它。所以默认隐藏，要看得点一下 —— 这不是防攻击，
 * 是防「无意中把密钥晒出去」。
 */
export default function SysConfigPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<SysConfig | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<SysConfig | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['sys-configs', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchSysConfigs({ page, limit: pageSize, paramKey: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['sys-configs'] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (c: SysConfig) =>
      c.id ? updateSysConfig(c) : createSysConfig({
        paramKey: c.paramKey, paramValue: c.paramValue, status: c.status, remark: c.remark,
      }),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (c: SysConfig) => deleteSysConfigs([c.id]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<SysConfig>[]>(() => [
    { accessorKey: 'id', header: 'ID', meta: { width: 70 } },
    { accessorKey: 'paramKey', header: '参数名', meta: { width: 200 } },
    {
      id: 'paramValue',
      header: '参数值',
      cell: ({ row }) => {
        const key = String(row.original.id)
        const shown = revealed.has(key)
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography
              variant="body2"
              sx={{
                maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: shown ? 'monospace' : undefined,
              }}
            >
              {shown ? row.original.paramValue : '••••••••'}
            </Typography>
            <Button
              size="small"
              onClick={() =>
                setRevealed((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
            >
              {shown ? '隐藏' : '显示'}
            </Button>
          </Stack>
        )
      },
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 80, align: 'center' },
      cell: ({ row }) =>
        row.original.status === 1
          ? <Chip size="small" color="success" label="启用" sx={{ height: 20 }} />
          : <Chip size="small" variant="outlined" label="停用" sx={{ height: 20 }} />,
    },
    {
      accessorKey: 'remark',
      header: '备注',
      meta: { width: 180 },
      cell: ({ row }) =>
        row.original.remark ?? <Typography variant="caption" color="text.secondary">未填写</Typography>,
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="修改">
            <IconButton size="small" onClick={() => setEditing(row.original)}>
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
  ], [revealed])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<SysConfig>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(c) => c.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的参数` : '还没有参数配置'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按参数名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 220 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditing(null)}>新增</Button>
          </Stack>
        }
      />

      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        参数值默认打码。这张表装过对象存储密钥一类的东西，
        值直接铺在列表里意味着任何一次截图或投屏都会把它带出去。
      </Alert>

      {editing !== undefined && (
        <ConfigForm
          config={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(c) => saveMutation.mutate(c)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除参数</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            确定删除「{confirmDelete?.paramKey}」吗？
          </Typography>
          <Alert severity="warning" variant="outlined">
            读这个参数的代码<b>不会因此报错</b>，它只会拿到 null，
            然后按「没配置」的分支走下去。所以删掉一个还在用的参数，
            表现往往是某个功能悄悄不工作了，而不是一个明确的错误。
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

const EMPTY: SysConfig = { id: '', paramKey: '', paramValue: '', status: 1, remark: '' }

function ConfigForm({
  config, submitting, onCancel, onSubmit,
}: {
  config: SysConfig | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (c: SysConfig) => void
}) {
  const [form, setForm] = useState<SysConfig>(
    config ? { ...config, remark: config.remark ?? '' } : EMPTY
  )
  const keyBad = form.paramKey.trim() === ''

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{config ? `修改参数 · ${config.paramKey}` : '新增参数'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="参数名" fullWidth autoFocus value={form.paramKey}
            error={keyBad}
            helperText={keyBad ? '请填写参数名' : '代码里按这个名字读取，改名等于换了一个参数'}
            onChange={(e) => setForm((f) => ({ ...f, paramKey: e.target.value }))}
          />
          <TextField
            label="参数值" fullWidth multiline minRows={2} value={form.paramValue}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            onChange={(e) => setForm((f) => ({ ...f, paramValue: e.target.value }))}
          />
          <TextField
            label="备注" fullWidth value={form.remark ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
          />
          <FormControlLabel
            label={form.status === 1 ? '启用' : '停用'}
            control={
              <Switch checked={form.status === 1}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 1 : 0 }))} />
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={submitting || keyBad} onClick={() => onSubmit(form)}>
          {submitting ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
