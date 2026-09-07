import { request, fetchPage } from './client'
import type { Id, PageResult } from './types'

/**
 * 消息治理接口：死信队列 / 事务性 Outbox / 消费幂等。
 *
 * <h3>网关路由（2026-09-06 补的，此前这两条前缀根本不通）</h3>
 * <pre>
 *   /api/mq/**     → mall-ware    （mall-mq-starter 在 coupon/order/ware 三个服务里都有，
 *                                   接口行为等价，选 mall-ware 是因为五条绑定里它占三条）
 *   /api/order/**  → mall-order   （后台专用入口，走 AdminAuthFilter；
 *                                   前台结算走的是不带 /api 的 /order/**，两者鉴权强度不同）
 *   /api/ware/**   → mall-ware    （早就有）
 * </pre>
 * 实测确认过：补之前 /api/order/order/list 和 /api/mq/dlq/queues 都是<b>网关自己的 404</b>
 * （响应体带 requestId），也就是压根没匹配上任何路由。
 *
 * <h3>这四张表 2026-09-06 之前在库里不存在</h3>
 * 功能代码早就上线了，建表语句一直躺在 mall-backend/docs/sql/ 里没进过迁移目录。
 * 后果不只是"页面没数据"：下单主链路会因为 outbox 表缺失而失败，
 * 而且 catch 块里的补偿动作访问的是同一张表、同样抛异常，
 * 导致锁掉的库存永远不会释放。见
 * mall-deploy/data-seed/migration-2026-09-06-mq-governance-tables.sql。
 */

// ---------------------------------------------------------------------------
// 死信队列
// ---------------------------------------------------------------------------

export interface DlqQueue {
  /** 源队列。消息本来该被谁消费。 */
  sourceQueue: string
  /** 死信队列名。重投/丢弃都用它定位，是白名单里的键。 */
  dlq: string
  /** 重投的目标交换机。 */
  replayExchange: string
  replayRoutingKey: string
  /** 当前堆积条数。 */
  messageCount: number
}

export interface DlqMessage {
  sourceQueue: string
  dlq: string
  messageId: string | null
  correlationId: string | null
  routingKey: string | null
  exchange: string | null
  /**
   * 头字段。最有价值的是 <code>x-death</code>：
   * 它记录了「因为什么原因、被拒过几次、原队列是哪个」，
   * 是这一页上唯一能回答"为什么进死信"的东西。
   */
  headers: Record<string, unknown>
  /** 消息体，后端截断到 1000 字符。 */
  body: string
}

export function fetchDlqQueues(signal?: AbortSignal): Promise<DlqQueue[]> {
  return request<{ code: number; queues: DlqQueue[] }>('/mq/dlq/queues', { signal })
    .then((r) => r.queues ?? [])
}

/**
 * 看队首的一条，<b>不消费</b>。
 *
 * 后端用 basicGet(queue, false) + nack(requeue) 实现，消息回到队首，
 * 队列顺序和深度都不变。所以这个操作可以随便点。
 *
 * 队列为空时返回 null（不是报错）。
 */
export function peekDlq(dlq: string, signal?: AbortSignal): Promise<DlqMessage | null> {
  return request<{ code: number; message: DlqMessage | null }>(
    `/mq/dlq/${encodeURIComponent(dlq)}/peek`,
    { signal }
  ).then((r) => r.message ?? null)
}

/**
 * 把死信重新投回源交换机。<b>危险操作</b>。
 *
 * 消息会被真正地重新消费一遍。重复由消费幂等表挡住，
 * 但那要求消费者确实走了 consumeOnce —— 五个监听器目前都走了。
 *
 * @returns 实际重投成功的条数（可能少于 limit：队列没那么多）
 */
export function replayDlq(dlq: string, limit: number): Promise<number> {
  return request<{ code: number; count: number }>(
    `/mq/dlq/${encodeURIComponent(dlq)}/replay`,
    { method: 'POST', query: { limit } }
  ).then((r) => r.count ?? 0)
}

