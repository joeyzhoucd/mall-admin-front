import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Button, Stack, TextField, Chip, Typography, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ReplayIcon from '@mui/icons-material/Replay'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  fetchDlqQueues, peekDlq, replayDlq, discardDlq,
  type DlqQueue, type DlqMessage,
} from '@/api/mq'

/**
 * 死信队列控制台。
 *
 * <pre>
 *   GET  /mq/dlq/queues            队列一览 + 堆积条数
 *   GET  /mq/dlq/{dlq}/peek        看队首一条（不消费）
 *   POST /mq/dlq/{dlq}/replay      重投回源交换机   —— 危险
 *   POST /mq/dlq/{dlq}/discard     丢弃           —— 不可恢复
 * </pre>
 *
 * <h3>三个操作的危险程度不一样，界面上必须看得出来</h3>
 * <ul>
 *   <li><b>查看</b>：完全安全。后端用 basicGet + nack(requeue) 实现，
 *       消息回到队首，队列顺序和深度都不变。可以随便点。</li>
 *   <li><b>重投</b>：消息会被真正重新消费一遍。重复由消费幂等表挡住，
 *       所以最坏情况是"做了两次但只生效一次"。</li>
 *   <li><b>丢弃</b>：<b>不可恢复</b>。消息从此不存在，它承载的业务动作
 *       永远不会发生。所以这里要求手工输入队列名才放行 ——
 *       一个二次确认弹窗对于不可逆操作来说太容易被下意识点掉了。</li>
 * </ul>
 *
 * <h3>队列名是白名单，不是自由输入</h3>
 * 后端只接受 MqDlqService.bindings() 里那五个。这一页也只显示那五个 ——
 * 不给"输入任意队列名"的入口，因为这几个接口能收发任意队列的消息，
 * 开放队列名等于把 broker 的读写权限暴露出来。
 */
