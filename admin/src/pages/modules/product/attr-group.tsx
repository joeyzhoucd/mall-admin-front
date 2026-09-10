import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, IconButton, Tooltip, Chip, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import SearchIcon from '@mui/icons-material/Search'
import { DataTable, type Col } from '@/components/DataTable'
import { AttrGroupForm } from '@/features/attr/AttrGroupForm'
import { AttrGroupRelationDialog } from '@/features/attr/AttrGroupRelationDialog'
import {
  fetchAttrGroups, createAttrGroup, updateAttrGroup, deleteAttrGroup, deleteAttrGroups,
  type AttrGroup,
} from '@/api/attr'

/**
 * 属性分组。
 *
 * 接口对照 BASELINE.md 的 attr-group.vue（9 个，一个不少一个不多）：
 * <pre>
 *   /product/attrgroup/list                                    列表
 *   /product/attrgroup/save                                    新增
 *   /product/attrgroup/update                                  编辑
 *   /product/attrgroup/delete/{}                               单个删除
 *   /product/attrgroup/delete                                  批量删除
 *   /product/attrattrgrouprelation/getAttrsByGroupId/{}        已关联属性  ┐
 *   /product/attr/unrelated/{}                                 候选属性    ├ 关联对话框
 *   /product/attrattrgrouprelation/saveBatch                   批量关联    │
 *   /product/attrattrgrouprelation/delete/{attrId}/{groupId}   解除关联   ┘
 * </pre>
 * 单个删除和批量删除是<b>两个不同的地址</b>，不是同一个 —— 容易看漏。
 */
export default function AttrGroupPage() {
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<AttrGroup | null | undefined>(undefined)
  const [relationFor, setRelationFor] = useState<AttrGroup | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AttrGroup[] | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['attr-groups', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchAttrGroups({ page, limit: pageSize, key: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['attr-groups'] })
    // 分组名变了之后，属性列表里的「所属分组」那一列也跟着过期。
    void qc.invalidateQueries({ queryKey: ['attr-groups-all'] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (g: AttrGroup) =>
      g.attrGroupId ? updateAttrGroup(g) : createAttrGroup(stripId(g)),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    // 单个和批量是两个地址。只用批量那个也能删一条，
    // 但那样 /product/attrgroup/delete/{} 就成了永远不会被调用的死接口。
    mutationFn: (groups: AttrGroup[]) =>
      groups.length === 1
        ? deleteAttrGroup(groups[0]!.attrGroupId)
        : deleteAttrGroups(groups.map((g) => g.attrGroupId)),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<AttrGroup>[]>(() => [
    { accessorKey: 'attrGroupId', header: 'ID', meta: { width: 70 } },
    { accessorKey: 'attrGroupName', header: '分组名' },
    { accessorKey: 'sort', header: '排序', meta: { width: 80, align: 'right' } },
    {
      id: 'descript',
      header: '描述',
      cell: ({ row }) =>
        row.original.descript ?? (
          <Typography variant="caption" color="text.secondary">未填写</Typography>
        ),
    },
    {
      id: 'categoryId',
      header: '所属分类',
      meta: { width: 140 },
      // 2026-09-10 之前这里显示的是 `#3` 这种原始 id —— 因为接口只返回 categoryId。
      // 当时的取舍是"显示 id 而不是逐行查名字"（一页 N 次请求撑不起这一列的价值），
      // 那个取舍本身没错，但漏了第三个选项：让后端一次批量查回来。
      // 现在后端补了 categoryName（AttrGroupServiceImpl.fillCategoryNames，1 次 IN 查询）。
      //
      // 仍然保留 id 回落：分组挂在已删除的分类下时 categoryName 是 null，
      // 那时显示 id 比显示空白有用 —— 至少能拿这个 id 去查是哪条脏数据。
      cell: ({ row }) => (
        <Chip
          size="small"
          variant="outlined"
          label={row.original.categoryName ?? `#${row.original.categoryId}`}
        />
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 120, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="关联属性">
            <IconButton size="small" onClick={() => setRelationFor(row.original)}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="修改">
            <IconButton size="small" onClick={() => setEditing(row.original)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => setConfirmDelete([row.original])}>
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
      <DataTable<AttrGroup>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(g) => g.attrGroupId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的分组` : '还没有属性分组'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按 ID / 分组名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 220 }}
            />
            <Button size="small" variant="outlined" startIcon={<SearchIcon />} onClick={submitSearch}>
              查询
            </Button>
            {search && (
              <Chip size="small" label={`已筛选：${search}`}
                onDelete={() => { setKeyword(''); setSearch(''); setPage(1) }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditing(null)}>
              新增
            </Button>
          </Stack>
        }
      />

      {editing !== undefined && (
        <AttrGroupForm
          group={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(g) => saveMutation.mutate(g)}
        />
      )}

      {relationFor && (
        <AttrGroupRelationDialog
          group={relationFor}
          onClose={() => setRelationFor(null)}
          onToast={setToast}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除属性分组</DialogTitle>
        <DialogContent>
          确定删除「{confirmDelete?.map((g) => g.attrGroupName).join('、')}」吗？
          <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
            分组下的属性本身不会被删除，只是不再归属于这个分组。
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

function stripId(g: AttrGroup): Omit<AttrGroup, 'attrGroupId'> {
  const { attrGroupId: _ignored, ...rest } = g
  return rest
}
