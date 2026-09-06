import { request, fetchPage, fetchData } from './client'
import type { Id, PageResult } from './types'

/**
 * 订单域接口。
 *
 * <h3>列表和详情是 2026-09-05 才补的</h3>
 * OrderService.queryPage 一直存在，但控制器上没有入口 ——
 * 同服务其它控制器（订单项、退货申请、支付、退款）都还留着完整生成器 CRUD，
 * 唯独主实体这两个被拿掉了。
 *
 * <h3>后台对订单是只读的</h3>
 * 没有 save / update / delete，这是有意的：状态迁移有状态机管着
 * （OrderStatus 的 TRANSITION_TABLE），发货、收货、售后各有自己的业务入口，
 * 它们会同时写操作记录、发 outbox 消息、解锁库存。
 * 绕过它们直接改一行数据，那些副作用一个都不会发生，而界面上看起来是成功的。
 */

export interface Order {
  id: Id
  orderSn: string
  memberId: Id
  memberUsername: string | null
  status: number
  totalAmount: number | null
  payAmount: number | null
  freightAmount: number | null
  payType: number | null
  sourceType: number | null
  deliveryCompany: string | null
  deliverySn: string | null
  receiverName: string | null
  receiverPhone: string | null
  receiverProvince: string | null
  createTime: string | null
}

export interface OrderItem {
  id: Id
  orderId: Id
  orderSn: string
  spuId: Id
  spuName: string | null
  spuPic: string | null
  skuId: Id
  skuName: string | null
  skuPic: string | null
  skuPrice: number | null
  skuQuantity: number | null
  /** 销售属性，形如「颜色:黑色;版本:8G」。 */
  skuAttrsVals: string | null
  realAmount: number | null
}

export interface OrderOperateHistory {
  id: Id
  orderId: Id
  operateMan: string | null
  createTime: string | null
  orderStatus: number | null
  note: string | null
}

export interface OrderDetail {
  order: Order
  items: OrderItem[]
  history: OrderOperateHistory[]
}

export interface OrderQuery {
  page: number
  limit: number
  /** 订单号，<b>精确</b>匹配。 */
  orderSn?: string
  /** 收件人 / 会员名 / 电话，模糊匹配。 */
  key?: string
  status?: number
  memberId?: Id
  /** "yyyy-MM-dd HH:mm:ss"，两端可以单独给。 */
  createTimeFrom?: string
  createTimeTo?: string
}

export function fetchOrders(q: OrderQuery, signal?: AbortSignal): Promise<PageResult<Order>> {
  return fetchPage<Order>('/order/order/list', { ...q }, { signal })
}

/**
 * 订单详情：订单 + 明细 + 操作记录，<b>一次取全</b>。
 *
 * 用 orderSn 而不是 id 定位：订单号是对外的那个标识
 * （客服和客户之间报的、支付回调带的都是它），而 id 只在库里有意义。
 */
export function fetchOrderDetail(orderSn: string, signal?: AbortSignal): Promise<OrderDetail> {
  return fetchData<OrderDetail>(`/order/order/detail/${orderSn}`, { signal })
}

// ---------------------------------------------------------------------------
// 状态机
// ---------------------------------------------------------------------------

export interface StatusDefinition {
  code: number
  /** 枚举名，如 NEW / PAYED。 */
  value: string
  /** <b>英文</b>标签，如 "Waiting pay"。中文见 STATUS_LABEL_ZH。 */
  label: string
  /** 终态：不能再迁移出去。 */
  terminal: boolean
}

export interface OrderStatusMeta {
  statuses: StatusDefinition[]
  /** from → 允许迁移到的状态列表。 */
  transitionTable: Record<string, number[]>
}

/**
 * 取订单状态机。
 *
 * <h3>为什么从后端取，而不是在前端写一份</h3>
 * 「哪个状态能做什么操作」的真相在后端的 TRANSITION_TABLE 里。
 * 前端自己写一份的话，两边迟早不一致 ——
 * 而不一致的表现是「按钮亮着，点下去报非法状态迁移」，
 * 或者更糟：「按钮灰着，但那个操作其实是允许的」，后者根本不会被报告。
 */
export function fetchOrderStatusMeta(signal?: AbortSignal): Promise<OrderStatusMeta> {
  return request<{ code: number; statuses: StatusDefinition[]; transitionTable: Record<string, number[]> }>(
    '/order/order/statuses',
    { signal }
  ).then((r) => ({ statuses: r.statuses ?? [], transitionTable: r.transitionTable ?? {} }))
}

/**
 * 状态的中文显示名。
 *
 * <b>只负责显示，不负责「有哪些状态」</b> —— 状态列表一律从后端的
 * definitions 取。这样后端新增一个状态时，它会以英文露出来，
 * 而不是从界面上悄悄消失。
 */
export const STATUS_LABEL_ZH: Record<number, string> = {
  0: '待付款',
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已关闭',
  5: '售后中',
  6: '售后完成',
}

/** 拿不到中文名时回落到后端给的英文，而不是显示成空或「未知」。 */
export function statusLabel(code: number, defs: StatusDefinition[]): string {
  return STATUS_LABEL_ZH[code] ?? defs.find((d) => d.code === code)?.label ?? `状态 ${code}`
}

// ---------------------------------------------------------------------------
// 业务动作
// ---------------------------------------------------------------------------

/** 发货。物流公司和运单号都必填 —— 没有运单号的「已发货」对客服毫无用处。 */
export function shipOrder(
  orderSn: string,
  deliveryCompany: string,
  deliverySn: string
): Promise<unknown> {
  return request('/order/order/ship', {
    method: 'POST',
    body: { orderSn, deliveryCompany, deliverySn },
  })
}

/** 代客确认收货。 */
export function receiveOrder(orderSn: string): Promise<unknown> {
  return request('/order/order/receive', { method: 'POST', body: { orderSn } })
}

export function completeOrder(orderSn: string): Promise<unknown> {
  return request('/order/order/complete', { method: 'POST', body: { orderSn } })
}

export function startAfterSale(orderSn: string, note: string): Promise<unknown> {
  return request('/order/order/after-sale/start', { method: 'POST', body: { orderSn, note } })
}

export function finishAfterSale(orderSn: string, note: string): Promise<unknown> {
  return request('/order/order/after-sale/finish', { method: 'POST', body: { orderSn, note } })
}