export default function DlqPage() {
  const qc = useQueryClient()
  const [peeking, setPeeking] = useState<{ queue: DlqQueue; data: DlqMessage | null } | null>(null)
  const [confirm, setConfirm] = useState<
    | { action: 'replay'; queue: DlqQueue }
    | { action: 'discard'; queue: DlqQueue }
    | null
  >(null)
  const [limit, setLimit] = useState('10')
  const [typedName, setTypedName] = useState('')
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const queuesQuery = useQuery({
    queryKey: ['dlq-queues'],
    queryFn: ({ signal }) => fetchDlqQueues(signal),
    // 死信是"平时应该为 0"的东西，堆积起来要尽快看见。
    refetchInterval: 15_000,
  })

  const peekMutation = useMutation({
    mutationFn: (queue: DlqQueue) => peekDlq(queue.dlq).then((data) => ({ queue, data })),
    onSuccess: (r) => setPeeking(r),
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  const replayMutation = useMutation({
    mutationFn: ({ queue, n }: { queue: DlqQueue; n: number }) => replayDlq(queue.dlq, n),
    onSuccess: (count) => {
      setToast({
        msg: count === 0
          ? '没有重投任何消息 —— 队列可能已经空了'
          : `已重投 ${count} 条回源交换机`,
        severity: count === 0 ? 'error' : 'success',
      })
      closeConfirm()
      void qc.invalidateQueries({ queryKey: ['dlq-queues'] })
    },
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  const discardMutation = useMutation({
    mutationFn: ({ queue, n }: { queue: DlqQueue; n: number }) => discardDlq(queue.dlq, n),
    onSuccess: (count) => {
      setToast({ msg: `已永久丢弃 ${count} 条消息`, severity: 'success' })
      closeConfirm()
      void qc.invalidateQueries({ queryKey: ['dlq-queues'] })
    },
    onError: (e: unknown) => setToast({ msg: errorText(e), severity: 'error' }),
  })

  function closeConfirm() {
    setConfirm(null)
    setTypedName('')
    setLimit('10')
  }

  const queues = queuesQuery.data ?? []
  const total = useMemo(() => queues.reduce((a, q) => a + q.messageCount, 0), [queues])

  const parsedLimit = Number(limit)
  const limitValid = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>死信队列</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        消费失败并且重试耗尽的消息会落到这里。死信队列<b>平时应该是空的</b> ——
        有堆积就意味着某一类消息一直处理不了，而对应的业务动作没有发生。
      </Typography>

      {total > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          共有 <b>{total}</b> 条死信。处理之前请先「查看」确认失败原因
          （消息头里的 <code>x-death</code> 会说明被拒了几次、原因是什么），
          再决定重投还是丢弃。
        </Alert>
      )}

      <Paper variant="outlined">
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              队列列表来自后端白名单（MqDlqService.bindings），共 {queues.length} 条绑定
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small" startIcon={<RefreshIcon />}
              onClick={() => void queuesQuery.refetch()}
            >
              刷新
            </Button>
          </Stack>
        </Box>

        {queuesQuery.error ? (
          <Alert
            severity="error"
            sx={{ m: 1.5 }}
            action={<Button color="inherit" size="small" onClick={() => void queuesQuery.refetch()}>重试</Button>}
          >
            {errorText(queuesQuery.error)}
          </Alert>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>死信队列</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>源队列</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>重投目标</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>堆积</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queuesQuery.isPending && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, border: 0 }}>
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                )}
                {!queuesQuery.isPending && queues.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, border: 0 }}>
                      <Typography variant="body2" color="text.secondary">
                        后端没有返回任何绑定。这不正常 —— 绑定表是代码里的静态常量，
                        应当恒有 5 条。
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {queues.map((q) => (
                  <TableRow key={q.dlq} hover>
                    <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{q.dlq}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{q.sourceQueue}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{q.replayExchange}</Typography>
                      <Typography variant="caption" color="text.secondary">{q.replayRoutingKey}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={q.messageCount}
                        color={q.messageCount > 0 ? 'error' : 'default'}
                        variant={q.messageCount > 0 ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="看队首一条，不消费也不改变队列">
                          <span>
                            <IconButton
                              size="small"
                              disabled={q.messageCount === 0 || peekMutation.isPending}
                              onClick={() => peekMutation.mutate(q)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="重投回源交换机">
                          <span>
                            <IconButton
                              size="small" color="warning"
                              disabled={q.messageCount === 0}
                              onClick={() => { setLimit('10'); setConfirm({ action: 'replay', queue: q }) }}
                            >
                              <ReplayIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="永久丢弃，不可恢复">
                          <span>
                            <IconButton
                              size="small" color="error"
                              disabled={q.messageCount === 0}
                              onClick={() => {
                                setLimit('10'); setTypedName('')
                                setConfirm({ action: 'discard', queue: q })
                              }}
                            >
                              <DeleteForeverIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 查看 */}
      <Dialog open={peeking !== null} onClose={() => setPeeking(null)} maxWidth="md" fullWidth>
        <DialogTitle>队首消息 · {peeking?.queue.dlq}</DialogTitle>
        <DialogContent dividers>
          {peeking?.data === null ? (
            <Alert severity="info">
              队列是空的。刚才显示的堆积数是上一次刷新时的快照，
              这中间可能已经被别人处理掉了。
            </Alert>
          ) : peeking ? (
            <Stack spacing={1.5}>
              <Alert severity="success" variant="outlined">
                这条消息<b>已经放回队首</b>，队列顺序和深度都没有改变。
              </Alert>
              <Field label="messageId" value={peeking.data?.messageId ?? '(无)'} mono />
              <Field label="correlationId" value={peeking.data?.correlationId ?? '(无)'} mono />
              <Field
                label="进入死信时的路由"
                value={`${peeking.data?.exchange ?? '(无)'} / ${peeking.data?.routingKey ?? '(无)'}`}
              />
              <Divider />
              <Typography variant="caption" color="text.secondary">
                消息头（<code>x-death</code> 记录了被拒的原因和次数，是判断该重投还是该丢弃的依据）
              </Typography>
              <Box component="pre" sx={preSx}>
                {JSON.stringify(peeking.data?.headers ?? {}, null, 2)}
              </Box>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                消息体（后端截断到 1000 字符）
              </Typography>
              <Box component="pre" sx={preSx}>{prettyJson(peeking.data?.body ?? '')}</Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPeeking(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 重投 / 丢弃 的二次确认 */}
      <Dialog open={confirm !== null} onClose={closeConfirm} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirm?.action === 'replay' ? '确认重投？' : '确认永久丢弃？'}
        </DialogTitle>
        <DialogContent dividers>
          {confirm && (
            <Stack spacing={2}>
              <Field label="队列" value={confirm.queue.dlq} mono />
              <Field label="当前堆积" value={`${confirm.queue.messageCount} 条`} />

              <TextField
                size="small" label="本次处理条数（1–100）" value={limit}
                onChange={(e) => setLimit(e.target.value)}
                error={limit !== '' && !limitValid}
                helperText={
                  limit !== '' && !limitValid
                    ? '必须是 1 到 100 之间的整数'
                    : '从队首开始取这么多条。队列不够时按实际条数处理。'
                }
                sx={{ width: 240 }}
              />

              {confirm.action === 'replay' ? (
                <Alert severity="warning">
                  这些消息会被投回 <b>{confirm.queue.replayExchange}</b>
                  （路由键 {confirm.queue.replayRoutingKey}），然后被
                  <b>真正地重新消费一遍</b>。
                  <br />
                  重复消费由消费幂等表挡住，所以最坏情况是"做了两次但只生效一次"。
                  但如果失败原因还没排除，它们会再次失败并回到死信队列。
                </Alert>
              ) : (
                <>
                  <Alert severity="error">
                    <b>这个操作不可恢复。</b>
                    消息会被永久删除，它承载的业务动作（关单 / 扣库存 / 放库存）
                    永远不会发生，也没有任何机制能把它找回来。
                    <br />
                    后端会把 messageId 和消息体前 200 字符写进日志作为痕迹，
                    但日志有保留期，过了就真的没有了。
                  </Alert>
                  {/* 不可逆操作只给一个「确定」按钮太容易被下意识点掉。
                      要求手工抄一遍队列名，是为了强迫看清楚删的到底是哪个队列。 */}
                  <TextField
                    size="small" fullWidth
                    label="请输入队列名以确认"
                    placeholder={confirm.queue.dlq}
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    error={typedName !== '' && typedName !== confirm.queue.dlq}
                    helperText={
                      typedName !== '' && typedName !== confirm.queue.dlq
                        ? '和队列名不一致'
                        : '手工输入，不要复制粘贴 —— 这一步的意义就是让你看清楚删的是哪个队列'
                    }
                  />
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm}>取消</Button>
          {confirm?.action === 'replay' ? (
            <Button
              color="warning" variant="contained"
              disabled={!limitValid || replayMutation.isPending}
              onClick={() => replayMutation.mutate({ queue: confirm.queue, n: parsedLimit })}
            >
              确认重投
            </Button>
          ) : (
            <Button
              color="error" variant="contained"
              disabled={
                !limitValid || discardMutation.isPending || typedName !== (confirm?.queue.dlq ?? '')
              }
              onClick={() => confirm && discardMutation.mutate({ queue: confirm.queue, n: parsedLimit })}
            >
              永久丢弃
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

const preSx = {
  m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1,
  fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
} as const

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

/** 解析失败就原样显示 —— 恰恰是解析不了的那条最需要被看到。 */
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
