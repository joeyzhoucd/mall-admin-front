import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import {
  Box, Paper, Stepper, Step, StepLabel, Button, Stack, TextField, MenuItem,
  Typography, Chip, Divider, Alert, Snackbar, CircularProgress, IconButton,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell,
  TableHead, TableRow, TableContainer,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { CategoryPicker } from '@/features/category/CategoryPicker'
import {
  fetchBrands, fetchAttrGroupsWithAttrs, fetchSaleAttrsByCategory, saveSpu,
  type SpuSavePayload, type SpuSaveSku,
} from '@/api/product'
import { fetchMemberLevels } from '@/api/member'
import type { Id } from '@/api/types'

const STEPS = ['基本信息', '规格参数', '销售属性与 SKU'] as const

/** 保存时一律未上架。上架是单独一步（会同步 ES），不该混在「新建」里。 */
const UNPUBLISHED = 0

interface BasicForm {
  spuName: string
  spuDescription: string
  categoryId: Id
  brandId: Id
  weight: string
  buyBounds: string
  growBounds: string
  images: string[]
  decript: string[]
}

/**
 * 发布商品。
 *
 * 接口对照 BASELINE.md 的 spu-add.vue（5 个，一个不少一个不多）：
 * <pre>
 *   /product/category/list/tree        选分类
 *   /product/brand/list                选品牌
 *   /product/attrgroup/withattr/{}     第 2 步的规格参数（按分类）
 *   /product/attr/sale/list/{}         第 3 步的销售属性（按分类）
 *   /member/memberlevel/list           每个 SKU 的会员价
 *   /product/spuinfo/save              保存
 * </pre>
 *
 * <h3>字段名照抄后端，包括拼错的那个</h3>
 * 详情描述图的数组叫 <b>decript</b>（不是 description、也不是 descript）。
 * 「顺手改对」的后果是后端收不到，而且不报错 —— 只是详情页没有描述图。
 *
 * <h3>图片先只支持填地址</h3>
 * 旧版走的是对象存储直传（/thirdparty/oss/presign）。那条链路还没接进来，
 * 与其做一个点了没反应的上传按钮，不如先明确只收 URL。
 */
export default function SpuAddPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const [basic, setBasic] = useState<BasicForm>({
    spuName: '', spuDescription: '', categoryId: '', brandId: '',
    weight: '0', buyBounds: '0', growBounds: '0', images: [], decript: [],
  })

  /** 规格参数的填写值：attrId → 值。 */
  const [baseAttrValues, setBaseAttrValues] = useState<Map<Id, string>>(new Map())

  /** 每个销售属性选中的值：attrId → 值数组。SKU 是这些的笛卡尔积。 */
  const [saleSelections, setSaleSelections] = useState<Map<Id, string[]>>(new Map())

  /** 生成出来的 SKU，可逐个编辑。 */
  const [skus, setSkus] = useState<SpuSaveSku[]>([])

  const brandQuery = useQuery({
    queryKey: ['brands-all'],
    queryFn: ({ signal }) => fetchBrands({ page: 1, limit: 500 }, signal),
    staleTime: 5 * 60 * 1000,
  })

  const groupsQuery = useQuery({
    queryKey: ['attrgroups-withattr', basic.categoryId],
    queryFn: ({ signal }) => fetchAttrGroupsWithAttrs(basic.categoryId, signal),
    enabled: basic.categoryId !== '' && step >= 1,
  })

  const saleAttrsQuery = useQuery({
    queryKey: ['sale-attrs-by-category', basic.categoryId],
    queryFn: ({ signal }) => fetchSaleAttrsByCategory(basic.categoryId, signal),
    enabled: basic.categoryId !== '' && step >= 2,
  })

  const levelsQuery = useQuery({
    queryKey: ['member-levels'],
    queryFn: ({ signal }) => fetchMemberLevels({ page: 1, limit: 100 }, signal),
    enabled: step >= 2,
    staleTime: 5 * 60 * 1000,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SpuSavePayload) => saveSpu(payload),
    onSuccess: () => {
      setToast({ msg: '商品已保存（未上架）', severity: 'success' })
      // 稍等一下让用户看到提示，再回列表
      setTimeout(() => navigate('/product-spu'), 800)
    },
    onError: (e) =>
      setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' }),
  })

  const basicValid =
    basic.spuName.trim() !== '' && basic.categoryId !== '' && basic.brandId !== '' &&
    Number.isFinite(Number(basic.weight))

  /**
   * 按选中的销售属性值做笛卡尔积，生成 SKU 骨架。
   *
   * 已经填过的 SKU 不会被覆盖：用属性值组合当 key 去匹配旧的，
   * 匹配上就保留原来填的价格库存。不这么做的话，
   * 回到第 3 步多勾一个颜色，前面填的所有价格<b>全部清零</b>。
   */
  const generateSkus = () => {
    const attrs = saleAttrsQuery.data ?? []
    const chosen = attrs
      .map((a) => ({ attr: a, values: saleSelections.get(a.attrId) ?? [] }))
      .filter((x) => x.values.length > 0)

    if (chosen.length === 0) { setSkus([]); return }

    let combos: { attrId: Id; attrName: string; attrValue: string }[][] = [[]]
    for (const { attr, values } of chosen) {
      const next: typeof combos = []
      for (const combo of combos) {
        for (const v of values) {
          next.push([...combo, { attrId: attr.attrId, attrName: attr.attrName, attrValue: v }])
        }
      }
      combos = next
    }

    const keyOf = (c: { attrValue: string }[]) => c.map((x) => x.attrValue).join('|')
    const existing = new Map(skus.map((s) => [keyOf(s.attr), s]))

    setSkus(
      combos.map((combo) => {
        const kept = existing.get(keyOf(combo))
        if (kept) return { ...kept, attr: combo.map((c) => ({ ...c, attrId: Number(c.attrId) })) }
        const suffix = combo.map((c) => c.attrValue).join(' ')
        return {
          attr: combo.map((c) => ({ attrId: Number(c.attrId), attrName: c.attrName, attrValue: c.attrValue })),
          skuName: `${basic.spuName} ${suffix}`.trim(),
          skuTitle: `${basic.spuName} ${suffix}`.trim(),
          skuSubtitle: '',
          price: 0, stock: 0, skuCode: '',
          images: [],
          fullCount: 0, discount: 0, countStatus: 0,
          fullPrice: 0, reducePrice: 0, priceStatus: 0,
          memberPrice: (levelsQuery.data?.list ?? []).map((l) => ({
            id: Number(l.id), name: l.name, price: 0,
          })),
        }
      })
    )
  }

  const submit = () => {
    const payload: SpuSavePayload = {
      spuName: basic.spuName.trim(),
      spuDescription: basic.spuDescription.trim(),
      categoryId: Number(basic.categoryId),
      brandId: Number(basic.brandId),
      weight: Number(basic.weight) || 0,
      publishStatus: UNPUBLISHED,
      decript: basic.decript,
      images: basic.images,
      bounds: {
        buyBounds: Number(basic.buyBounds) || 0,
        growBounds: Number(basic.growBounds) || 0,
      },
      baseAttrs: [...baseAttrValues.entries()]
        // 没填值的规格参数不提交 —— 提交空串会在详情页显示一个空的参数行
        .filter(([, v]) => v.trim() !== '')
        .map(([attrId, attrValues]) => ({
          attrId: Number(attrId), attrValues: attrValues.trim(), showDesc: 1,
        })),
      skus,
    }
    saveMutation.mutate(payload)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((s) => (
            <Step key={s}><StepLabel>{s}</StepLabel></Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Stack spacing={2} sx={{ maxWidth: 720 }}>
            <TextField
              label="商品名称" fullWidth autoFocus value={basic.spuName}
              onChange={(e) => setBasic((b) => ({ ...b, spuName: e.target.value }))}
            />
            <TextField
              label="商品描述" fullWidth multiline minRows={2} value={basic.spuDescription}
              onChange={(e) => setBasic((b) => ({ ...b, spuDescription: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <CategoryPicker
                value={basic.categoryId} size="medium" sx={{ flex: 1 }}
                onChange={(id) => {
                  setBasic((b) => ({ ...b, categoryId: id }))
                  // 换分类等于换了一整套规格/销售属性，之前填的都不再适用。
                  // 悄悄留着会导致提交一批属于别的分类的 attrId。
                  setBaseAttrValues(new Map())
                  setSaleSelections(new Map())
                  setSkus([])
                }}
              />
              <TextField
                select label="品牌" value={basic.brandId} sx={{ flex: 1 }}
                onChange={(e) => setBasic((b) => ({ ...b, brandId: e.target.value }))}
              >
                {(brandQuery.data?.list ?? []).map((b) => (
                  <MenuItem key={b.brandId} value={b.brandId}>{b.name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="重量(kg)" value={basic.weight} sx={{ flex: 1 }}
                onChange={(e) => setBasic((b) => ({ ...b, weight: e.target.value }))}
              />
              <TextField
                label="购物积分" value={basic.buyBounds} sx={{ flex: 1 }}
                onChange={(e) => setBasic((b) => ({ ...b, buyBounds: e.target.value }))}
              />
              <TextField
                label="成长积分" value={basic.growBounds} sx={{ flex: 1 }}
                onChange={(e) => setBasic((b) => ({ ...b, growBounds: e.target.value }))}
              />
            </Stack>

            <UrlListField
              label="商品图片" hint="商品图集的图片地址"
              value={basic.images}
              onChange={(v) => setBasic((b) => ({ ...b, images: v }))}
            />
            <UrlListField
              label="详情描述图" hint="详情页从上到下依次展示的图片地址"
              value={basic.decript}
              onChange={(v) => setBasic((b) => ({ ...b, decript: v }))}
            />
          </Stack>
        )}

        {step === 1 && (
          <Box>
            {groupsQuery.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : groupsQuery.error ? (
              <Alert severity="error">
                {groupsQuery.error instanceof Error ? groupsQuery.error.message : '规格参数加载失败'}
              </Alert>
            ) : (groupsQuery.data ?? []).length === 0 ? (
              <Alert severity="info">
                这个分类下还没有属性分组。可以先去「属性分组」页建好分组并关联规格参数，
                也可以跳过这一步 —— 规格参数不是必填的。
              </Alert>
            ) : (
              (groupsQuery.data ?? []).map((g) => (
                <Accordion key={g.attrGroupId} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">{g.attrGroupName}</Typography>
                    <Chip size="small" label={`${g.attrs.length} 项`} sx={{ ml: 1, height: 20 }} />
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {g.attrs.map((a) => {
                        const options = (a.valueSelect ?? '').split(';').filter(Boolean)
                        return options.length > 0 ? (
                          <TextField
                            key={a.attrId} select size="small" label={a.attrName}
                            value={baseAttrValues.get(a.attrId) ?? ''}
                            onChange={(e) =>
                              setBaseAttrValues((m) => new Map(m).set(a.attrId, e.target.value))
                            }
                          >
                            <MenuItem value="">（不填）</MenuItem>
                            {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                          </TextField>
                        ) : (
                          <TextField
                            key={a.attrId} size="small" label={a.attrName}
                            value={baseAttrValues.get(a.attrId) ?? ''}
                            onChange={(e) =>
                              setBaseAttrValues((m) => new Map(m).set(a.attrId, e.target.value))
                            }
                          />
                        )
                      })}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Box>
        )}

        {step === 2 && (
          <Box>
            {saleAttrsQuery.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (saleAttrsQuery.data ?? []).length === 0 ? (
              <Alert severity="warning">
                这个分类下没有销售属性，没法组合出 SKU。
                请先去「销售属性」页为该分类添加属性（比如颜色、尺码）。
              </Alert>
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  勾选每个销售属性要用到的值，再生成 SKU
                </Typography>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  {(saleAttrsQuery.data ?? []).map((a) => {
                    const options = (a.valueSelect ?? '').split(';').filter(Boolean)
                    const chosen = saleSelections.get(a.attrId) ?? []
                    return (
                      <Box key={a.attrId}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>{a.attrName}</Typography>
                        {options.length === 0 ? (
                          <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
                            「{a.attrName}」还没有设置可选值，去「销售属性」页补上后才能用它组合 SKU。
                          </Alert>
                        ) : (
                          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {options.map((o) => (
                              <Chip
                                key={o} size="small" label={o}
                                color={chosen.includes(o) ? 'primary' : 'default'}
                                variant={chosen.includes(o) ? 'filled' : 'outlined'}
                                onClick={() =>
                                  setSaleSelections((m) => {
                                    const next = new Map(m)
                                    const cur = next.get(a.attrId) ?? []
                                    next.set(
                                      a.attrId,
                                      cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]
                                    )
                                    return next
                                  })
                                }
                              />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    )
                  })}
                </Stack>

                <Button size="small" variant="outlined" onClick={generateSkus} sx={{ mb: 2 }}>
                  生成 SKU
                </Button>

                {skus.length > 0 && (
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>规格</TableCell>
                          <TableCell sx={{ minWidth: 200 }}>SKU 名称</TableCell>
                          <TableCell sx={{ width: 110 }}>价格</TableCell>
                          <TableCell sx={{ width: 100 }}>库存</TableCell>
                          <TableCell sx={{ width: 130 }}>货号</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {skus.map((s, i) => (
                          <TableRow key={s.attr.map((a) => a.attrValue).join('|')}>
                            <TableCell>
                              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                {s.attr.map((a) => (
                                  <Chip key={a.attrId} size="small" variant="outlined"
                                    label={a.attrValue} sx={{ height: 20 }} />
                                ))}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" fullWidth variant="standard" value={s.skuName}
                                onChange={(e) => patchSku(setSkus, i, { skuName: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" fullWidth variant="standard" value={s.price}
                                onChange={(e) =>
                                  patchSku(setSkus, i, { price: Number(e.target.value) || 0 })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" fullWidth variant="standard" value={s.stock}
                                onChange={(e) =>
                                  patchSku(setSkus, i, { stock: Number(e.target.value) || 0 })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" fullWidth variant="standard" value={s.skuCode}
                                onChange={(e) => patchSku(setSkus, i, { skuCode: e.target.value })}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1}>
          <Button onClick={() => navigate('/product-spu')}>取消</Button>
          <Box sx={{ flexGrow: 1 }} />
          {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>上一步</Button>}
          {step < STEPS.length - 1 ? (
            <Button
              variant="contained"
              disabled={step === 0 && !basicValid}
              onClick={() => setStep((s) => s + 1)}
            >
              下一步
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={skus.length === 0 || saveMutation.isPending}
              onClick={submit}
            >
              {saveMutation.isPending ? '保存中…' : '保存'}
            </Button>
          )}
        </Stack>

        {step === 0 && !basicValid && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            商品名称、分类、品牌都填好后才能进入下一步
          </Typography>
        )}
        {step === STEPS.length - 1 && skus.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            至少要有一个 SKU 才能保存
          </Typography>
        )}
      </Paper>

      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.severity === 'error' ? null : 3000}
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

function patchSku(
  setSkus: React.Dispatch<React.SetStateAction<SpuSaveSku[]>>,
  index: number,
  patch: Partial<SpuSaveSku>
) {
  setSkus((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
}

/** 一组图片地址。上传功能接进来之前，先老老实实收 URL。 */
function UrlListField({
  label, hint, value, onChange,
}: {
  label: string
  hint: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>{label}</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          size="small" fullWidth placeholder={hint} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <IconButton size="small" onClick={add}><AddIcon fontSize="small" /></IconButton>
      </Stack>
      {value.length === 0 ? (
        <Typography variant="caption" color="text.secondary">还没有添加</Typography>
      ) : (
        <Stack spacing={0.5}>
          {value.map((u, i) => (
            <Stack key={u} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" sx={{ flex: 1, wordBreak: 'break-all' }}>
                {i + 1}. {u}
              </Typography>
              <IconButton size="small" onClick={() => onChange(value.filter((x) => x !== u))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  )
}
