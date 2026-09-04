import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, Typography, Chip, IconButton, Tooltip, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { DataTable, type Col } from '@/components/DataTable'
import { SkuPicker } from '@/features/seckill/SkuPicker'
import {
  fetchSeckillRelations, fetchSeckillSessions, saveSeckill, activateSeckill,
  deleteSeckillRelations, toBackendTime,
  type SeckillRelation, type SeckillSession,
} from '@/api/seckill'
import { fetchSkus, type Sku } from '@/api/product'
import type { Id } from '@/api/types'

/**
 * 秒杀活动。
 *
 * <h3>这一页没有旧版可对照</h3>
 * 旧后台里秒杀只有 sku 页上的一个对话框，没有独立入口。
 * 后端的编排接口（POST /coupon/seckill/scheduler/save）是 2026-09-03 才补的，
 * 菜单项也是同一天加的。所以这一页是照后端能力设计的，不是照旧页面翻译的。
 *
 * <h3>配置和上线是两步，这是刻意的</h3>
 * 保存只写数据库；真实库存在 Redis，要再点一次「激活」才开卖。
 * 合成一步的话，配置的瞬间就开卖了 —— 场次还没到就能抢。
 *
 * <h3>「已上线」这一列刻意没有</h3>
 * 上线状态的真相是 Redis 里有没有 seckill:stock:{id} 这个键，
 * 而列表接口不返回它。与其显示一个<b>猜的</b>状态（比如按场次时间推断），
 * 不如不显示 —— 显示错的状态比不显示更糟：
 * 管理员会据此决定要不要点激活，而对已上线的活动点激活会导致超卖。
 * 后端会拦住那种情况并说明原因，界面把原因原样显示出来。
 */
