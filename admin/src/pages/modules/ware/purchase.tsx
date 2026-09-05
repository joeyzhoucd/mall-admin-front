import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Checkbox,
  List, ListItem, ListItemText, Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AssignIcon from '@mui/icons-material/PersonAdd'
import DoneIcon from '@mui/icons-material/DoneAll'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchPurchases, deletePurchases, assignPurchase, finishPurchase,
  fetchPurchaseDetails,
  PURCHASE_STATUS, PURCHASE_STATUS_TEXT,
  type Purchase,
} from '@/api/ware'
import { fetchSysUsers } from '@/api/sys'
import type { Id } from '@/api/types'

/**
 * 采购单。
 *
 * 接口对照 BASELINE.md 的 purchase.vue（8 个）：
 * <pre>
 *   /ware/purchase/list      列表
 *   /ware/purchase/save      新增        ← 有意不做，见下
 *   /ware/purchase/update    修改        ← 有意不做，见下
 *   /ware/purchase/delete    批量删除
 *   /ware/purchase/assign    分配采购员
 *   /ware/purchase/receive   领取        ← 有意不做，见下
 *   /ware/purchase/finish    完成采购（会真的入库）
 *   /sys/user/list           分配时选人
 * </pre>
 *
 * <h3>save / update / receive 有意不做</h3>
 * <ul>
 *   <li><b>save / update</b>：采购单不该在这一页手工新建。它的正常来源是
 *       「采购需求页选中若干条 → 合并成一张采购单」，那条路会同时把明细挂上去。
 *       在这里凭空建一张没有明细的空采购单，除了制造脏数据没有别的用处。</li>
 *   <li><b>receive（领取）</b>：领取是<b>采购员自己</b>在采购端做的动作
 *       （receiverId/receiverName 是操作人自己）。在管理后台代替别人「领取」，
 *       会把这张单子的责任人写成管理员，采购员那边反而看不到自己的单子。</li>
 * </ul>
 *
 * <h3>「完成采购」会真的往仓库加库存</h3>
 * 所以要选明细、要二次确认。2026-09-05 之前后端不检查明细是否已完成过，
 * 调两次库存就加两遍；现在会跳过已完成的明细
 * （PurchaseFinishIdempotencyTest 守着），但界面上仍然防重复提交 ——
 * 依赖后端兜底不等于可以随便点。
 */
