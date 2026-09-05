import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Checkbox,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MergeIcon from '@mui/icons-material/CallMerge'
import AddIcon from '@mui/icons-material/Add'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchPurchaseDetails, savePurchaseDetail, updatePurchaseDetail,
  deletePurchaseDetails, mergePurchaseDetails, fetchPurchases, fetchWareInfos,
  DETAIL_STATUS_TEXT, PURCHASE_STATUS_TEXT, PURCHASE_STATUS,
  type PurchaseDetail,
} from '@/api/ware'
import type { Id } from '@/api/types'

/**
 * 采购需求（采购单明细）。
 *
 * 接口对照 BASELINE.md 的 purchasedetail.vue（7 个）：
 * <pre>
 *   /ware/purchasedetail/list     列表
 *   /ware/purchasedetail/save     新增
 *   /ware/purchasedetail/update   修改
 *   /ware/purchasedetail/delete   批量删除
 *   /ware/purchase/merge          合并成采购单
 *   /ware/purchase/list           合并时选目标采购单
 *   /ware/wareinfo/list           仓库下拉
 * </pre>
 *
 * <h3>这一页是采购流程的入口</h3>
 * 先在这里登记「要采购什么、多少件、进哪个仓库」，
 * 再把若干条需求<b>合并</b>成一张采购单，然后才是分配/领取/完成。
 * 采购单页刻意不提供手工新建，就是为了让单子只有这一个来源。
 */
