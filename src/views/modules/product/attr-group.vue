<template>
  <div class="attr-group-container">
    <!-- 左侧分类树 -->
    <div class="left-panel">
      <tree-selector
        title="属性分组"
        @node-click="handleCategoryClick">
      </tree-selector>
    </div>

    <!-- 右侧内容区域 -->
    <div class="right-panel">
      <div class="content-header">
        <span class="content-title">属性分组</span>
      </div>

      <!-- 搜索和操作区域 -->
      <div class="operation-container">
        <el-input
          v-model="searchForm.attrGroupName"
          placeholder="参数名"
          style="width: 200px; margin-right: 10px;">
        </el-input>
        <el-button type="primary" @click="searchGroups">查询</el-button>
        <el-button type="success" @click="addGroup" :disabled="!selectedCategory">新增</el-button>
        <el-button type="danger" @click="batchDelete" :disabled="selectedIds.length === 0">批量删除</el-button>
      </div>

      <!-- 属性分组列表表格 -->
      <el-table
        :data="groupList"
        v-loading="loading"
        style="width: 100%"
        @selection-change="handleSelectionChange">
        <el-table-column
          type="selection"
          width="55">
        </el-table-column>
        <el-table-column
          prop="attrGroupId"
          label="分组id"
          width="100">
        </el-table-column>
        <el-table-column
          prop="attrGroupName"
          label="组名"
          width="150">
        </el-table-column>
        <el-table-column
          prop="sort"
          label="排序"
          width="100">
        </el-table-column>
        <el-table-column
          prop="descript"
          label="描述"
          show-overflow-tooltip>
        </el-table-column>
        <el-table-column
          prop="icon"
          label="组图标"
          width="120">
          <template slot-scope="scope">
            <img
              v-if="scope.row.icon"
              :src="scope.row.icon"
              class="group-icon"
              style="width: 40px; height: 40px; display: block; border: 1px solid #ddd; background-color: #f5f5f5; object-fit: contain; border-radius: 4px; cursor: pointer;"
              @click="previewImage(scope.row.icon)"
              :alt="scope.row.attrGroupName + ' Icon'">
            <span v-else>无图标</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="catelogId"
          label="所属分类id"
          width="120">
        </el-table-column>
        <el-table-column
          label="操作"
          width="150">
          <template slot-scope="scope">
            <el-button
              type="text"
              size="mini"
              @click="editGroup(scope.row)">
              修改
            </el-button>
            <el-button
              type="text"
              size="mini"
              @click="deleteGroup(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

    <!-- 添加/编辑属性分组对话框 -->
    <el-dialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      width="600px"
      @close="handleDialogClose">
      <el-form
        ref="groupForm"
        :model="groupForm"
        :rules="groupRules"
        label-width="100px">
        <el-form-item label="组名" prop="attrGroupName">
          <el-input v-model="groupForm.attrGroupName" placeholder="请输入组名"></el-input>
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="groupForm.sort" :min="0" placeholder="请输入排序"></el-input-number>
        </el-form-item>
        <el-form-item label="描述" prop="descript">
          <el-input
            type="textarea"
            :rows="3"
            v-model="groupForm.descript"
            placeholder="请输入描述">
          </el-input>
        </el-form-item>
        <el-form-item label="组图标" prop="icon">
          <oss-upload
            v-model="groupForm.icon"
            button-text="上传图标"
            tip="支持jpg、png、gif格式，文件大小不超过2MB"
            :preview-width="80"
            :preview-height="80"
            @success="onIconUploadSuccess"
            @error="onIconUploadError">
          </oss-upload>
        </el-form-item>
        <el-form-item label="所属分类" prop="catelogId">
          <el-input
            v-model="categoryName"
            disabled
            placeholder="请先选择分类">
          </el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitLoading">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'
import TreeSelector from '@/components/TreeSelector.vue'
import OssUpload from '@/components/OssUpload.vue'