/**
 * 丢弃死信。<b>不可恢复</b>。
 *
 * 后端会在丢弃前把 messageId 和消息体前 200 字符写进日志 ——
 * 那是事后唯一能回答「当时丢掉的是什么」的东西。
 * 但日志有保留期，过了就真的没有了。
 */
export function discardDlq(dlq: string, limit: number): Promise<number> {
  return request<{ code: number; count: number }>(
    `/mq/dlq/${encodeURIComponent(dlq)}/discard`,
    { method: 'POST', query: { limit } }
  ).then((r) => r.count ?? 0)
}

// ---------------------------------------------------------------------------
// 事务性 Outbox
// ---------------------------------------------------------------------------

/**
 * Outbox 状态。数值来自 mall-common 的 OutboxMessageStatus。
 *
 * SENDING 是个<b>中间态</b>：已经声明要发、还没等到 broker 确认。
 * 停留过久说明发送方在确认之前挂了，后端的 recoverStaleSending 会把
 * 超时的 SENDING 打回 FAILED 让它重试 —— 所以看到少量 SENDING 是正常的，
 * 看到大量且不动才是问题。
 */
export const OUTBOX_STATUS = {
  PENDING: 0,
  SENDING: 1,
  SENT: 2,
  FAILED: 3,
  DEAD: 4,
} as const

export const OUTBOX_STATUS_LABEL: Record<number, string> = {
  0: '待发送',
  1: '发送中',
  2: '已发送',
  3: '发送失败',
  4: '已死信',
}

export interface OutboxMessage {
  id: Id
  /** 幂等键。唯一索引就建在这一列上。 */
  messageKey: string
  businessType: string
  /** 业务键：订单侧通常是 order_sn，库存侧是采购单明细 id。 */
  businessKey: string
  exchangeName: string
  routingKey: string
  payloadType: string
  payload: string
  status: number
  retryCount: number
  nextRetryTime: string | null
  lastError: string | null
  sentTime: string | null
  createTime: string | null
  updateTime: string | null
}

/** 两个 Outbox 除了前缀完全一样，用同一套类型和同一个页面组件。 */
export type OutboxKind = 'order' | 'ware'

const OUTBOX_BASE: Record<OutboxKind, string> = {
  order: '/order/outbox',
  ware: '/ware/outbox',
}

export const OUTBOX_TITLE: Record<OutboxKind, string> = {
  order: '订单 Outbox',
  ware: '库存 Outbox',
}

export interface OutboxQuery {
  page: number
  limit: number
  status?: number
  businessType?: string
  businessKey?: string
  messageKey?: string
  /** 在 message_key 和 business_key 上模糊。 */
  key?: string
}

export function fetchOutbox(
  kind: OutboxKind,
  q: OutboxQuery,
  signal?: AbortSignal
): Promise<PageResult<OutboxMessage>> {
  return fetchPage<OutboxMessage>(`${OUTBOX_BASE[kind]}/list`, { ...q }, { signal })
}

/** 各状态条数。让「有 N 条死信」不需要主动去筛才能看见。 */
export function fetchOutboxStats(
  kind: OutboxKind,
  signal?: AbortSignal
): Promise<Record<number, number>> {
  return request<{ code: number; counts: Record<string, number> }>(
    `${OUTBOX_BASE[kind]}/stats`,
    { signal }
  ).then((r) => numericKeys(r.counts))
}

/**
 * 立刻跑一次"发布待发送消息"。
 *
 * 这个动作定时任务本来就在做，手工触发只是不想等下一个周期。
 * 幂等：它只挑 PENDING/FAILED 且到了重试时间的，重复点不会重复发已发送的。
 */
export function publishOutboxReady(kind: OutboxKind): Promise<number> {
  return request<{ code: number; count: number }>(`${OUTBOX_BASE[kind]}/publish`, {
    method: 'POST',
  }).then((r) => r.count ?? 0)
}

/**
 * 重发单条。<b>危险操作</b>。
 *
 * 和 publish 的区别是它会<b>强制</b>发送：连 DEAD 状态的也发。
 * 一条被判死的消息通常是因为反复失败，强制重发之前应当先看 lastError。
 */
