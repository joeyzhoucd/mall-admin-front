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
        height="calc(100vh - 260px)"
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
          prop="categoryId"
          label="所属分类ID"
          width="120">
        </el-table-column>
        <el-table-column
          label="操作"
          width="200">
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
              @click="manageAttrRelation(scope.row)">
              关联属性
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
        <el-form-item label="所属分类" prop="categoryId">
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

    <!-- 关联属性对话框 -->
    <el-dialog
      :title="`关联属性 - ${currentAttrGroup ? currentAttrGroup.attrGroupName : ''}`"
      :visible.sync="attrRelationDialogVisible"
      width="800px"
      @close="handleAttrRelationDialogClose">
      <div v-if="currentAttrGroup" class="relation-header-tip">
        <span>当前分组：</span>
        <el-tag size="mini" type="info" style="margin-right: 8px;">{{ currentAttrGroup.attrGroupName }}</el-tag>
        <span>所属分类：</span>
        <el-tag size="mini">{{ categoryName }}</el-tag>
      </div>
      <div class="attr-relation-container">
        <!-- 已关联的属性 -->
        <div class="related-attr-section">
          <h4>已关联的属性</h4>
          <div class="related-attr-list">
            <el-tag
              v-for="attr in relatedAttrs"
              :key="attr.attrId"
              closable
              @close="removeAttrRelation(attr)"
              style="margin: 5px;">
              {{ attr.attrName }}
            </el-tag>
            <span v-if="relatedAttrs.length === 0" class="no-data">暂无关联属性</span>
          </div>
        </div>

        <!-- 可关联的属性 -->
        <div class="available-attr-section">
          <h4>可关联的属性</h4>
          <el-table
            :data="availableAttrs"
            v-loading="attrLoading"
            style="width: 100%"
            height="300px"
            @selection-change="handleAttrSelectionChange">
            <el-table-column
              type="selection"
              width="55">
            </el-table-column>
            <el-table-column
              prop="attrId"
              label="属性ID"
              width="100">
            </el-table-column>
            <el-table-column
              prop="attrName"
              label="属性名"
              width="150">
            </el-table-column>
            <el-table-column
              prop="searchType"
              label="是否检索"
              width="100">
              <template slot-scope="scope">
                <el-tag :type="scope.row.searchType === 1 ? 'success' : 'info'">
                  {{ scope.row.searchType === 1 ? '需要' : '不需要' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="attrType"
              label="属性类型"
              width="100">
              <template slot-scope="scope">
                <el-tag :type="scope.row.attrType === 1 ? 'primary' : 'warning'">
                  {{ scope.row.attrType === 1 ? '基本属性' : '销售属性' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="enable"
              label="状态"
              width="80">
              <template slot-scope="scope">
                <el-tag :type="scope.row.enable === 1 ? 'success' : 'danger'">
                  {{ scope.row.enable === 1 ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button @click="attrRelationDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="saveAttrRelation" :loading="saveRelationLoading">保 存</el-button>
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
        categoryId: null
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
        categoryId: [
          { required: true, message: '请先选择分类', trigger: 'change' }
        ]
      },

      // 关联属性相关数据
      attrRelationDialogVisible: false,
      currentAttrGroup: null, // 当前操作的属性分组
      relatedAttrs: [], // 已关联的属性
      availableAttrs: [], // 可关联的属性
      selectedAttrs: [], // 选中的属性
      attrLoading: false,
      saveRelationLoading: false
    }
  },
  methods: {
    // 处理分类点击
    handleCategoryClick (category) {
      this.selectedCategory = category
      this.categoryName = category.name
      this.groupForm.categoryId = category.catId
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
          categoryId: this.selectedCategory.catId
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
        categoryId: this.selectedCategory.catId
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
        categoryId: this.selectedCategory ? this.selectedCategory.catId : null
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
    },

    // 管理属性关联
    async manageAttrRelation (attrGroup) {
      this.currentAttrGroup = attrGroup
      this.attrRelationDialogVisible = true
      await this.getRelatedAttrs()
      await this.getAvailableAttrs()
    },

    // 获取已关联的属性
    async getRelatedAttrs () {
      if (!this.currentAttrGroup) return

      try {
        const response = await http({
          url: http.adornUrl(`/product/attrattrgrouprelation/getAttrsByGroupId/${this.currentAttrGroup.attrGroupId}`),
          method: 'get'
        })

        if (response.data && response.data.code === 0) {
          this.relatedAttrs = response.data.data || []
        } else {
          this.relatedAttrs = []
        }
      } catch (error) {
        console.error('获取已关联属性失败:', error)
        this.relatedAttrs = []
      }
    },

    // 获取可关联的属性
    async getAvailableAttrs () {
      if (!this.currentAttrGroup) return

      this.attrLoading = true
      try {
        const response = await http({
          url: http.adornUrl(`/product/attr/unrelated/${this.currentAttrGroup.attrGroupId}`),
          method: 'get'
        })

        if (response.data && response.data.code === 0) {
          const list = response.data.data || []
          // 统一字段类型，避免 === 判断失真
          this.availableAttrs = list.map(item => ({
            ...item,
            enable: typeof item.enable === 'string' ? parseInt(item.enable) || 0 : item.enable,
            searchType: typeof item.searchType === 'string' ? parseInt(item.searchType) || 0 : item.searchType,
            attrType: typeof item.attrType === 'string' ? parseInt(item.attrType) || 0 : item.attrType
          }))
        } else {
          this.availableAttrs = []
        }
      } catch (error) {
        console.error('获取可关联属性失败:', error)
        this.availableAttrs = []
      } finally {
        this.attrLoading = false
      }
    },

    // 处理属性选择变化
    handleAttrSelectionChange (selection) {
      this.selectedAttrs = selection
    },

    // 移除属性关联
    async removeAttrRelation (attr) {
      try {
        await this.$confirm(`确定要移除属性"${attr.attrName}"的关联吗？`, '确认移除', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })

        const response = await http({
          url: http.adornUrl(`/product/attrattrgrouprelation/delete/${attr.attrId}/${this.currentAttrGroup.attrGroupId}`),
          method: 'post'
        })

        if (response.data && response.data.code === 0) {
          this.$message.success('移除关联成功')
          await this.getRelatedAttrs()
          await this.getAvailableAttrs()
        } else {
          this.$message.error(response.data.msg || '移除关联失败')
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('移除关联失败:', error)
          this.$message.error('移除关联失败')
        }
      }
    },

    // 保存属性关联
    async saveAttrRelation () {
      if (this.selectedAttrs.length === 0) {
        this.$message.warning('请选择要关联的属性')
        return
      }

      this.saveRelationLoading = true
      try {
        const relations = this.selectedAttrs.map((attr, index) => ({
          attrId: attr.attrId,
          attrGroupId: this.currentAttrGroup.attrGroupId,
          attrSort: index + 1
        }))

        const response = await http({
          url: http.adornUrl('/product/attrattrgrouprelation/saveBatch'),
          method: 'post',
          data: relations
        })

        if (response.data && response.data.code === 0) {
          this.$message.success('关联属性成功')
          this.attrRelationDialogVisible = false
          await this.getRelatedAttrs()
          await this.getAvailableAttrs()
        } else {
          this.$message.error(response.data.msg || '关联属性失败')
        }
      } catch (error) {
        console.error('关联属性失败:', error)
        this.$message.error('关联属性失败')
      } finally {
        this.saveRelationLoading = false
      }
    },

    // 关联属性对话框关闭处理
    handleAttrRelationDialogClose () {
      this.currentAttrGroup = null
      this.relatedAttrs = []
      this.availableAttrs = []
      this.selectedAttrs = []
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

.relation-header-tip {
  padding: 6px 8px;
  background: #f9fafc;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 10px;
  color: #606266;
  font-size: 12px;
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
  overflow: hidden;
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
  background: #fff;
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

/* 关联属性对话框样式 */
.attr-relation-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.related-attr-section,
.available-attr-section {
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  padding: 16px;
}

.related-attr-section h4,
.available-attr-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.related-attr-list {
  min-height: 40px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.no-data {
  color: #999;
  font-size: 12px;
}
</style>
