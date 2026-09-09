import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, LinearProgress,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchCoupons, fetchCouponHistories, saveCoupon, updateCoupon, deleteCoupons,
  claimedRatio, couponState,
  type Coupon, type CouponDraft, type CouponHistory,
} from '@/api/coupon'
import type { Id } from '@/api/types'

/**
 * 优惠券管理。
 *
 * <pre>
 *   GET  /coupon/coupon/list          列表
 *   GET  /coupon/coupon/info/{id}     详情
 *   POST /coupon/coupon/save          新建（2026-09-08 新补）
 *   POST /coupon/coupon/update        修改（2026-09-08 新补）
 *   POST /coupon/coupon/delete        删除（2026-09-08 新补）
 *   GET  /coupon/couponhistory/list   领券记录
 * </pre>
 * save/update/delete/info 此前<b>不存在</b> —— CouponController 上只有 /list、
 * 一个 /placeholder 和一个返回硬编码假券的 /member/list，
 * 也就是后台根本不能建券。和会员、订单那两次是同一个情况。
 *
 * <h3>「已领 / 已用」两列是只读的，表单里没有它们</h3>
 * 它们是运行时计数，只由领券和用券流程推进。
 * 让它们可编辑会造成超发：编辑表单是"GET 详情 → 改字段 → POST 回来"，
 * 请求体里的 receiveCount 是打开表单那一刻的旧值，写回去等于把上限撑开。
 * 后端在 update 时会把这两列置空（MyBatis-Plus 因此跳过它们），
 * 有 CouponAdminWriteGuardTest 钉着。
 *
 * <h3>两类券后端会拒绝创建，界面上提前说明原因</h3>
 * 会员等级限制和指定分类/商品的适用范围<b>都还没实现</b>
 * （等级体系不存在；订单明细不写 spu_id / category_id）。
 * 提交时后端会带原因拒绝，所以表单里直接把这两项锁死并写上理由 ——
 * 让运营在填的时候就知道，而不是点了保存才看到一段报错。
 */

const EMPTY_DRAFT: CouponDraft = {
  couponType: 0,
  couponName: '',
  couponImg: null,
  amount: '',
  minPoint: '0',
  perLimit: 1,
  publishCount: 100,
  startTime: null,
  endTime: null,
  enableStartTime: null,
  enableEndTime: null,
  useType: 0,
  memberLevel: 0,
  publish: 0,
  code: null,
  note: null,
}

/** `2026-09-08 12:00:00` ⇄ `2026-09-08T12:00`（datetime-local 要后一种）。 */
function toInputValue(v: string | null | undefined): string {
  if (!v) return ''
  return String(v).replace(' ', 'T').slice(0, 16)
}
function fromInputValue(v: string): string | null {
  if (!v) return null
  return v.replace('T', ' ') + ':00'
}

function stateColor(state: string): 'success' | 'warning' | 'default' | 'error' {
  switch (state) {
    case '可领取': return 'success'
    case '已领完': return 'warning'
    case '未发布': return 'default'
    default: return 'error'
  }
}

