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
// SPU（商品）
// ---------------------------------------------------------------------------

/**
 * 商品（SPU）。实测字段。
 *
 * <b>列表只返回 brandId / categoryId，不返回名字</b> ——
 * 所以页面要自己拿品牌列表和分类树在前端拼名字。
 * 这也是旧版 spu.vue 要额外拉那两个接口的原因。
 */
export interface Spu {
  id: Id
  spuName: string
  spuDescription: string
  brandId: Id
  categoryId: Id
  /** <b>1 = 已上架，0 = 未上架/已下架</b>。没有 2 —— 后端 upSpu 置 1、downSpu 置 0。 */
  publishStatus: number
  weight: number
  createTime: string
  updateTime: string
}

export interface SpuQuery {
  page: number
  limit: number
  key?: string
  categoryId?: Id
  brandId?: Id
  /** 参数名是 status，不是 publishStatus。 */
  status?: number
}

export function fetchSpus(q: SpuQuery, signal?: AbortSignal): Promise<PageResult<Spu>> {
  return fetchPage<Spu>('/product/spuinfo/list', { ...q }, { signal })
}

/**
 * 上架。<b>一次只能一个</b>（后端签名是 /{spuId}/up），
 * 而下架和删除是批量的 —— 这个不对称是后端的既有形状，不是这里写漏了。
 *
 * 上架会同步商品到 ES，比下架慢得多，失败也更常见。
 */
export function publishSpu(spuId: Id): Promise<unknown> {
  return request(`/product/spuinfo/${spuId}/up`, { method: 'POST' })
}

/** 下架，批量。请求体是 id 数组。 */
export function unpublishSpus(spuIds: Id[]): Promise<unknown> {
  return request('/product/spuinfo/unpublish', { method: 'POST', body: spuIds.map(Number) })
}

/** 删除，批量。请求体是 id 数组。 */
export function deleteSpus(spuIds: Id[]): Promise<unknown> {
  return request('/product/spuinfo/delete', { method: 'POST', body: spuIds.map(Number) })
}

/**
 * 发布商品的载荷（对应后端 SpuSaveVo）。
 *
 * 字段名<b>照抄后端</b>，包括拼错的那个：规格描述图数组叫 <b>decript</b>
 * （不是 description、也不是 descript）。改成"对的"拼写后端就收不到了，
 * 而且不报错 —— 只是商品详情页没有描述图。
 */
export interface SpuSavePayload {
  spuName: string
  spuDescription: string
  categoryId: number
  brandId: number
  weight: number
  /** 保存时一律 0（未上架）。上架是单独的动作，走 /{spuId}/up。 */
  publishStatus: number
  /** 商品详情描述图的地址列表。后端字段名就是 decript。 */
  decript: string[]
  /** 商品图片集。 */
  images: string[]
  bounds: { buyBounds: number; growBounds: number }
  baseAttrs: { attrId: number; attrValues: string; showDesc: number }[]
  skus: SpuSaveSku[]
}

export interface SpuSaveSku {
  attr: { attrId: number; attrName: string; attrValue: string }[]
  skuName: string
  skuTitle: string
  skuSubtitle: string
  price: number
  stock: number
  skuCode: string
  images: { imgUrl: string; defaultImg: number }[]
  /** 满 N 件打折。countStatus 1 表示叠加其它优惠。 */
  fullCount: number
  discount: number
  countStatus: number
  /** 满 X 元减 Y 元。 */
  fullPrice: number
  reducePrice: number
  priceStatus: number
  memberPrice: { id: number; name: string; price: number }[]
}

export function saveSpu(payload: SpuSavePayload): Promise<unknown> {
  return request('/product/spuinfo/save', { method: 'POST', body: payload })
}

/** 某个分类下的属性分组，每组带着它的属性 —— 发布商品第二步填规格参数用。 */
export interface AttrGroupWithAttrs {
  attrGroupId: Id
  attrGroupName: string
  categoryId: Id
  sort: number
  attrs: {
    attrId: Id
    attrName: string
    valueSelect: string | null
    showDesc: number
  }[]
}

