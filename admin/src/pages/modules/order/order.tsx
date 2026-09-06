import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Divider,
  CircularProgress, Avatar,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ShipIcon from '@mui/icons-material/LocalShipping'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchOrders, fetchOrderDetail, fetchOrderStatusMeta,
  shipOrder, receiveOrder, completeOrder, startAfterSale, finishAfterSale,
  statusLabel, type Order, type StatusDefinition,
} from '@/api/order'

/** 状态 → Chip 颜色。终态用中性色，进行中的用有色。 */
function statusColor(code: number): 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error' {
  switch (code) {
    case 0: return 'warning'   // 待付款
    case 1: return 'info'      // 待发货
    case 2: return 'primary'   // 已发货
    case 3: return 'success'   // 已完成
    case 4: return 'default'   // 已关闭
    case 5: return 'error'     // 售后中
    case 6: return 'default'   // 售后完成
    default: return 'default'
  }
}

/**
 * 订单管理。
 *
 * 接口（这一页<b>没有旧版可对照</b>，旧后台里没有订单入口）：
 * <pre>
 *   GET  /order/order/list              列表 + 筛选
 *   GET  /order/order/detail/{orderSn}  订单 + 明细 + 操作记录
 *   GET  /order/order/statuses          状态机（状态定义 + 迁移表）
 *   POST /order/order/ship              发货
 *   POST /order/order/receive           代客确认收货
 *   POST /order/order/complete          完成
 *   POST /order/order/after-sale/start  发起售后
 *   POST /order/order/after-sale/finish 售后完成
 * </pre>
 *
 * <h3>按钮能不能点，由后端的迁移表决定</h3>
 * 「哪个状态能做什么操作」的真相在后端的 TRANSITION_TABLE 里。
 * 前端自己写一份规则的话，两边迟早不一致 ——
 * 表现要么是「按钮亮着，点下去报非法迁移」，
 * 要么是「按钮灰着，但那个操作其实允许」，后者根本不会被报告。
 * 所以这里拉 /statuses 拿到迁移表，按它来判断。
 *
 * <h3>后台对订单只读</h3>
 * 没有改字段、删订单的入口。状态只能通过上面那些业务动作迁移，
 * 它们会同时写操作记录、发 outbox、解锁库存。
 */
