import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, IconButton, Tooltip, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchWareInfos, saveWareInfo, updateWareInfo, deleteWareInfos, type WareInfo,
} from '@/api/ware'

/**
 * 仓库维护。
 *
 * 接口对照 BASELINE.md 的 ware-info.vue（4 个）：
 * <pre>
 *   /ware/wareinfo/list        列表
 *   /ware/wareinfo/{}          新增/修改（旧代码写成 ${!id ? 'save' : 'update'}）
 *   /ware/wareinfo/delete      批量删除
 *   /ware/wareinfo/info/{}     详情
 * </pre>
 * <b>info/{} 有意不用</b>：list 返回的就是完整实体（只有 4 个字段），
 * 点编辑再拉一次是白跑一趟往返。和分类页同样的取舍。
 */
export default function WareInfoPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WareInfo | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<WareInfo | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['ware-infos', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchWareInfos({ page, limit: pageSize, key: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['ware-infos'] })
    // 仓库下拉在库存页和采购页都用到，一并失效
    void qc.invalidateQueries({ queryKey: ['ware-infos-all'] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (w: WareInfo) =>
      w.id ? updateWareInfo(w) : saveWareInfo({ name: w.name, address: w.address, areacode: w.areacode }),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (w: WareInfo) => deleteWareInfos([w.id]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<WareInfo>[]>(() => [
    { accessorKey: 'id', header: 'ID', meta: { width: 80 } },
    { accessorKey: 'name', header: '仓库名', meta: { width: 160 } },
    { accessorKey: 'address', header: '地址' },
    { accessorKey: 'areacode', header: '区域编码', meta: { width: 110 } },
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
  ], [])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<WareInfo>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(w) => w.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的仓库` : '还没有仓库'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按 ID / 名称 / 地址搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 240 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            <Button size="small" onClick={() => { setKeyword(''); setSearch(''); setPage(1) }}>
              重置
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditing(null)}>新增</Button>
          </Stack>
        }
      />

      {editing !== undefined && (
        <WareInfoForm
          ware={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(w) => saveMutation.mutate(w)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除仓库</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            确定删除「{confirmDelete?.name}」吗？
          </Typography>
          <Alert severity="warning" variant="outlined">
            这个仓库下的商品库存记录<b>不会</b>被一并删除，它们会变成挂在一个
            不存在的仓库上的孤儿数据 —— 库存页里仍然能看到，但「属于哪个仓库」查不出来。
            先确认这个仓库下没有库存再删。
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

const EMPTY: WareInfo = { id: '', name: '', address: '', areacode: '' }

function WareInfoForm({
  ware, submitting, onCancel, onSubmit,
}: {
  ware: WareInfo | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (w: WareInfo) => void
}) {
  const [form, setForm] = useState<WareInfo>(ware ?? EMPTY)
  const nameBad = form.name.trim() === ''
  // 区域编码是行政区划代码，6 位数字。后端不校验，但填错了在按区域找仓库时查不到。
  const codeBad = form.areacode.trim() !== '' && !/^\d{6}$/.test(form.areacode.trim())

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{ware ? `修改仓库 · ${ware.name}` : '新增仓库'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="仓库名" fullWidth autoFocus value={form.name}
            error={nameBad} helperText={nameBad ? '请填写仓库名' : ' '}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="地址" fullWidth value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextField
            label="区域编码" fullWidth value={form.areacode}
            error={codeBad}
            helperText={codeBad ? '行政区划代码是 6 位数字，如 440300' : '行政区划代码，如 440300'}
            onChange={(e) => setForm((f) => ({ ...f, areacode: e.target.value }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={submitting || nameBad || codeBad}
          onClick={() => onSubmit(form)}>
          {submitting ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
