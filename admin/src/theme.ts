import { createTheme } from '@mui/material/styles'
import { zhCN } from '@mui/material/locale'

/**
 * MUI 主题。刻意保持克制 —— 后台的价值在信息密度和操作效率，不在观感。
 *
 * 两个具体决定：
 * - density 偏紧：后台表格常有 10+ 列，MUI 的默认间距会让一屏放不下几行。
 * - 中文 locale：分页器、表格、日期选择器的内置文案走 zhCN，
 *   否则会出现「界面是中文、控件里是英文」的混杂。
 */
export const theme = createTheme(
  {
    palette: { mode: 'light' },
    shape: { borderRadius: 6 },
    typography: { fontSize: 13 },
    components: {
      MuiButton: { defaultProps: { size: 'small', disableElevation: true } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiTable: { defaultProps: { size: 'small' } },
    },
  },
  zhCN
)
