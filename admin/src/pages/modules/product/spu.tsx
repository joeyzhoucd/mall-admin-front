import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import {
  Box, Button, Stack, TextField, MenuItem, IconButton, Tooltip, Chip, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import PublishIcon from '@mui/icons-material/CloudUpload'
import UnpublishIcon from '@mui/icons-material/CloudOff'
import TuneIcon from '@mui/icons-material/Tune'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import { DataTable, type Col } from '@/components/DataTable'
import { CategoryPicker } from '@/features/category/CategoryPicker'
import {
  fetchSpus, publishSpu, unpublishSpus, deleteSpus, fetchBrands, fetchCategoryTree,
  type Spu, type CategoryNode,
} from '@/api/product'
import type { Id } from '@/api/types'

/** 1 = 已上架，0 = 未上架/已下架。后端没有第三种取值。 */
const PUBLISHED = 1

/**
 * 商品管理（SPU）。
 *
 * 接口对照 BASELINE.md 的 spu.vue（6 个，一个不少一个不多）：
 * <pre>
 *   /product/spuinfo/list        列表（支持 key / categoryId / brandId / status）
 *   /product/spuinfo/{}/up       上架（单个）
 *   /product/spuinfo/unpublish   下架（批量）
 *   /product/spuinfo/delete      删除（批量）
 *   /product/brand/list          品牌筛选 + 把 brandId 翻成品牌名
 *   /product/category/list/tree  分类筛选 + 把 categoryId 翻成分类名
 * </pre>
 *
 * <h3>为什么要在前端拼名字</h3>
 * 列表接口只返回 brandId 和 categoryId，不返回名字。
 * 逐行去查名字会变成一页 N 次请求；把品牌表和分类树各拉一次做成 id→名字 的表，
 * 是一次性的两次请求。旧版 spu.vue 拉这两个接口也是这个原因。
 */
export default function SpuPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<{ key: string; categoryId: Id; brandId: Id; status: string }>({
    key: '', categoryId: '', brandId: '', status: '',
  })

  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'unpublish'; spu: Spu } | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['spus', page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchSpus(
        {
          page, limit: pageSize,
          key: filters.key || undefined,
          categoryId: filters.categoryId || undefined,
          brandId: filters.brandId || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  // 品牌和分类各拉一次，做成 id → 名字 的表。limit 给足，别分页 ——
  // 只翻到第一页的话，列表里第 2 页之后的品牌就显示成 id 了。
  const brandQuery = useQuery({
    queryKey: ['brands-all'],
    queryFn: ({ signal }) => fetchBrands({ page: 1, limit: 500 }, signal),
    staleTime: 5 * 60 * 1000,
  })
  const treeQuery = useQuery({
    queryKey: ['category-tree'],
    queryFn: ({ signal }) => fetchCategoryTree(signal),
    staleTime: 5 * 60 * 1000,
  })

  const brandName = useMemo(() => {
    const m = new Map<Id, string>()
    for (const b of brandQuery.data?.list ?? []) m.set(b.brandId, b.name)
    return m
  }, [brandQuery.data])

  const categoryName = useMemo(() => {
    const m = new Map<Id, string>()
    const walk = (ns: CategoryNode[]) => ns.forEach((n) => { m.set(n.id, n.name); walk(n.children) })
    walk(treeQuery.data ?? [])
    return m
  }, [treeQuery.data])

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['spus'] })
    setToast({ msg, severity: 'success' })
  }

  const publishMutation = useMutation({
    mutationFn: (spu: Spu) => publishSpu(spu.id),
    // 上架会把商品同步进 ES，比下架慢，所以提示里说清楚它做了什么。
    onSuccess: () => afterWrite('已上架，并同步到搜索索引'),
    onError,
  })

  const unpublishMutation = useMutation({
    mutationFn: (spu: Spu) => unpublishSpus([spu.id]),
    onSuccess: () => { setConfirm(null); afterWrite('已下架') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (spu: Spu) => deleteSpus([spu.id]),
    onSuccess: () => { setConfirm(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<Spu>[]>(() => [
    {
      id: 'spuName',
      header: '商品',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 320 }}>
          <Typography variant="body2" noWrap>{row.original.spuName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            #{row.original.id}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'brand',
      header: '品牌',
      meta: { width: 110 },
      // 名字还没加载出来时显示 id 而不是空白 —— 空白会被当成「没有品牌」。
      cell: ({ row }) =>
        brandName.get(row.original.brandId) ?? `#${row.original.brandId}`,
    },
    {
      id: 'category',
      header: '分类',
      meta: { width: 110 },
      cell: ({ row }) =>
        categoryName.get(row.original.categoryId) ?? `#${row.original.categoryId}`,
    },
    {
      id: 'publishStatus',
      header: '状态',
      meta: { width: 90, align: 'center' },
      cell: ({ row }) =>
        row.original.publishStatus === PUBLISHED
          ? <Chip size="small" color="success" label="已上架" sx={{ height: 20 }} />
          : <Chip size="small" label="未上架" variant="outlined" sx={{ height: 20 }} />,
    },
    {
      accessorKey: 'weight',
      header: '重量',
      meta: { width: 80, align: 'right' },
      cell: ({ row }) => `${row.original.weight} kg`,
    },
    {
      accessorKey: 'createTime',
      header: '创建时间',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Typography variant="caption">{row.original.createTime}</Typography>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 150, align: 'center' },
      cell: ({ row }) => {
        const spu = row.original
        const published = spu.publishStatus === PUBLISHED
        return (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            {published ? (
              <Tooltip title="下架">
                <IconButton size="small" onClick={() => setConfirm({ kind: 'unpublish', spu })}>
                  <UnpublishIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="上架">
                <span>
                  <IconButton
                    size="small" color="primary"
                    disabled={publishMutation.isPending}
                    onClick={() => publishMutation.mutate(spu)}
                  >
                    <PublishIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="规格">
              <IconButton size="small" onClick={() => navigate(`/product-spu-spec/${spu.id}`)}>
                <TuneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => setConfirm({ kind: 'delete', spu })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [brandName, categoryName, navigate, publishMutation])

  const applyFilters = () => {
    setFilters((f) => ({ ...f, key: keyword.trim() }))
    setPage(1)
  }
  const resetFilters = () => {
    setKeyword('')
    setFilters({ key: '', categoryId: '', brandId: '', status: '' })
    setPage(1)
  }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<Spu>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(s) => s.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="没有符合条件的商品"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" placeholder="按 ID / 商品名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
              sx={{ width: 200 }}
            />
            <CategoryPicker
              value={filters.categoryId}
              label="分类"
              onChange={(id) => { setFilters((f) => ({ ...f, categoryId: id })); setPage(1) }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              select size="small" label="品牌" value={filters.brandId}
              onChange={(e) => { setFilters((f) => ({ ...f, brandId: e.target.value })); setPage(1) }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部品牌</MenuItem>
              {(brandQuery.data?.list ?? []).map((b) => (
                <MenuItem key={b.brandId} value={b.brandId}>{b.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select size="small" label="状态" value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}
              sx={{ minWidth: 110 }}
            >
              <MenuItem value="">全部状态</MenuItem>
              <MenuItem value="1">已上架</MenuItem>
              <MenuItem value="0">未上架</MenuItem>
            </TextField>
            <Button size="small" variant="outlined" startIcon={<SearchIcon />} onClick={applyFilters}>
              查询
            </Button>
            <Button size="small" onClick={resetFilters}>重置</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => navigate('/product-spu-add')}
            >
              发布商品
            </Button>
          </Stack>
        }
      />

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.kind === 'delete' ? '删除商品' : '下架商品'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            「{confirm?.spu.spuName}」
          </Typography>
          <Alert severity={confirm?.kind === 'delete' ? 'warning' : 'info'} variant="outlined">
            {confirm?.kind === 'delete'
              ? '删除会连同该商品的 SKU、图片、属性值一起处理，且不会保留在前台。'
              : '下架后商品会从搜索索引中移除，前台不再可见，但数据保留，可以再次上架。'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>取消</Button>
          <Button
            color={confirm?.kind === 'delete' ? 'error' : 'primary'}
            disabled={deleteMutation.isPending || unpublishMutation.isPending}
            onClick={() => {
              if (!confirm) return
              if (confirm.kind === 'delete') deleteMutation.mutate(confirm.spu)
              else unpublishMutation.mutate(confirm.spu)
            }}
          >
            {confirm?.kind === 'delete' ? '删除' : '下架'}
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
