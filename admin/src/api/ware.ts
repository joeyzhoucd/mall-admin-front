import { request, fetchPage, fetchData } from './client'
import type { Id, PageResult } from './types'

/**
 * 库存域接口。字段是 2026-09-05 直连 mall-ware 实测的。
 */

// ---------------------------------------------------------------------------
// 仓库
// ---------------------------------------------------------------------------

export interface WareInfo {
  id: Id
  name: string
  address: string
  /** 区域编码，如 "440300"。后端是字符串。 */
  areacode: string
}

export function fetchWareInfos(
  q: { page: number; limit: number; key?: string },
  signal?: AbortSignal
): Promise<PageResult<WareInfo>> {
  return fetchPage<WareInfo>('/ware/wareinfo/list', { ...q }, { signal })
}

export function fetchWareInfo(id: Id, signal?: AbortSignal): Promise<WareInfo> {
  return fetchData<WareInfo>(`/ware/wareinfo/info/${id}`, { signal })
}

/**
 * 新增/修改。后端是两个地址（/save 和 /update），
 * 旧前端写成 `/ware/wareinfo/${!id ? 'save' : 'update'}`，
 * 所以 BASELINE.md 里它显示成 `/ware/wareinfo/{}`。
 */
export function saveWareInfo(w: Omit<WareInfo, 'id'>): Promise<unknown> {
  return request('/ware/wareinfo/save', { method: 'POST', body: w })
}

export function updateWareInfo(w: WareInfo): Promise<unknown> {
  return request('/ware/wareinfo/update', { method: 'POST', body: w })
}

/** 批量删除，请求体是 id 数组。 */
export function deleteWareInfos(ids: Id[]): Promise<unknown> {
  return request('/ware/wareinfo/delete', { method: 'POST', body: ids.map(Number) })
}

// ---------------------------------------------------------------------------
// 商品库存
// ---------------------------------------------------------------------------

/**
 * 仓库里某个 SKU 的库存。
 *
 * <b>这个接口返回 skuName</b>（实测），所以不用再去 mall-product 查商品名 ——
 * 和 spuinfo/list 只给 id 的行为不一样，别照着那边写。
 */
export interface WareSku {
  id: Id
  skuId: Id
  skuName: string
  wareId: Id
  stock: number
  /** 已被订单锁定的数量。可售 = stock - stockLocked。 */
  stockLocked: number
}

export function fetchWareSkus(
  q: { page: number; limit: number; skuId?: Id; wareId?: Id },
  signal?: AbortSignal
): Promise<PageResult<WareSku>> {
  return fetchPage<WareSku>('/ware/waresku/list', { ...q }, { signal })
}

export function fetchWareSku(id: Id, signal?: AbortSignal): Promise<WareSku> {
  return fetchData<WareSku>(`/ware/waresku/info/${id}`, { signal })
}

export function saveWareSku(s: Omit<WareSku, 'id'>): Promise<unknown> {
  return request('/ware/waresku/save', { method: 'POST', body: s })
}

export function updateWareSku(s: WareSku): Promise<unknown> {
  return request('/ware/waresku/update', { method: 'POST', body: s })
}

export function deleteWareSkus(ids: Id[]): Promise<unknown> {
  return request('/ware/waresku/delete', { method: 'POST', body: ids.map(Number) })
}

// ---------------------------------------------------------------------------
// 采购单
// ---------------------------------------------------------------------------

/**
 * 采购单状态。后端是裸数字加英文注释，没有常量类，
 * 取值从 PurchaseServiceImpl 里读出来的。
 */
export const PURCHASE_STATUS = {
  CREATED: 0,
  ASSIGNED: 1,
  RECEIVED: 2,
  FINISHED: 3,
  HAS_ERROR: 4,
} as const

export const PURCHASE_STATUS_TEXT: Record<number, string> = {
  0: '新建',
  1: '已分配',
  2: '已领取',
  3: '已完成',
  4: '有异常',
}

export interface Purchase {
  id: Id
  assigneeId: Id | null
  assigneeName: string | null
  phone: string | null
  priority: number | null
  status: number
  wareId: Id | null
  amount: number | null
  createTime: string | null
  updateTime: string | null
}

export function fetchPurchases(
  q: { page: number; limit: number; key?: string; status?: number },
  signal?: AbortSignal
): Promise<PageResult<Purchase>> {
  return fetchPage<Purchase>('/ware/purchase/list', { ...q }, { signal })
}

