import { useForm, Controller } from 'react-hook-form'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack,
} from '@mui/material'
import { CategoryPicker } from '@/features/category/CategoryPicker'
import type { AttrGroup } from '@/api/attr'

interface Props {
  /** null 表示新增。 */
  group: AttrGroup | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (group: AttrGroup) => void
}

const EMPTY: AttrGroup = {
  attrGroupId: '', attrGroupName: '', categoryId: '', descript: '', icon: '', sort: 0,
}

export function AttrGroupForm({ group, submitting, onCancel, onSubmit }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<AttrGroup>({
    // descript / icon 后端会给 null，而 null 进 MUI 输入框会让它从受控变非受控
    // （控制台一句警告，然后那个框再也改不动了）。在这里归一成空串。
    defaultValues: group
      ? { ...group, descript: group.descript ?? '', icon: group.icon ?? '' }
      : EMPTY,
  })

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{group ? `修改分组 · ${group.attrGroupName}` : '新增属性分组'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="分组名" fullWidth autoFocus
              error={!!errors.attrGroupName} helperText={errors.attrGroupName?.message}
              {...register('attrGroupName', { required: '请填写分组名' })}
            />

            <Controller
              name="categoryId"
              control={control}
              rules={{ required: '请选择所属分类' }}
              render={({ field, fieldState }) => (
                <>
                  <CategoryPicker
                    value={field.value}
                    onChange={field.onChange}
                    size="medium"
                    sx={{ width: '100%' }}
                  />
                  {fieldState.error && (
                    <TextField
                      // 只为把校验错误显示出来。CategoryPicker 自己不接管表单错误状态，
                      // 与其给它加一堆 props，不如在这里补一行。
                      variant="standard" disabled fullWidth
                      error helperText={fieldState.error.message}
                      sx={{ mt: -2, '& .MuiInput-root': { display: 'none' } }}
                    />
                  )}
                </>
              )}
            />

            <TextField
              label="排序" type="number" fullWidth
              error={!!errors.sort} helperText={errors.sort?.message ?? '数字越小越靠前'}
              {...register('sort', {
                required: '请填写排序值',
                valueAsNumber: true, // 不加会把字符串提交给后端的 Integer
                min: { value: 0, message: '排序不能是负数' },
              })}
            />

            <TextField label="描述" fullWidth multiline minRows={2} {...register('descript')} />
            <TextField label="图标" fullWidth helperText="可留空" {...register('icon')} />
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
