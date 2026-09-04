import { useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, FormControlLabel, Switch, Alert,
} from '@mui/material'
import type { CategoryNode, CategoryDraft } from '@/api/product'
import type { Id } from '@/api/types'

interface Props {
  /** null 表示新增。 */
  node: CategoryNode | null
  /** 新增时的父分类；编辑时是该节点当前的父分类。null 表示一级分类。 */
  parent: CategoryNode | null
  tree: CategoryNode[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (draft: CategoryDraft) => void
}

interface Option {
  id: Id
  label: string
  level: number
}

/**
 * 把树拍平成「父分类」下拉的选项。
 *
 * 只列到二级：三级分类下面不能再挂分类（这个后台的分类树就是三层）。
 * 编辑时还要排掉<b>自己和自己的所有后代</b> —— 把一个分类挂到自己的子分类下面
 * 会做出一个环，而环会让递归建树的后端<b>栈溢出</b>，
 * 表现是整个分类接口 500，且从错误信息里看不出是哪条数据导致的。
 */
function flatten(tree: CategoryNode[], excludeSubtreeOf: Id | null): Option[] {
  const out: Option[] = []
  const walk = (nodes: CategoryNode[], prefix: string) => {
    for (const n of nodes) {
      if (n.id === excludeSubtreeOf) continue // 连同它的后代一起跳过
      if (n.level < 3) {
        out.push({ id: n.id, label: prefix + n.name, level: n.level })
        walk(n.children, prefix + '　')
      }
    }
  }
  walk(tree, '')
  return out
}

export function CategoryForm({ node, parent, tree, submitting, onCancel, onSubmit }: Props) {
  const isEdit = node !== null

  const options = useMemo(() => flatten(tree, node?.id ?? null), [tree, node])

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<CategoryDraft>({
    defaultValues: node
      ? {
          catId: node.id, name: node.name, parentCid: node.parentId, catLevel: node.level,
          sort: node.sort, showStatus: node.showStatus, icon: node.icon, productUnit: node.productUnit,
        }
      : {
          name: '', parentCid: parent?.id ?? '0', catLevel: (parent?.level ?? 0) + 1,
          sort: 0, showStatus: 1, icon: '', productUnit: '',
        },
  })

  const parentCid = watch('parentCid')
  const showStatus = watch('showStatus')

  // 层级是从父分类推出来的，不让用户手填 —— 手填的层级和实际父子关系
  // 对不上时，前台按层级取分类会取到空，而后台看起来一切正常。
  const derivedLevel = useMemo(() => {
    if (parentCid === '0' || parentCid === '') return 1
    const found = options.find((o) => o.id === parentCid)
    return (found?.level ?? 0) + 1
  }, [parentCid, options])

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>
        {isEdit ? `编辑分类 · ${node.name}` : parent ? `在「${parent.name}」下新增分类` : '新增一级分类'}
      </DialogTitle>
      <form onSubmit={handleSubmit((v) => onSubmit({ ...v, catLevel: derivedLevel }))}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="分类名称" fullWidth autoFocus
              error={!!errors.name} helperText={errors.name?.message}
              {...register('name', { required: '请填写分类名称' })}
            />

            <Controller
              name="parentCid"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select fullWidth label="父分类"
                  helperText={`保存后为第 ${derivedLevel} 级分类`}
                >
                  <MenuItem value="0">（一级分类，没有父级）</MenuItem>
                  {options.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
                  ))}
                </TextField>
              )}
            />

            {isEdit && node.children.length > 0 && parentCid !== node.parentId && (
              <Alert severity="warning" variant="outlined">
                这个分类下面还有 {node.children.length} 个子分类。移动它<b>不会</b>同时移动子分类的层级，
                子分类的 catLevel 会和实际层级对不上，需要逐个调整。
              </Alert>
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                label="排序" type="number" fullWidth
                error={!!errors.sort} helperText={errors.sort?.message ?? '数字越小越靠前'}
                {...register('sort', {
                  required: '请填写排序值',
                  // 不加 valueAsNumber 拿到的是字符串，提交上去后端的 Integer 收到字符串
                  valueAsNumber: true,
                  min: { value: 0, message: '排序不能是负数' },
                })}
              />
              <TextField label="计量单位" fullWidth helperText="如：件、台、盒"
                {...register('productUnit')} />
            </Stack>

            <TextField label="图标" fullWidth helperText="图标标识或图片地址，可留空"
              {...register('icon')} />

            <Controller
              name="showStatus"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label={showStatus === 1 ? '前台显示' : '前台隐藏'}
                  control={
                    <Switch
                      checked={field.value === 1}
                      onChange={(e) => field.onChange(e.target.checked ? 1 : 0)}
                    />
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>取消</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? '保存中…' : '确定'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
