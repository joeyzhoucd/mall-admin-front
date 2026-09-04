import { request, fetchPage } from './client'
import type { Id, PageResult } from './types'

/**
 * 秒杀域接口。
 *
 * 字段是 2026-09-04 直连 mall-coupon 实测的。
 */

/** 秒杀场次。同一个时间段的多个 SKU 共用一个场次。 */
export interface SeckillSession {
  id: Id
  name: string
  /** 格式 "yyyy-MM-dd HH:mm:ss"。 */
  startTime: string
  endTime: string
  status: number
  createTime: string
}

export function fetchSeckillSessions(
  q: { page: number; limit: number },
  signal?: AbortSignal
): Promise<PageResult<SeckillSession>> {
  return fetchPage<SeckillSession>('/coupon/seckillsession/list', { ...q }, { signal })
}

/**
 * 场次 ⇄ SKU 的秒杀配置。
 *
 * <b>不返回 skuName</b>，只有 skuId —— 商品名要另外从 mall-product 取。
 * 也<b>不返回「是否已上线」</b>：上线状态的真相在 Redis 的
 * {@code seckill:stock:{id}} 键上，不在这张表里。
 * 所以界面上不能声称某一条「已上线」，只能显示配置本身。
 */
export interface SeckillRelation {
  id: Id
  promotionId: Id
  promotionSessionId: Id
  skuId: Id
  seckillCount: number
  seckillLimit: number
  seckillPrice: number
  seckillSort: number
  soldCount: number
}

export function fetchSeckillRelations(
  q: { page: number; limit: number },
  signal?: AbortSignal
): Promise<PageResult<SeckillRelation>> {
  return fetchPage<SeckillRelation>('/coupon/seckillskurelation/list', { ...q }, { signal })
}

/**
 * 配置一个 SKU 的秒杀。
 *
 * <h3>时间格式必须是 "yyyy-MM-dd HH:mm:ss"</h3>
 * 后端用固定的 DateTimeFormatter 解析，<b>不接受 ISO 串</b>。
 * `<input type="datetime-local">` 给的是 "2026-09-10T10:00"，直接传会被拒，
 * 报错是「格式不对，期望 yyyy-MM-dd HH:mm:ss」。转换见 toBackendTime()。
 *
 * <h3>保存不等于上线</h3>
 * 返回体里带 relationId，因为真实库存在 Redis，
 * 要再调 activateSeckill() 才会开卖。
 */
export interface SeckillDraft {
  skuId: Id
  startTime: string
  endTime: string
  seckillPrice: number
  seckillCount: number
  seckillLimit: number
  seckillSort: number
}

export interface SeckillSaveResult {
  code: number
  relationId?: Id
  activated?: boolean
  msg?: string
}

export function saveSeckill(draft: SeckillDraft): Promise<SeckillSaveResult> {
  return request<SeckillSaveResult>('/coupon/seckill/scheduler/save', {
    method: 'POST',
    body: draft,
  })
}

/**
 * 激活（把库存放进 Redis，正式开卖）。
 *
 * <h3>这个动作对已上线的活动会被后端拒绝，那是有意的</h3>
 * 激活做的是<b>重置</b>：库存回满 + 清空每人限购记录。
 * 对正在进行的秒杀再点一次，已经抢中的人可以再抢一次，<b>直接超卖</b>。
 * 后端以 Redis 里的库存键为准拦住这种情况（SeckillActivateGuardTest 守着）。
 *
 * 走的是 /coupon/seckill/scheduler/activate 而<b>不是</b>
 * /coupon/seckill/activate —— 后者要求内部令牌，
 * 而把内部令牌发到浏览器等于公开它，任何拿到的人都能开卖任意一场秒杀。
 */
export function activateSeckill(relationId: Id): Promise<unknown> {
  return request(`/coupon/seckill/scheduler/activate/${relationId}`, { method: 'POST' })
}

/** 删除一条秒杀配置。请求体是 id 数组（生成器的批量删除接口）。 */
export function deleteSeckillRelations(ids: Id[]): Promise<unknown> {
  return request('/coupon/seckillskurelation/delete', {
    method: 'POST',
    body: ids.map(Number),
  })
}

/**
 * 把 `<input type="datetime-local">` 的值转成后端要的格式。
 *
 * 输入 "2026-09-10T10:00" 或 "2026-09-10T10:00:30"，
 * 输出 "2026-09-10 10:00:00" / "2026-09-10 10:00:30"。
 *
 * <b>不用 new Date().toISOString()</b>：那会把本地时间转成 UTC，
 * 于是管理员填的 10:00 变成后端收到的 02:00 —— 活动时间整体偏移，
 * 而且界面上完全看不出来（填的和显示的都是 10:00）。
 * 这里做的是纯字符串改写，不碰时区。
 */
export function toBackendTime(local: string): string {
  if (!local) return ''
  const [date, time = ''] = local.split('T')
  const parts = time.split(':')
  const hh = parts[0] ?? '00'
  const mm = parts[1] ?? '00'
  const ss = parts[2] ?? '00'
  return `${date} ${hh}:${mm}:${ss}`
}

/** 反向：把后端的 "yyyy-MM-dd HH:mm:ss" 填回 datetime-local 输入框。 */
export function toLocalInput(backend: string): string {
  if (!backend) return ''
  return backend.trim().replace(' ', 'T').slice(0, 16)
}
