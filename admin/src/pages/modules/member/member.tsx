import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Divider, Avatar,
  CircularProgress,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchMembers, fetchMemberDetail, fetchMemberLevels, genderLabel,
  type Member,
} from '@/api/member'
import type { Id } from '@/api/types'

/**
 * 会员管理。
 *
 * <pre>
 *   GET /member/member/list       列表（2026-09-06 新补）
 *   GET /member/member/info/{id}  详情（2026-09-06 新补）
 *   GET /member/memberlevel/list  等级下拉
 * </pre>
 * 前两个此前不存在 —— MemberService.queryPage 一直有，但控制器上没有入口，
 * 而同服务其它控制器都留着完整 CRUD。和订单那次是同一个情况。
 *
 * <h3>列表里的手机号和邮箱是脱敏的</h3>
 * 后端在列表接口上打码（138****5678 / j*******@x.com），详情接口给全量。
 * 列表一次会把上百个人的联系方式铺在屏幕上，而绝大多数时候只是在找某一个人。
 * <p>
 * <b>搜索不受影响</b>：按完整手机号搜，打的还是数据库里的真实列。
 * 所以「输入完整手机号能搜到、但列表里显示成星号」是预期行为。
 *
 * <h3>后台对会员是只读的</h3>
 * 没有新增/编辑/删除。会员数据的写入口是注册和用户自己的资料修改，
 * 那些路径上有密码加密、手机号唯一性校验、等级成长值联动。
 * 从后台直接改一行会绕过全部这些，而界面上看起来是成功的。
 * 真要做「封禁会员」这类功能，应当是一个独立的、带审计的动作，不是编辑表单。
 */
