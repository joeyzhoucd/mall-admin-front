import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import {
  Box, Button, Stack, Typography, Paper, Chip, Avatar, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchSkus, fetchSpuInfo, updateSkuBasic, deleteSkus,
  type Sku, type SkuBasicUpdate,
} from '@/api/product'

/**
 * 某个 SPU 下的 SKU 列表（「规格」页）。
 *
 * 接口对照 BASELINE.md 的 spu-spec.vue（4 个）：
 * <pre>
 *   /product/spuinfo/info/{}   顶部显示这是哪个商品
 *   /product/skuinfo/list      该 SPU 下的 SKU（带 spuId 过滤）
 *   /product/skuinfo/update    改基本信息
 *   /product/skuinfo/delete    删除
 * </pre>
 *
 * <h3>和旧版的一个差别：没有「保存所有」</h3>
 * 旧版是把整页 SKU 一起提交。这里改成逐条编辑保存，因为后端的
 * /product/skuinfo/update 一次只收一个 SkuInfoEntity ——
 * 旧版的「保存所有」只能是循环发 N 个请求，
 * 中间失败就会留下<b>一半保存了一半没保存</b>的状态，而且用户不知道是哪一半。
 * 逐条保存至少每一次的成功/失败都是明确的。
 */
export default function SpuSpecPage() {
  const { id: spuId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<Sku | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Sku | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const spuQuery = useQuery({
    queryKey: ['spu-info', spuId],
    queryFn: ({ signal }) => fetchSpuInfo(spuId, signal),
    enabled: spuId !== '',
  })

  const listQuery = useQuery({
    queryKey: ['skus', spuId, page, pageSize],
    queryFn: ({ signal }) => fetchSkus({ page, limit: pageSize, spuId }, signal),
    enabled: spuId !== '',
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['skus', spuId] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (patch: SkuBasicUpdate) => updateSkuBasic(patch),
    onSuccess: () => { setEditing(null); afterWrite('已保存') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (sku: Sku) => deleteSkus([sku.skuId]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<Sku>[]>(() => [
    {
      id: 'img',
      header: '图',
      meta: { width: 56 },
      cell: ({ row }) => (
        <Avatar src={row.original.skuDefaultImg || undefined} variant="rounded"
          sx={{ width: 36, height: 36, fontSize: 12 }}>
          {row.original.skuName.slice(0, 1)}
        </Avatar>
      ),
    },
    {
      id: 'skuName',
      header: 'SKU',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 280 }}>
          <Typography variant="body2" noWrap>{row.original.skuName}</Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            #{row.original.skuId}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'saleAttrs',
      header: '销售属性',
      cell: ({ row }) => {
        const attrs = row.original.saleAttrs ?? []
        if (attrs.length === 0)
          return <Typography variant="caption" color="text.secondary">无</Typography>
        return (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, maxWidth: 260 }}>
            {attrs.map((a) => (
              <Chip key={`${a.attrId}-${a.attrValue}`} size="small" variant="outlined"
                label={`${a.attrName}：${a.attrValue}`} sx={{ height: 20 }} />
            ))}
          </Stack>
        )
      },
    },
    {
      accessorKey: 'price',
      header: '价格',
      meta: { width: 100, align: 'right' },
      // tabular-nums 让金额的数字对齐，扫一列价格时差别很明显
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          ¥{Number(row.original.price).toFixed(2)}
        </Typography>
      ),
    },
    {
      accessorKey: 'saleCount',
      header: '销量',
      meta: { width: 80, align: 'right' },
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="编辑">
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

  return (
    <Box sx={{ p: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/product-spu')}>
            返回
          </Button>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {spuQuery.data?.spuName ?? (spuQuery.isLoading ? '加载中…' : `商品 #${spuId}`)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {spuQuery.data?.spuDescription}
            </Typography>
          </Box>
          {spuQuery.data && (
            <Chip
              size="small"
              color={spuQuery.data.publishStatus === 1 ? 'success' : 'default'}
              variant={spuQuery.data.publishStatus === 1 ? 'filled' : 'outlined'}
              label={spuQuery.data.publishStatus === 1 ? '已上架' : '未上架'}
            />
          )}
        </Stack>
      </Paper>

      <DataTable<Sku>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(s) => s.skuId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="这个商品下还没有 SKU"
      />

      {editing && (
        <SkuEditDialog
          sku={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(patch) => saveMutation.mutate(patch)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除 SKU</DialogTitle>
        <DialogContent>确定删除「{confirmDelete?.skuName}」吗？</DialogContent>
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

interface EditProps {
  sku: Sku
  submitting: boolean
  onCancel: () => void
  onSubmit: (patch: SkuBasicUpdate) => void
}

/**
 * 只放后端白名单里的四个字段。
 * 多放一个（比如图片、销售属性）会得到一个「改了、保存了、没生效」的输入框 ——
 * 那比没有这个输入框糟糕得多。
 */
function SkuEditDialog({ sku, submitting, onCancel, onSubmit }: EditProps) {
  const [form, setForm] = useState({
    skuName: sku.skuName,
    skuTitle: sku.skuTitle ?? '',
    skuSubtitle: sku.skuSubtitle ?? '',
    price: String(sku.price),
  })
  const priceNum = Number(form.price)
  const priceBad = !Number.isFinite(priceNum) || priceNum < 0

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>编辑 SKU · {sku.skuName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="SKU 名称" fullWidth autoFocus value={form.skuName}
            onChange={(e) => setForm((f) => ({ ...f, skuName: e.target.value }))} />
          <TextField label="标题" fullWidth value={form.skuTitle}
            onChange={(e) => setForm((f) => ({ ...f, skuTitle: e.target.value }))} />
          <TextField label="副标题" fullWidth value={form.skuSubtitle}
            onChange={(e) => setForm((f) => ({ ...f, skuSubtitle: e.target.value }))} />
          <TextField
            label="价格" fullWidth value={form.price}
            error={priceBad}
            helperText={priceBad ? '请填一个不小于 0 的数字' : '单位：元'}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <Alert severity="info" variant="outlined">
            这里只能改这四项。图片和销售属性由后端的更新白名单挡着，
            改了也不会生效，所以没有放出来。
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          disabled={submitting || priceBad || !form.skuName.trim()}
          onClick={() => onSubmit({ skuId: sku.skuId, ...form, price: priceNum })}
        >
          {submitting ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
