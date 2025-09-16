<template>
  <div>
    <div class="block">
      <p>品牌管理</p>
      <div class="operation-container">
        <el-button type="primary" @click="addBrand">新增品牌</el-button>
      </div>

      <!-- 品牌列表表格 -->
      <el-table
        :data="brandList"
        v-loading="loading"
        style="width: 100%">
        <el-table-column
          prop="brandId"
          label="品牌ID"
          width="100">
        </el-table-column>
        <el-table-column
          prop="name"
          label="品牌名称"
          width="200">
        </el-table-column>
        <el-table-column
          prop="logo"
          label="品牌Logo"
          width="350">
                     <template slot-scope="scope">
             <img
               v-if="scope.row.logo"
               :src="scope.row.logo"
               class="brand-logo"
               style="width: 80px; height: 80px; display: block; border: 1px solid #ddd; background-color: #f5f5f5; object-fit: contain; border-radius: 4px; cursor: pointer;"
               @click="previewImage(scope.row.logo)"
               :alt="scope.row.name + ' Logo'">
             <span v-else>无Logo</span>
           </template>
        </el-table-column>
        <el-table-column
          prop="descript"
          label="品牌介绍"
          show-overflow-tooltip>
        </el-table-column>
        <el-table-column
          prop="firstLetter"
          label="首字母"
          width="100">
        </el-table-column>
        <el-table-column
          prop="sort"
          label="排序"
          width="100">
        </el-table-column>
        <el-table-column
          prop="showStatus"
          label="显示状态"
          width="150">
          <template slot-scope="scope">
            <el-switch
              v-model="scope.row.showStatus"
              :active-value="1"
              :inactive-value="0"
              active-text="显示"
              inactive-text="隐藏"
              @change="handleStatusChange(scope.row)">
            </el-switch>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="280">
          <template slot-scope="scope">
            <el-button
              type="text"
              size="mini"
              @click="editBrand(scope.row)">
              编辑
            </el-button>
            <el-button
              type="text"
              size="mini"
              @click="deleteBrand(scope.row)">
              删除
            </el-button>
            <el-button
              type="text"
              size="mini"
              @click="manageCategoryRelation(scope.row)">
              关联分类
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

    <!-- 添加/编辑品牌对话框 -->
    <el-dialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      width="600px"
      @close="handleDialogClose">
      <el-form
        ref="brandForm"
        :model="brandForm"
        :rules="brandRules"
        label-width="100px">
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="brandForm.name" placeholder="请输入品牌名称"></el-input>
        </el-form-item>
        <el-form-item label="品牌Logo" prop="logo">
          <oss-upload
            v-model="brandForm.logo"
            button-text="上传Logo"
            tip="支持jpg、png、gif格式，文件大小不超过2MB"
            :preview-width="120"
            :preview-height="120"
            @success="onLogoUploadSuccess"
            @error="onLogoUploadError">
          </oss-upload>
        </el-form-item>
        <el-form-item label="品牌介绍" prop="descript">
          <el-input
            type="textarea"
            :rows="4"
            v-model="brandForm.descript"
            placeholder="请输入品牌介绍">
          </el-input>
        </el-form-item>
        <el-form-item label="首字母" prop="firstLetter">
          <el-input v-model="brandForm.firstLetter" placeholder="请输入首字母" maxlength="1"></el-input>
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="brandForm.sort" :min="0" placeholder="请输入排序"></el-input-number>
        </el-form-item>
        <el-form-item label="显示状态" prop="showStatus">
          <el-switch
            v-model="brandForm.showStatus"
            :active-value="1"
            :inactive-value="0"
            active-text="显示"
            inactive-text="隐藏">
          </el-switch>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitLoading">确 定</el-button>
      </div>
    </el-dialog>

    <!-- 品牌关联分类对话框 -->
    <el-dialog
      title="品牌关联分类"
      :visible.sync="categoryRelationDialogVisible"
      width="800px"
      @close="handleCategoryRelationDialogClose">
      <div class="category-relation-container">
        <div class="brand-info">
          <h4>品牌信息：{{ currentBrand.name }}</h4>
        </div>

        <div class="category-selection">
          <h4>选择要关联的分类：</h4>
          <el-tree
            ref="categoryTree"
            :data="categoryTreeData"
            show-checkbox
            node-key="catId"
            :props="categoryTreeProps"
            :default-expanded-keys="expandedCategoryKeys"
            @check="handleCategoryCheck">
          </el-tree>
        </div>

        <div class="selected-categories" v-if="selectedCategories.length > 0">
          <h4>已选择的分类：</h4>
          <el-tag
            v-for="category in selectedCategories"
            :key="category.catId"
            closable
            @close="removeCategory(category)"
            style="margin-right: 8px; margin-bottom: 8px;">
            {{ category.name }}
          </el-tag>
        </div>
      </div>

      <div slot="footer" class="dialog-footer">
        <el-button @click="categoryRelationDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="saveCategoryRelation" :loading="saveRelationLoading">保 存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
  import http from '@/utils/httpRequest'
  import OssUpload from '@/components/OssUpload.vue'

  export default {
    components: {
      OssUpload
    },
    props: {},
    data () {
      return {
        // 品牌列表数据
        brandList: [],
        loading: false,
        // 分页参数
        page: 1,
        limit: 10,
        total: 0,
        // 对话框相关数据
        dialogVisible: false,
        dialogTitle: '',
        submitLoading: false,
        isEdit: false, // 是否为编辑模式

        // 品牌表单数据
        brandForm: {
          brandId: null,
          name: '',
          logo: '',
          descript: '',
          showStatus: 1,
          firstLetter: '',
          sort: 0
        },
        // 表单验证规则
        brandRules: {
          name: [
            { required: true, message: '请输入品牌名称', trigger: 'blur' },
            { max: 50, message: '品牌名称不能超过50个字符', trigger: 'blur' }
          ],
          firstLetter: [
            { required: true, message: '请输入首字母', trigger: 'blur' },
            { pattern: /^[A-Za-z]$/, message: '首字母只能是一个英文字母', trigger: 'blur' }
          ],
          sort: [
            { required: true, message: '请输入排序', trigger: 'blur' }
          ]
        },

        // 品牌关联分类相关数据
        categoryRelationDialogVisible: false,
        currentBrand: {},
        categoryTreeData: [],
        categoryTreeProps: {
          children: 'children',
          label: 'name'
        },
        expandedCategoryKeys: [],
        selectedCategories: [],
        saveRelationLoading: false
      }
    },
    computed: {},
    watch: {},
    methods: {
      // 获取品牌列表
      async getBrandList () {
        this.loading = true
        try {
          const response = await http({
            url: http.adornUrl('/product/brand/list'),
            method: 'get',
            params: http.adornParams({
              page: this.page,
              limit: this.limit
            })
          })
          if (response.data && response.data.code === 0) {
            this.brandList = response.data.data.list || []
            this.total = response.data.data.totalCount || 0
          } else {
            this.$message.error(response.data.msg || '获取品牌列表失败')
          }
        } catch (error) {
          console.error('获取品牌列表失败:', error)
          this.$message.error('获取品牌列表失败')
        } finally {
          this.loading = false
        }
      },

      // 新增品牌
      addBrand () {
        this.isEdit = false
        this.dialogTitle = '新增品牌'
        this.dialogVisible = true
        this.brandForm = {
          brandId: null,
          name: '',
          logo: '',
          descript: '',
          showStatus: 1,
          firstLetter: '',
          sort: 0
        }
      },

      // 编辑品牌
      editBrand (row) {
        this.isEdit = true
        this.dialogTitle = '编辑品牌'
        this.dialogVisible = true
        this.brandForm = { ...row }
      },

      // 删除品牌
      async deleteBrand (row) {
        try {
          await this.$confirm(`确定要删除品牌"${row.name}"吗？`, '确认删除', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })

          const response = await http({
            url: http.adornUrl(`/product/brand/delete/${row.brandId}`),
            method: 'post'
          })

          if (response.data && response.data.code === 0) {
            this.$message.success('删除成功')
            this.getBrandList() // 重新加载列表
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

      // 处理显示状态改变
      async handleStatusChange (row) {
        try {
          const response = await http({
            url: http.adornUrl('/product/brand/updateStatus'),
            method: 'post',
            data: http.adornData({
              brandId: row.brandId,
              showStatus: row.showStatus
            })
          })

          if (response.data && response.data.code === 0) {
            this.$message.success('状态更新成功')
          } else {
            this.$message.error(response.data.msg || '状态更新失败')
            // 恢复原状态
            row.showStatus = row.showStatus === 1 ? 0 : 1
          }
        } catch (error) {
          console.error('状态更新失败:', error)
          this.$message.error('状态更新失败')
          // 恢复原状态
          row.showStatus = row.showStatus === 1 ? 0 : 1
        }
      },

      // 提交表单
      submitForm () {
        this.$refs.brandForm.validate(async (valid) => {
          if (valid) {
            this.submitLoading = true
            try {
              const url = this.isEdit ? '/product/brand/update' : '/product/brand/save'
              const method = 'post'

              // 编辑时不传递brandId
              let submitData = { ...this.brandForm }
              if (!this.isEdit) {
                delete submitData.brandId
              }

              const response = await http({
                url: http.adornUrl(url),
                method: method,
                data: http.adornData(submitData)
              })

              if (response.data && response.data.code === 0) {
                this.$message.success(this.isEdit ? '修改成功' : '添加成功')
                this.dialogVisible = false
                this.getBrandList() // 重新加载列表
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
        this.$refs.brandForm.resetFields()
        this.brandForm = {
          brandId: null,
          name: '',
          logo: '',
          descript: '',
          showStatus: 1,
          firstLetter: '',
          sort: 0
        }
      },

      // 分页大小改变
      handleSizeChange (val) {
        this.limit = val
        this.page = 1
        this.getBrandList()
      },

      // 当前页改变
      handleCurrentChange (val) {
        this.page = val
        this.getBrandList()
      },

      // Logo上传成功
      onLogoUploadSuccess (data) {
        console.log('Logo上传成功:', data.url)
      },

      // Logo上传失败
      onLogoUploadError (error) {
        console.error('Logo上传失败:', error)
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
            // 清理DOM元�
            div.remove()
          }
        })
      },

      // 管理品牌分类关联
      async manageCategoryRelation (brand) {
        this.currentBrand = { ...brand }
        this.categoryRelationDialogVisible = true
        this.selectedCategories = []

        // 获取分类树数据
        await this.getCategoryTree()

        // 获取该品牌已关联的分类
        await this.getBrandCategoryRelations(brand.brandId)
      },

      // 获取分类树数据
      async getCategoryTree () {
        try {
          const response = await http({
            url: http.adornUrl('/product/category/list/tree'),
            method: 'get'
          })

          if (response.data && response.data.code === 0) {
            this.categoryTreeData = response.data.data || []
            // 默认折叠所有节点，不展开
            this.expandedCategoryKeys = []
          } else {
            this.$message.error(response.data.msg || '获取分类列表失败')
          }
        } catch (error) {
          console.error('获取分类列表失败:', error)
          this.$message.error('获取分类列表失败')
        }
      },

      // 获取所有分类ID（用于展开树节点）
      getAllCategoryIds (categories) {
        let ids = []
        categories.forEach(category => {
          ids.push(category.catId)
          if (category.children && category.children.length > 0) {
            ids = ids.concat(this.getAllCategoryIds(category.children))
          }
        })
        return ids
      },

      // 展开包含已选中分类的父节点
      expandNodesWithSelectedCategories (selectedKeys) {
        const expandedKeys = new Set()
        
        // 递归查找包含选中节点的父节点
        const findParentNodes = (categories, targetKeys) => {
          categories.forEach(category => {
            if (category.children && category.children.length > 0) {
              // 检查子节点中是否有选中的节点
              const hasSelectedChild = this.hasSelectedChild(category.children, targetKeys)
              if (hasSelectedChild) {
                expandedKeys.add(category.catId)
                // 递归检查更深层的父节点
                findParentNodes(category.children, targetKeys)
              }
            }
          })
        }
        
        findParentNodes(this.categoryTreeData, selectedKeys)
        this.expandedCategoryKeys = Array.from(expandedKeys)
      },

      // 检查节点及其子节点中是否有选中的节点
      hasSelectedChild (categories, selectedKeys) {
        for (let category of categories) {
          if (selectedKeys.includes(category.catId)) {
            return true
          }
          if (category.children && category.children.length > 0) {
            if (this.hasSelectedChild(category.children, selectedKeys)) {
              return true
            }
          }
        }
        return false
      },

      // 获取品牌已关联的分类
      async getBrandCategoryRelations (brandId) {
        try {
          const response = await http({
            url: http.adornUrl(`/product/categorybrandrelation/getRelationsByBrandId/${brandId}`),
            method: 'get'
          })

          if (response.data && response.data.code === 0) {
            const responseData = response.data.data
            console.log('获取到的关联数据:', responseData)
            
            // 判断返回的数据格式
            let relations = []
            if (Array.isArray(responseData)) {
              // 直接返回数组
              relations = responseData
            } else if (responseData && responseData.list) {
              // 分页格式
              relations = responseData.list
            }
            
            console.log('关联列表:', relations)
            
            // 将已关联的分类添加到选中列表
            this.selectedCategories = relations.map(relation => ({
              catId: relation.categoryId,
              name: relation.categoryName
            }))
            
            console.log('处理后的选中分类:', this.selectedCategories)

            // 设置树节点的选中状态和展开状态
            this.$nextTick(() => {
              const checkedKeys = this.selectedCategories.map(cat => cat.catId)
              this.$refs.categoryTree.setCheckedKeys(checkedKeys)
              
              // 展开包含已选中分类的父节点
              this.expandNodesWithSelectedCategories(checkedKeys)
            })
          }
        } catch (error) {
          console.error('获取品牌分类关联失败:', error)
        }
      },

      // 处理分类选择
      handleCategoryCheck (checkedNodes, checkedInfo) {
        // 获取所有选中的节点（包括半选中的父节点）
        const allCheckedNodes = this.$refs.categoryTree.getCheckedNodes()

        // 只保留叶子节点（三级分类）
        const leafNodes = allCheckedNodes.filter(node => !node.children || node.children.length === 0)
        this.selectedCategories = leafNodes.map(node => ({
          catId: node.catId,
          name: node.name
        }))
      },

      // 移除分类
      removeCategory (category) {
        const index = this.selectedCategories.findIndex(cat => cat.catId === category.catId)
        if (index > -1) {
          this.selectedCategories.splice(index, 1)
          // 更新树节点的选中状态
          this.$nextTick(() => {
            const checkedKeys = this.selectedCategories.map(cat => cat.catId)
            this.$refs.categoryTree.setCheckedKeys(checkedKeys)
          })
        }
      },

      // 保存品牌分类关联
      async saveCategoryRelation () {
        if (this.selectedCategories.length === 0) {
          this.$message.warning('请至少选择一个分类')
          return
        }

        this.saveRelationLoading = true
        try {
          // 提取分类ID列表
          const categoryIds = this.selectedCategories.map(category => category.catId)

          console.log('品牌ID:', this.currentBrand.brandId)
          console.log('分类ID列表:', categoryIds)

          // 调用统一的更新接口（在一个事务中处理删除和添加）
          const response = await http({
            url: http.adornUrl(`/product/categorybrandrelation/updateRelations/${this.currentBrand.brandId}`),
            method: 'post',
            data: categoryIds
          })

          console.log('更新响应:', response)

          if (response.data && response.data.code === 0) {
            this.$message.success('关联分类保存成功')
            this.categoryRelationDialogVisible = false
          } else {
            this.$message.error(response.data.msg || '保存失败')
          }
        } catch (error) {
          console.error('保存品牌分类关联失败:', error)
          this.$message.error('保存失败')
        } finally {
          this.saveRelationLoading = false
        }
      },

      // 关闭品牌分类关联对话框
      handleCategoryRelationDialogClose () {
        this.currentBrand = {}
        this.categoryTreeData = []
        this.selectedCategories = []
        this.expandedCategoryKeys = []
      }
    },
    // 生命周期钩子
    beforeCreate () {},
    async created () {
      await this.getBrandList()
    },
    beforeMount () {},
    mounted () {},
    beforeUpdate () {},
    updated () {},
    beforeDestroy () {},
    destroyed () {},
    activated () {}
  }
</script>

<style scoped>
.operation-container {
  margin: 15px 0;
}

.el-pagination {
  margin-top: 20px;
  text-align: right;
}

/* 图片样式 */
.brand-logo {
  transition: transform 0.2s;
}

.brand-logo:hover {
  transform: scale(1.05);
}

/* 图片预览对话框样式 */
:global(.image-preview-dialog) {
  max-width: 500px !important;
}

/* 品牌关联分类对话框样式 */
.category-relation-container {
  max-height: 500px;
  overflow-y: auto;
}

.brand-info {
  margin-bottom: 20px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.brand-info h4 {
  margin: 0;
  color: #409EFF;
}

.category-selection {
  margin-bottom: 20px;
}

.category-selection h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.selected-categories {
  margin-top: 20px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.selected-categories h4 {
  margin: 0 0 10px 0;
  color: #333;
}
</style>
