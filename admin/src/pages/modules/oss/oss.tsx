import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, Typography, IconButton, Tooltip, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, Avatar,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import { DataTable, type Col } from '@/components/DataTable'
import { fetchOssFiles, deleteOssFiles, fetchOssConfig, type SysOss } from '@/api/sys'
import type { Id } from '@/api/types'

/** 图片类型才值得显示缩略图。 */
const IMAGE_TYPES = /^image\//

function formatSize(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 文件管理（对象存储）。
 *
 * 接口对照 BASELINE.md（oss.vue + oss-config.vue + oss-upload.vue）：
 * <pre>
 *   /sys/oss/list      列表（<b>没有筛选参数</b>）
 *   /sys/oss/delete    批量删除
 *   /sys/oss/config    查看公开配置（bucket、endpoint 之类，<b>不含密钥</b>）
 *   /sys/oss/confirm   上传确认  ← 见下
 * </pre>
 *
 * <h3>上传功能暂时不做</h3>
 * 完整链路是「前端向 /thirdparty/oss/presign 要一个预签名地址 →
 * 浏览器直传到对象存储 → 调 /sys/oss/confirm 把记录落库」。
 * presign 那一段在 mall-thirdparty，目前还没接进新后台。
 * 与其做一个点了没反应的上传按钮，不如先明确说明它还没接 ——
 * 一个不工作的按钮比没有按钮更浪费时间。
 *
 * <h3>云存储配置只读</h3>
 * 旧版有一个「云存储配置」对话框，能在后台<b>写</b> accessKey/secretKey。
 * 写接口 /sys/oss/saveConfig <b>刻意没有实现</b>：
 * 把云存储凭证放进一张后台可编辑的数据库表，意味着它会随备份、
 * 从库和 binlog 一起扩散，而且任何能打开后台的人都能读到它。
 * 凭证走 Sealed Secrets 注入到服务里，后台这边只读不写。
 */
export default function OssPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [checked, setChecked] = useState<Set<Id>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<SysOss[] | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['oss-files', page, pageSize],
    queryFn: ({ signal }) => fetchOssFiles({ page, limit: pageSize }, signal),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (files: SysOss[]) => deleteOssFiles(files.map((f) => f.id)),
    onSuccess: () => {
      setConfirmDelete(null)
      setChecked(new Set())
      void qc.invalidateQueries({ queryKey: ['oss-files'] })
      setToast({ msg: '已删除', severity: 'success' })
    },
    onError: (e) =>
      setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' }),
  })

  const rows = listQuery.data?.list ?? []
  const checkedRows = rows.filter((f) => checked.has(f.id))

  const toggle = (id: Id) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const columns = useMemo<Col<SysOss>[]>(() => [
    {
      id: 'check',
      header: '',
      meta: { width: 44, align: 'center' },
      cell: ({ row }) => (
        <Checkbox size="small" sx={{ p: 0.5 }}
          checked={checked.has(row.original.id)}
          onChange={() => toggle(row.original.id)} />
      ),
    },
    {
      id: 'preview',
      header: '',
      meta: { width: 56 },
      cell: ({ row }) =>
        IMAGE_TYPES.test(row.original.contentType ?? '')
          ? <Avatar src={row.original.url} variant="rounded" sx={{ width: 36, height: 36 }} />
          : <Avatar variant="rounded" sx={{ width: 36, height: 36, fontSize: 11 }}>
              {(row.original.contentType ?? '?').split('/').pop()?.slice(0, 4)}
            </Avatar>,
    },
    {
      id: 'objectKey',
      header: '对象键',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 380 }}>
          <Typography variant="body2" noWrap sx={{ fontFamily: 'monospace' }}>
            {row.original.objectKey}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {row.original.contentType ?? '未知类型'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'fileSize',
      header: '大小',
      meta: { width: 90, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatSize(row.original.fileSize)}
        </Typography>
      ),
    },
    {
      accessorKey: 'createBy',
      header: '上传者',
      meta: { width: 110 },
      cell: ({ row }) =>
        row.original.createBy ?? <Typography variant="caption" color="text.secondary">-</Typography>,
    },
    {
      accessorKey: 'createDate',
      header: '上传时间',
      meta: { width: 150 },
      cell: ({ row }) => <Typography variant="caption">{row.original.createDate ?? '-'}</Typography>,
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 90, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="在新标签页打开">
            <IconButton size="small" component="a" href={row.original.url}
              target="_blank" rel="noopener noreferrer">
              <OpenIcon fontSize="small" />
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
  ], [checked])

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<SysOss>
        columns={columns}
        rows={rows}
        getRowId={(f) => f.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="还没有文件"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              共 {listQuery.data?.totalCount ?? 0} 个文件
            </Typography>
            <Button size="small" color="error" startIcon={<DeleteIcon />}
              disabled={checkedRows.length === 0}
              onClick={() => setConfirmDelete(checkedRows)}>
              批量删除{checkedRows.length > 0 ? `（${checkedRows.length}）` : ''}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" startIcon={<SettingsIcon />} onClick={() => setShowConfig(true)}>
              云存储配置
            </Button>
          </Stack>
        }
      />

      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        <b>上传功能还没接。</b>完整链路是「向 presign 要预签名地址 → 浏览器直传 →
        调 confirm 落库」，presign 那一段在 mall-thirdparty，还没接进新后台。
        与其放一个点了没反应的按钮，不如先说清楚。
      </Alert>

      <Dialog open={showConfig} onClose={() => setShowConfig(false)} maxWidth="sm" fullWidth>
        <DialogTitle>云存储配置</DialogTitle>
        <DialogContent dividers>
          <OssConfigView />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfig(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除文件</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            删除 {confirmDelete?.length ?? 0} 个文件的<b>记录</b>。
          </Typography>
          <Alert severity="warning" variant="outlined">
            这只删数据库里的记录，<b>对象存储上的文件本身不会被删除</b>，
            原来的 URL 仍然能访问。所以这不是「让文件不可访问」的办法 ——
            商品图之类还在被引用的文件，删掉记录后前台照常显示。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button color="error" disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>
            删除记录
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

/** 只读展示对象存储的公开配置。写入路径刻意不存在，见页面顶部说明。 */
function OssConfigView() {
  const configQuery = useQuery({
    queryKey: ['oss-config'],
    queryFn: ({ signal }) => fetchOssConfig(signal),
  })

  if (configQuery.isLoading) {
    return <Typography variant="body2" color="text.secondary">加载中…</Typography>
  }
  if (configQuery.error) {
    return (
      <Alert severity="error">
        {configQuery.error instanceof Error ? configQuery.error.message : '配置加载失败'}
      </Alert>
    )
  }

  const entries = Object.entries(configQuery.data ?? {})

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        <b>这里只读。</b>凭证（accessKey / secretKey）不在这份配置里，
        也<b>不能</b>从后台写入 —— 把云存储凭证放进一张后台可编辑的数据库表，
        意味着它会随备份、从库和 binlog 一起扩散，
        而且任何能打开这一页的人都能读到。凭证走 Sealed Secrets 注入到服务里。
      </Alert>

      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">没有可展示的配置项</Typography>
      ) : (
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1 }}>
          {entries.map(([k, v]) => (
            <Box key={k} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" color="text.secondary">{k}</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  )
}
