import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, FormControlLabel, Switch, Chip, Box, Typography,
} from '@mui/material'
import { fetchAttrGroups, type Attr, type AttrDraft } from '@/api/attr'
import type { Id } from '@/api/types'

interface Props {
  /** null 表示新增。 */
  attr: Attr | null
  categoryId: Id
  title: string
  withGroup: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (draft: AttrDraft) => void
}

/** 可选值在后端存成一个用分号隔开的字符串。 */
const SEP = ';'

export function AttrForm({ attr, categoryId, title, withGroup, submitting, onCancel, onSubmit }: Props) {
  const isEdit = attr !== null

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } =
    useForm<AttrDraft>({
      defaultValues: attr
        ? {
            attrId: attr.attrId,
            attrName: attr.attrName,
            searchType: attr.searchType,
            // valueType 列表接口不返回，编辑时给个默认值（0 = 单选）。
            // 写成 0 而不是 undefined：undefined 会被 JSON 丢掉，
            // 后端拿到 null 再拆箱成 int 就是 NPE。
            valueType: 0,
            valueSelect: attr.valueSelect ?? '',
            attrGroupId: attr.attrGroupId ?? '',
            icon: attr.icon ?? '',
            showDesc: attr.showDesc,
            categoryId: attr.categoryId,
          }
        : {
            attrName: '', searchType: 0, valueType: 0, valueSelect: '',
            attrGroupId: '', icon: '', showDesc: 1, categoryId,
          },
    })

  const valueSelect = watch('valueSelect')
  const searchType = watch('searchType')
  const showDesc = watch('showDesc')
  const [newValue, setNewValue] = useState('')

  const values = valueSelect ? valueSelect.split(SEP).filter(Boolean) : []

  const addValue = () => {
    const v = newValue.trim()
    // 分号是分隔符，值里带分号会把一个值拆成两个 —— 直接不让输入。
    if (!v || v.includes(SEP) || values.includes(v)) return
    setValue('valueSelect', [...values, v].join(SEP))
    setNewValue('')
  }

  const groupQuery = useQuery({
    queryKey: ['attr-groups-all'],
    // 分组只用来做下拉，一次拉够。500 是后端 Query 能接受的上限量级，
    // 真实数据是 27 个。
    queryFn: ({ signal }) => fetchAttrGroups({ page: 1, limit: 500 }, signal),
    enabled: withGroup,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onCancel}>
      <DialogTitle>{isEdit ? `编辑${title} · ${attr.attrName}` : `新增${title}`}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="属性名" fullWidth autoFocus
              error={!!errors.attrName} helperText={errors.attrName?.message}
              {...register('attrName', { required: '请填写属性名' })}
            />

            {withGroup && (
              <Controller
                name="attrGroupId"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select fullWidth label="所属属性分组"
                    helperText="可留空，之后在属性分组页里关联">
                    <MenuItem value="">（不归入分组）</MenuItem>
                    {(groupQuery.data?.list ?? []).map((g) => (
                      <MenuItem key={g.attrGroupId} value={g.attrGroupId}>
                        {g.attrGroupName}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>可选值</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small" fullWidth placeholder="输入一个值后回车添加"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 不阻止的话回车会顺带提交整个表单
                      e.preventDefault()
                      addValue()
                    }
                  }}
                  helperText={newValue.includes(SEP) ? '值里不能包含分号（分号是分隔符）' : ' '}
                  error={newValue.includes(SEP)}
                />
                <Button size="small" onClick={addValue} sx={{ height: 40 }}>添加</Button>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, minHeight: 32 }}>
                {values.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">还没有可选值</Typography>
                ) : (
                  values.map((v) => (
                    <Chip
                      key={v} size="small" label={v}
                      onDelete={() =>
                        setValue('valueSelect', values.filter((x) => x !== v).join(SEP))
                      }
                    />
                  ))
                )}
              </Stack>
            </Box>

            <TextField label="图标" fullWidth helperText="可留空" {...register('icon')} />

            <Stack direction="row" spacing={3}>
              <Controller
                name="searchType"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    label="可检索"
                    control={
                      <Switch checked={searchType === 1}
                        onChange={(e) => field.onChange(e.target.checked ? 1 : 0)} />
                    }
                  />
                )}
              />
              <Controller
                name="showDesc"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    label="详情页展示"
                    control={
                      <Switch checked={showDesc === 1}
                        onChange={(e) => field.onChange(e.target.checked ? 1 : 0)} />
                    }
                  />
                )}
              />
            </Stack>
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