export default function CouponPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<{ id: Id | null; draft: CouponDraft } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [historyOf, setHistoryOf] = useState<Coupon | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null)

  const listQuery = useQuery({
    queryKey: ['coupons', page, pageSize],
    queryFn: ({ signal }) => fetchCoupons({ page, limit: pageSize }, signal),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: { id: Id | null; draft: CouponDraft }) =>
      payload.id ? updateCoupon(payload.id, payload.draft) : saveCoupon(payload.draft),
    onSuccess: (res) => {
      // 后端用 code != 0 表达业务拒绝（校验失败、发行量小于已领量…），
      // HTTP 仍然是 200。不看 code 就会把拒绝当成成功，对话框关掉、
      // 列表没变，而用户以为保存了 —— 这是这个后台里最常见的那种静默失败。
      if (res.code !== 0) {
        setFormError(res.msg ?? '保存被拒绝')
        return
      }
      setFormError(null)
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['coupons'] })
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : '保存失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: Id) => deleteCoupons([id]),
    onSuccess: (res) => {
      if (res.code !== 0) {
        setFormError(res.msg ?? '删除被拒绝')
        return
      }
      setConfirmDelete(null)
      void qc.invalidateQueries({ queryKey: ['coupons'] })
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : '删除失败'),
  })

  const columns = useMemo<Col<Coupon>[]>(() => [
    {
      id: 'name',
      header: '优惠券',
      meta: { width: 260 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.original.couponName ?? '(未命名)'}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            减 ¥{row.original.amount ?? 0}
            {Number(row.original.minPoint ?? 0) > 0
              ? `，满 ¥${row.original.minPoint} 可用`
              : '，无门槛'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'state',
      header: '状态',
      meta: { width: 110 },
      cell: ({ row }) => {
        const s = couponState(row.original)
        return <Chip size="small" label={s} color={stateColor(s)} />
      },
    },
    {
      id: 'claimed',
      header: '已领 / 发行',
      meta: { width: 180 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">
            {row.original.receiveCount ?? 0} / {row.original.publishCount ?? 0}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={claimedRatio(row.original) * 100}
            sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
          />
        </Box>
      ),
    },
    { accessorKey: 'useCount', header: '已使用', meta: { width: 90, align: 'right' } },
    { accessorKey: 'perLimit', header: '每人限领', meta: { width: 90, align: 'right' } },
    {
      id: 'window',
      header: '领取窗口',
      meta: { width: 220 },
      cell: ({ row }) => (
        <Typography variant="caption" color="text.secondary">
          {(row.original.enableStartTime ?? '—').slice(0, 16)}
          {' ~ '}
          {(row.original.enableEndTime ?? '—').slice(0, 16)}
        </Typography>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 140, align: 'center' },
      cell: ({ row }) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
          <Tooltip title="领券记录">
            <IconButton size="small" onClick={() => setHistoryOf(row.original)}>
              <ReceiptLongIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="编辑">
            <IconButton
              size="small"
              onClick={() => {
                setFormError(null)
                // 用列表里这一行的数据开表单，而不是再 GET 一次详情。
                // 【注意】receiveCount / useCount 刻意不进 draft ——
                // 它们不该被提交回去，见文件头注释。
                const c = row.original
                setEditing({
                  id: c.id,
                  draft: {
                    couponType: c.couponType ?? 0,
                    couponName: c.couponName ?? '',
                    couponImg: c.couponImg,
                    amount: c.amount ?? '',
                    minPoint: c.minPoint ?? '0',
                    perLimit: c.perLimit ?? 1,
                    publishCount: c.publishCount ?? 0,
                    startTime: c.startTime,
                    endTime: c.endTime,
                    enableStartTime: c.enableStartTime,
                    enableEndTime: c.enableEndTime,
                    useType: c.useType ?? 0,
                    memberLevel: c.memberLevel ?? 0,
                    publish: c.publish ?? 0,
                    code: c.code,
                    note: c.note,
                  },
                })
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={(row.original.receiveCount ?? 0) > 0 ? '已被领取，不能删除' : '删除'}>
            <span>
              <IconButton
                size="small"
                disabled={(row.original.receiveCount ?? 0) > 0}
                onClick={() => { setFormError(null); setConfirmDelete(row.original) }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ], [])

  const draft = editing?.draft
  const setDraft = (patch: Partial<CouponDraft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  return (
    <Box>
      <DataTable
        columns={columns}
        rows={listQuery.data?.list ?? []}
        getRowId={(r) => String(r.id)}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        isLoading={listQuery.isFetching}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText="还没有优惠券。点「新建优惠券」创建一张。"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={() => { setFormError(null); setEditing({ id: null, draft: { ...EMPTY_DRAFT } }) }}
            >
              新建优惠券
            </Button>
            <Typography variant="caption" color="text.secondary">
              前台促销页：seckill.mall.com/promotion.html
            </Typography>
          </Stack>
        }
      />

      {/* ------------------------------ 新建 / 编辑 ------------------------------ */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? '编辑优惠券' : '新建优惠券'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          {draft && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="券名" size="small" required
                value={draft.couponName ?? ''}
                onChange={(e) => setDraft({ couponName: e.target.value })}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="面额（减多少）" size="small" required type="number"
                  value={draft.amount ?? ''}
                  onChange={(e) => setDraft({ amount: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="使用门槛（满多少可用）" size="small" type="number"
                  helperText="0 = 无门槛"
                  value={draft.minPoint ?? '0'}
                  onChange={(e) => setDraft({ minPoint: e.target.value })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="发行量" size="small" required type="number"
                  helperText={editing?.id ? '只能改大（追加发行），不能小于已领取量' : '领取上限'}
                  value={draft.publishCount ?? 0}
                  onChange={(e) => setDraft({ publishCount: Number(e.target.value) })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="每人限领" size="small" required type="number"
                  value={draft.perLimit ?? 1}
                  onChange={(e) => setDraft({ perLimit: Number(e.target.value) })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="领取开始" size="small" type="datetime-local"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={toInputValue(draft.enableStartTime)}
                  onChange={(e) => setDraft({ enableStartTime: fromInputValue(e.target.value) })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="领取截止" size="small" type="datetime-local"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={toInputValue(draft.enableEndTime)}
                  onChange={(e) => setDraft({ enableEndTime: fromInputValue(e.target.value) })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="券有效期起" size="small" type="datetime-local"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={toInputValue(draft.startTime)}
                  onChange={(e) => setDraft({ startTime: fromInputValue(e.target.value) })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="券有效期止" size="small" type="datetime-local"
                  helperText="领到手之后能用到什么时候。领取时会冻结成快照。"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={toInputValue(draft.endTime)}
                  onChange={(e) => setDraft({ endTime: fromInputValue(e.target.value) })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <TextField
                select label="发布状态" size="small"
                value={draft.publish ?? 0}
                onChange={(e) => setDraft({ publish: Number(e.target.value) })}
              >
                <MenuItem value={0}>未发布（不出现在促销页，也领不了）</MenuItem>
                <MenuItem value={1}>已发布</MenuItem>
              </TextField>

              {/* 这两项锁死并写明原因。理由见文件头：后端会拒绝，
                  在这里提前说清楚比让人填完再报错好。 */}
              <TextField
                select label="适用范围" size="small" value={0} disabled
                helperText="只支持全场通用。指定分类/商品需要订单明细里的 spu_id 和 category_id，而那两列目前从来不写入。"
              >
                <MenuItem value={0}>全场通用</MenuItem>
              </TextField>
              <TextField
                select label="会员等级限制" size="small" value={0} disabled
                helperText="只支持不限等级。等级体系还没建立（ums_member_level 为空，也没有查等级的接口），带等级限制的券会被领取接口一律拒绝。"
              >
                <MenuItem value={0}>不限等级</MenuItem>
              </TextField>

              <TextField
                label="备注" size="small"
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ note: e.target.value })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending}
            onClick={() => editing && saveMutation.mutate(editing)}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------ 删除确认 ------------------------------ */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>删除优惠券</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Typography variant="body2">
            确定删除「{confirmDelete?.couponName}」？
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            只有从未被领取过的券可以删除。要停止发放一张已发出的券，
            应当把发布状态改成「未发布」—— 已发到用户手里的券仍然可用。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------ 领券记录 ------------------------------ */}
      <CouponHistoryDialog coupon={historyOf} onClose={() => setHistoryOf(null)} />
    </Box>
  )
}

/**
 * 某张券的领券记录。
 *
 * <p>做成对话框而不是独立页面，是因为它<b>总是</b>在"某一张券"的语境下被看 ——
 * 独立页面就得先选券，多一步。
 */
function CouponHistoryDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const query = useQuery({
    queryKey: ['coupon-histories', coupon?.id, page, pageSize],
    queryFn: ({ signal }) =>
      fetchCouponHistories({ page, limit: pageSize, couponId: coupon!.id }, signal),
    enabled: !!coupon,
  })

  const columns = useMemo<Col<CouponHistory>[]>(() => [
    {
      id: 'member',
      header: '会员',
      meta: { width: 200 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.original.memberNickName ?? '(无昵称)'}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            id {row.original.memberId}
            {(row.original.receiveSeq ?? 1) > 1 ? ` · 第 ${row.original.receiveSeq} 张` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 100 },
      cell: ({ row }) => {
        const h = row.original
        if (h.useType === 1) return <Chip size="small" label="已使用" color="primary" />
        // 过期不落库、在这里算 —— 后端也是这么算的（没有定时任务去改 use_type）
        const expired = h.expireTime ? new Date(h.expireTime).getTime() < Date.now() : false
        return expired
          ? <Chip size="small" label="已过期" color="default" />
          : <Chip size="small" label="未使用" color="success" />
      },
    },
    {
      accessorKey: 'createTime',
      header: '领取时间',
      meta: { width: 170 },
      cell: ({ row }) => (row.original.createTime ?? '—').slice(0, 19),
    },
    {
      accessorKey: 'expireTime',
      header: '失效时间',
      meta: { width: 170 },
      cell: ({ row }) => (row.original.expireTime ?? '—').slice(0, 19),
    },
    {
      accessorKey: 'orderSn',
      header: '使用订单',
      meta: { width: 260 },
      cell: ({ row }) => row.original.orderSn ?? '—',
    },
  ], [])

  return (
    <Dialog open={!!coupon} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        领券记录 —— {coupon?.couponName}
        <Typography variant="caption" color="text.secondary" component="div">
          已领 {coupon?.receiveCount ?? 0} / 发行 {coupon?.publishCount ?? 0}
          {'，'}已使用 {coupon?.useCount ?? 0}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DataTable
          columns={columns}
          rows={query.data?.list ?? []}
          getRowId={(r) => String(r.id)}
          page={page}
          pageSize={pageSize}
          total={query.data?.totalCount ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyText="这张券还没有人领取。"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