export default function OrderPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState({ orderSn: '', key: '', status: '', from: '', to: '' })
  const [filters, setFilters] = useState({ orderSn: '', key: '', status: '', from: '', to: '' })
  const [detailSn, setDetailSn] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const metaQuery = useQuery({
    queryKey: ['order-status-meta'],
    queryFn: ({ signal }) => fetchOrderStatusMeta(signal),
    staleTime: 30 * 60 * 1000,
  })
  const defs: StatusDefinition[] = metaQuery.data?.statuses ?? []

  const listQuery = useQuery({
    queryKey: ['orders', page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchOrders(
        {
          page, limit: pageSize,
          orderSn: filters.orderSn || undefined,
          key: filters.key || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
          createTimeFrom: filters.from ? `${filters.from} 00:00:00` : undefined,
          createTimeTo: filters.to ? `${filters.to} 23:59:59` : undefined,
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const columns = useMemo<Col<Order>[]>(() => [
    {
      id: 'orderSn',
      header: '订单号',
      meta: { width: 190 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.original.orderSn}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.createTime ?? '-'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'receiver',
      header: '收件人',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">
            {row.original.receiverName ?? '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.receiverPhone ?? ''}
          </Typography>
        </Box>
      ),
    },
    {
      accessorKey: 'memberUsername',
      header: '会员',
      meta: { width: 120 },
      cell: ({ row }) =>
        row.original.memberUsername ?? (
          <Typography variant="caption" color="text.secondary">#{row.original.memberId}</Typography>
        ),
    },
    {
      id: 'payAmount',
      header: '应付',
      meta: { width: 110, align: 'right' },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            ¥{Number(row.original.payAmount ?? 0).toFixed(2)}
          </Typography>
          {row.original.totalAmount != null &&
            Number(row.original.totalAmount) !== Number(row.original.payAmount) && (
              <Typography variant="caption" color="text.secondary" component="div"
                sx={{ textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                ¥{Number(row.original.totalAmount).toFixed(2)}
              </Typography>
            )}
        </Box>
      ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => (
        <Chip size="small" color={statusColor(row.original.status)}
          label={statusLabel(row.original.status, defs)} sx={{ height: 20 }} />
      ),
    },
    {
      id: 'delivery',
      header: '物流',
      meta: { width: 160 },
      cell: ({ row }) =>
        row.original.deliverySn ? (
          <Box>
            <Typography variant="caption" component="div">{row.original.deliveryCompany}</Typography>
            <Typography variant="caption" color="text.secondary" component="div"
              sx={{ fontFamily: 'monospace' }}>
              {row.original.deliverySn}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">未发货</Typography>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { width: 60, align: 'center' },
      cell: ({ row }) => (
        <Tooltip title="详情">
          <IconButton size="small" onClick={() => setDetailSn(row.original.orderSn)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [defs])

  const apply = () => { setFilters(form); setPage(1) }
  const reset = () => {
    const empty = { orderSn: '', key: '', status: '', from: '', to: '' }
    setForm(empty); setFilters(empty); setPage(1)
  }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<Order>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(o) => o.orderSn}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="没有符合条件的订单"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" label="订单号" value={form.orderSn}
              helperText=" " sx={{ width: 190 }}
              onChange={(e) => setForm((f) => ({ ...f, orderSn: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
            />
            <TextField
              size="small" label="收件人 / 会员 / 电话" value={form.key}
              helperText=" " sx={{ width: 190 }}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
            />
            <TextField
              select size="small" label="状态" value={form.status}
              helperText=" " sx={{ minWidth: 120 }}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <MenuItem value="">全部状态</MenuItem>
              {/* 状态列表来自后端 —— 后端新增一个状态，这里自动就有 */}
              {defs.map((d) => (
                <MenuItem key={d.code} value={String(d.code)}>
                  {statusLabel(d.code, defs)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" type="date" label="下单起" value={form.from}
              helperText=" " slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            />
            <TextField
              size="small" type="date" label="下单止" value={form.to}
              helperText=" " slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }}
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            />
            <Button size="small" variant="outlined" onClick={apply} sx={{ mb: 2.5 }}>查询</Button>
            <Button size="small" onClick={reset} sx={{ mb: 2.5 }}>重置</Button>
          </Stack>
        }
      />

      {metaQuery.error && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          状态机加载失败，状态名会显示成数字、操作按钮也无法判断是否可用。
          列表本身不受影响。
        </Alert>
      )}

      {detailSn && (
        <OrderDetailDialog
          orderSn={detailSn}
          defs={defs}
          transitionTable={metaQuery.data?.transitionTable ?? {}}
          onClose={() => setDetailSn(null)}
          onChanged={(msg) => {
            void qc.invalidateQueries({ queryKey: ['orders'] })
            void qc.invalidateQueries({ queryKey: ['order-detail', detailSn] })
            setToast({ msg, severity: 'success' })
          }}
          onError={(e) =>
            setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
          }
        />
      )}

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

interface DetailProps {
  orderSn: string
  defs: StatusDefinition[]
  transitionTable: Record<string, number[]>
  onClose: () => void
  onChanged: (msg: string) => void
  onError: (e: unknown) => void
}

/** 订单状态码，和后端 OrderStatus 对齐。 */
const S = { NEW: 0, PAYED: 1, SENT: 2, RECEIVED: 3, CLOSED: 4, SERVICING: 5, SERVICED: 6 }

function OrderDetailDialog({
  orderSn, defs, transitionTable, onClose, onChanged, onError,
}: DetailProps) {
  const [shipOpen, setShipOpen] = useState(false)
  const [afterSaleOpen, setAfterSaleOpen] = useState<'start' | 'finish' | null>(null)

  const detailQuery = useQuery({
    queryKey: ['order-detail', orderSn],
    queryFn: ({ signal }) => fetchOrderDetail(orderSn, signal),
  })

  const order = detailQuery.data?.order
  const status = order?.status ?? -1

  /**
   * 某个目标状态是不是合法的下一步 —— 以后端的迁移表为准。
   * 拿不到迁移表时一律返回 false：宁可按钮点不了，
   * 也不要让人点一个会被后端拒绝的按钮。
   */
  const canGoTo = (to: number) => (transitionTable[String(status)] ?? []).includes(to)

  const mut = (fn: () => Promise<unknown>, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => onChanged(msg),
    onError,
  })

  const receiveMutation = useMutation(mut(() => receiveOrder(orderSn), '已确认收货'))
  const completeMutation = useMutation(mut(() => completeOrder(orderSn), '订单已完成'))

  const busy =
    receiveMutation.isPending || completeMutation.isPending

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>
        订单 {orderSn}
        {order && (
          <Chip size="small" color={statusColor(status)} sx={{ ml: 1, height: 20 }}
            label={statusLabel(status, defs)} />
        )}
      </DialogTitle>
      <DialogContent dividers>
        {detailQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : detailQuery.error ? (
          <Alert severity="error">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '详情加载失败'}
          </Alert>
        ) : order ? (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: 1, alignItems: 'baseline' }}>
              <Typography variant="caption" color="text.secondary">收件人</Typography>
              <Typography variant="body2">
                {order.receiverName ?? '-'} {order.receiverPhone ?? ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">会员</Typography>
              <Typography variant="body2">{order.memberUsername ?? `#${order.memberId}`}</Typography>

              <Typography variant="caption" color="text.secondary">应付</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                ¥{Number(order.payAmount ?? 0).toFixed(2)}
                {order.freightAmount != null && Number(order.freightAmount) > 0 &&
                  `（含运费 ¥${Number(order.freightAmount).toFixed(2)}）`}
              </Typography>
              <Typography variant="caption" color="text.secondary">下单时间</Typography>
              <Typography variant="body2">{order.createTime ?? '-'}</Typography>

              <Typography variant="caption" color="text.secondary">物流</Typography>
              <Typography variant="body2" sx={{ gridColumn: 'span 3' }}>
                {order.deliverySn
                  ? `${order.deliveryCompany ?? ''} ${order.deliverySn}`
                  : '未发货'}
              </Typography>
            </Box>

            <Divider />
            <Typography variant="subtitle2">商品明细</Typography>
            {(detailQuery.data?.items ?? []).length === 0 ? (
              <Alert severity="warning" variant="outlined">
                这个订单没有明细行。订单和明细是分两张表存的，
                明细缺失说明下单流程在中途失败过 —— 值得去查一下。
              </Alert>
            ) : (
              <Stack spacing={1}>
                {(detailQuery.data?.items ?? []).map((it) => (
                  <Stack key={it.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar src={it.skuPic ?? undefined} variant="rounded"
                      sx={{ width: 40, height: 40, fontSize: 12 }}>
                      {(it.skuName ?? '?').slice(0, 1)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{it.skuName ?? `SKU #${it.skuId}`}</Typography>
                      {it.skuAttrsVals && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {it.skuAttrsVals}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      ¥{Number(it.skuPrice ?? 0).toFixed(2)} × {it.skuQuantity ?? 0}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}

            <Divider />
            <Typography variant="subtitle2">操作记录</Typography>
            {(detailQuery.data?.history ?? []).length === 0 ? (
              <Typography variant="caption" color="text.secondary">还没有操作记录</Typography>
            ) : (
              <Stack spacing={1}>
                {(detailQuery.data?.history ?? []).map((h) => (
                  <Box key={h.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="caption">{h.createTime}</Typography>
                      {h.orderStatus != null && (
                        <Chip size="small" variant="outlined" sx={{ height: 17, fontSize: 10 }}
                          label={statusLabel(h.orderStatus, defs)} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {h.operateMan ?? '系统'}
                      </Typography>
                    </Stack>
                    {h.note && <Typography variant="caption" component="div">{h.note}</Typography>}
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {/* 每个按钮的可用性都问后端的迁移表，不在前端另写一套规则 */}
        <Tooltip title={canGoTo(S.SENT) ? '' : '当前状态不允许发货'}>
          <span>
            <Button size="small" variant="contained" startIcon={<ShipIcon />}
              disabled={!canGoTo(S.SENT) || busy}
              onClick={() => setShipOpen(true)}>
              发货
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canGoTo(S.RECEIVED) ? '' : '当前状态不允许确认收货'}>
          <span>
            <Button size="small" disabled={!canGoTo(S.RECEIVED) || busy}
              onClick={() => receiveMutation.mutate()}>
              代客确认收货
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canGoTo(S.RECEIVED) ? '' : '当前状态不允许完成'}>
          <span>
            <Button size="small" disabled={!canGoTo(S.RECEIVED) || busy}
              onClick={() => completeMutation.mutate()}>
              完成
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canGoTo(S.SERVICING) ? '' : '当前状态不允许发起售后'}>
          <span>
            <Button size="small" color="warning" disabled={!canGoTo(S.SERVICING) || busy}
              onClick={() => setAfterSaleOpen('start')}>
              发起售后
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canGoTo(S.SERVICED) ? '' : '当前状态不允许结束售后'}>
          <span>
            <Button size="small" color="warning" disabled={!canGoTo(S.SERVICED) || busy}
              onClick={() => setAfterSaleOpen('finish')}>
              售后完成
            </Button>
          </span>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>

      {shipOpen && (
        <ShipDialog
          orderSn={orderSn}
          onCancel={() => setShipOpen(false)}
          onDone={() => { setShipOpen(false); onChanged('已发货') }}
          onError={onError}
        />
      )}
      {afterSaleOpen && (
        <AfterSaleDialog
          orderSn={orderSn}
          mode={afterSaleOpen}
          onCancel={() => setAfterSaleOpen(null)}
          onDone={(msg) => { setAfterSaleOpen(null); onChanged(msg) }}
          onError={onError}
        />
      )}
    </Dialog>
  )
}

function ShipDialog({
  orderSn, onCancel, onDone, onError,
}: {
  orderSn: string
  onCancel: () => void
  onDone: () => void
  onError: (e: unknown) => void
}) {
  const [company, setCompany] = useState('')
  const [sn, setSn] = useState('')

  const mutation = useMutation({
    mutationFn: () => shipOrder(orderSn, company.trim(), sn.trim()),
    onSuccess: onDone,
    onError,
  })

  const bad = company.trim() === '' || sn.trim() === ''

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onCancel}>
      <DialogTitle>发货</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="物流公司" fullWidth autoFocus value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <TextField
            label="运单号" fullWidth value={sn}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            onChange={(e) => setSn(e.target.value)}
          />
          <Alert severity="info" variant="outlined">
            两项都是必填。没有运单号的「已发货」对客服毫无用处 ——
            客户问「我的东西到哪了」时答不上来。
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={bad || mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? '提交中…' : '确认发货'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function AfterSaleDialog({
  orderSn, mode, onCancel, onDone, onError,
}: {
  orderSn: string
  mode: 'start' | 'finish'
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (e: unknown) => void
}) {
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'start'
        ? startAfterSale(orderSn, note.trim())
        : finishAfterSale(orderSn, note.trim()),
    onSuccess: () => onDone(mode === 'start' ? '已发起售后' : '售后已完成'),
    onError,
  })

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onCancel}>
      <DialogTitle>{mode === 'start' ? '发起售后' : '售后完成'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="说明" fullWidth multiline minRows={3} autoFocus value={note}
            helperText="会写进这个订单的操作记录，是之后追溯的唯一依据"
            onChange={(e) => setNote(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" color="warning"
          disabled={note.trim() === '' || mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? '提交中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