export default function PurchaseDetailPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<{ key: string; status: string; wareId: Id }>({
    key: '', status: '', wareId: '',
  })

  const [checked, setChecked] = useState<Set<Id>>(new Set())
  const [editing, setEditing] = useState<PurchaseDetail | null | undefined>(undefined)
  const [merging, setMerging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<PurchaseDetail | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['purchase-details', page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchPurchaseDetails(
        {
          page, limit: pageSize,
          key: filters.key || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
          wareId: filters.wareId || undefined,
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const wareQuery = useQuery({
    queryKey: ['ware-infos-all'],
    queryFn: ({ signal }) => fetchWareInfos({ page: 1, limit: 200 }, signal),
    staleTime: 5 * 60 * 1000,
  })

  const wareName = useMemo(() => {
    const m = new Map<Id, string>()
    for (const w of wareQuery.data?.list ?? []) m.set(w.id, w.name)
    return m
  }, [wareQuery.data])

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['purchase-details'] })
    void qc.invalidateQueries({ queryKey: ['purchases'] })
    setChecked(new Set())
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (d: PurchaseDetail) =>
      d.id ? updatePurchaseDetail(d) : savePurchaseDetail({
        skuId: d.skuId, skuNum: d.skuNum, skuPrice: d.skuPrice, wareId: d.wareId, status: 0,
      }),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (d: PurchaseDetail) => deletePurchaseDetails([d.id]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const toggle = (id: Id) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows = listQuery.data?.list ?? []
  const checkedRows = rows.filter((d) => checked.has(d.id))

  const columns = useMemo<Col<PurchaseDetail>[]>(() => [
    {
      id: 'check',
      header: '',
      meta: { width: 44, align: 'center' },
      cell: ({ row }) => (
        <Checkbox
          size="small" sx={{ p: 0.5 }}
          checked={checked.has(row.original.id)}
          onChange={() => toggle(row.original.id)}
        />
      ),
    },
    { accessorKey: 'id', header: 'ID', meta: { width: 90 } },
    {
      id: 'sku',
      header: '商品',
      cell: ({ row }) => (
        <Typography variant="body2">SKU #{row.original.skuId}</Typography>
      ),
    },
    {
      accessorKey: 'skuNum',
      header: '数量',
      meta: { width: 80, align: 'right' },
    },
    {
      accessorKey: 'skuPrice',
      header: '单价',
      meta: { width: 100, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.original.skuPrice == null ? '-' : `¥${Number(row.original.skuPrice).toFixed(2)}`}
        </Typography>
      ),
    },
    {
      id: 'ware',
      header: '目标仓库',
      meta: { width: 120 },
      cell: ({ row }) =>
        row.original.wareId
          ? wareName.get(row.original.wareId) ?? `#${row.original.wareId}`
          : <Typography variant="caption" color="text.secondary">未指定</Typography>,
    },
    {
      id: 'purchaseId',
      header: '所属采购单',
      meta: { width: 110 },
      cell: ({ row }) =>
        row.original.purchaseId
          ? `#${row.original.purchaseId}`
          : <Typography variant="caption" color="text.secondary">未合并</Typography>,
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => {
        const s = row.original.status
        const color = s === 3 ? 'success' : s === 4 ? 'error' : s === 0 ? 'default' : 'info'
        return (
          <Chip size="small" color={color} variant={color === 'default' ? 'outlined' : 'filled'}
            label={DETAIL_STATUS_TEXT[s] ?? `未知(${s})`} sx={{ height: 20 }} />
        )
      },
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 90, align: 'center' },
      cell: ({ row }) => {
        // 已完成的明细代表「货已入库」，改它没有意义、还会让账对不上。
        const locked = row.original.status === 3
        return (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            <Tooltip title={locked ? '已完成入库，不能再改' : '编辑'}>
              <span>
                <IconButton size="small" disabled={locked} onClick={() => setEditing(row.original)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => setConfirmDelete(row.original)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [checked, wareName])

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<PurchaseDetail>
        columns={columns}
        rows={rows}
        getRowId={(d) => d.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="还没有采购需求"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" placeholder="按 ID / SKU 搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setFilters((f) => ({ ...f, key: keyword.trim() })); setPage(1) }
              }}
              sx={{ width: 180 }}
            />
            <TextField
              select size="small" label="状态" value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">全部状态</MenuItem>
              {Object.entries(DETAIL_STATUS_TEXT).map(([v, t]) => (
                <MenuItem key={v} value={v}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              select size="small" label="仓库" value={filters.wareId}
              onChange={(e) => { setFilters((f) => ({ ...f, wareId: e.target.value })); setPage(1) }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部仓库</MenuItem>
              {(wareQuery.data?.list ?? []).map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="outlined"
              onClick={() => { setFilters((f) => ({ ...f, key: keyword.trim() })); setPage(1) }}>
              查询
            </Button>
            <Button size="small" startIcon={<MergeIcon />}
              disabled={checkedRows.length === 0} onClick={() => setMerging(true)}>
              合并成采购单{checkedRows.length > 0 ? `（${checkedRows.length}）` : ''}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => setEditing(null)}>
              新增需求
            </Button>
          </Stack>
        }
      />

      {editing !== undefined && (
        <DetailForm
          detail={editing}
          wares={wareQuery.data?.list ?? []}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(d) => saveMutation.mutate(d)}
        />
      )}

      {merging && (
        <MergeDialog
          details={checkedRows}
          onCancel={() => setMerging(false)}
          onDone={(msg) => { setMerging(false); afterWrite(msg) }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除采购需求</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            删除需求 #{confirmDelete?.id}（SKU #{confirmDelete?.skuId} × {confirmDelete?.skuNum}）。
          </Typography>
          {confirmDelete?.status === 3 && (
            <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
              这条需求<b>已经完成入库</b>，删掉它不会把库存退回去，
              只会让这批货失去来源记录。
            </Alert>
          )}
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
        autoHideDuration={toast?.severity === 'error' ? null : 4000}
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

const EMPTY: PurchaseDetail = {
  id: '', purchaseId: null, skuId: '', skuNum: 1, skuPrice: null, wareId: null, status: 0,
}

function DetailForm({
  detail, wares, submitting, onCancel, onSubmit,
}: {
  detail: PurchaseDetail | null
  wares: { id: Id; name: string }[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (d: PurchaseDetail) => void
}) {
  const [form, setForm] = useState<PurchaseDetail>(detail ?? EMPTY)
  const skuBad = String(form.skuId).trim() === ''
  const numBad = !(Number(form.skuNum) > 0)
  const priceBad = form.skuPrice != null && Number(form.skuPrice) < 0

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{detail ? `编辑采购需求 #${detail.id}` : '新增采购需求'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="SKU ID" fullWidth autoFocus value={form.skuId}
            error={skuBad} helperText={skuBad ? '请填写 SKU ID' : '在「商品库存」页可以查到'}
            onChange={(e) => setForm((f) => ({ ...f, skuId: e.target.value }))}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="采购数量" fullWidth value={form.skuNum}
              error={numBad} helperText={numBad ? '数量必须大于 0' : ' '}
              onChange={(e) => setForm((f) => ({ ...f, skuNum: Number(e.target.value) || 0 }))}
            />
            <TextField
              label="采购单价" fullWidth value={form.skuPrice ?? ''}
              error={priceBad} helperText={priceBad ? '单价不能为负' : '可留空'}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  skuPrice: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </Stack>
          <TextField
            select label="目标仓库" fullWidth value={form.wareId ?? ''}
            helperText="采购到货后入哪个仓库"
            onChange={(e) => setForm((f) => ({ ...f, wareId: e.target.value || null }))}
          >
            <MenuItem value="">（暂不指定）</MenuItem>
            {wares.map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </TextField>
          {!form.wareId && (
            <Alert severity="warning" variant="outlined">
              没有目标仓库的需求，在完成采购时<b>入库会落到 wareId=null</b> ——
              那批货不属于任何仓库，库存页里查不出来。合并成采购单前最好补上。
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={submitting || skuBad || numBad || priceBad}
          onClick={() => onSubmit(form)}>
          {submitting ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * 合并成采购单。
 *
 * 不选目标采购单时后端会<b>新建</b>一张 —— 这一点必须在界面上说清楚，
 * 否则「不选直接点合并」的结果是凭空多出一张单子，而用户以为什么都没发生。
 */
function MergeDialog({
  details, onCancel, onDone, onError,
}: {
  details: PurchaseDetail[]
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (e: unknown) => void
}) {
  const [purchaseId, setPurchaseId] = useState<Id>('')

  const purchaseQuery = useQuery({
    queryKey: ['purchases', 'mergeable'],
    queryFn: ({ signal }) => fetchPurchases({ page: 1, limit: 200 }, signal),
  })

  // 只能并进还没完成的单子。并进已完成的单子，那些明细会永远停在「已分配」——
  // 因为完成动作已经过去了，不会再有人来处理它们。
  const mergeable = (purchaseQuery.data?.list ?? []).filter(
    (p) => p.status !== PURCHASE_STATUS.FINISHED && p.status !== PURCHASE_STATUS.HAS_ERROR
  )

  const already = details.filter((d) => d.purchaseId)

  const mutation = useMutation({
    mutationFn: () => mergePurchaseDetails(details.map((d) => d.id), purchaseId || undefined),
    onSuccess: () =>
      onDone(
        purchaseId
          ? `已合并 ${details.length} 条需求到采购单 #${purchaseId}`
          : `已新建采购单并合并 ${details.length} 条需求`
      ),
    onError,
  })

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>合并成采购单</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">
            已选中 <b>{details.length}</b> 条采购需求。
          </Typography>

          <TextField
            select label="目标采购单" fullWidth value={purchaseId}
            onChange={(e) => setPurchaseId(e.target.value)}
            helperText={
              purchaseId
                ? '这些需求会挂到选中的采购单下'
                : '不选则【新建一张采购单】'
            }
          >
            <MenuItem value="">（新建一张采购单）</MenuItem>
            {mergeable.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                #{p.id} · {PURCHASE_STATUS_TEXT[p.status]}
                {p.assigneeName ? ` · ${p.assigneeName}` : ''}
              </MenuItem>
            ))}
          </TextField>

          {already.length > 0 && (
            <Alert severity="warning" variant="outlined">
              其中 <b>{already.length}</b> 条已经挂在别的采购单下
              （{already.map((d) => `#${d.purchaseId}`).join('、')}）。
              合并会把它们<b>移到</b>新的单子上，原单子里就少了这几条。
            </Alert>
          )}

          {mergeable.length === 0 && !purchaseQuery.isLoading && (
            <Alert severity="info" variant="outlined">
              目前没有可合并的采购单（已完成/有异常的单子不能再并入），
              继续操作会新建一张。
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? '合并中…' : purchaseId ? '合并' : '新建并合并'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
