import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Stack, TextField, MenuItem, Typography, Chip, Button, LinearProgress, Alert,
} from '@mui/material'
import { DataTable, type Col } from '@/components/DataTable'
import { fetchWareSkus, fetchWareInfos, type WareSku } from '@/api/ware'
import type { Id } from '@/api/types'

/**
 * 商品库存。
 *
 * 接口对照 BASELINE.md 的 ware-sku.vue（5 个）：
 * <pre>
 *   /ware/waresku/list      列表
 *   /ware/wareinfo/list     仓库筛选下拉
 *   /ware/waresku/info/{}   详情      ← 有意不用，list 已返回完整实体
 *   /ware/waresku/{}        新增/修改 ← 有意不做，见下
 *   /ware/waresku/delete    删除      ← 有意不做，见下
 * </pre>
 *
 * <h3>这一页刻意是只读的</h3>
 * 旧版有新增/修改/删除。但库存不是一个应该手工编辑的东西：
 * <ul>
 *   <li>入库走采购单（完成采购时 addStock，走的是相对增量、能防丢更新）</li>
 *   <li>出库走订单（下单锁库存、发货扣库存，有完整的锁定/解锁链路）</li>
 *   <li>手工改 stock 是<b>绝对赋值</b>，会直接盖掉并发进行中的那些增量 ——
 *       比如一边有订单在扣、一边有人在后台改数字，结果谁最后写谁说了算</li>
 * </ul>
 * 更要命的是 stockLocked：手工改 stock 不会同步 stockLocked，
 * 于是「可售 = stock - stockLocked」立刻算错，可能变成负数或者虚高。
 *
 * 所以这里只展示，不提供编辑入口。真要调整库存应该是一次
 * 有记录、有原因的<b>库存调整</b>操作，而不是让人直接改一个数字 ——
 * 那个功能后端目前没有，缺了它比给一个危险的输入框好。
 */
export default function WareSkuPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [wareId, setWareId] = useState<Id>('')
  const [skuIdInput, setSkuIdInput] = useState('')
  const [skuId, setSkuId] = useState<Id>('')

  const listQuery = useQuery({
    queryKey: ['ware-skus', page, pageSize, wareId, skuId],
    queryFn: ({ signal }) =>
      fetchWareSkus(
        { page, limit: pageSize, wareId: wareId || undefined, skuId: skuId || undefined },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const wareQuery = useQuery({
    queryKey: ['ware-infos-all'],
    queryFn: ({ signal }) => fetchWareInfos({ page: 1, limit: 200 }, signal),
    staleTime: 5 * 60 * 1000,
  })

  const wareName = useMemo(() => {
    const m = new Map<Id, string>()
    for (const w of wareQuery.data?.list ?? []) m.set(w.id, w.name)
    return m
  }, [wareQuery.data])

  const columns = useMemo<Col<WareSku>[]>(() => [
    {
      id: 'sku',
      header: '商品',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="body2" noWrap>{row.original.skuName}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            SKU #{row.original.skuId}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'ware',
      header: '仓库',
      meta: { width: 120 },
      // 名字没加载出来时显示 #id 而不是空白 —— 空白会被当成「没有仓库」
      cell: ({ row }) => wareName.get(row.original.wareId) ?? `#${row.original.wareId}`,
    },
    {
      accessorKey: 'stock',
      header: '总库存',
      meta: { width: 90, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.original.stock}
        </Typography>
      ),
    },
    {
      accessorKey: 'stockLocked',
      header: '已锁定',
      meta: { width: 90, align: 'right' },
      cell: ({ row }) => (
        <Typography
          variant="body2"
          color={row.original.stockLocked > 0 ? 'warning.main' : 'text.secondary'}
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.original.stockLocked}
        </Typography>
      ),
    },
    {
      id: 'available',
      header: '可售',
      meta: { width: 140, align: 'right' },
      cell: ({ row }) => {
        const { stock, stockLocked } = row.original
        const available = stock - stockLocked
        const pct = stock > 0 ? Math.max(0, Math.min(100, (available / stock) * 100)) : 0
        return (
          <Box sx={{ minWidth: 120 }}>
            <Typography
              variant="body2"
              // 可售为负说明锁定量超过了总库存 —— 那是数据不一致，不是「卖光了」，
              // 必须显眼，否则会被当成正常的缺货。
              color={available < 0 ? 'error.main' : available === 0 ? 'text.secondary' : 'text.primary'}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {available}
              {available < 0 && ' ⚠'}
            </Typography>
            <LinearProgress
              variant="determinate" value={pct}
              color={available < 0 ? 'error' : available === 0 ? 'inherit' : 'primary'}
              sx={{ height: 4, borderRadius: 2, mt: 0.25 }}
            />
          </Box>
        )
      },
    },
  ], [wareName])

  const applySkuFilter = () => { setSkuId(skuIdInput.trim()); setPage(1) }

  const negatives = (listQuery.data?.list ?? []).filter((r) => r.stock - r.stockLocked < 0).length

  return (
    <Box sx={{ p: 2 }}>
      {negatives > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          本页有 <b>{negatives}</b> 条记录的可售数量为负 —— 锁定量超过了总库存。
          这是数据不一致（通常是锁定后没有正确解锁），不是「卖光了」。
        </Alert>
      )}

      <DataTable<WareSku>
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
        emptyText={skuId || wareId ? '没有符合条件的库存记录' : '还没有库存记录'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              select size="small" label="仓库" value={wareId}
              onChange={(e) => { setWareId(e.target.value); setPage(1) }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">全部仓库</MenuItem>
              {(wareQuery.data?.list ?? []).map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" label="SKU ID" value={skuIdInput}
              onChange={(e) => setSkuIdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySkuFilter() }}
              sx={{ width: 200 }}
            />
            <Button size="small" variant="outlined" onClick={applySkuFilter}>查询</Button>
            {(skuId || wareId) && (
              <Button size="small" onClick={() => {
                setSkuIdInput(''); setSkuId(''); setWareId(''); setPage(1)
              }}>
                重置
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Chip
              size="small" variant="outlined" label="只读"
              title="库存由采购入库和订单出入库驱动，不提供手工编辑"
            />
          </Stack>
        }
      />

      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        <b>这一页只读。</b>入库走采购单，出库走订单 —— 两条路径都是相对增量、
        并且会同步维护锁定量。手工改库存是绝对赋值，会盖掉并发进行中的增量，
        而且不会同步 <code>stockLocked</code>，「可售」立刻算错。
        需要调账时应该是一次有记录、有原因的库存调整操作，那个功能后端目前还没有。
      </Alert>
    </Box>
  )
}
