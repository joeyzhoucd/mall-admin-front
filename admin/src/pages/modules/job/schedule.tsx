import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, MenuItem, Chip, Typography, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Checkbox,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ResumeIcon from '@mui/icons-material/NotStarted'
import HistoryIcon from '@mui/icons-material/History'
import { DataTable, type Col } from '@/components/DataTable'
import {
  fetchScheduleJobs, fetchScheduleBeans, createScheduleJob, updateScheduleJob,
  deleteScheduleJobs, runScheduleJobs, pauseScheduleJobs, resumeScheduleJobs,
  fetchScheduleLogs, JOB_STATUS, type ScheduleJob,
} from '@/api/sys'
import type { Id } from '@/api/types'

/**
 * 定时任务。
 *
 * 接口对照 BASELINE.md（schedule.vue + schedule-add-or-update.vue + schedule-log.vue）：
 * <pre>
 *   /sys/schedule/list       列表（筛选参数是 <b>beanName</b>）
 *   /sys/schedule/info/{}    详情    ← 有意不用，list 已返回完整实体
 *   /sys/schedule/{}         新增/修改
 *   /sys/schedule/delete     批量删除
 *   /sys/schedule/run        立即执行
 *   /sys/schedule/pause      暂停
 *   /sys/schedule/resume     恢复
 *   /sys/scheduleLog/list    执行日志
 *   /sys/scheduleLog/info/{} 日志详情 ← 有意不用，list 已带 error 全文
 *   /sys/schedule/beans      可用 bean（<b>2026-09-05 新增</b>，见下）
 * </pre>
 *
 * <h3>beanName 做成下拉，不是自由文本</h3>
 * 后端只允许调用标了 {@code @ScheduledTask} 的 bean（白名单，防「任意方法执行」）。
 * 但填错不会当场报错 —— 要等这个任务按 cron 真的跑起来才抛
 * 「没有标 @ScheduledTask」。cron 是凌晨三点的话，得等到第二天。
 * 所以给后端加了一个只读的 /sys/schedule/beans，把可选项列出来。
 *
 * <h3>status 的 0/1 和别处相反</h3>
 * 这里 <b>0 是正常、1 是暂停</b>；而用户、参数配置那边是 1 正常。
 * 照抄别的页面会把状态显示反 —— 而「暂停中的任务显示成正常」
 * 是那种你不会去怀疑的错误。
 */
