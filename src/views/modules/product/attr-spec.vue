<template>
  <div class="attr-spec-container">
    <div class="left-panel">
      <tree-selector title="规格参数" @node-click="handleCategoryClick" />
    </div>

    <div class="right-panel">
      <div class="content-header">
        <span class="content-title">规格参数</span>
      </div>

      <div class="operation-container">
        <el-input v-model="searchForm.attrName" placeholder="参数名" style="width: 200px; margin-right: 10px;" />
        <el-select v-model="searchForm.searchType" placeholder="可检索" clearable style="width: 120px; margin-right: 10px;">
          <el-option :value="1" label="是" />
          <el-option :value="0" label="否" />
        </el-select>
        <el-button type="primary" @click="searchAttrs">查询</el-button>
        <el-button type="success" @click="addAttr" :disabled="!selectedCategory">新增</el-button>
        <el-button type="danger" @click="batchDelete" :disabled="selectedIds.length === 0">批量删除</el-button>
      </div>

      <el-table :data="attrList" v-loading="loading" style="width: 100%" @selection-change="handleSelectionChange" size="mini" align="center">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column prop="attrId" label="ID" width="100" align="center" show-overflow-tooltip />
        <el-table-column prop="attrName" label="参数名" min-width="120" align="center" show-overflow-tooltip />
        <el-table-column prop="searchType" label="检索" width="70" align="center">
          <template slot-scope="scope">
            <el-tag :type="scope.row.searchType === 1 ? 'success' : 'info'" size="mini">{{ scope.row.searchType === 1 ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="attrType" label="类型" width="70" align="center">
          <template slot-scope="scope">
            {{ scope.row.attrType === 1 ? '单选' : '多选' }}
          </template>
        </el-table-column>
        <el-table-column prop="valueSelect" label="可选值" min-width="150" align="center" class-name="col-value-select">
          <template slot-scope="scope">
            <div v-if="scope.row.valueSelect" class="value-select-display" :style="getValueGridStyle(scope.row.valueSelect)">
              <el-tag
                v-for="(value, index) in getValueList(scope.row.valueSelect)"
                :key="index"
                size="mini"
                class="value-tag-mini">
                {{ value }}
              </el-tag>
            </div>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="icon" label="图标" width="70" align="center">
          <template slot-scope="scope">
            <img v-if="scope.row.icon" :src="scope.row.icon" class="attr-icon" style="width: 24px; height: 24px; display: block; border: 1px solid #ddd; background-color: #f5f5f5; object-fit: contain; border-radius: 4px;" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="enable" label="启用" width="80" align="center">
          <template slot-scope="scope">
            <el-switch v-model="scope.row.enable" :active-value="1" :inactive-value="0" @change="toggleEnable(scope.row)" size="mini" />
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" min-width="100" align="center" show-overflow-tooltip />
        <el-table-column prop="attrGroupName" label="分组" min-width="100" align="center" show-overflow-tooltip />
        <el-table-column label="操作" width="120" align="center">
          <template slot-scope="scope">
            <el-button type="text" size="mini" @click="editAttr(scope.row)">修改</el-button>
            <el-button type="text" size="mini" @click="deleteAttr(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange" :current-page="page" :page-sizes="[10, 20, 50, 100]" :page-size="limit" layout="total, sizes, prev, pager, next, jumper" :total="total" />

      <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="650px" @close="handleDialogClose">
        <el-form ref="attrForm" :model="attrForm" :rules="attrRules" label-width="110px">
          <el-form-item label="参数名" prop="attrName">
            <el-input v-model="attrForm.attrName" />
          </el-form-item>
          <el-form-item label="可检索" prop="searchType">
            <el-switch v-model="attrForm.searchType" :active-value="1" :inactive-value="0" />
          </el-form-item>
          <el-form-item label="值类型" prop="attrType">
            <el-radio-group v-model="attrForm.attrType">
              <el-radio :label="0">多选</el-radio>
              <el-radio :label="1">单选</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="属性图标" prop="icon">
            <oss-upload
              v-model="attrForm.icon"
              button-text="上传图标"
              tip="支持jpg、png、gif格式，文件大小不超过2MB"
              :preview-width="80"
              :preview-height="80"
              @success="onIconUploadSuccess"
              @error="onIconUploadError">
            </oss-upload>
          </el-form-item>
          <el-form-item label="可选值列表" prop="valueSelect">
            <div class="value-select-container">
              <div class="value-tags">
                <el-tag
                  v-for="(value, index) in valueList"
                  :key="index"
                  closable
                  @close="removeValue(index)"
                  class="value-tag">
                  {{ value }}
                </el-tag>
              </div>
              <el-input
                v-model="inputValue"
                placeholder="输入值后按回车添加"
                @keyup.enter.native="addValue"
                @blur="addValue"
                class="value-input">
                <el-button slot="append" icon="el-icon-plus" @click="addValue"></el-button>
              </el-input>
            </div>
          </el-form-item>
          <el-form-item label="所属分组" prop="attrGroupId">
            <el-select v-model="attrForm.attrGroupId" placeholder="请选择所属分组" clearable filterable @change="handleGroupChange">
              <el-option
                v-for="group in groupOptions"
                :key="group.attrGroupId"
                :label="group.attrGroupName"
                :value="String(group.attrGroupId)">
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="快速展示" prop="showDesc">
            <el-switch v-model="attrForm.showDesc" :active-value="1" :inactive-value="0" />
            <span class="field-tip">是否在商品介绍中快速展示此属性</span>
          </el-form-item>
        </el-form>
        <div slot="footer" class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitLoading">确 定</el-button>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'
import TreeSelector from '@/components/TreeSelector.vue'
import OssUpload from '@/components/OssUpload.vue'

export default {
  components: { TreeSelector, OssUpload },
  data () {
    return {
      loading: false,
      attrList: [],
      selectedIds: [],
      selectedCategory: null,
      page: 1,
      limit: 10,
      total: 0,
      searchForm: { attrName: '', searchType: undefined },
      dialogVisible: false,
      dialogTitle: '',
      submitLoading: false,
      isEdit: false,
      attrForm: {
        attrId: null,
        attrName: '',
        searchType: 1,
        attrType: 0,
        valueSelect: '',
        attrGroupId: null,
        attrGroupName: '',
        icon: '',
        showDesc: 0
      },
      groupOptions: [],
      valueList: [],
      inputValue: '',
      attrRules: {
        attrName: [{ required: true, message: '请输入参数名', trigger: 'blur' }]
      }
    }
  },
  methods: {
    handleCategoryClick (node) {
      this.selectedCategory = node
      this.page = 1
      this.getAttrList()
      // 只在需要时获取分组选项（新增/编辑时）
      // 移除自动获取，减少不必要的请求
    },
    async getAttrList () {
      if (!this.selectedCategory) return
      this.loading = true
      try {
        const { data } = await http({
          url: http.adornUrl('/product/attr/spec/list'),
          method: 'get',
          params: http.adornParams({
            page: this.page,
            limit: this.limit,
            key: this.searchForm.attrName,
            searchType: this.searchForm.searchType,
            categoryId: this.selectedCategory.catId
          })
        })
        if (data && data.code === 0) {
          const list = (data.data && data.data.list) || []
          // 转换数据类型，只对字符串类型的字段进行转换
          this.attrList = list.map(item => ({
            ...item,
            enable: typeof item.enable === 'string' ? parseInt(item.enable) || 0 : item.enable,
            searchType: typeof item.searchType === 'string' ? parseInt(item.searchType) || 0 : item.searchType,
            attrType: typeof item.attrType === 'string' ? parseInt(item.attrType) || 0 : item.attrType,
            showDesc: typeof item.showDesc === 'string' ? parseInt(item.showDesc) || 0 : item.showDesc
          }))
          this.total = (data.data && data.data.totalCount) || 0
        }
      } finally {
        this.loading = false
      }
    },
    searchAttrs () { this.page = 1; this.getAttrList() },
    handleSelectionChange (rows) { this.selectedIds = rows.map(r => r.attrId) },
    handleSizeChange (v) { this.limit = v; this.page = 1; this.getAttrList() },
    handleCurrentChange (v) { this.page = v; this.getAttrList() },
    addAttr () {
      this.isEdit = false
      this.dialogTitle = '新增规格参数'
      this.dialogVisible = true
      this.resetForm()
      this.initValueList()
      // 只在需要时获取分组选项
      if (this.groupOptions.length === 0) {
        this.getGroupOptions()
      }
    },
    async editAttr (row) {
      this.isEdit = true
      this.dialogTitle = '编辑规格参数'
      this.dialogVisible = true
      // 确保字段名映射正确，并转换数据类型
      this.attrForm = {
        attrId: row.attrId,
        attrName: row.attrName,
        searchType: typeof row.searchType === 'string' ? parseInt(row.searchType) || 1 : row.searchType,
        attrType: typeof row.attrType === 'string' ? parseInt(row.attrType) || 0 : row.attrType,
        valueSelect: row.valueSelect || '',
        attrGroupId: row.attrGroupId != null ? String(row.attrGroupId) : null,
        attrGroupName: row.attrGroupName || '',
        icon: row.icon || '',
        showDesc: typeof row.showDesc === 'string' ? parseInt(row.showDesc) || 0 : row.showDesc
      }
      this.initValueList()
      // 编辑时必须确保分组选项已加载，用于回显
      await this.getGroupOptions()
      // 若后端列表没有返回 attrGroupId，但返回了 attrGroupName，则通过名称匹配ID回填
      if (!this.attrForm.attrGroupId && this.attrForm.attrGroupName) {
        const targetName = String(this.attrForm.attrGroupName).trim().toLowerCase()
        const match = this.groupOptions.find(g => String(g.attrGroupName).trim().toLowerCase() === targetName)
        if (match) {
          this.attrForm.attrGroupId = String(match.attrGroupId)
        }
      }
    },
    async deleteAttr (row) {
      await http({ url: http.adornUrl(`/product/attr/spec/delete/${row.attrId}`), method: 'post' })
      this.$message.success('删除成功'); this.getAttrList()
    },
    async batchDelete () {
      await http({ url: http.adornUrl('/product/attr/spec/delete'), method: 'post', data: http.adornData(this.selectedIds) })
      this.$message.success('批量删除成功'); this.getAttrList()
    },
    async submitForm () {
      this.$refs.attrForm.validate(async (valid) => {
        if (!valid) return
        this.submitLoading = true
        try {
          const url = this.isEdit ? '/product/attr/spec/update' : '/product/attr/spec/save'
          const payload = {
            ...this.attrForm,
            categoryId: this.selectedCategory ? this.selectedCategory.catId : null,
            // 提交给后端前确保为数字
            attrGroupId: this.attrForm.attrGroupId != null ? parseInt(this.attrForm.attrGroupId) : null
          }
          const { data } = await http({ url: http.adornUrl(url), method: 'post', data: http.adornData(payload) })
          if (data && data.code === 0) {
            this.$message.success(this.isEdit ? '修改成功' : '新增成功')
            this.dialogVisible = false
            this.getAttrList()
          }
        } finally { this.submitLoading = false }
      })
    },
    toggleEnable (row) {
      http({ url: http.adornUrl('/product/attr/spec/updateEnable'), method: 'post', data: http.adornData({ attrId: row.attrId, enable: row.enable }) })
    },
    resetForm () {
      this.attrForm = { attrId: null, attrName: '', searchType: 1, attrType: 0, valueSelect: '', attrGroupId: null, attrGroupName: '', icon: '', showDesc: 0 }
      this.valueList = []
      this.inputValue = ''
    },
    async getGroupOptions () {
      if (!this.selectedCategory) return
      try {
        const { data } = await http({
          url: http.adornUrl('/product/attrgroup/list'),
          method: 'get',
          params: http.adornParams({
            categoryId: this.selectedCategory.catId,
            limit: 1000
          })
        })
        if (data && data.code === 0) {
          this.groupOptions = (data.data && data.data.list) || []
          // 如果当前在编辑，且服务器返回了分组选项，确保回显
          if (this.isEdit && this.attrForm.attrGroupId) {
            const exist = this.groupOptions.some(g => String(g.attrGroupId) === this.attrForm.attrGroupId)
            if (!exist) {
              // 分组选项中没有当前值时，清空以避免显示异常
              this.attrForm.attrGroupId = null
              this.attrForm.attrGroupName = ''
            }
          }
        }
      } catch (error) {
        console.error('获取分组列表失败:', error)
      }
    },
    handleGroupChange (groupId) {
      const group = this.groupOptions.find(g => String(g.attrGroupId) === String(groupId))
      this.attrForm.attrGroupName = group ? group.attrGroupName : ''
      // 同步保存字符串ID，确保下拉回显
      this.attrForm.attrGroupId = group ? String(group.attrGroupId) : null
    },
    addValue () {
      if (this.inputValue.trim()) {
        if (!this.valueList.includes(this.inputValue.trim())) {
          this.valueList.push(this.inputValue.trim())
          this.updateValueSelect()
        }
        this.inputValue = ''
      }
    },
    removeValue (index) {
      this.valueList.splice(index, 1)
      this.updateValueSelect()
    },
    updateValueSelect () {
      this.attrForm.valueSelect = this.valueList.join(',')
    },
    initValueList () {
      if (this.attrForm.valueSelect) {
        this.valueList = this.attrForm.valueSelect.split(',').filter(v => v.trim())
      } else {
        this.valueList = []
      }
    },
    handleDialogClose () {
      this.$refs.attrForm.resetFields()
      this.resetForm()
    },
    onIconUploadSuccess (data) {
      console.log('图标上传成功:', data.url)
    },
    onIconUploadError (error) {
      console.error('图标上传失败:', error)
    },
    getValueList (valueSelect) {
      if (!valueSelect) return []
      return valueSelect.split(',').filter(v => v.trim())
    },
    getValueGridStyle (valueSelect) {
      const list = this.getValueList(valueSelect)
      const count = list.length
      // 默认三列
      let columns = 3
      // 当总数>3且对3取余为1时，用2列更均衡（例如4=2+2，7=3+2+2 等）
      if (count > 3 && count % 3 === 1) {
        columns = 2
      }
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, max-content)`,
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: '6px',
        rowGap: '6px',
        width: '100%'
      }
    }
  }
}
</script>

<style scoped>
.attr-spec-container {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}
.left-panel { width: 300px; background: #fff; border-right: 1px solid #e6e6e6; }
.right-panel { flex: 1; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
.content-header { display: flex; align-items: center; padding: 6px 16px; border-bottom: 1px solid #e6e6e6; background: #f5f5f5; }
.content-title { font-size: 14px; font-weight: 500; color: #333; }
.operation-container { padding: 4px 20px; border-bottom: 1px solid #e6e6e6; background: #fff; }
.attr-icon { border-radius: 4px; display: block; margin: 0 auto; }

/* 表头不换行，避免两个字被拆成两行 */
::v-deep(.el-table th .cell) {
  white-space: nowrap;
}

/* 简化样式 - 让Element UI的align="center"生效 */
::v-deep(.el-table th .cell) {
  white-space: nowrap;
}
::v-deep(.el-table td .cell) { 
  white-space: nowrap;
}

/* 可选值标签容器 - 强制居中 */
::v-deep(.el-table .value-select-display) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 2px;
  width: 100%;
  text-align: center;
  margin: 0 auto;
}

/* 确保可选值列的内容居中 */
::v-deep(.el-table td .cell) {
  text-align: center !important;
}

/* 可选值列表样式 */
.value-select-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  min-height: 40px;
  background-color: #fff;
}

.value-tags {
  margin-bottom: 8px;
  min-height: 24px;
}

.value-tag {
  margin-right: 8px;
  margin-bottom: 4px;
}

.value-input {
  width: 100%;
}

.value-input .el-input__inner {
  border: none;
  box-shadow: none;
  padding-left: 0;
}

.value-input .el-input__inner:focus {
  border: none;
  box-shadow: none;
}

/* 字段提示样式 */
.field-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #999;
}

/* 可选值列：单元格强制居中（避免文本流影响） */
::v-deep(.el-table .col-value-select .cell) {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 可选值显示样式 */
.value-select-display {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 170px;
  line-height: 1;
  margin: 0 auto;
}

.value-tag-mini {
  margin: 0;
  font-size: 10px;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  margin-bottom: 0px;
  max-width: 100%;
  word-break: break-all;
}
</style>