export default function PurchasePage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<{ key: string; status: string }>({ key: '', status: '' })

  const [assigning, setAssigning] = useState<Purchase | null>(null)
  const [finishing, setFinishing] = useState<Purchase | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Purchase | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['purchases', page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchPurchases(
        {
          page, limit: pageSize,
          key: filters.key || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['purchases'] })
    void qc.invalidateQueries({ queryKey: ['purchase-details'] })
    // 完成采购会改库存
    void qc.invalidateQueries({ queryKey: ['ware-skus'] })
    setToast({ msg, severity: 'success' })
  }

  const deleteMutation = useMutation({
    mutationFn: (p: Purchase) => deletePurchases([p.id]),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })

  const columns = useMemo<Col<Purchase>[]>(() => [
    { accessorKey: 'id', header: '单号', meta: { width: 100 } },
    {
      id: 'assignee',
      header: '采购员',
      meta: { width: 150 },
      cell: ({ row }) =>
        row.original.assigneeName ? (
          <Box>
            <Typography variant="body2">{row.original.assigneeName}</Typography>
            {row.original.phone && (
              <Typography variant="caption" color="text.secondary" component="div">
                {row.original.phone}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">未分配</Typography>
        ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 90, align: 'center' },
      cell: ({ row }) => {
        const s = row.original.status
        const color =
          s === PURCHASE_STATUS.FINISHED ? 'success'
            : s === PURCHASE_STATUS.HAS_ERROR ? 'error'
              : s === PURCHASE_STATUS.CREATED ? 'default' : 'info'
        return (
          <Chip size="small" color={color} variant={color === 'default' ? 'outlined' : 'filled'}
            label={PURCHASE_STATUS_TEXT[s] ?? `未知(${s})`} sx={{ height: 20 }} />
        )
      },
    },
    {
      accessorKey: 'priority',
      header: '优先级',
      meta: { width: 80, align: 'right' },
      cell: ({ row }) => row.original.priority ?? '-',
    },
    {
      accessorKey: 'amount',
      header: '金额',
      meta: { width: 100, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.original.amount == null ? '-' : `¥${Number(row.original.amount).toFixed(2)}`}
        </Typography>
      ),
    },
    {
      accessorKey: 'createTime',
      header: '创建时间',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Typography variant="caption">{row.original.createTime ?? '-'}</Typography>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 110, align: 'center' },
      cell: ({ row }) => {
        const p = row.original
        const done = p.status === PURCHASE_STATUS.FINISHED
        return (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            <Tooltip title={done ? '已完成，不能再分配' : '分配采购员'}>
              <span>
                <IconButton size="small" disabled={done} onClick={() => setAssigning(p)}>
                  <AssignIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={done ? '已完成' : '完成采购（会入库）'}>
              <span>
                <IconButton size="small" color="primary" disabled={done}
                  onClick={() => setFinishing(p)}>
                  <DoneIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => setConfirmDelete(p)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [])

  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        采购单由<b>采购需求页</b>合并生成，这里不提供手工新建。
        「领取」是采购员在自己那端做的动作，后台代领会把责任人写成管理员，所以也没有放出来。
      </Alert>

      <DataTable<Purchase>
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(p) => p.id}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="还没有采购单 —— 去「采购需求」页把需求合并成采购单"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small" placeholder="按单号 / 采购员搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setFilters((f) => ({ ...f, key: keyword.trim() })); setPage(1) }
              }}
              sx={{ width: 220 }}
            />
            <TextField
              select size="small" label="状态" value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">全部状态</MenuItem>
              {Object.entries(PURCHASE_STATUS_TEXT).map(([v, t]) => (
                <MenuItem key={v} value={v}>{t}</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="outlined"
              onClick={() => { setFilters((f) => ({ ...f, key: keyword.trim() })); setPage(1) }}>
              查询
            </Button>
            <Button size="small" onClick={() => {
              setKeyword(''); setFilters({ key: '', status: '' }); setPage(1)
            }}>
              重置
            </Button>
          </Stack>
        }
      />

      {assigning && (
        <AssignDialog
          purchase={assigning}
          onCancel={() => setAssigning(null)}
          onDone={() => { setAssigning(null); afterWrite('已分配') }}
          onError={onError}
        />
      )}

      {finishing && (
        <FinishDialog
          purchase={finishing}
          onCancel={() => setFinishing(null)}
          onDone={(msg) => { setFinishing(null); afterWrite(msg) }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除采购单</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>删除采购单 #{confirmDelete?.id}。</Typography>
          <Alert severity="warning" variant="outlined">
            挂在这张单子下的采购需求<b>不会</b>被一并删除，它们的 purchaseId 会指向
            一张已不存在的单子 —— 在采购需求页里仍然显示「已分配」，但点进去找不到单子。
            {confirmDelete?.status === PURCHASE_STATUS.FINISHED &&
              ' 这张单子已经完成入库，删掉它不会把库存退回去。'}
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

/** 分配采购员。四个字段后端都会取，缺一个会被 String.valueOf(null) 变成字面量 "null"。 */
function AssignDialog({
  purchase, onCancel, onDone, onError,
}: {
  purchase: Purchase
  onCancel: () => void
  onDone: () => void
  onError: (e: unknown) => void
}) {
  const [userId, setUserId] = useState<Id>('')
  const [phone, setPhone] = useState('')

  const usersQuery = useQuery({
    queryKey: ['sys-users-all'],
    queryFn: ({ signal }) => fetchSysUsers({ page: 1, limit: 200 }, signal),
    staleTime: 5 * 60 * 1000,
  })

  const picked = (usersQuery.data?.list ?? []).find((u) => u.userId === userId)

  const mutation = useMutation({
    mutationFn: () =>
      assignPurchase(purchase.id, userId, picked?.username ?? '', phone.trim() || picked?.mobile || ''),
    onSuccess: onDone,
    onError,
  })

  return (
    <Dialog open fullWidth maxWidth="xs" onClose={onCancel}>
      <DialogTitle>分配采购员 · 单号 {purchase.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select label="采购员" fullWidth value={userId}
            onChange={(e) => {
              setUserId(e.target.value)
              // 自动带出该用户的手机号，仍然允许改 —— 采购联系方式可能和账号里的不同
              const u = (usersQuery.data?.list ?? []).find((x) => x.userId === e.target.value)
              if (u?.mobile) setPhone(u.mobile)
            }}
            helperText={usersQuery.error ? '用户列表加载失败' : ' '}
            error={!!usersQuery.error}
          >
            {(usersQuery.data?.list ?? []).map((u) => (
              <MenuItem key={u.userId} value={u.userId}>
                {u.username}{u.mobile ? ` · ${u.mobile}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="联系电话" fullWidth value={phone}
            onChange={(e) => setPhone(e.target.value)}
            // JSX 属性里不支持反斜杠转义，引号要走表达式
            helperText={'后端必填 —— 留空会被 String.valueOf(null) 存成字面量 "null"'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained"
          disabled={!userId || !phone.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? '分配中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * 完成采购。逐条明细标记成功/失败。
 *
 * 成功的明细会入库；失败的不会。
 * 采购单最终状态：有任何失败明细就是「有异常」，否则「已完成」。
 */
function FinishDialog({
  purchase, onCancel, onDone, onError,
}: {
  purchase: Purchase
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (e: unknown) => void
}) {
  // failed 里放的是被标记为「采购失败」的明细 id，其余视为成功。
  // 默认全部成功 —— 绝大多数情况是全部到货。
  const [failed, setFailed] = useState<Set<Id>>(new Set())

  const detailQuery = useQuery({
    queryKey: ['purchase-details', 'of-purchase', purchase.id],
    queryFn: ({ signal }) =>
      fetchPurchaseDetails({ page: 1, limit: 500, key: String(purchase.id) }, signal),
  })

  // 后端的 key 是模糊匹配，可能带回别的单子的明细，所以在这里再过滤一次。
  // 不过滤的话会把别人的明细一起提交上去 —— 后端现在会按 purchaseId 拒绝，
  // 但让界面提交明知不属于这张单子的 id 本身就是错的。
  const details = useMemo(
    () => (detailQuery.data?.list ?? []).filter((d) => String(d.purchaseId) === String(purchase.id)),
    [detailQuery.data, purchase.id]
  )

  const alreadyDone = details.filter((d) => d.status === 3)
  const actionable = details.filter((d) => d.status !== 3)

  const mutation = useMutation({
    mutationFn: () => {
      const failedIds = actionable.filter((d) => failed.has(d.id)).map((d) => d.id)
      const successIds = actionable.filter((d) => !failed.has(d.id)).map((d) => d.id)
      return finishPurchase(purchase.id, successIds, failedIds)
    },
    onSuccess: () => {
      const n = actionable.filter((d) => !failed.has(d.id)).length
      onDone(`已完成采购，${n} 条明细入库`)
    },
    onError,
  })

  const toggle = (id: Id) =>
    setFailed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>完成采购 · 单号 {purchase.id}</DialogTitle>
      <DialogContent dividers>
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">加载明细中…</Typography>
        ) : details.length === 0 ? (
          <Alert severity="warning">
            这张采购单下没有明细。完成它只会把状态改成「已完成」，不会入库任何商品。
          </Alert>
        ) : (
          <>
            <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
              <b>这一步会真的往仓库加库存。</b>勾选的明细视为<b>采购失败</b>，不入库；
              未勾选的视为到货，按数量入库。
              有任何失败明细时，采购单最终状态是「有异常」。
            </Alert>

            {alreadyDone.length > 0 && (
              <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
                其中 {alreadyDone.length} 条明细<b>已经完成入库</b>，不会重复处理。
              </Alert>
            )}

            <List dense>
              {actionable.map((d) => (
                <ListItem key={d.id} disablePadding>
                  <Checkbox
                    size="small" checked={failed.has(d.id)} onChange={() => toggle(d.id)}
                  />
                  <ListItemText
                    primary={`SKU #${d.skuId} × ${d.skuNum}`}
                    secondary={
                      failed.has(d.id)
                        ? '标记为采购失败 —— 不入库'
                        : `到货入库 ${d.skuNum} 件`
                    }
                    slotProps={{
                      secondary: {
                        variant: 'caption',
                        color: failed.has(d.id) ? 'error' : 'text.secondary',
                      },
                    }}
                  />
                </ListItem>
              ))}
            </List>

            {alreadyDone.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  已完成（不可再操作）：{alreadyDone.map((d) => `#${d.skuId}`).join('、')}
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          // 禁用而不是靠后端拦：后端确实会跳过已完成的明细，
          // 但界面上能连点两次这件事本身就该在前端解决。
          disabled={mutation.isPending || detailQuery.isLoading}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? '处理中…' : `完成并入库（${actionable.length - failed.size} 条）`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
