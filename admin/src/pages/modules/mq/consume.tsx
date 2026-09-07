import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, Tooltip,
  ToggleButton, ToggleButtonGroup, Alert,
} from '@mui/material'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchConsumeRecords, fetchConsumeStats,
  CONSUME_STATUS, CONSUME_STATUS_LABEL, CONSUMER_GROUPS,
  type ConsumeKind, type MqConsumeRecord,
} from '@/api/mq'

/**
 * MQ 消费幂等记录。
 *
 * <pre>
 *   GET /order/mq-consume/list   oms_mq_consume_message
 *   GET /ware/mq-consume/list    wms_mq_consume_message
 * </pre>
 * 两个接口都是 2026-09-06 新写的 —— 这两张表此前<b>没有任何对外入口</b>，
 * 只有 consumeOnce 在往里写。
 *
 * <h3>为什么订单和库存合成一页，而 Outbox 是两页</h3>
 * Outbox 的使用场景是「订单的消息没发出去」，一次只关心一侧。
 * 而消费幂等的使用场景是排查一条消息的<b>完整链路</b>：
 * 订单发出去 → 库存消费 → 库存发出去 → 订单消费。
 * 同一个 message_key 会同时出现在两张表里，来回切菜单去对比很难受。
 *
 * <h3>这一页只读，没有任何写入口 —— 这是刻意的</h3>
 * 这张表不是日志，它<b>就是幂等判断的依据</b>：
 * 消费者第一步是往这里插一条（靠唯一键抢占），插不进去就说明已经处理过、跳过。
 * <p>
 * 所以删掉一行的后果是那条消息<b>会被完整地重新执行一遍</b> ——
 * 库存侧就是重复扣减或重复释放。而操作者在界面上看到的只是
 * 「删掉了一条状态为失败的记录」，后果和操作看起来完全不相称。
 * <p>
 * 要让一条失败的消息重跑，正确的入口是<b>死信队列</b>那一页：
 * 它把消息重投回源交换机，走完整的消费链路，幂等判断照常生效。
 */
