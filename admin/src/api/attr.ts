import { request, fetchPage, fetchData } from './client'
import type { Id, PageResult } from './types'

/**
 * 属性域：属性分组 / 规格参数 / 销售属性。
 *
 * 字段是 2026-09-03 直连 mall-product 实测的。
 */

// ---------------------------------------------------------------------------
// 属性分组
// ---------------------------------------------------------------------------

export interface AttrGroup {
  attrGroupId: Id
  attrGroupName: string
  categoryId: Id
  /** 后端字段名就叫 descript，实测多为 null。 */
  descript: string | null
  icon: string | null
  sort: number
  /**
   * 所属分类名。2026-09-10 后端补上的（一次批量查询，不是逐行查）。
   *
   * <p><b>可能是 null</b>：分组挂在已被删除的分类下时后端留空，
   * 界面要回落显示 categoryId，而不是显示成一片空白 ——
   * 那是脏数据，但它不该表现成"这一行什么都没有"。
   */
  categoryName?: string | null
}

export interface AttrGroupQuery {
  page: number
  limit: number
  key?: string
}

export function fetchAttrGroups(
  q: AttrGroupQuery,
  signal?: AbortSignal
): Promise<PageResult<AttrGroup>> {
  return fetchPage<AttrGroup>('/product/attrgroup/list', { ...q }, { signal })
}

export function createAttrGroup(g: Omit<AttrGroup, 'attrGroupId'>): Promise<unknown> {
  return request('/product/attrgroup/save', { method: 'POST', body: g })
}

export function updateAttrGroup(g: AttrGroup): Promise<unknown> {
  return request('/product/attrgroup/update', { method: 'POST', body: g })
}

/** 单个删除。注意和批量删除是两个不同的地址，不是同一个。 */
export function deleteAttrGroup(id: Id): Promise<unknown> {
  return request(`/product/attrgroup/delete/${id}`, { method: 'POST' })
}

/** 批量删除，请求体是 id 数组。 */
export function deleteAttrGroups(ids: Id[]): Promise<unknown> {
  return request('/product/attrgroup/delete', { method: 'POST', body: ids.map(Number) })
}

// ---------------------------------------------------------------------------
// 属性（规格参数 / 销售属性）
// ---------------------------------------------------------------------------

/**
 * 属性。
 *
 * <b>enable 是字符串 "1" 不是数字 1</b>（实测）。写 enable === 1 会永远为假，
 * 而「永远为假」的表现是所有属性都显示成禁用 —— 没有报错，只是全都不对。
 * 其它数字字段（attrType / searchType / showDesc）确实是数字。
 */
export interface Attr {
  attrId: Id
  attrName: string
  /** 1 = 规格参数，0 = 销售属性。由不同的接口地址区分，保存时不用传。 */
  attrType: number
  categoryId: Id
  categoryName: string | null
  /** "1" 启用 / "0" 禁用。是字符串。 */
  enable: string
  icon: string | null
  /** 1 需要检索 / 0 不需要。 */
  searchType: number
  /** 1 在详情页展示 / 0 不展示。 */
  showDesc: number
  /** 可选值列表，用分号隔开的一个字符串，可能为 null。 */
  valueSelect: string | null
  attrGroupId: Id | null
  attrGroupName: string | null
}

/** 规格参数和销售属性走两套地址，其余完全一样。 */
export type AttrKind = 'spec' | 'sale'

export interface AttrQuery {
  page: number
  limit: number
  /**
   * <b>必填。</b>后端 queryAttrPage 里是
   * {@code params.getOrDefault("categoryId", 0L)} 然后无条件
   * {@code wrapper.eq("category_id", categoryId)} ——
   * 不传就按 category_id = 0 过滤，而真实属性的 category_id 不是 0，
   * 于是<b>永远返回空列表</b>，且不报任何错。
   * 所以界面上必须先选分类，并且在没选时明确说「请先选择分类」，
   * 而不是显示一个空表格。
   */
  categoryId: Id
  key?: string
}