export default function MemberPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [form, setForm] = useState({ key: '', levelId: '', from: '', to: '' })
  const [filters, setFilters] = useState({ key: '', levelId: '', from: '', to: '' })
  const [detailId, setDetailId] = useState<Id | null>(null)

  const levelsQuery = useQuery({
    queryKey: ['member-levels'],
    queryFn: ({ signal }) => fetchMemberLevels({ page: 1, limit: 100 }, signal),
    staleTime: 30 * 60 * 1000,
  })
  const levels = levelsQuery.data?.list ?? []

  const listQuery = useQuery({
    queryKey: ['members', page, pageSize, filters],
    queryFn: ({ signal }) =>
      fetchMembers(
        {
          page,
          limit: pageSize,
          key: filters.key || undefined,
          levelId: filters.levelId || undefined,
          createTimeFrom: filters.from ? `${filters.from} 00:00:00` : undefined,
          createTimeTo: filters.to ? `${filters.to} 23:59:59` : undefined,
        },
        signal
      ),
    placeholderData: (prev) => prev,
  })

  const detailQuery = useQuery({
    queryKey: ['member-detail', detailId],
    queryFn: ({ signal }) => fetchMemberDetail(detailId as Id, signal),
    enabled: detailId !== null,
  })

  const columns = useMemo<Col<Member>[]>(() => [
    {
      id: 'user',
      header: '会员',
      meta: { width: 240 },
      cell: ({ row }) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Avatar src={row.original.header ?? undefined} sx={{ width: 32, height: 32 }}>
            {(row.original.nickname ?? row.original.username ?? '?').slice(0, 1)}
          </Avatar>
          <Box>
            <Typography variant="body2">{row.original.nickname ?? '(未设置昵称)'}</Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {row.original.username ?? '-'}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      id: 'contact',
      header: '联系方式',
      meta: { width: 200 },
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.original.mobile ?? '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {row.original.email ?? '-'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'level',
      header: '等级',
      meta: { width: 120 },
      cell: ({ row }) => {
        // levelName 来自 ums_member_level，那张表当前是空的（实测 0 行），
        // 所以这里几乎总是会走到回落分支。回落成显示 levelId 而不是空白 ——
        // 空白会让人以为这个会员没有等级，而实际是等级表没数据。
        const { levelName, levelId } = row.original
        if (levelName) return <Chip size="small" label={levelName} variant="outlined" />
        if (levelId) {
          return (
            <Tooltip title="等级表 ums_member_level 里没有这一条，只能显示 id">
              <Chip size="small" label={`等级 ${levelId}`} variant="outlined" color="warning" />
            </Tooltip>
          )
        }
        return <Typography variant="caption" color="text.secondary">未设置</Typography>
      },
    },
    {
      id: 'points',
      header: '积分 / 成长值',
      meta: { width: 120, align: 'right' },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.original.integration ?? 0} / {row.original.growth ?? 0}
        </Typography>
      ),
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 100 },
      cell: ({ row }) => statusChip(row.original.status),
    },
    {
      id: 'createTime',
      header: '注册时间',
      meta: { width: 160 },
      cell: ({ row }) => (
        <Typography variant="caption">{row.original.createTime ?? '-'}</Typography>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 70, align: 'right' },
      cell: ({ row }) => (
        <Tooltip title="查看详情（含完整联系方式）">
          <IconButton size="small" onClick={() => setDetailId(row.original.id)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [])

  const detail = detailQuery.data

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>会员管理</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        只读。列表里的手机号和邮箱已脱敏，完整值在详情里；
        按完整手机号搜索仍然有效（搜的是数据库里的真实值）。
      </Typography>

      {levels.length === 0 && !levelsQuery.isPending && (
        <Alert severity="info" sx={{ mb: 2 }}>
          等级表 <code>ums_member_level</code> 里一条数据都没有，
          所以「等级」列只能显示 id、等级筛选也是空的。
          这不是这一页的问题 —— 那张表从来没被填过。
        </Alert>
      )}

      <DataTable<Member>
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
        emptyText="没有符合条件的会员"
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" label="用户名 / 昵称 / 手机号" value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { setFilters(form); setPage(1) } }}
              sx={{ width: 240 }}
            />
            <TextField
              size="small" select label="等级" value={form.levelId}
              onChange={(e) => {
                const next = { ...form, levelId: e.target.value }
                setForm(next); setFilters(next); setPage(1)
              }}
              disabled={levels.length === 0}
              sx={{ width: 150 }}
            >
              <MenuItem value="">全部</MenuItem>
              {levels.map((l) => (
                <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" type="date" label="注册起" value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 160 }}
            />
            <TextField
              size="small" type="date" label="注册止" value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 160 }}
            />
            <Button variant="contained" onClick={() => { setFilters(form); setPage(1) }}>查询</Button>
            <Button
              onClick={() => {
                const empty = { key: '', levelId: '', from: '', to: '' }
                setForm(empty); setFilters(empty); setPage(1)
              }}
            >
              重置
            </Button>
          </Stack>
        }
      />

      <Dialog open={detailId !== null} onClose={() => setDetailId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>会员详情</DialogTitle>
        <DialogContent dividers>
          {detailQuery.isPending && (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
          )}
          {detailQuery.error && (
            <Alert severity="error">
              {detailQuery.error instanceof Error ? detailQuery.error.message : String(detailQuery.error)}
            </Alert>
          )}
          {detail && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar src={detail.header ?? undefined} sx={{ width: 56, height: 56 }}>
                  {(detail.nickname ?? detail.username ?? '?').slice(0, 1)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1">{detail.nickname ?? '(未设置昵称)'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {detail.username ?? '-'} · id {detail.id}
                  </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                {statusChip(detail.status)}
              </Stack>

              <Divider />

              {/* 完整联系方式。展示它是打开详情这个动作的目的，
                  所以不在这里再做一次遮挡 —— 那会让整个功能失去意义。 */}
              <Stack direction="row" spacing={4}>
                <Field label="手机号" value={detail.mobile ?? '-'} mono />
                <Field label="邮箱" value={detail.email ?? '-'} mono />
              </Stack>

              <Stack direction="row" spacing={4}>
                <Field label="性别" value={genderLabel(detail.gender)} />
                <Field label="生日" value={detail.birth ?? '未填写'} />
                <Field label="城市" value={detail.city ?? '未填写'} />
                <Field label="职业" value={detail.job ?? '未填写'} />
              </Stack>

              <Stack direction="row" spacing={4}>
                <Field
                  label="等级"
                  value={detail.levelName ?? (detail.levelId ? `等级 ${detail.levelId}（等级表无此条）` : '未设置')}
                />
                <Field label="积分" value={String(detail.integration ?? 0)} />
                <Field label="成长值" value={String(detail.growth ?? 0)} />
              </Stack>

              <Field label="个性签名" value={detail.sign ?? '未填写'} />
              <Field label="注册时间" value={detail.createTime ?? '-'} />

              <Alert severity="info" variant="outlined">
                后台对会员只读。封禁、改等级这类动作需要走各自的业务入口
                （会带上校验和记录），不能直接改这张表。
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

/**
 * 状态显示。
 *
 * <b>null 必须显示成「未设置」，不能显示成「正常」</b> ——
 * 当前线上 103 个会员这一列全是 NULL（注册流程从来没给它赋过值）。
 * 把 null 渲染成「正常」是在替一个从未被设置过的字段编造含义，
 * 而且会让「这个字段没人维护」这件事永远不被发现。
 */
function statusChip(status: number | null | undefined) {
  if (status === null || status === undefined) {
    return (
      <Tooltip title="ums_member.status 为 NULL —— 注册流程没有给这个字段赋过值">
        <Chip size="small" label="未设置" variant="outlined" />
      </Tooltip>
    )
  }
  return status === 1
    ? <Chip size="small" label="正常" color="success" variant="outlined" />
    : <Chip size="small" label={`状态 ${status}`} color="default" variant="outlined" />
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="body2" sx={mono ? { fontFamily: 'monospace' } : undefined}>
        {value}
      </Typography>
    </Box>
  )
}
