import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Switch, IconButton, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Avatar,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CategoryIcon from '@mui/icons-material/AccountTree'
import SearchIcon from '@mui/icons-material/Search'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchBrands, createBrand, updateBrand, deleteBrand, updateBrandStatus,
  type Brand,
} from '@/api/product'
// 子组件放在 features/ 而不是 pages/modules/ 下面：
// pages/modules/**/*.tsx 会被 import.meta.glob 全部注册成「页面」，
// 放进去会凭空多出 product/brand/BrandForm 这样的假路由。
import { BrandForm } from '@/features/brand/BrandForm'
import { BrandCategoryDialog } from '@/features/brand/BrandCategoryDialog'

/**
 * 品牌管理。
 *
 * <h3>验收对照（BASELINE.md 里 brand.vue 那一节，必须一个不少、一个不多）</h3>
 * <pre>
 *   /product/brand/list                                     列表      ✓
 *   /product/brand/save                                     新增      ✓
 *   /product/brand/update                                   编辑      ✓
 *   /product/brand/delete/{}                                删除      ✓
 *   /product/brand/updateStatus                             切换显示  ✓
 *   /product/category/list/tree                             关联分类  ✓（子组件）
 *   /product/categorybrandrelation/getRelationsByBrandId/{} 关联分类  ✓（子组件）
 *   /product/categorybrandrelation/updateRelations/{}       关联分类  ✓（子组件）
 * </pre>
 * 比旧版<b>多了一个搜索框</b>：旧版没有，因为后端的 key 参数当时是无效的
 * （空 QueryWrapper）。2026-09-03 后端补上了，见 BrandQueryWrapperTest。
 */
export default function BrandPage() {
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // 输入框的值和真正发出去的检索词分开：不分开就变成每敲一个字发一次请求。
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Brand | null | undefined>(undefined) // undefined=关闭, null=新增
  const [relationFor, setRelationFor] = useState<Brand | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Brand | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['brands', page, pageSize, search],
    queryFn: ({ signal }) => fetchBrands({ page, limit: pageSize, key: search || undefined }, signal),
    // 翻页时保留上一页的数据，避免表格在加载中整个塌掉再撑开。
    placeholderData: (prev) => prev,
  })

  /** 所有写操作共用的收尾：刷新列表 + 提示。 */
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['brands'] })
    setToast({ msg, severity: 'success' })
  }
  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })

  const statusMutation = useMutation({
    mutationFn: ({ brand, next }: { brand: Brand; next: number }) =>
      updateBrandStatus(brand.brandId, next),
    onSuccess: () => afterWrite('状态已更新'),
    onError,
  })

  const saveMutation = useMutation({
    // brandId 为空表示新增。后端按 save/update 分两个地址，不是同一个地址靠 id 区分。
    mutationFn: (values: Brand) =>
      values.brandId ? updateBrand(values) : createBrand(stripId(values)),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (brand: Brand) => deleteBrand(brand.brandId),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<Brand>[]>(() => [
    { accessorKey: 'brandId', header: 'ID', meta: { width: 70 } },
    {
      id: 'logo',
      header: 'Logo',
      meta: { width: 60 },
      // 没有 logo 的品牌显示首字母，比一个破图标或空白格子更有用。
      cell: ({ row }) => (
        <Avatar src={row.original.logo || undefined} variant="rounded" sx={{ width: 32, height: 32, fontSize: 14 }}>
          {row.original.firstLetter || row.original.name.slice(0, 1)}
        </Avatar>
      ),
    },
    { accessorKey: 'name', header: '品牌名' },
    { accessorKey: 'firstLetter', header: '首字母', meta: { width: 80, align: 'center' } },
    { accessorKey: 'sort', header: '排序', meta: { width: 80, align: 'right' } },
    {
      id: 'showStatus',
      header: '显示',
      meta: { width: 90, align: 'center' },
      cell: ({ row }) => (
        <Switch
          size="small"
          checked={row.original.showStatus === 1}
          disabled={statusMutation.isPending}
          onChange={(e) =>
            statusMutation.mutate({ brand: row.original, next: e.target.checked ? 1 : 0 })
          }
        />
      ),
    },
    {
      accessorKey: 'descript',
      header: '介绍',
      // 介绍可能很长，这一列不参与 nowrap，给个上限让它省略。
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.original.descript || <Chip size="small" label="未填写" variant="outlined" />}
        </Box>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 140, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
          <Tooltip title="编辑">
            <IconButton size="small" onClick={() => setEditing(row.original)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="关联分类">
            <IconButton size="small" onClick={() => setRelationFor(row.original)}>
              <CategoryIcon fontSize="small" />
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
  ], [statusMutation])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<Brand>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(b) => b.brandId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的品牌` : '暂无品牌'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="按 ID / 名称 / 首字母搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 260 }}
            />
            <Button size="small" variant="outlined" startIcon={<SearchIcon />} onClick={submitSearch}>
              查询
            </Button>
            {search && (
              <Chip
                size="small"
                label={`已筛选：${search}`}
                onDelete={() => { setKeyword(''); setSearch(''); setPage(1) }}
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditing(null)}>
              新增品牌
            </Button>
          </Stack>
        }
      />

      {editing !== undefined && (
        <BrandForm
          brand={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(values) => saveMutation.mutate(values)}
        />
      )}

      {relationFor && (
        <BrandCategoryDialog
          brand={relationFor}
          onClose={() => setRelationFor(null)}
          onSaved={() => { setRelationFor(null); setToast({ msg: '关联分类已保存', severity: 'success' }) }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>删除品牌</DialogTitle>
        <DialogContent>
          确定删除「{confirmDelete?.name}」吗？该品牌与分类的关联也会一并失效。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
          >
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
        {/* 错误提示不自动消失（autoHideDuration=null）—— 失败信息一闪而过
            等于没提示，用户只会看到「点了没反应」。 */}
        <Alert severity={toast?.severity ?? 'success'} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

/** 新增时不能带 brandId —— 旧代码也是显式 delete 掉的。 */
function stripId(b: Brand): Omit<Brand, 'brandId'> {
  const { brandId: _ignored, ...rest } = b
  return rest
}