export default function MqConsumePage() {
  const [kind, setKind] = useState<ConsumeKind>('order')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [form, setForm] = useState({ key: '', consumerGroup: '', status: '' })
  const [filters, setFilters] = useState({ key: '', consumerGroup: '', status: '' })

  const statsQuery = useQuery({
    queryKey: ['consume-stats', kind],
    queryFn: ({ signal }) => fetchConsumeStats(kind, signal),
    refetchInterval: 30_000,
  })

  const listQuery = useQuery({
    queryKey: ['consume', kind, page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchConsumeRecords(
        kind,
        {
          page,
          limit: pageSize,
          key: filters.key || undefined,
          consumerGroup: filters.consumerGroup || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const columns = useMemo<Col<MqConsumeRecord>[]>(() => [
    {
      id: 'messageKey',
      header: '消息键',
      meta: { width: 300 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.original.messageKey}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.businessType}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'consumerGroup',
      header: '消费者',
      meta: { width: 200 },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {row.original.consumerGroup}
        </Typography>
      ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 100 },
      cell: ({ row }) => (
        <Chip
          size="small"
          label={CONSUME_STATUS_LABEL[row.original.status] ?? `状态 ${row.original.status}`}
          color={consumeStatusColor(row.original.status)}
          variant={row.original.status === CONSUME_STATUS.SUCCESS ? 'outlined' : 'filled'}
        />
      ),
    },
    {
      id: 'consumeCount',
      header: '消费次数',
      meta: { width: 90, align: 'right' },
      cell: ({ row }) => {
        const n = row.original.consumeCount ?? 0
        // 次数 > 1 说明重试过。这本身不是错误（重试就是设计的一部分），
        // 但它是"这条消息不顺利"的信号，值得让它跳出来。
        return n > 1 ? <Chip size="small" label={n} color="warning" variant="outlined" /> : n
      },
    },
    {
      id: 'time',
      header: '创建 / 更新',
      meta: { width: 180 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="caption" component="div">{row.original.createTime ?? '-'}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.updateTime ?? '-'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'lastError',
      header: '最后一次错误',
      meta: { width: 300 },
      cell: ({ row }) =>
        row.original.lastError ? (
          <Tooltip title={row.original.lastError}>
            <Typography
              variant="caption"
              color="error"
              sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {row.original.lastError}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.secondary">-</Typography>
        ),
    },
  ], [])

  const stats = statsQuery.data ?? {}
  const failed = stats[CONSUME_STATUS.FAILED] ?? 0
  const processing = stats[CONSUME_STATUS.PROCESSING] ?? 0

  function switchKind(next: ConsumeKind) {
    setKind(next)
    setPage(1)
    // 消费者组的可选项是按侧区分的，切换后原来的值必然查不到任何东西。
    // 不清掉的话表现是「切过去一条都没有」，很容易被当成"库存这边没数据"。
    const cleared = { ...form, consumerGroup: '' }
    setForm(cleared)
    setFilters({ ...filters, consumerGroup: '' })
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>消费幂等</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        每个 MQ 监听器处理消息前先在这张表里抢占一条记录（唯一键是
        <code> 消费者 + 消息键 </code>），抢不到就说明已经处理过、直接跳过。
        这是"同一条消息只生效一次"的实现方式。
        <b>本页只读</b> —— 删改这里的记录等于让消息被重新执行一遍。
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <ToggleButtonGroup
          size="small" exclusive value={kind}
          onChange={(_, v) => { if (v) switchKind(v as ConsumeKind) }}
        >
          <ToggleButton value="order">订单侧</ToggleButton>
          <ToggleButton value="ware">库存侧</ToggleButton>
        </ToggleButtonGroup>

        <Chip
          label={`全部 ${Object.values(stats).reduce((a, b) => a + b, 0)}`}
          variant={filters.status === '' ? 'filled' : 'outlined'}
          onClick={() => {
            setForm((f) => ({ ...f, status: '' }))
            setFilters((f) => ({ ...f, status: '' }))
            setPage(1)
          }}
        />
        {Object.entries(CONSUME_STATUS_LABEL).map(([code, label]) => (
          <Chip
            key={code}
            label={`${label} ${stats[Number(code)] ?? 0}`}
            color={consumeStatusColor(Number(code))}
            variant={filters.status === code ? 'filled' : 'outlined'}
            onClick={() => {
              setForm((f) => ({ ...f, status: code }))
              setFilters((f) => ({ ...f, status: code }))
              setPage(1)
            }}
          />
        ))}
      </Stack>

      {failed > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          有 <b>{failed}</b> 条消费失败。它们对应的消息多半已经进了死信队列 ——
          去「死信队列」页按队列查看失败原因，确认之后再决定重投。
        </Alert>
      )}
      {processing > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          有 <b>{processing}</b> 条停留在「处理中」。这是消费者抢占之后还没写回结果的状态，
          正常情况下只会存在几毫秒。长期停留说明消费者在处理过程中被强杀了
          （进程被 kill、pod 被驱逐），这条记录会一直占着幂等键、
          让那条消息<b>再也不会被重新处理</b>。
        </Alert>
      )}

      <DataTable<MqConsumeRecord>
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
        emptyText="没有符合条件的记录"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" label="消息键" value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { setFilters(form); setPage(1) } }}
              placeholder="stock.deduct:2026..."
              sx={{ width: 240 }}
            />
            {/* 下拉而不是自由输入：输错一个字母的结果是「查出 0 条」，
                而那看起来和「这个监听器没出过问题」一模一样。 */}
            <TextField
              size="small" select label="消费者" value={form.consumerGroup}
              onChange={(e) => {
                const next = { ...form, consumerGroup: e.target.value }
                setForm(next); setFilters(next); setPage(1)
              }}
              sx={{ width: 220 }}
            >
              <MenuItem value="">全部</MenuItem>
              {CONSUMER_GROUPS[kind].map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" select label="状态" value={form.status}
              onChange={(e) => {
                const next = { ...form, status: e.target.value }
                setForm(next); setFilters(next); setPage(1)
              }}
              sx={{ width: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {Object.entries(CONSUME_STATUS_LABEL).map(([code, label]) => (
                <MenuItem key={code} value={code}>{label}</MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => { setFilters(form); setPage(1) }}>查询</Button>
            <Button
              onClick={() => {
                const empty = { key: '', consumerGroup: '', status: '' }
                setForm(empty); setFilters(empty); setPage(1)
              }}
            >
              重置
            </Button>
          </Stack>
        }
      />
    </Box>
  )
}

function consumeStatusColor(code: number): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (code) {
    case CONSUME_STATUS.PROCESSING: return 'info'
    case CONSUME_STATUS.SUCCESS: return 'success'
    case CONSUME_STATUS.FAILED: return 'error'
    default: return 'default'
  }
}