export function fetchAttrGroupsWithAttrs(
  categoryId: Id,
  signal?: AbortSignal
): Promise<AttrGroupWithAttrs[]> {
  return fetchData<AttrGroupWithAttrs[]>(`/product/attrgroup/withattr/${categoryId}`, { signal })
}

/**
 * 某分类下的销售属性 —— 发布商品第三步用它组合出 SKU。
 *
 * 注意这个地址<b>返回的是分页容器</b>（后端 listSaleAttrByPath 里
 * 塞了 page=1 / limit=500 再走同一个分页查询），
 * 虽然它长得像一个「按 id 取列表」的接口。
 */
export async function fetchSaleAttrsByCategory(
  categoryId: Id,
  signal?: AbortSignal
): Promise<{ attrId: Id; attrName: string; valueSelect: string | null }[]> {
  const page = await fetchPage<{ attrId: Id; attrName: string; valueSelect: string | null }>(
    `/product/attr/sale/list/${categoryId}`,
    {},
    { signal }
  )
  return page.list
}

// ---------------------------------------------------------------------------
// SKU
// ---------------------------------------------------------------------------

export interface SkuImage {
  id: Id
  imgUrl: string
  imgSort: number
  /** 1 表示是默认主图。 */
  defaultImg: number
}

export interface SkuSaleAttr {
  attrId: Id
  attrName: string
  attrValue: string
  attrSort: number
}

export interface Sku {
  skuId: Id
  spuId: Id
  skuName: string
  skuDesc: string | null
  categoryId: Id
  brandId: Id
  skuDefaultImg: string | null
  skuTitle: string | null
  skuSubtitle: string | null
  price: number
  saleCount: number
  categoryName: string | null
  brandName: string | null
  images: SkuImage[] | null
  saleAttrs: SkuSaleAttr[] | null
}

export interface SkuQuery {
  page: number
  limit: number
  key?: string
  categoryId?: Id
  brandId?: Id
  /** 查某个 SPU 下的全部 SKU 时用。 */
  spuId?: Id
}

export function fetchSkus(q: SkuQuery, signal?: AbortSignal): Promise<PageResult<Sku>> {
  return fetchPage<Sku>('/product/skuinfo/list', { ...q }, { signal })
}

/**
 * 可以改的 SKU 字段。
 *
 * <b>后端有白名单</b>（SkuInfoServiceImpl.updateBasicInfo）：只有这四个字段会生效，
 * 请求体里的其它字段一律被忽略 —— 那是防越权写入的，不是漏写。
 * 所以这里也只暴露这四个，免得界面上摆出一个改了不生效的输入框。
 */
export interface SkuBasicUpdate {
  skuId: Id
  skuName: string
  skuTitle: string
  skuSubtitle: string
  price: number
}

export function updateSkuBasic(patch: SkuBasicUpdate): Promise<unknown> {
  return request('/product/skuinfo/update', { method: 'POST', body: patch })
}

/** 批量删除 SKU，请求体是 id 数组。 */
export function deleteSkus(skuIds: Id[]): Promise<unknown> {
  return request('/product/skuinfo/delete', { method: 'POST', body: skuIds.map(Number) })
}