export function savePurchase(p: Partial<Purchase>): Promise<unknown> {
  return request('/ware/purchase/save', { method: 'POST', body: p })
}

export function updatePurchase(p: Partial<Purchase>): Promise<unknown> {
  return request('/ware/purchase/update', { method: 'POST', body: p })
}

export function deletePurchases(ids: Id[]): Promise<unknown> {
  return request('/ware/purchase/delete', { method: 'POST', body: ids.map(Number) })
}

/** 分配采购员。四个字段后端都会取，缺一个会 NPE 在 String.valueOf(null) 上变成 "null"。 */
export function assignPurchase(
  purchaseId: Id,
  assigneeId: Id,
  assigneeName: string,
  phone: string
): Promise<unknown> {
  return request('/ware/purchase/assign', {
    method: 'POST',
    body: { purchaseId: Number(purchaseId), assigneeId: Number(assigneeId), assigneeName, phone },
  })
}

/** 领取采购单，可批量。 */
export function receivePurchases(
  purchaseIds: Id[],
  receiverId: Id,
  receiverName: string
): Promise<unknown> {
  return request('/ware/purchase/receive', {
    method: 'POST',
    body: {
      purchaseIds: purchaseIds.map(Number),
      receiverId: Number(receiverId),
      receiverName,
    },
  })
}

/**
 * 完成采购 —— <b>这一步会真的往仓库加库存</b>。
 *
 * <h3>成功明细会入库，失败明细不会</h3>
 * 采购单最终状态：有任何失败明细就是「有异常」(4)，否则「已完成」(3)。
 *
 * <h3>重复完成会被后端拒绝</h3>
 * 2026-09-05 之前 finish 不检查明细是否已完成过，调两次库存就加两遍
 * （事务只保证一次调用的原子性，挡不住第二次调用）。
 * 现在已完成的明细会被跳过，见 PurchaseFinishIdempotencyTest。
 * 界面上仍然要防重复提交 —— 依赖后端兜底不等于可以随便点。
 */
export function finishPurchase(
  purchaseId: Id,
  successDetailIds: Id[],
  failedDetailIds: Id[]
): Promise<unknown> {
  return request('/ware/purchase/finish', {
    method: 'POST',
    body: {
      purchaseId: Number(purchaseId),
      successDetailIds: successDetailIds.map(Number),
      failedDetailIds: failedDetailIds.map(Number),
    },
  })
}

/**
 * 把采购需求合并进一张采购单。
 *
 * purchaseId 不传（或传空）时后端会<b>新建</b>一张采购单。
 * 这一点在界面上要说清楚，否则「不选采购单直接点合并」的结果
 * 是凭空多出一张单子，而用户以为什么都没发生。
 */
export function mergePurchaseDetails(detailIds: Id[], purchaseId?: Id): Promise<unknown> {
  const body: Record<string, unknown> = { detailIds: detailIds.map(Number) }
  if (purchaseId) body.purchaseId = Number(purchaseId)
  return request('/ware/purchase/merge', { method: 'POST', body })
}

// ---------------------------------------------------------------------------
// 采购需求（采购单明细）
// ---------------------------------------------------------------------------

export const DETAIL_STATUS_TEXT: Record<number, string> = {
  0: '新建',
  1: '已分配',
  2: '正在采购',
  3: '已完成',
  4: '采购失败',
}

export interface PurchaseDetail {
  id: Id
  purchaseId: Id | null
  skuId: Id
  skuNum: number
  skuPrice: number | null
  wareId: Id | null
  status: number
}

export function fetchPurchaseDetails(
  q: { page: number; limit: number; key?: string; status?: number; wareId?: Id },
  signal?: AbortSignal
): Promise<PageResult<PurchaseDetail>> {
  return fetchPage<PurchaseDetail>('/ware/purchasedetail/list', { ...q }, { signal })
}

export function savePurchaseDetail(d: Partial<PurchaseDetail>): Promise<unknown> {
  return request('/ware/purchasedetail/save', { method: 'POST', body: d })
}

export function updatePurchaseDetail(d: Partial<PurchaseDetail>): Promise<unknown> {
  return request('/ware/purchasedetail/update', { method: 'POST', body: d })
}

export function deletePurchaseDetails(ids: Id[]): Promise<unknown> {
  return request('/ware/purchasedetail/delete', { method: 'POST', body: ids.map(Number) })
}