export default {
  name: 'AttrGroup',
  components: {
    TreeSelector,
    OssUpload
  },
  data () {
    return {
      // 选中的分类
      selectedCategory: null,
      categoryName: '',
      // 属性分组列表数据
      groupList: [],
      loading: false,
      selectedIds: [], // 选中的分组ID
      // 分页参数
      page: 1,
      limit: 10,
      total: 0,
      // 搜索表单
      searchForm: {
        attrGroupName: ''
      },
      // 对话框相关数据
      dialogVisible: false,
      dialogTitle: '',
      submitLoading: false,
      isEdit: false, // 是否为编辑模式

      // 属性分组表单数据
      groupForm: {
        attrGroupId: null,
        attrGroupName: '',
        sort: 0,
        descript: '',
        icon: '',
        catelogId: null
      },
      // 表单验证规则
      groupRules: {
        attrGroupName: [
          { required: true, message: '请输入组名', trigger: 'blur' },
          { max: 20, message: '组名不能超过20个字符', trigger: 'blur' }
        ],
        sort: [
          { required: true, message: '请输入排序', trigger: 'blur' }
        ],
        catelogId: [
          { required: true, message: '请先选择分类', trigger: 'change' }
        ]
      }
    }
  },
  methods: {
    // 处理分类点击
    handleCategoryClick (category) {
      this.selectedCategory = category
      this.categoryName = category.name
      this.groupForm.catelogId = category.catId
      this.getGroupList()
    },

    // 获取属性分组列表
    async getGroupList () {
      if (!this.selectedCategory) {
        this.groupList = []
        this.total = 0
        return
      }

      this.loading = true
      try {
        const params = {
          page: this.page,
          limit: this.limit,
          catelogId: this.selectedCategory.catId
        }
        if (this.searchForm.attrGroupName) {
          params.attrGroupName = this.searchForm.attrGroupName
        }

        const response = await http({
          url: http.adornUrl('/product/attrgroup/list'),
          method: 'get',
          params: http.adornParams(params)
        })

        if (response.data && response.data.code === 0) {
          this.groupList = response.data.data.list || []
          this.total = response.data.data.totalCount || 0
        } else {
          this.$message.error(response.data.msg || '获取属性分组列表失败')
        }
      } catch (error) {
        console.error('获取属性分组列表失败:', error)
        this.$message.error('获取属性分组列表失败')
      } finally {
        this.loading = false
      }
    },

    // 搜索属性分组
    searchGroups () {
      this.page = 1
      this.getGroupList()
    },

    // 新增属性分组
    addGroup () {
      if (!this.selectedCategory) {
        this.$message.warning('请先选择分类')
        return
      }
      this.isEdit = false
      this.dialogTitle = '新增属性分组'
      this.dialogVisible = true
      this.groupForm = {
        attrGroupId: null,
        attrGroupName: '',
        sort: 0,
        descript: '',
        icon: '',
        catelogId: this.selectedCategory.catId
      }
    },

    // 编辑属性分组
    editGroup (row) {
      this.isEdit = true
      this.dialogTitle = '修改属性分组'
      this.dialogVisible = true
      this.groupForm = { ...row }
    },

    // 删除属性分组
    async deleteGroup (row) {
      try {
        await this.$confirm(`确定要删除属性分组"${row.attrGroupName}"吗？`, '确认删除', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })

        const response = await http({
          url: http.adornUrl(`/product/attrgroup/delete/${row.attrGroupId}`),
          method: 'post'
        })

        if (response.data && response.data.code === 0) {
          this.$message.success('删除成功')
          this.getGroupList() // 重新加载列表
        } else {
          this.$message.error(response.data.msg || '删除失败')
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除失败:', error)
          this.$message.error('删除失败')
        }
      }
    },

    // 批量删除
    async batchDelete () {
      if (this.selectedIds.length === 0) {
        this.$message.warning('请选择要删除的分组')
        return
      }

      try {
        await this.$confirm(`确定要删除选中的 ${this.selectedIds.length} 个属性分组吗？`, '确认删除', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })

        const response = await http({
          url: http.adornUrl('/product/attrgroup/delete'),
          method: 'post',
          data: this.selectedIds
        })

        if (response.data && response.data.code === 0) {
          this.$message.success('批量删除成功')
          this.getGroupList() // 重新加载列表
        } else {
          this.$message.error(response.data.msg || '批量删除失败')
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('批量删除失败:', error)
          this.$message.error('批量删除失败')
        }
      }
    },

    // 处理选择变化
    handleSelectionChange (selection) {
      this.selectedIds = selection.map(item => item.attrGroupId)
    },

    // 提交表单
    submitForm () {
      this.$refs.groupForm.validate(async (valid) => {
        if (valid) {
          this.submitLoading = true
          try {
            const url = this.isEdit ? '/product/attrgroup/update' : '/product/attrgroup/save'
            const method = 'post'

            // 编辑时不传递attrGroupId
            let submitData = { ...this.groupForm }
            if (!this.isEdit) {
              delete submitData.attrGroupId
            }

            const response = await http({
              url: http.adornUrl(url),
              method: method,
              data: http.adornData(submitData)
            })

            if (response.data && response.data.code === 0) {
              this.$message.success(this.isEdit ? '修改成功' : '添加成功')
              this.dialogVisible = false
              this.getGroupList() // 重新加载列表
            } else {
              this.$message.error(response.data.msg || (this.isEdit ? '修改失败' : '添加失败'))
            }
          } catch (error) {
            console.error(this.isEdit ? '修改失败:' : '添加失败:', error)
            this.$message.error(this.isEdit ? '修改失败' : '添加失败')
          } finally {
            this.submitLoading = false
          }
        }
      })
    },

    // 对话框关闭处理
    handleDialogClose () {
      this.$refs.groupForm.resetFields()
      this.groupForm = {
        attrGroupId: null,
        attrGroupName: '',
        sort: 0,
        descript: '',
        icon: '',
        catelogId: this.selectedCategory ? this.selectedCategory.catId : null
      }
    },

    // 分页大小改变
    handleSizeChange (val) {
      this.limit = val
      this.page = 1
      this.getGroupList()
    },

    // 当前页改变
    handleCurrentChange (val) {
      this.page = val
      this.getGroupList()
    },

    // 图标上传成功
    onIconUploadSuccess (data) {
      console.log('图标上传成功:', data.url)
    },

    // 图标上传失败
    onIconUploadError (error) {
      console.error('图标上传失败:', error)
    },

    // 预览图片
    previewImage (url) {
      // 直接使用原生HTML创建预览
      const div = document.createElement('div')
      div.style.cssText = 'text-align: center; padding: 20px; max-width: 400px; max-height: 400px; overflow: hidden;'

      const img = document.createElement('img')
      img.src = url
      img.style.cssText = 'max-width: 300px; max-height: 300px; width: auto; height: auto; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; display: block; margin: 0 auto;'

      div.appendChild(img)

      this.$msgbox({
        title: '图片预览',
        message: div,
        showCancelButton: false,
        confirmButtonText: '关闭',
        customClass: 'image-preview-dialog',
        beforeClose: () => {
          // 清理DOM元素
          div.remove()
        }
      })
    }
  }
}
</script>

<style scoped>
.attr-group-container {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

.left-panel {
  width: 300px;
  background: #fff;
  border-right: 1px solid #e6e6e6;
}

.right-panel {
  flex: 1;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.content-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e6e6e6;
  background: #f5f5f5;
}

.content-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.operation-container {
  padding: 16px 20px;
  border-bottom: 1px solid #e6e6e6;
}

.el-pagination {
  margin: 20px;
  text-align: right;
}

/* 图标样式 */
.group-icon {
  transition: transform 0.2s;
}

.group-icon:hover {
  transform: scale(1.05);
}

/* 图片预览对话框样式 */
:global(.image-preview-dialog) {
  max-width: 500px !important;
}
</style>