export default function SchedulePage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<Id>>(new Set())
  const [editing, setEditing] = useState<ScheduleJob | null | undefined>(undefined)
  const [confirmRun, setConfirmRun] = useState<ScheduleJob[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ScheduleJob[] | null>(null)
  const [logsFor, setLogsFor] = useState<ScheduleJob | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const listQuery = useQuery({
    queryKey: ['schedule-jobs', page, pageSize, search],
    queryFn: ({ signal }) =>
      fetchScheduleJobs({ page, limit: pageSize, beanName: search || undefined }, signal),
    placeholderData: (prev) => prev,
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })
  const afterWrite = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['schedule-jobs'] })
    setChecked(new Set())
    setToast({ msg, severity: 'success' })
  }

  const runMutation = useMutation({
    mutationFn: (jobs: ScheduleJob[]) => runScheduleJobs(jobs.map((j) => j.jobId)),
    onSuccess: () => { setConfirmRun(null); afterWrite('已触发执行 —— 结果看「执行日志」') },
    onError: (e) => { setConfirmRun(null); onError(e) },
  })
  const pauseMutation = useMutation({
    mutationFn: (jobs: ScheduleJob[]) => pauseScheduleJobs(jobs.map((j) => j.jobId)),
    onSuccess: () => afterWrite('已暂停'),
    onError,
  })
  const resumeMutation = useMutation({
    mutationFn: (jobs: ScheduleJob[]) => resumeScheduleJobs(jobs.map((j) => j.jobId)),
    onSuccess: () => afterWrite('已恢复'),
    onError,
  })
  const deleteMutation = useMutation({
    mutationFn: (jobs: ScheduleJob[]) => deleteScheduleJobs(jobs.map((j) => j.jobId)),
    onSuccess: () => { setConfirmDelete(null); afterWrite('已删除') },
    onError,
  })
  const saveMutation = useMutation({
    mutationFn: (j: ScheduleJob) =>
      j.jobId
        ? updateScheduleJob({
            jobId: j.jobId, beanName: j.beanName, params: j.params ?? '',
            cronExpression: j.cronExpression, remark: j.remark ?? '', status: j.status,
          })
        : createScheduleJob({
            beanName: j.beanName, params: j.params ?? '',
            cronExpression: j.cronExpression, remark: j.remark ?? '',
          }),
    onSuccess: () => { setEditing(undefined); afterWrite('保存成功') },
    onError,
  })

  const rows = listQuery.data?.list ?? []
  const checkedRows = rows.filter((j) => checked.has(j.jobId))

  const toggle = (id: Id) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const columns = useMemo<Col<ScheduleJob>[]>(() => [
    {
      id: 'check',
      header: '',
      meta: { width: 44, align: 'center' },
      cell: ({ row }) => (
        <Checkbox size="small" sx={{ p: 0.5 }}
          checked={checked.has(row.original.jobId)}
          onChange={() => toggle(row.original.jobId)} />
      ),
    },
    { accessorKey: 'jobId', header: 'ID', meta: { width: 70 } },
    {
      accessorKey: 'beanName',
      header: 'bean',
      meta: { width: 200 },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {row.original.beanName}
        </Typography>
      ),
    },
    {
      accessorKey: 'cronExpression',
      header: 'cron',
      meta: { width: 150 },
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {row.original.cronExpression}
        </Typography>
      ),
    },
    {
      accessorKey: 'params',
      header: '参数',
      cell: ({ row }) =>
        row.original.params
          ? <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{row.original.params}</Typography>
          : <Typography variant="caption" color="text.secondary">无</Typography>,
    },
    {
      id: 'status',
      header: '状态',
      meta: { width: 80, align: 'center' },
      // 【0 正常 / 1 暂停】—— 和用户、参数配置那边相反，别照抄
      cell: ({ row }) =>
        row.original.status === JOB_STATUS.NORMAL
          ? <Chip size="small" color="success" label="正常" sx={{ height: 20 }} />
          : <Chip size="small" color="warning" variant="outlined" label="暂停" sx={{ height: 20 }} />,
    },
    {
      id: 'actions',
      header: '操作',
      meta: { width: 150, align: 'center' },
      cell: ({ row }) => {
        const j = row.original
        const paused = j.status === JOB_STATUS.PAUSED
        return (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            <Tooltip title="立即执行一次">
              <IconButton size="small" color="primary" onClick={() => setConfirmRun([j])}>
                <PlayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={paused ? '恢复' : '暂停'}>
              <IconButton size="small"
                onClick={() => (paused ? resumeMutation : pauseMutation).mutate([j])}>
                {paused ? <ResumeIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="执行日志">
              <IconButton size="small" onClick={() => setLogsFor(j)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="修改">
              <IconButton size="small" onClick={() => setEditing(j)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => setConfirmDelete([j])}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      },
    },
  ], [checked, pauseMutation, resumeMutation])

  const submitSearch = () => { setSearch(keyword.trim()); setPage(1) }

  return (
    <Box sx={{ p: 2 }}>
      <DataTable<ScheduleJob>
        columns={columns}
        rows={rows}
        getRowId={(j) => j.jobId}
        page={page}
        pageSize={pageSize}
        total={listQuery.data?.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        emptyText={search ? `没有匹配「${search}」的任务` : '还没有定时任务'}
        toolbar={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small" placeholder="按 bean 名搜索" value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              sx={{ width: 200 }}
            />
            <Button size="small" variant="outlined" onClick={submitSearch}>查询</Button>
            <Button size="small" disabled={checkedRows.length === 0}
              onClick={() => setConfirmRun(checkedRows)}>
              批量执行{checkedRows.length > 0 ? `（${checkedRows.length}）` : ''}
            </Button>
            <Button size="small" disabled={checkedRows.length === 0}
              onClick={() => pauseMutation.mutate(checkedRows)}>
              批量暂停
            </Button>
            <Button size="small" disabled={checkedRows.length === 0}
              onClick={() => resumeMutation.mutate(checkedRows)}>
              批量恢复
            </Button>
            <Button size="small" color="error" disabled={checkedRows.length === 0}
              onClick={() => setConfirmDelete(checkedRows)}>
              批量删除
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="contained" onClick={() => setEditing(null)}>新增</Button>
          </Stack>
        }
      />

      {editing !== undefined && (
        <JobForm
          job={editing}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(j) => saveMutation.mutate(j)}
        />
      )}

      {logsFor && <JobLogsDialog job={logsFor} onClose={() => setLogsFor(null)} />}

      <Dialog open={!!confirmRun} onClose={() => setConfirmRun(null)} maxWidth="xs" fullWidth>
        <DialogTitle>立即执行</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            立即执行 {confirmRun?.length ?? 0} 个任务：
            {confirmRun?.map((j) => j.beanName).join('、')}
          </Typography>
          <Alert severity="warning" variant="outlined">
            这会<b>真的跑一次业务逻辑</b>，不是演练。
            而且它<b>不看任务当前是不是暂停</b> —— 暂停中的任务照样会被执行一次。
            执行结果不会在这里显示，要去「执行日志」看。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRun(null)}>取消</Button>
          <Button variant="contained" disabled={runMutation.isPending}
            onClick={() => confirmRun && runMutation.mutate(confirmRun)}>
            {runMutation.isPending ? '执行中…' : '执行'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除定时任务</DialogTitle>
        <DialogContent>
          删除 {confirmDelete?.length ?? 0} 个任务：
          {confirmDelete?.map((j) => j.beanName).join('、')}。
          任务会从 Quartz 调度里移除，不再自动执行。
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

const EMPTY: ScheduleJob = {
  jobId: '', beanName: '', params: '', cronExpression: '', status: JOB_STATUS.NORMAL,
  remark: '', createTime: null,
}

function JobForm({
  job, submitting, onCancel, onSubmit,
}: {
  job: ScheduleJob | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (j: ScheduleJob) => void
}) {
  const [form, setForm] = useState<ScheduleJob>(
    job ? { ...job, params: job.params ?? '', remark: job.remark ?? '' } : EMPTY
  )

  const beansQuery = useQuery({
    queryKey: ['schedule-beans'],
    queryFn: ({ signal }) => fetchScheduleBeans(signal),
    staleTime: 5 * 60 * 1000,
  })

  const beans = beansQuery.data ?? []
  // 编辑一个 bean 已经不在白名单里的旧任务时，下拉里没有它。
  // 直接显示成空会让人以为没配 —— 把它作为一个「已失效」选项列出来。
  const stale = form.beanName !== '' && beans.length > 0 && !beans.includes(form.beanName)

  const beanBad = form.beanName.trim() === ''
  // cron 至少要有 6 段（Quartz 是 秒 分 时 日 月 周 [年]）。
  // 这里只做最基本的形状检查 —— 真正的校验在后端，写错的表达式那里会拒绝。
  const cronParts = form.cronExpression.trim().split(/\s+/).filter(Boolean)
  const cronBad = form.cronExpression.trim() === '' || cronParts.length < 6

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{job ? `修改任务 · ${job.beanName}` : '新增定时任务'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select label="bean 名" fullWidth value={form.beanName}
            error={beanBad}
            helperText={
              beansQuery.error ? '可用任务列表加载失败 —— 保存前请确认 bean 名正确'
                : beanBad ? '请选择要执行的任务'
                  : '只有标了 @ScheduledTask 的类允许被定时任务调用'
            }
            onChange={(e) => setForm((f) => ({ ...f, beanName: e.target.value }))}
          >
            {stale && (
              <MenuItem value={form.beanName}>
                {form.beanName}（已不在可用列表中）
              </MenuItem>
            )}
            {beans.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
            {beans.length === 0 && !beansQuery.isLoading && (
              <MenuItem value="" disabled>没有可用的任务 bean</MenuItem>
            )}
          </TextField>

          {stale && (
            <Alert severity="warning" variant="outlined">
              「{form.beanName}」不在当前的可用列表里 —— 可能是那个类被删了，
              或者 @ScheduledTask 注解被去掉了。<b>保持原样保存不会报错，
              但这个任务到点执行时会失败。</b>
            </Alert>
          )}

          <TextField
            label="cron 表达式" fullWidth value={form.cronExpression}
            error={cronBad}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            helperText={
              cronBad ? 'Quartz 的 cron 至少 6 段：秒 分 时 日 月 周（可选 年）'
                : '例如 0 0 3 * * ? 表示每天凌晨三点'
            }
            onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
          />

          <TextField
            label="参数" fullWidth value={form.params ?? ''}
            helperText="会作为唯一的字符串参数传给 run(String)，可留空"
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            onChange={(e) => setForm((f) => ({ ...f, params: e.target.value }))}
          />

          <TextField
            label="备注" fullWidth value={form.remark ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="contained" disabled={submitting || beanBad || cronBad}
          onClick={() => onSubmit(form)}>
          {submitting ? '保存中…' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function JobLogsDialog({ job, onClose }: { job: ScheduleJob; onClose: () => void }) {
  const [page, setPage] = useState(1)

  const logsQuery = useQuery({
    queryKey: ['schedule-logs', job.jobId, page],
    queryFn: ({ signal }) => fetchScheduleLogs({ page, limit: 10, jobId: job.jobId }, signal),
    placeholderData: (prev) => prev,
  })

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>执行日志 · {job.beanName}</DialogTitle>
      <DialogContent dividers>
        {logsQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">加载中…</Typography>
        ) : (logsQuery.data?.list ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            这个任务还没有执行记录
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {(logsQuery.data?.list ?? []).map((l) => (
              <Box key={l.logId} sx={{ borderLeft: 3, borderColor: l.status === 1 ? 'success.main' : 'error.main', pl: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {/* 这里 1 是成功 —— 和任务本身 status 的 0 正常又不一样 */}
                  <Chip size="small" color={l.status === 1 ? 'success' : 'error'}
                    label={l.status === 1 ? '成功' : '失败'} sx={{ height: 18, fontSize: 11 }} />
                  <Typography variant="caption">{l.createTime}</Typography>
                  {l.times != null && (
                    <Typography variant="caption" color="text.secondary">耗时 {l.times} ms</Typography>
                  )}
                </Stack>
                {l.params && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                    参数：{l.params}
                  </Typography>
                )}
                {l.error && (
                  <Box component="pre" sx={{
                    m: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 11,
                    maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {l.error}
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
        <Typography variant="caption" sx={{ mx: 1 }}>
          第 {page} 页 / 共 {logsQuery.data?.totalPage ?? 1} 页
        </Typography>
        <Button size="small"
          disabled={page >= (logsQuery.data?.totalPage ?? 1)}
          onClick={() => setPage((p) => p + 1)}>
          下一页
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