export function resendOutbox(kind: OutboxKind, id: Id): Promise<boolean> {
  return request<{ code: number; resend: boolean }>(`${OUTBOX_BASE[kind]}/${id}/resend`, {
    method: 'POST',
  }).then((r) => r.resend === true)
}

/**
 * 手工判死。<b>危险操作</b>。
 *
 * 判死之后这条消息不会再被定时任务发送 ——
 * 也就是说它承载的那个业务动作（关单、扣库存、放库存）<b>永远不会发生</b>。
 * 后端会拒绝对已发送（SENT）的消息判死。
 */
export function markOutboxDead(kind: OutboxKind, id: Id, reason: string): Promise<boolean> {
  return request<{ code: number; dead: boolean }>(`${OUTBOX_BASE[kind]}/${id}/dead`, {
    method: 'POST',
    query: { reason },
  }).then((r) => r.dead === true)
}

// ---------------------------------------------------------------------------
// 消费幂等
// ---------------------------------------------------------------------------

/** 数值来自 mall-common 的 MqConsumeStatus。 */
export const CONSUME_STATUS = {
  PROCESSING: 0,
  SUCCESS: 1,
  FAILED: 2,
} as const

export const CONSUME_STATUS_LABEL: Record<number, string> = {
  0: '处理中',
  1: '成功',
  2: '失败',
}

export interface MqConsumeRecord {
  id: Id
  /** 消费者组，实际上是监听器名，如 stock-deduct-listener。 */
  consumerGroup: string
  messageKey: string
  businessType: string
  status: number
  consumeCount: number
  lastError: string | null
  successTime: string | null
  createTime: string | null
  updateTime: string | null
}

export type ConsumeKind = 'order' | 'ware'

const CONSUME_BASE: Record<ConsumeKind, string> = {
  order: '/order/mq-consume',
  ware: '/ware/mq-consume',
}

export interface ConsumeQuery {
  page: number
  limit: number
  status?: number
  consumerGroup?: string
  businessType?: string
  /** 在 message_key 上模糊。 */
  key?: string
}

export function fetchConsumeRecords(
  kind: ConsumeKind,
  q: ConsumeQuery,
  signal?: AbortSignal
): Promise<PageResult<MqConsumeRecord>> {
  return fetchPage<MqConsumeRecord>(`${CONSUME_BASE[kind]}/list`, { ...q }, { signal })
}

export function fetchConsumeStats(
  kind: ConsumeKind,
  signal?: AbortSignal
): Promise<Record<number, number>> {
  return request<{ code: number; counts: Record<string, number> }>(
    `${CONSUME_BASE[kind]}/stats`,
    { signal }
  ).then((r) => numericKeys(r.counts))
}

/**
 * 已知的消费者组。用于筛选下拉框。
 *
 * <b>写死在前端是有意的</b>：这五个是代码里 consumeOnce(...) 的第一个参数，
 * 不是配置、也没有接口能列出来。做成下拉框而不是自由输入，
 * 是因为输错一个字母的结果是「查出 0 条」，
 * 而那看起来和「这个监听器没出过问题」一模一样。
 *
 * 加了新监听器而这里没更新时，列表本身仍然会显示它 ——
 * 只是筛选下拉里没有。这个失败方向是安全的。
 */
export const CONSUMER_GROUPS: Record<ConsumeKind, string[]> = {
  order: ['order-close-listener', 'seckill-order-listener'],
  ware: ['stock-deduct-listener', 'stock-fail-listener', 'stock-release-listener'],
}

// ---------------------------------------------------------------------------

/** 后端返回的 map 键在 JSON 里一定是字符串，转回数字方便和状态常量比较。 */
function numericKeys(counts: Record<string, number> | undefined): Record<number, number> {
  const result: Record<number, number> = {}
  for (const [k, v] of Object.entries(counts ?? {})) {
    const n = Number(k)
    if (Number.isFinite(n)) result[n] = v
  }
  return result
}
