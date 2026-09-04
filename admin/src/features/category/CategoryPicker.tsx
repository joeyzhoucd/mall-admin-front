import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TextField, MenuItem, CircularProgress, InputAdornment } from '@mui/material'
import { fetchCategoryTree, type CategoryNode } from '@/api/product'
import type { Id } from '@/api/types'

interface Props {
  value: Id
  onChange: (categoryId: Id) => void
  label?: string
  /** 只允许选到某一层为止。属性挂在具体分类上，默认全部层级都能选。 */
  maxLevel?: number
  size?: 'small' | 'medium'
  sx?: object
}

interface Option {
  id: Id
  label: string
  level: number
}

/**
 * 分类选择器。
 *
 * 用「缩进的扁平下拉」而不是弹出一棵树：分类只有三层，扁平列表能一眼看全，
 * 也省掉了「点开分类树 → 展开 → 选中 → 关闭」这一串操作。
 *
 * 数据用 category-tree 这个 queryKey，和分类管理页共享缓存 ——
 * 同一份分类树在一个会话里只会拉一次。
 */
export function CategoryPicker({ value, onChange, label = '所属分类', maxLevel = 3, size = 'small', sx }: Props) {
  const treeQuery = useQuery({
    queryKey: ['category-tree'],
    queryFn: ({ signal }) => fetchCategoryTree(signal),
    staleTime: 5 * 60 * 1000,
  })

  const options = useMemo(() => {
    const out: Option[] = []
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const n of nodes) {
        if (n.level > maxLevel) continue
        // 全角空格做缩进：下拉选项里普通空格会被折叠掉，看不出层级。
        out.push({ id: n.id, label: '　'.repeat(depth) + n.name, level: n.level })
        walk(n.children, depth + 1)
      }
    }
    walk(treeQuery.data ?? [], 0)
    return out
  }, [treeQuery.data, maxLevel])

  return (
    <TextField
      select
      size={size}
      label={label}
      value={options.some((o) => o.id === value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      error={!!treeQuery.error}
      helperText={treeQuery.error ? '分类加载失败' : undefined}
      sx={{ minWidth: 200, ...sx }}
      slotProps={{
        input: treeQuery.isLoading
          ? { endAdornment: <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> }
          : undefined,
      }}
    >
      {options.length === 0 && (
        <MenuItem value="" disabled>
          {treeQuery.isLoading ? '加载中…' : '没有分类'}
        </MenuItem>
      )}
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
      ))}
    </TextField>
  )
}
