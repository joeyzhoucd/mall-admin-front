import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Stack, TextField, Button, Typography, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert,
} from '@mui/material'
import { DataTable, type Col } from '@/components/DataTable'
import { fetchSysLogs, type SysLog } from '@/api/sys'

/**
 * 操作日志。
 *
 * 接口对照 BASELINE.md 的 log.vue：只有 <code>/sys/log/list</code> 一个。
 * <b>这一组里唯一筛选参数真叫 key 的接口</b>（user 用 username、role 用 roleName、
 * config 用 paramKey）—— 见 api/sys.ts 顶部的说明。
 *
 * 这一页天然只读：日志不该能在界面上改或删。
 */
export default function SysLogPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<SysLog | null>(null)

  const listQuery = useQuery({
    queryKey: ['sys-logs', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchSysLogs({ page, limit: pageSize, key: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const columns = useMemo<Col<SysLog>[]>(() => [
    {
      accessorKey: 'username',
      header: '操作人',
      meta: { width: 110 },
      cell: ({ row }) =>
        row.original.username ?? <Typography variant="caption" color="text.secondary">-</Typography>,
    },
    {
      accessorKey: 'operation',
      header: '操作',
      meta: { width: 160 },
      cell: ({ row }) => row.original.operation ?? '-',
    },
    {
      id: 'method',
      header: '方法',
      cell: ({ row }) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: 'monospace', maxWidth: 320, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {row.original.method ?? '-'}
        </Typography>
      ),
    },
    {
      id: 'time',
      header: '耗时',
      meta: { width: 90, align: 'right' },
      cell: ({ row }) => {
        const t = row.original.time
        if (t == null) return '-'
        // 慢操作标出来。日志页最常见的用途之一就是「哪个操作变慢了」，
        // 一列裸数字要靠人去扫，标色能一眼看到。
        const color = t >= 1000 ? 'error.main' : t >= 300 ? 'warning.main' : 'text.primary'
        return (
          <Typography variant="body2" color={color} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {t} ms
          </Typography>
        )
      },
    },
    { accessorKey: 'ip', header: 'IP', meta: { width: 130 } },
    {
      accessorKey: 'createDate',
      header: '时间',
      meta: { width: 160 },
      cell: ({ row }) => <Typography variant="caption">{row.original.createDate ?? '-'}</Typography>,
    },
    {
      id: 'actions',
      header: '',
      meta: { width: 70, align: 'center' },
      cell: ({ row }) => (
        <Button size="small" onClick={() => setDetail(row.original)}>参数</Button>
      ),
    },
  ], [])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<SysLog>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(l) => l.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的日志` : '还没有操作日志'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按操作人 / 操作内容搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 240 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            {search && (
              <Chip size="small" label={`已筛选：${search}`}
                onDelete={() => { setKeyword(''); setSearch(''); setPage(1) }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Chip size="small" variant="outlined" label="只读" title="日志不提供修改或删除" />
          </Stack>
        }
      />

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>调用参数</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              {detail?.username} · {detail?.operation} · {detail?.createDate}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {detail?.method}
            </Typography>
            <Alert severity="warning" variant="outlined">
              调用参数是<b>原样记录</b>的。如果某个接口的入参里带了密码、令牌之类的东西，
              它们就在下面这段文本里 —— 截图前先看一眼。
            </Alert>
            <Box
              component="pre"
              sx={{
                m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1,
                fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}
            >
              {detail?.params || '（没有参数）'}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
