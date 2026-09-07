import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Divider,
} from '@mui/material'
import ReplayIcon from '@mui/icons-material/Replay'
import BlockIcon from '@mui/icons-material/Block'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PublishIcon from '@mui/icons-material/Publish'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchOutbox, fetchOutboxStats, publishOutboxReady, resendOutbox, markOutboxDead,
  OUTBOX_STATUS, OUTBOX_STATUS_LABEL, OUTBOX_TITLE,
  type OutboxKind, type OutboxMessage,
} from '@/api/mq'

/**
 * 事务性 Outbox 的管理面板。订单和库存<b>共用这一份实现</b>。
 *
 * <h3>为什么共用</h3>
 * oms_order_outbox_message 和 wms_stock_outbox_message 逐列相同，
 * 接口形状也相同（只差 /order/outbox 和 /ware/outbox 这个前缀）。
 * 各写一份的话，将来加一个筛选条件或改一处文案就要改两处，
 * 而漏掉其中一处不会有任何报错 —— 只会表现为「库存那页少了个功能」。
 * <p>
 * 但菜单上仍然是两项、路由也是两条：运维找的是「订单的消息卡住了」，
 * 不是「Outbox 里订单那一类」。所以是<b>一份实现、两个入口</b>，
 * 见 pages/modules/mq/order-outbox.tsx 和 ware-outbox.tsx。
 *
 * <h3>状态汇总放在最上面，而且可以点</h3>
 * 这一页第一眼要回答的是「有没有卡住的」。
 * 只给列表的话，「死信有 37 条」这件事要求看的人先怀疑、再去筛，
 * 而没人会主动这么做。
 */
