import { request, fetchPage, fetchData } from './client'
import { normalizeId, type Id, type PageResult } from './types'

/**
 * 商品域的接口。
 *
 * 字段不是照后端实体抄的，是 2026-09-03 直连 mall-product 逐个探出来的
 * （网关已经要管理端 JWT，而拿 JWT 要过验证码，所以走 port-forward）。
 * 照实体猜的后果是类型编译得过、界面上那一列空着 —— 而空列和「这条数据本来就没值」
 * 长得一模一样。
 */

// ---------------------------------------------------------------------------
// 品牌
// ---------------------------------------------------------------------------

/**
 * 实测字段（GET /product/brand/list）。
 *
 * 注意 <b>descript</b> 不是 description —— 这是后端字段名，别「顺手改对」，
 * 改了之后表单提交上去后端收不到，而且不会报错。
 */
export interface Brand {
  brandId: Id
  name: string
  /** 品牌介绍。后端字段就叫 descript。 */
  descript: string
  /** 检索首字母，单个大写字母。 */
  firstLetter: string
  /** Logo 地址。实测多数为空串而不是 null。 */
  logo: string
  /** 1 显示 / 0 不显示。后端给的是数字，不是布尔。 */
  showStatus: number
  sort: number
}

export interface BrandQuery {
  page: number
  limit: number
  /**
   * 关键字。同时匹配 brandId 精确、name 模糊、firstLetter 模糊。
   *
   * 【2026-09-03 之前这个参数是无效的】BrandServiceImpl.queryPage 传的是空
   * QueryWrapper，key 传过去悄悄被忽略、返回全量第一页。没人发现是因为
   * 旧后台的品牌页根本没有搜索框。后端已补上，见 BrandQueryWrapperTest。
   */
  key?: string
}

export function fetchBrands(q: BrandQuery, signal?: AbortSignal): Promise<PageResult<Brand>> {
  return fetchPage<Brand>('/product/brand/list', { ...q }, { signal })
}

/** 新增。后端按 save/update 分两个地址，不是同一个地址靠有没有 id 区分。 */
export function createBrand(brand: Omit<Brand, 'brandId'>): Promise<unknown> {
  return request('/product/brand/save', { method: 'POST', body: brand })
}

export function updateBrand(brand: Brand): Promise<unknown> {
  return request('/product/brand/update', { method: 'POST', body: brand })
}

/** 删除是 POST 不是 DELETE，id 在路径上、没有请求体（沿用后端既有约定）。 */
export function deleteBrand(brandId: Id): Promise<unknown> {
  return request(`/product/brand/delete/${brandId}`, { method: 'POST' })
}

/** 单独的显示状态切换接口，只传这两个字段。 */
export function updateBrandStatus(brandId: Id, showStatus: number): Promise<unknown> {
  return request('/product/brand/updateStatus', {
    method: 'POST',
    body: { brandId, showStatus },
  })
}

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------

/**
 * 分类树节点（GET /product/category/list/tree）。
 *
 * <b>这里的 id 是数字</b>，而品牌、SKU 那些接口的 id 是字符串。
 * 原因大概是部分实体配了 Long → String 序列化以避免 JS 精度丢失，分类树没配。
 * 所以下面 toCategoryNode 会统一转成字符串 —— 不转的话，
 * 拿分类 id 和关系接口返回的 categoryId（字符串）比较会永远不相等，
 * 表现是「关联分类对话框里一个都没勾上」。
 */
interface RawCategory {
  catId: number
  name: string
  parentCid: number
  catLevel: number
  showStatus: number
  sort: number
  productCount: number | null
  productUnit: string | null
  icon: string | null
  children?: RawCategory[]
}

export interface CategoryNode {
  id: Id
  name: string
  parentId: Id
  level: number
  children: CategoryNode[]
}

function toCategoryNode(raw: RawCategory): CategoryNode {
  return {
    id: normalizeId(raw.catId),
    name: raw.name,
    parentId: normalizeId(raw.parentCid),
    level: raw.catLevel,
    children: (raw.children ?? []).map(toCategoryNode),
  }
}

export async function fetchCategoryTree(signal?: AbortSignal): Promise<CategoryNode[]> {
  const raw = await fetchData<RawCategory[]>('/product/category/list/tree', { signal })
  return raw.map(toCategoryNode)
}

// ---------------------------------------------------------------------------
// 品牌 ⇄ 分类 关联
// ---------------------------------------------------------------------------

/** 实测字段。全部是字符串，包括 categoryId —— 和分类树的数字 catId 要归一后再比。 */
export interface BrandCategoryRelation {
  id: Id
  brandId: Id
  brandName: string
  categoryId: Id
  categoryName: string
}

export function fetchBrandRelations(
  brandId: Id,
  signal?: AbortSignal
): Promise<BrandCategoryRelation[]> {
  return fetchData<BrandCategoryRelation[]>(
    `/product/categorybrandrelation/getRelationsByBrandId/${brandId}`,
    { signal }
  )
}

/**
 * 覆盖式保存关联：请求体是一个<b>分类 id 数组</b>，不是对象。
 *
 * 是覆盖不是追加 —— 传空数组等于清空该品牌的全部关联。
 */
export function updateBrandRelations(brandId: Id, categoryIds: Id[]): Promise<unknown> {
  return request(`/product/categorybrandrelation/updateRelations/${brandId}`, {
    method: 'POST',
    body: categoryIds,
  })
}
