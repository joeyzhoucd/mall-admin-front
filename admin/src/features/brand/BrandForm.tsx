import { useForm } from 'react-hook-form'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, FormControlLabel, Switch,
} from '@mui/material'
import type { Brand } from '@/api/product'

interface Props {
  /** null 表示新增，Brand 表示编辑。 */
  brand: Brand | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Brand) => void
}

/** 新增时的初值。showStatus 默认 1（显示）—— 新建了一个默认不显示的品牌很反直觉。 */
const EMPTY: Brand = {
  brandId: '', name: '', descript: '', firstLetter: '', logo: '', showStatus: 1, sort: 0,
}

/**
 * 品牌新增 / 编辑表单。
 *
 * 校验规则跟后端实体上的约束对齐（首字母必须是单个字母、排序必须非负），
 * 在前端拦一道是为了给出<b>具体</b>的错误位置 ——
 * 后端的校验失败返回的是 code≠0 加一句笼统的 msg，
 * 用户看不出是哪个字段的问题。
 */
export function BrandForm({ brand, submitting, onCancel, onSubmit }: Props) {
  const isEdit = brand !== null
  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Brand>({ defaultValues: brand ?? EMPTY })

  const showStatus = watch('showStatus')

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{isEdit ? `编辑品牌 · ${brand.name}` : '新增品牌'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="品牌名" fullWidth autoFocus
              error={!!errors.name} helperText={errors.name?.message}
              {...register('name', {
                required: '请填写品牌名',
                maxLength: { value: 50, message: '品牌名不能超过 50 个字' },
              })}
            />
            <TextField
              label="检索首字母" fullWidth
              error={!!errors.firstLetter} helperText={errors.firstLetter?.message ?? '一个字母，用于按首字母检索'}
              {...register('firstLetter', {
                required: '请填写首字母',
                pattern: { value: /^[a-zA-Z]$/, message: '只能是一个英文字母' },
              })}
            />
            <TextField
              label="排序" type="number" fullWidth
              error={!!errors.sort} helperText={errors.sort?.message ?? '数字越小越靠前'}
              {...register('sort', {
                required: '请填写排序值',
                // valueAsNumber 必须加：不加的话表单里拿到的是字符串 "10"，
                // 提交上去后端的 Integer 字段会收到字符串，而这不一定报错。
                valueAsNumber: true,
                min: { value: 0, message: '排序不能是负数' },
              })}
            />
            <TextField
              label="Logo 地址" fullWidth
              helperText="图片的完整 URL。文件上传功能待接入对象存储后再开放。"
              {...register('logo')}
            />
            <TextField
              label="品牌介绍" fullWidth multiline minRows={2}
              {...register('descript')}
            />
            <FormControlLabel
              label={showStatus === 1 ? '前台显示' : '前台隐藏'}
              control={
                <Switch
                  checked={showStatus === 1}
                  onChange={(e) => setValue('showStatus', e.target.checked ? 1 : 0)}
                />
              }
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