export function fetchAttrs(
  kind: AttrKind,
  q: AttrQuery,
  signal?: AbortSignal
): Promise<PageResult<Attr>> {
  return fetchPage<Attr>(`/product/attr/${kind}/list`, { ...q }, { signal })
}

/**
 * 新增/编辑属性的载荷。
 *
 * 后端的 AttrSaveRequestVO <b>没有 attrType 字段</b> ——
 * 规格还是销售由接口地址决定（saveBaseAttr / saveSaleAttr）。
 * 也没有 enable 字段，启用状态走单独的 updateEnable 接口。
 */
export interface AttrDraft {
  attrId?: Id
  attrName: string
  searchType: number
  valueType: number
  valueSelect: string
  attrGroupId: string
  icon: string
  showDesc: number
  categoryId: Id
}

export function createAttr(kind: AttrKind, draft: AttrDraft): Promise<unknown> {
  const { attrId: _drop, ...body } = draft
  return request(`/product/attr/${kind}/save`, { method: 'POST', body })
}

export function updateAttr(kind: AttrKind, draft: AttrDraft): Promise<unknown> {
  return request(`/product/attr/${kind}/update`, { method: 'POST', body: draft })
}

export function deleteAttr(kind: AttrKind, attrId: Id): Promise<unknown> {
  return request(`/product/attr/${kind}/delete/${attrId}`, { method: 'POST' })
}

export function deleteAttrs(kind: AttrKind, attrIds: Id[]): Promise<unknown> {
  return request(`/product/attr/${kind}/delete`, { method: 'POST', body: attrIds.map(Number) })
}

/** 启用/禁用。后端读的是 params.get("attrId") 和 get("enable")，两个都必须给。 */
export function updateAttrEnable(kind: AttrKind, attrId: Id, enable: number): Promise<unknown> {
  return request(`/product/attr/${kind}/updateEnable`, {
    method: 'POST',
    body: { attrId, enable },
  })
}

// ---------------------------------------------------------------------------
// 分组 ⇄ 属性 关联
// ---------------------------------------------------------------------------

/** getAttrsByGroupId 的元素。attr 是嵌套的完整属性对象。 */
export interface AttrGroupRelation {
  id: Id
  attrGroupId: Id
  attrId: Id
  attrName: string
  attrSort: number
  attr: Attr
}

export function fetchGroupAttrs(
  groupId: Id,
  signal?: AbortSignal
): Promise<AttrGroupRelation[]> {
  return fetchData<AttrGroupRelation[]>(
    `/product/attrattrgrouprelation/getAttrsByGroupId/${groupId}`,
    { signal }
  )
}

/** 还没被这个分组关联的属性，用于「添加关联」的候选列表。 */
export function fetchUnrelatedAttrs(groupId: Id, signal?: AbortSignal): Promise<Attr[]> {
  return fetchData<Attr[]>(`/product/attr/unrelated/${groupId}`, { signal })
}

/** 批量新增关联。是<b>追加</b>不是覆盖 —— 和品牌那边的 updateRelations 语义相反。 */
export function addGroupAttrs(groupId: Id, attrIds: Id[]): Promise<unknown> {
  return request('/product/attrattrgrouprelation/saveBatch', {
    method: 'POST',
    body: attrIds.map((attrId) => ({ attrGroupId: Number(groupId), attrId: Number(attrId) })),
  })
}

/**
 * 解除一条关联。
 *
 * <b>路径参数是 attrId 在前、groupId 在后</b>
 * （后端签名 {@code /delete/{attrId}/{groupId}}）。
 * BASELINE.md 里记的是 delete/{}/{}，看不出顺序 —— 弄反了会删掉别的关系
 * 或者什么都不删，而接口照样返回成功。
 */
export function removeGroupAttr(groupId: Id, attrId: Id): Promise<unknown> {
  return request(`/product/attrattrgrouprelation/delete/${attrId}/${groupId}`, { method: 'POST' })
}