export function OutboxPanel({ kind }: { kind: OutboxKind }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [form, setForm] = useState({ key: '', businessType: '', status: '' })
  const [filters, setFilters] = useState({ key: '', businessType: '', status: '' })
  const [viewing, setViewing] = useState<OutboxMessage | null>(null)
  const [confirm, setConfirm] = useState<
    | { action: 'resend'; row: OutboxMessage }
    | { action: 'dead'; row: OutboxMessage }
    | null
  >(null)
  const [deadReason, setDeadReason] = useState('')
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const statsQuery = useQuery({
    queryKey: ['outbox-stats', kind],
    queryFn: ({ signal }) => fetchOutboxStats(kind, signal),
    refetchInterval: 30_000,
  })

  const listQuery = useQuery({
    queryKey: ['outbox', kind, page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchOutbox(
        kind,
        {
          page,
          limit: pageSize,
          key: filters.key || undefined,
          businessType: filters.businessType || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['outbox', kind] })
    void qc.invalidateQueries({ queryKey: ['outbox-stats', kind] })
  }

  const publishMutation = useMutation({
    mutationFn: () => publishOutboxReady(kind),
    onSuccess: (count) => {
      setToast({ msg: `已触发发布，本次发出 ${count} 条`, severity: 'success' })
      refresh()
    },
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  const resendMutation = useMutation({
    mutationFn: (row: OutboxMessage) => resendOutbox(kind, row.id),
    onSuccess: (ok) => {
      // 后端返回 false 表示「没有发」（比如这条已经是 SENT）。
      // 那不是异常，但也绝不能报告成"已重发" —— 那会让人以为消息已经出去了。
      setToast(
        ok
          ? { msg: '已重新投递', severity: 'success' }
          : { msg: '未重发：这条消息的当前状态不允许重发（多半已经发送成功了）', severity: 'error' }
      )
      setConfirm(null)
      refresh()
    },
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  const deadMutation = useMutation({
    mutationFn: ({ row, reason }: { row: OutboxMessage; reason: string }) =>
      markOutboxDead(kind, row.id, reason),
    onSuccess: (ok) => {
      setToast(
        ok
          ? { msg: '已判死，这条消息不会再被发送', severity: 'success' }
          : { msg: '未判死：已发送成功的消息不能判死', severity: 'error' }
      )
      setConfirm(null)
      setDeadReason('')
      refresh()
    },
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  const columns = useMemo<Col<OutboxMessage>[]>(() => [
    {
      id: 'messageKey',
      header: '消息键 / 业务键',
      meta: { width: 300 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.original.messageKey}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.businessType} · {row.original.businessKey}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'route',
      header: '投递目标',
      meta: { width: 240 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.original.exchangeName}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.routingKey}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 110 },
      cell: ({ row }) => (
        <Chip
          size="small"
          label={OUTBOX_STATUS_LABEL[row.original.status] ?? `状态 ${row.original.status}`}
          color={outboxStatusColor(row.original.status)}
          variant={row.original.status === OUTBOX_STATUS.SENT ? 'outlined' : 'filled'}
        />
      ),
    },
    {
      id: 'retry',
      header: '重试',
      meta: { width: 70, align: 'right' },
      cell: ({ row }) => row.original.retryCount ?? 0,
    },
    {
      id: 'time',
      header: '创建 / 发送',
      meta: { width: 180 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="caption" component="div">{row.original.createTime ?? '-'}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.sentTime ?? '未发送'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'lastError',
      header: '最后一次错误',
      meta: { width: 260 },
      cell: ({ row }) =>
        row.original.lastError ? (
          // 错误信息后端截到 500 字符，这里再截一次只为了不撑爆表格；
          // 完整内容在详情弹窗里。
          <Tooltip title={row.original.lastError}>
            <Typography
              variant="caption"
              color="error"
              sx={{ display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {row.original.lastError}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.secondary">-</Typography>
        ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 130, align: 'right' },
      cell: ({ row }) => {
        const sent = row.original.status === OUTBOX_STATUS.SENT
        return (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="查看消息体">
              <IconButton size="small" onClick={() => setViewing(row.original)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {/* 已发送的不给重发/判死入口 —— 后端也会拒绝，
                但一个点了必然被拒的按钮只会让人怀疑是不是自己点错了。 */}
            <Tooltip title={sent ? '已发送成功的消息不能重发' : '强制重新投递'}>
              <span>
                <IconButton
                  size="small"
                  color="warning"
                  disabled={sent}
                  onClick={() => setConfirm({ action: 'resend', row: row.original })}
                >
                  <ReplayIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={sent ? '已发送成功的消息不能判死' : '判死：不再发送'}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={sent}
                  onClick={() => {
                    setDeadReason('')
                    setConfirm({ action: 'dead', row: row.original })
                  }}
                >
                  <BlockIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [])

  const stats = statsQuery.data ?? {}
  const stuck = (stats[OUTBOX_STATUS.FAILED] ?? 0) + (stats[OUTBOX_STATUS.DEAD] ?? 0)

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{OUTBOX_TITLE[kind]}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        事务性发件箱：业务数据和待发消息在<b>同一个事务</b>里落库，再由后台任务投递。
        这样「订单存了但消息没发出去」不会发生 —— 消息还在表里，会被重试。
      </Typography>

      {/* 卡住的条数单独提出来说。放在筛选条里的话它只是七个数字之一。 */}
      {stuck > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          有 <b>{stuck}</b> 条消息没有成功投递（发送失败 {stats[OUTBOX_STATUS.FAILED] ?? 0} 条、
          已死信 {stats[OUTBOX_STATUS.DEAD] ?? 0} 条）。
          死信状态的消息<b>不会再自动重试</b>，它承载的业务动作永远不会发生。
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip
          label={`全部 ${Object.values(stats).reduce((a, b) => a + b, 0)}`}
          variant={filters.status === '' ? 'filled' : 'outlined'}
          onClick={() => {
            setForm((f) => ({ ...f, status: '' }))
            setFilters((f) => ({ ...f, status: '' }))
            setPage(1)
          }}
        />
        {Object.entries(OUTBOX_STATUS_LABEL).map(([code, label]) => (
          <Chip
            key={code}
            label={`${label} ${stats[Number(code)] ?? 0}`}
            color={outboxStatusColor(Number(code))}
            variant={filters.status === code ? 'filled' : 'outlined'}
            onClick={() => {
              setForm((f) => ({ ...f, status: code }))
              setFilters((f) => ({ ...f, status: code }))
              setPage(1)
            }}
          />
        ))}
      </Stack>

      <DataTable<OutboxMessage>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(r) => String(r.id)}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isPending}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="没有符合条件的消息"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" label="消息键 / 业务键" value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { setFilters(form); setPage(1) } }}
              sx={{ width: 220 }}
            />
            <TextField
              size="small" label="业务类型" value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { setFilters(form); setPage(1) } }}
              placeholder="ORDER_CLOSE"
              sx={{ width: 180 }}
            />
            <TextField
              size="small" select label="状态" value={form.status}
              onChange={(e) => {
                const next = { ...form, status: e.target.value }
                setForm(next); setFilters(next); setPage(1)
              }}
              sx={{ width: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {Object.entries(OUTBOX_STATUS_LABEL).map(([code, label]) => (
                <MenuItem key={code} value={code}>{label}</MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => { setFilters(form); setPage(1) }}>查询</Button>
            <Button
              onClick={() => {
                const empty = { key: '', businessType: '', status: '' }
                setForm(empty); setFilters(empty); setPage(1)
              }}
            >
              重置
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              startIcon={<PublishIcon />}
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              立即发布待发送
            </Button>
          </Stack>
        }
      />

      {/* 消息体 */}
      <Dialog open={viewing !== null} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        <DialogTitle>消息内容</DialogTitle>
        <DialogContent dividers>
          {viewing && (
            <Stack spacing={1.5}>
              <Field label="消息键" value={viewing.messageKey} mono />
              <Field label="业务" value={`${viewing.businessType} · ${viewing.businessKey}`} />
              <Field label="投递目标" value={`${viewing.exchangeName} / ${viewing.routingKey}`} />
              <Field label="载荷类型" value={viewing.payloadType} mono />
              <Divider />
              <Typography variant="caption" color="text.secondary">载荷</Typography>
              <Box
                component="pre"
                sx={{
                  m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1,
                  fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              >
                {prettyJson(viewing.payload)}
              </Box>
              {viewing.lastError && (
                <>
                  <Divider />
                  <Typography variant="caption" color="text.secondary">最后一次错误</Typography>
                  <Alert severity="error" variant="outlined">{viewing.lastError}</Alert>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewing(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 二次确认。重发和判死都是会改变业务结果的操作。 */}
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirm?.action === 'resend' ? '确认重新投递？' : '确认判死？'}
        </DialogTitle>
        <DialogContent dividers>
          {confirm && (
            <Stack spacing={2}>
              <Field label="消息键" value={confirm.row.messageKey} mono />
              <Field label="业务" value={`${confirm.row.businessType} · ${confirm.row.businessKey}`} />
              {confirm.action === 'resend' ? (
                <Alert severity="warning">
                  这条消息会被<b>真正地重新投递并消费一遍</b>。
                  重复由消费幂等表挡住，但那要求消费方确实走了幂等判断。
                  当前状态是「{OUTBOX_STATUS_LABEL[confirm.row.status]}」，
                  已重试 {confirm.row.retryCount ?? 0} 次。
                </Alert>
              ) : (
                <>
                  <Alert severity="error">
                    判死之后这条消息<b>不会再被任何机制发送</b> ——
                    它承载的业务动作（关单 / 扣库存 / 放库存）永远不会发生。
                    这不是「先标记一下回头再说」，请确认这个后果是可以接受的。
                  </Alert>
                  <TextField
                    size="small" label="判死原因（会写进 last_error，事后靠它追溯）"
                    value={deadReason}
                    onChange={(e) => setDeadReason(e.target.value)}
                    fullWidth multiline minRows={2}
                  />
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>取消</Button>
          {confirm?.action === 'resend' ? (
            <Button
              color="warning" variant="contained"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate(confirm.row)}
            >
              确认重投
            </Button>
          ) : (
            <Button
              color="error" variant="contained"
              // 原因必填：一条被人工判死的消息，事后唯一能解释"为什么"的就是这行字。
              disabled={deadMutation.isPending || deadReason.trim() === ''}
              onClick={() => confirm && deadMutation.mutate({ row: confirm.row, reason: deadReason.trim() })}
            >
              确认判死
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="body2" sx={mono ? { fontFamily: 'monospace', wordBreak: 'break-all' } : undefined}>
        {value}
      </Typography>
    </Box>
  )
}

function outboxStatusColor(code: number): 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error' {
  switch (code) {
    case OUTBOX_STATUS.PENDING: return 'info'
    case OUTBOX_STATUS.SENDING: return 'primary'
    case OUTBOX_STATUS.SENT: return 'success'
    case OUTBOX_STATUS.FAILED: return 'warning'
    case OUTBOX_STATUS.DEAD: return 'error'
    default: return 'default'
  }
}

/**
 * 载荷格式化。解析失败就原样显示 —— 不能因为格式化不了就什么都不显示，
 * 恰恰是解析不了的那条最需要被人看到。
 */
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