export default function SeckillPage() {
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SeckillRelation | null>(null)
  const [confirmActivate, setConfirmActivate] = useState<SeckillRelation | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['seckill-relations', page, pageSize],
    queryFn: ({ signal }) => fetchSeckillRelations({ page, limit: pageSize }, signal),
    placeholderData: (prev) => prev,
  })

  // 场次单独拉一次，用来把 promotionSessionId 翻成「起止时间」。
  // 列表接口只给 id，而管理员真正关心的是这场什么时候开。
  const sessionQuery = useQuery({
    queryKey: ['seckill-sessions-all'],
    queryFn: ({ signal }) => fetchSeckillSessions({ page: 1, limit: 200 }, signal),
    staleTime: 60 * 1000,
  })

  const sessionById = useMemo(() => {
    const m = new Map<Id, SeckillSession>()
    for (const s of sessionQuery.data?.list ?? []) m.set(s.id, s)
    return m
  }, [sessionQuery.data])

  // 当前这一页涉及到的 SKU 名字。只查这一页用到的，不做全量。
  const skuIds = useMemo(
    () => (listQuery.data?.list ?? []).map((r) => r.skuId),
    [listQuery.data]
  )
  const skuQuery = useQuery({
    queryKey: ['seckill-sku-names', skuIds.join(',')],
    queryFn: async ({ signal }) => {
      const m = new Map<Id, string>()
      // 一条条查会变成一页 N 次请求。这里按 skuId 逐个查是唯一可行的方式
      // （skuinfo/list 的 key 是模糊匹配，没有「按 id 批量取」的接口），
      // 所以并发发出去而不是串行等 —— 一页 10~20 条，可以接受。
      await Promise.all(
        [...new Set(skuIds)].map(async (id) => {
          try {
            const p = await fetchSkus({ page: 1, limit: 1, key: id }, signal)
            const hit = p.list[0]
            if (hit) m.set(id, hit.skuName)
          } catch {
            // 单个失败不该让整页的名字都没了，静默跳过、显示 #id
          }
        })
      )
      return m
    },
    enabled: skuIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['seckill-relations'] })
    void qc.invalidateQueries({ queryKey: ['seckill-sessions-all'] })
  }

  const activateMutation = useMutation({
    mutationFn: (r: SeckillRelation) => activateSeckill(r.id),
    onSuccess: () => {
      setConfirmActivate(null)
      setToast({ msg: '已激活，库存已放入 Redis，前台可以开抢', severity: 'success' })
      refresh()
    },
    onError: (e) => { setConfirmActivate(null); onError(e) },
  })

  const deleteMutation = useMutation({
    mutationFn: (r: SeckillRelation) => deleteSeckillRelations([r.id]),
    onSuccess: () => {
      setConfirmDelete(null)
      setToast({ msg: '已删除', severity: 'success' })
      refresh()
    },
    onError,
  })

  const columns = useMemo<Col<SeckillRelation>[]>(() => [
    {
      id: 'sku',
      header: '秒杀商品',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 300 }}>
          <Typography variant="body2" noWrap>
            {skuQuery.data?.get(row.original.skuId) ?? `SKU #${row.original.skuId}`}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            #{row.original.skuId}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'session',
      header: '场次时间',
      meta: { width: 200 },
      cell: ({ row }) => {
        const s = sessionById.get(row.original.promotionSessionId)
        if (!s) {
          return (
            <Typography variant="caption" color="warning.main">
              找不到场次 #{row.original.promotionSessionId}
            </Typography>
          )
        }
        const now = Date.now()
        // 时间字符串是 "yyyy-MM-dd HH:mm:ss"，Safari 不认这种带空格的格式，
        // 换成 T 之后 new Date 在各浏览器上行为一致。
        const start = new Date(s.startTime.replace(' ', 'T')).getTime()
        const end = new Date(s.endTime.replace(' ', 'T')).getTime()
        const phase = now < start ? '未开始' : now > end ? '已结束' : '进行中'
        const color = phase === '进行中' ? 'success' : phase === '未开始' ? 'info' : 'default'
        return (
          <Box>
            <Typography variant="caption" component="div">{s.startTime}</Typography>
            <Typography variant="caption" component="div" color="text.secondary">
              至 {s.endTime}
            </Typography>
            <Chip size="small" color={color} label={phase} sx={{ height: 18, fontSize: 11, mt: 0.25 }} />
          </Box>
        )
      },
    },
    {
      id: 'seckillPrice',
      header: '秒杀价',
      meta: { width: 100, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          ¥{Number(row.original.seckillPrice).toFixed(2)}
        </Typography>
      ),
    },
    {
      id: 'stock',
      header: '总量 / 已售',
      meta: { width: 120, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.original.seckillCount} / {row.original.soldCount}
        </Typography>
      ),
    },
    {
      accessorKey: 'seckillLimit',
      header: '每人限购',
      meta: { width: 90, align: 'right' },
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 100, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="激活（把库存放进 Redis，开卖）">
            <IconButton size="small" color="primary" onClick={() => setConfirmActivate(row.original)}>
              <BoltIcon fontSize="small" />
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
  ], [sessionById, skuQuery.data])

  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        <b>配置和上线是两步。</b>保存只写数据库；真实库存在 Redis，要点「激活」才开卖。
        列表里<b>看不到「是否已上线」</b>—— 那个状态的真相在 Redis 里，接口不返回，
        显示一个猜的状态会误导人去点激活，而对已上线的活动点激活会导致超卖。
      </Alert>

      <DataTable<SeckillRelation>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(r) => r.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="还没有配置秒杀"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              共 {listQuery.data?.totalCount ?? 0} 条秒杀配置
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => setCreating(true)}>
              新建秒杀
            </Button>
          </Stack>
        }
      />

      {creating && (
        <SeckillForm
          onCancel={() => setCreating(false)}
          onDone={(msg, severity) => { setCreating(false); setToast({ msg, severity }); refresh() }}
        />
      )}

      <Dialog open={!!confirmActivate} onClose={() => setConfirmActivate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>激活秒杀</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            将把 <b>{confirmActivate?.seckillCount}</b> 件库存写入 Redis，前台即可开抢。
          </Typography>
          <Alert severity="warning" variant="outlined">
            如果这场秒杀<b>已经在进行中</b>，后端会拒绝这次操作 —— 因为激活做的是
            <b>重置</b>：库存回满、清空每人限购记录，已经抢中的人可以再抢一次，会直接超卖。
            确实要重来一轮请走运维通道。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmActivate(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={activateMutation.isPending}
            onClick={() => confirmActivate && activateMutation.mutate(confirmActivate)}
          >
            {activateMutation.isPending ? '激活中…' : '激活'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除秒杀配置</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            删除 SKU #{confirmDelete?.skuId} 的秒杀配置。
          </Typography>
          <Alert severity="warning" variant="outlined">
            删除只清掉数据库里的配置，<b>不会撤掉 Redis 里已经放出去的库存</b>。
            如果这场正在进行，前台仍然能继续抢，直到库存耗尽或场次结束。
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

interface FormProps {
  onCancel: () => void
  onDone: (msg: string, severity: 'success' | 'info') => void
}

/**
 * 新建秒杀配置。
 *
 * 校验规则和后端一致（SeckillSchedulerServiceImpl 里那一串），
 * 在前端拦一道是为了给出<b>具体是哪一项</b>不对 ——
 * 后端返回的是 code≠0 加一句话，够用但要读文字。
 */
function SeckillForm({ onCancel, onDone }: FormProps) {
  const [sku, setSku] = useState<Sku | null>(null)
  const [form, setForm] = useState({
    startTime: '', endTime: '',
    seckillPrice: '', seckillCount: '', seckillLimit: '1', seckillSort: '0',
  })
  const [error, setError] = useState<string | null>(null)

  const num = (v: string) => Number(v)
  const problems: string[] = []
  if (!sku) problems.push('请选择秒杀商品')
  if (!form.startTime) problems.push('请填开始时间')
  if (!form.endTime) problems.push('请填结束时间')
  if (form.startTime && form.endTime && form.endTime <= form.startTime)
    problems.push('结束时间必须晚于开始时间')
  if (!(num(form.seckillPrice) > 0)) problems.push('秒杀价必须大于 0')
  if (!(num(form.seckillCount) > 0)) problems.push('秒杀总量必须大于 0')
  if (!(num(form.seckillLimit) > 0)) problems.push('每人限购必须大于 0')
  if (num(form.seckillLimit) > num(form.seckillCount))
    problems.push('每人限购不能大于秒杀总量')
  // 秒杀价高于原价不是错误（后端也不拦），但几乎肯定是填错了，所以提示而不是阻止。
  const priceWarning =
    sku && num(form.seckillPrice) > 0 && num(form.seckillPrice) >= Number(sku.price)

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSeckill({
        skuId: sku!.skuId,
        startTime: toBackendTime(form.startTime),
        endTime: toBackendTime(form.endTime),
        seckillPrice: num(form.seckillPrice),
        seckillCount: num(form.seckillCount),
        seckillLimit: num(form.seckillLimit),
        seckillSort: num(form.seckillSort) || 0,
      }),
    onSuccess: () =>
      // 刻意不自动激活。保存完就开卖等于绕过「配置和上线分两步」这个设计。
      onDone('秒杀配置已保存。还没有上线 —— 在活动开始前点列表里的「激活」才会开卖。', 'info'),
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  })

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>新建秒杀</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <SkuPicker value={sku} onChange={setSku} />

          <Stack direction="row" spacing={2}>
            <TextField
              label="开始时间" type="datetime-local" fullWidth
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="结束时间" type="datetime-local" fullWidth
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="秒杀价" fullWidth value={form.seckillPrice}
              helperText={sku ? `原价 ¥${Number(sku.price).toFixed(2)}` : ' '}
              onChange={(e) => setForm((f) => ({ ...f, seckillPrice: e.target.value }))}
            />
            <TextField
              label="秒杀总量" fullWidth value={form.seckillCount}
              onChange={(e) => setForm((f) => ({ ...f, seckillCount: e.target.value }))}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="每人限购" fullWidth value={form.seckillLimit}
              onChange={(e) => setForm((f) => ({ ...f, seckillLimit: e.target.value }))}
            />
            <TextField
              label="排序" fullWidth value={form.seckillSort}
              helperText="数字越小越靠前"
              onChange={(e) => setForm((f) => ({ ...f, seckillSort: e.target.value }))}
            />
          </Stack>

          {priceWarning && (
            <Alert severity="warning" variant="outlined">
              秒杀价不低于原价（¥{Number(sku!.price).toFixed(2)}）。
              后端不拦这种情况，但这通常是填错了。
            </Alert>
          )}

          {problems.length > 0 && (
            <Alert severity="info" variant="outlined">
              还差这些：{problems.join('、')}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info" variant="outlined">
            <b>同一个时间段会复用同一个场次。</b>已经有起止时间完全相同的场次时，
            这个 SKU 会挂到那个场次下，而不是新建一个 —— 否则前台按场次分组的秒杀页
            会把本该在一起的商品拆成好几组。
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          disabled={problems.length > 0 || saveMutation.isPending}
          onClick={() => { setError(null); saveMutation.mutate() }}
        >
          {saveMutation.isPending ? '保存中…' : '保存（不上线）'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