/** 单个 SPU 的详情，规格页顶部用来显示「这是哪个商品」。 */
export function fetchSpuInfo(spuId: Id, signal?: AbortSignal): Promise<Spu> {
  return fetchData<Spu>(`/product/spuinfo/info/${spuId}`, { signal, key: 'spuInfo' })
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

/**
 * 树节点保留<b>全部可编辑字段</b>。
 *
 * 【为什么不调 /product/category/info/{catId}】
 * 旧页面点「编辑」会再去拉一次详情，但 list/tree 返回的就是完整实体
 * （实测含 icon、productUnit、showStatus、sort），再拉一次是白跑一趟往返。
 * 所以那个接口在这里<b>有意不用</b> —— 记在这里是为了让对照 BASELINE.md 的人
 * 知道这是个决定，不是漏了。
 */
export interface CategoryNode {
  id: Id
  name: string
  parentId: Id
  level: number
  sort: number
  showStatus: number
  icon: string
  productUnit: string
  /** 挂在该分类下的商品数。删除前的判断依据之一，后端可能给 null。 */
  productCount: number | null
  children: CategoryNode[]
}

function toCategoryNode(raw: RawCategory): CategoryNode {
  return {
    id: normalizeId(raw.catId),
    name: raw.name,
    parentId: normalizeId(raw.parentCid),
    level: raw.catLevel,
    sort: raw.sort,
    showStatus: raw.showStatus,
    // 后端这几个字段会给 null，而表单里 null 会让 MUI 的输入框从受控变非受控
    // （控制台一句警告，然后那个框就再也改不动了）。在边界上归一成空串。
    icon: raw.icon ?? '',
    productUnit: raw.productUnit ?? '',
    productCount: raw.productCount,
    children: (raw.children ?? []).map(toCategoryNode),
  }
}

export async function fetchCategoryTree(signal?: AbortSignal): Promise<CategoryNode[]> {
  const raw = await fetchData<RawCategory[]>('/product/category/list/tree', { signal })
  return raw.map(toCategoryNode)
}

/**
 * 分类的可编辑字段。<b>id 一律用字符串</b>（见 CategoryNode 上的说明），
 * 发给后端时再转回数字 —— 后端的 catId / parentCid 是 Long。
 */
export interface CategoryDraft {
  catId?: Id
  name: string
  parentCid: Id
  catLevel: number
  sort: number
  showStatus: number
  icon: string
  productUnit: string
}

/** 字符串 id 转回数字。空串要变成 undefined 而不是 0 —— 0 是根分类的合法父 id。 */
function toNumberId(id: Id | undefined): number | undefined {
  if (id === undefined || id === '') return undefined
  const n = Number(id)
  return Number.isFinite(n) ? n : undefined
}

function toRawPayload(d: CategoryDraft) {
  return {
    catId: toNumberId(d.catId),
    name: d.name,
    parentCid: toNumberId(d.parentCid) ?? 0,
    catLevel: d.catLevel,
    sort: d.sort,
    showStatus: d.showStatus,
    icon: d.icon,
    productUnit: d.productUnit,
  }
}

export function createCategory(draft: CategoryDraft): Promise<unknown> {
  const { catId: _drop, ...body } = toRawPayload(draft)
  return request('/product/category/save', { method: 'POST', body })
}

export function updateCategory(draft: CategoryDraft): Promise<unknown> {
  return request('/product/category/update', { method: 'POST', body: toRawPayload(draft) })
}

/** 批量删除。请求体是 id 数组（后端签名是 Long[]），是<b>逻辑删除</b>。 */
export function deleteCategories(catIds: Id[]): Promise<unknown> {
  return request('/product/category/delete', {
    method: 'POST',
    body: catIds.map((id) => toNumberId(id)),
  })
}

/** 调整层级/排序后的元素。旧前端拖拽保存发的就是这四个字段。 */
export interface CategoryPositionChange {
  catId: Id
  parentCid: Id
  catLevel: number
  sort: number
}

/**
 * 批量保存层级/排序调整。
 *
 * 【2026-09-03 之前这个接口是坏的】后端用的是 saveBatch（INSERT 语义），
 * 而调用方发的是已存在的分类，必然主键冲突 —— 也就是说旧后台的
 * 「批量保存」按钮从上线起就没成功过一次。
 * 已改成 updateBatchById，见 CategoryControllerGuardTest。
 */
export function saveCategoryPositions(changes: CategoryPositionChange[]): Promise<unknown> {
  return request('/product/category/save/drag', {
    method: 'POST',
    body: changes.map((c) => ({
      catId: toNumberId(c.catId),
      parentCid: toNumberId(c.parentCid) ?? 0,
      catLevel: c.catLevel,
      sort: c.sort,
    })),
  })
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
