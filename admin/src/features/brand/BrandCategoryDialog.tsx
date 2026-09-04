import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, CircularProgress, Alert, Typography, Chip, Stack,
} from '@mui/material'
import { RichTreeView } from '@mui/x-tree-view/RichTreeView'
import {
  fetchCategoryTree, fetchBrandRelations, updateBrandRelations,
  type Brand, type CategoryNode,
} from '@/api/product'
import type { Id } from '@/api/types'

interface Props {
  brand: Brand
  onClose: () => void
  onSaved: () => void
  onError: (e: unknown) => void
}

interface TreeItem {
  id: string
  label: string
  children?: TreeItem[]
}

function toTreeItems(nodes: CategoryNode[]): TreeItem[] {
  return nodes.map((n) => ({
    id: n.id,
    label: n.name,
    children: n.children.length ? toTreeItems(n.children) : undefined,
  }))
}

/**
 * 品牌 ⇄ 分类 关联。
 *
 * <h3>这里最容易出的错：两边的 id 类型不一样</h3>
 * 分类树返回的 catId 是<b>数字</b>，而关系接口返回的 categoryId 是<b>字符串</b>。
 * 不归一就会「一个都勾不上」——因为 3 !== '3'，而且没有任何报错。
 * 归一在 api/product.ts 里做（normalizeId），这里拿到的已经统一是字符串。
 *
 * <h3>保存是覆盖不是追加</h3>
 * updateRelations 接收一个完整的分类 id 数组，传什么就是什么。
 * 所以取消勾选再保存 = 解除关联，清空全部 = 传空数组。
 * 这一点在界面上要说清楚，否则用户会以为只是在「加」。
 */
export function BrandCategoryDialog({ brand, onClose, onSaved, onError }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  const treeQuery = useQuery({
    queryKey: ['category-tree'],
    queryFn: ({ signal }) => fetchCategoryTree(signal),
    // 分类树几乎不变，缓存久一点，免得每次开对话框都重新拉一遍。
    staleTime: 5 * 60 * 1000,
  })

  const relationQuery = useQuery({
    queryKey: ['brand-relations', brand.brandId],
    queryFn: ({ signal }) => fetchBrandRelations(brand.brandId, signal),
  })

  // 已有关联填进勾选状态。只在数据到达时做一次，之后交给用户操作 ——
  // 每次 render 都同步会把用户刚点的勾覆盖掉。
  useEffect(() => {
    if (relationQuery.data && !dirty) {
      setSelected(relationQuery.data.map((r) => r.categoryId))
    }
  }, [relationQuery.data, dirty])

  const items = useMemo(
    () => (treeQuery.data ? toTreeItems(treeQuery.data) : []),
    [treeQuery.data]
  )

  /** id → 名称，用于显示「当前已选」。树是嵌套的，所以要拍平一次。 */
  const nameById = useMemo(() => {
    const m = new Map<Id, string>()
    const walk = (ns: CategoryNode[]) => ns.forEach((n) => { m.set(n.id, n.name); walk(n.children) })
    if (treeQuery.data) walk(treeQuery.data)
    return m
  }, [treeQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => updateBrandRelations(brand.brandId, selected),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['brand-relations', brand.brandId] })
      onSaved()
    },
    onError,
  })

  const loading = treeQuery.isLoading || relationQuery.isLoading
  const error = treeQuery.error ?? relationQuery.error

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>品牌关联分类 · {brand.name}</DialogTitle>
      <DialogContent dividers>
        {error ? (
          <Alert severity="error">
            {error instanceof Error ? error.message : String(error)}
          </Alert>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              勾选该品牌所属的分类。保存是<b>整体覆盖</b>：取消勾选即解除关联。
            </Typography>

            {/* 把当前选择摊开显示。树折叠起来之后，光看树看不出「一共选了什么」，
                而这正是保存前唯一该确认的东西。 */}
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5, minHeight: 32 }}>
              {selected.length === 0 ? (
                <Typography variant="caption" color="warning.main">
                  未选择任何分类 —— 保存后该品牌的现有关联会被全部清除
                </Typography>
              ) : (
                selected.map((id) => (
                  <Chip
                    key={id}
                    size="small"
                    label={nameById.get(id) ?? `未知分类 ${id}`}
                    onDelete={() => { setDirty(true); setSelected((s) => s.filter((x) => x !== id)) }}
                  />
                ))
              )}
            </Stack>

            <Box sx={{ maxHeight: 380, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <RichTreeView
                items={items}
                checkboxSelection
                multiSelect
                selectedItems={selected}
                onSelectedItemsChange={(_e, ids) => {
                  setDirty(true)
                  setSelected(ids as string[])
                }}
              />
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={loading || !!error || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
