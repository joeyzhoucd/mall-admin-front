import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Switch, IconButton, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import { DataTable, type Col } from '@/components/DataTable'
import { CategoryPicker } from '@/features/category/CategoryPicker'
import { AttrForm } from './AttrForm'
import {
  fetchAttrs, createAttr, updateAttr, deleteAttr, deleteAttrs, updateAttrEnable,
  type Attr, type AttrKind, type AttrDraft,
} from '@/api/attr'
import type { Id } from '@/api/types'

interface Props {
  kind: AttrKind
  /** 「规格参数」/「销售属性」。只影响文案。 */
  title: string
  /** 规格参数会归到属性分组里，销售属性不会。 */
  withGroup: boolean
}

/**
 * 规格参数 / 销售属性的共用实现。
 *
 * 这两页在旧版里是两个几乎一模一样的文件（attr-spec.vue / attr-sale.vue），
 * 差别只有接口前缀和「有没有属性分组」。合成一个带参数的实现，
 * 而不是复制一遍 —— 复制的那份迟早只有一边被改到。
 *
 * <h3>为什么分类是必选的</h3>
 * 后端 queryAttrPage 里是 {@code params.getOrDefault("categoryId", 0L)}
 * 加一句无条件的 {@code wrapper.eq("category_id", categoryId)}：
 * 不传 categoryId 就按 category_id = 0 过滤，<b>永远返回空</b>，而且不报错。
 * 所以这里在没选分类时显示「请先选择分类」，绝不显示一个空表格 ——
 * 空表格会被读成「这个分类下没有属性」，那是另一回事。
 */
export function AttrListPage({ kind, title, withGroup }: Props) {
  const qc = useQueryClient()

  const [categoryId, setCategoryId] = useState<Id>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Attr | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<Attr[] | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['attrs', kind, categoryId, page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchAttrs(kind, { page, limit: pageSize, categoryId, key: search || undefined }, signal),
    // 没选分类时干脆不发请求 —— 发了也只会拿到一个误导性的空列表。
    enabled: categoryId !== '',
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['attrs', kind] })
    setToast({ msg, severity: 'success' })
  }

  const enableMutation = useMutation({
    mutationFn: ({ attr, next }: { attr: Attr; next: number }) =>
      updateAttrEnable(kind, attr.attrId, next),
    onSuccess: () => afterWrite('状态已更新'),
    onError,
  })

  const saveMutation = useMutation({
    mutationFn: (draft: AttrDraft) =>
      draft.attrId ? updateAttr(kind, draft) : createAttr(kind, draft),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (attrs: Attr[]) =>
      attrs.length === 1
        ? deleteAttr(kind, attrs[0]!.attrId)
        : deleteAttrs(kind, attrs.map((a) => a.attrId)),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<Attr>[]>(() => {
    const cols: Col<Attr>[] = [
      { accessorKey: 'attrId', header: 'ID', meta: { width: 70 } },
      { accessorKey: 'attrName', header: '属性名', meta: { width: 160 } },
      {
        id: 'valueSelect',
        header: '可选值',
        cell: ({ row }) => {
          const raw = row.original.valueSelect
          if (!raw) return <Typography variant="caption" color="text.secondary">未设置</Typography>
          // 后端把可选值存成一个用分号隔开的字符串。拆开显示比原样打印可读得多。
          return (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, maxWidth: 320 }}>
              {raw.split(';').filter(Boolean).map((v) => (
                <Chip key={v} size="small" label={v} variant="outlined" sx={{ height: 20 }} />
              ))}
            </Stack>
          )
        },
      },
      {
        id: 'searchType',
        header: '可检索',
        meta: { width: 80, align: 'center' },
        cell: ({ row }) =>
          row.original.searchType === 1
            ? <Chip size="small" color="primary" label="是" sx={{ height: 20 }} />
            : <Typography variant="caption" color="text.secondary">否</Typography>,
      },
      {
        id: 'enable',
        header: '启用',
        meta: { width: 80, align: 'center' },
        cell: ({ row }) => (
          <Switch
            size="small"
            // enable 是【字符串】"1"，不是数字。写 === 1 会全都显示成禁用。
            checked={row.original.enable === '1'}
            disabled={enableMutation.isPending}
            onChange={(e) =>
              enableMutation.mutate({ attr: row.original, next: e.target.checked ? 1 : 0 })
            }
          />
        ),
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
              <IconButton size="small" color="error" onClick={() => setConfirmDelete([row.original])}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ]
    if (withGroup) {
      cols.splice(2, 0, {
        id: 'attrGroupName',
        header: '所属分组',
        meta: { width: 130 },
        cell: ({ row }) =>
          row.original.attrGroupName ?? (
            <Typography variant="caption" color="text.secondary">未分组</Typography>
          ),
      })
    }
    return cols
  }, [enableMutation, withGroup])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<Attr>
        columns={columns}
        rows={categoryId ? listQuery.data?.list ?? [] : []}
        getRowId={(a) => a.attrId}
        page={page}
        pageSize={pageSize}
        total={categoryId ? listQuery.data?.totalCount ?? 0 : 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={categoryId !== '' && listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={
          // 三种「表里没行」要说成三句不同的话，否则用户分不清自己在看什么。
          !categoryId
            ? '请先选择分类 —— 属性是挂在分类下面的'
            : search
              ? `该分类下没有匹配「${search}」的${title}`
              : `该分类下还没有${title}`
        }
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <CategoryPicker
              value={categoryId}
              onChange={(id) => { setCategoryId(id); setPage(1) }}
            />
            <TextField
              size="small"
              placeholder="按 ID / 名称搜索"
              value={keyword}
              disabled={!categoryId}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 200 }}
            />
            <Button size="small" variant="outlined" startIcon={<SearchIcon />}
              disabled={!categoryId} onClick={submitSearch}>
              查询
            </Button>
            {search && (
              <Chip size="small" label={`已筛选：${search}`}
                onDelete={() => { setKeyword(''); setSearch(''); setPage(1) }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title={categoryId ? '' : '请先选择分类'}>
              <span>
                <Button size="small" variant="contained" disabled={!categoryId}
                  onClick={() => setEditing(null)}>
                  新增{title}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        }
      />

      {editing !== undefined && (
        <AttrForm
          attr={editing}
          categoryId={categoryId}
          title={title}
          withGroup={withGroup}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(draft) => saveMutation.mutate(draft)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除{title}</DialogTitle>
        <DialogContent>
          确定删除「{confirmDelete?.map((a) => a.attrName).join('、')}」吗？
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
