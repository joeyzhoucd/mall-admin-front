<template>
  <div class="attr-sale-container">
    <div class="left-panel">
      <tree-selector title="销售属性" @node-click="handleCategoryClick" />
    </div>

    <div class="right-panel">
      <div class="content-header">
        <span class="content-title">销售属性</span>
      </div>

      <div class="operation-container">
        <el-input v-model="searchForm.attrName" placeholder="属性名" style="width: 200px; margin-right: 10px;" />
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
        <el-table-column prop="attrName" label="属性名" min-width="120" align="center" show-overflow-tooltip />
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
        <el-table-column prop="enable" label="状态" width="70" align="center">
          <template slot-scope="scope">
            <el-switch
              v-model="scope.row.enable"
              :active-value="1"
              :inactive-value="0"
              @change="updateEnable(scope.row)">
            </el-switch>
          </template>
        </el-table-column>
        <el-table-column prop="showDesc" label="快速展示" width="90" align="center">
          <template slot-scope="scope">
            <el-tag :type="scope.row.showDesc === 1 ? 'success' : 'info'" size="mini">
              {{ scope.row.showDesc === 1 ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template slot-scope="scope">
            <el-button type="text" size="mini" @click="editAttr(scope.row)">编辑</el-button>
            <el-button type="text" size="mini" @click="deleteAttr(scope.row)" style="color: #f56c6c;">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="page"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="limit"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total">
        </el-pagination>
      </div>

      <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="650px" @close="handleDialogClose">
        <el-form ref="attrForm" :model="attrForm" :rules="attrRules" label-width="110px">
          <el-form-item label="属性名" prop="attrName">
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
            <div class="value-input-container">
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
        icon: '',
        showDesc: 0
      },
      valueList: [],
      inputValue: '',
      attrRules: {
        attrName: [{ required: true, message: '请输入属性名', trigger: 'blur' }]
      }
    }
  },
  methods: {
    handleCategoryClick (node) {
      this.selectedCategory = node
      this.page = 1
      this.getAttrList()
    },
    async getAttrList () {
      if (!this.selectedCategory) return
      this.loading = true
      try {
        const { data } = await http({
          url: http.adornUrl('/product/attr/sale/list'),
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
          // 转换数据类型
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
      this.dialogTitle = '新增销售属性'
      this.dialogVisible = true
      this.resetForm()
    },
    async editAttr (row) {
      this.isEdit = true
      this.dialogTitle = '编辑销售属性'
      this.dialogVisible = true
      // 确保字段名映射正确，并转换数据类型
      this.attrForm = {
        attrId: row.attrId,
        attrName: row.attrName,
        searchType: typeof row.searchType === 'string' ? parseInt(row.searchType) || 1 : row.searchType,
        attrType: typeof row.attrType === 'string' ? parseInt(row.attrType) || 0 : row.attrType,
        valueSelect: row.valueSelect || '',
        icon: row.icon || '',
        showDesc: typeof row.showDesc === 'string' ? parseInt(row.showDesc) || 0 : row.showDesc
      }
      this.initValueList()
    },
    async deleteAttr (row) {
      await http({ url: http.adornUrl(`/product/attr/sale/delete/${row.attrId}`), method: 'post' })
      this.$message.success('删除成功'); this.getAttrList()
    },
    async batchDelete () {
      await http({ url: http.adornUrl('/product/attr/sale/delete'), method: 'post', data: http.adornData(this.selectedIds) })
      this.$message.success('批量删除成功'); this.getAttrList()
    },
    async updateEnable (row) {
      await http({
        url: http.adornUrl('/product/attr/sale/updateEnable'),
        method: 'post',
        data: http.adornData({ attrId: row.attrId, enable: row.enable })
      })
      this.$message.success('状态更新成功')
    },
    async submitForm () {
      this.$refs.attrForm.validate(async (valid) => {
        if (!valid) return
        this.submitLoading = true
        try {
          const url = this.isEdit ? '/product/attr/sale/update' : '/product/attr/sale/save'
          const payload = {
            ...this.attrForm,
            categoryId: this.selectedCategory ? this.selectedCategory.catId : null
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
    resetForm () {
      this.attrForm = { attrId: null, attrName: '', searchType: 1, attrType: 0, valueSelect: '', icon: '', showDesc: 0 }
      this.valueList = []
      this.inputValue = ''
    },
    handleDialogClose () {
      this.resetForm()
    },
    initValueList () {
      this.valueList = this.attrForm.valueSelect ? this.attrForm.valueSelect.split(',') : []
    },
    addValue () {
      if (this.inputValue.trim()) {
        this.valueList.push(this.inputValue.trim())
        this.attrForm.valueSelect = this.valueList.join(',')
        this.inputValue = ''
      }
    },
    removeValue (index) {
      this.valueList.splice(index, 1)
      this.attrForm.valueSelect = this.valueList.join(',')
    },
    onIconUploadSuccess (url) {
      this.attrForm.icon = url
    },
    onIconUploadError () {
      this.$message.error('图标上传失败')
    },
    getValueList (valueSelect) {
      return valueSelect ? valueSelect.split(',') : []
    },
    getValueGridStyle (valueSelect) {
      const values = this.getValueList(valueSelect)
      const cols = Math.ceil(Math.sqrt(values.length))
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '4px'
      }
    }
  }
}
</script>

<style scoped>
.attr-sale-container {
  display: flex;
  height: 100vh;
}

.left-panel {
  width: 300px;
  border-right: 1px solid #e6e6e6;
}

.right-panel {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.content-header {
  margin-bottom: 20px;
}

.content-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.operation-container {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.value-input-container {
  width: 100%;
}

.value-tags {
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.value-tag {
  margin: 0;
}

.value-input {
  width: 100%;
}

.value-select-display {
  display: grid;
  gap: 4px;
}

.value-tag-mini {
  margin: 0;
  font-size: 12px;
}

.field-tip {
  margin-left: 10px;
  color: #999;
  font-size: 12px;
}

.col-value-select {
  max-width: 200px;
}
</style>
