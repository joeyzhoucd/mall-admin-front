<template>
  <div>
    <div class="block">
      <p>商品分类管理</p>
      <el-tree
        ref="tree"
        :data="data"
        show-checkbox
        node-key="catId"
        :expand-on-click-node="false"
        :default-expanded-keys="expandedKeys"
        :props="defaultProps"
        @check="handleCheck">
        <span class="custom-tree-node" slot-scope="{ node, data }">
          <span>{{ node.label }}</span>
          <span>
            <el-button
              v-if="data.catLevel < 3"
              type="text"
              size="mini"
              @click="() => append(data)">
              添加
            </el-button>
            <el-button
              type="text"
              size="mini"
              @click="() => editCategory(data)">
              修改
            </el-button>
            <el-button
              type="text"
              size="mini"
              @click="() => deleteCategory(data)">
              删除
            </el-button>
          </span>
        </span>
      </el-tree>
    </div>

    <!-- 添加/修改分类对话框 -->
    <el-dialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      width="500px"
      @close="handleDialogClose">
      <el-form
        ref="categoryForm"
        :model="categoryForm"
        :rules="categoryRules"
        label-width="100px">
        <el-form-item label="父分类">
          <el-input v-model="parentCategoryName" disabled placeholder="父分类名称"></el-input>
        </el-form-item>
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="categoryForm.name" placeholder="请输入分类名称"></el-input>
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="categoryForm.sort" :min="0" placeholder="请输入排序"></el-input-number>
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <el-input v-model="categoryForm.icon" placeholder="请输入图标URL"></el-input>
        </el-form-item>
        <el-form-item label="计量单位" prop="productUnit">
          <el-input v-model="categoryForm.productUnit" placeholder="请输入计量单位"></el-input>
        </el-form-item>
        <el-form-item label="显示状态" prop="showStatus">
          <el-switch
            v-model="categoryForm.showStatus"
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
  </div>
</template>

<script>
  // 这里可以导入其他文件 (比如: 组件, 工具类, 第三方插件包, json文件, 图片资源等)
  // 例如: import 《组件名称》 from '《组件路径》';
  import http from '@/utils/httpRequest'

  export default {
    // import引入的组件需要注入到对象中才能使用
    components: {},
    props: {},
    data () {
      return {
        data: [],
        selectedIds: [],
        expandedKeys: [], // 默认展开的节点key数组
        defaultProps: {
          children: 'children',
          label: 'name'
        },
        // 对话框相关数据
        dialogVisible: false,
        dialogTitle: '',
        submitLoading: false,
        isEdit: false, // 是否为编辑模式
        parentCategoryName: '', // 父分类名称

        categoryForm: {
          catId: null,
          name: '',
          parentCid: 0,
          catLevel: 1,
          showStatus: 1,
          sort: 0,
          icon: '',
          productUnit: ''
        },
        categoryRules: {
          name: [
            { required: true, message: '请输入分类名称', trigger: 'blur' }
          ],
          sort: [
            { required: true, message: '请输入排序', trigger: 'blur' }
          ]
        }
      }
    },
    // 计算属性 类似于data概念
    computed: {},
    // 监控data中的数据变化
    watch: {},
    // 方法集合
    methods: {
      // 在这里定义组件方法
      // 获取分类树数据
      async getCategoryTree () {
        try {
          const response = await http({
            url: http.adornUrl('/product/category/list/tree'),
            method: 'get',
            params: http.adornParams()
          })
          if (response.data && response.data.code === 0) {
            this.data = response.data.data || []
          } else {
            this.$message.error(response.data.msg || '获取分类数据失败')
          }
        } catch (error) {
          console.error('获取分类数据失败:', error)
          this.$message.error('获取分类数据失败')
        }
      },

      // 处理节点勾选事件
      handleCheck (data, checkedInfo) {
        this.selectedIds = checkedInfo.checkedKeys
      },

      // 递归获取所有子分类ID
      getAllChildIds (category) {
        let ids = [category.catId]
        if (category.children && category.children.length > 0) {
          category.children.forEach(child => {
            ids = ids.concat(this.getAllChildIds(child))
          })
        }
        return ids
      },

      // 删除分类（包括子分类）
      async deleteCategory (data) {
        // 获取当前分类及其所有子分类的ID
        const categoryIds = this.getAllChildIds(data)
        // 获取父节点ID（用于删除后展开）
        const parentId = data.parentCid
        // 构建确认消息
        let confirmMessage = `确定要删除分类"${data.name}"`
        if (categoryIds.length > 1) {
          confirmMessage += `及其 ${categoryIds.length - 1} 个子分类`
        }
        confirmMessage += '吗？'

        try {
          await this.$confirm(confirmMessage, '确认删除', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })

          const response = await http({
            url: http.adornUrl('/product/category/delete'),
            method: 'post',
            data: categoryIds
          })

          if (response.data && response.data.code === 0) {
            this.$message.success('删除成功')
            // 设置要展开的父节点
            if (parentId && parentId !== 0) {
              this.expandedKeys = [parentId]
            } else {
              this.expandedKeys = []
            }
            await this.getCategoryTree() // 重新加载数据
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

      // 添加分类
      append (data) {
        console.log(data)
        this.isEdit = false
        this.dialogTitle = '添加分类'
        this.parentCategoryName = data.name // 设置父分类名称
        this.categoryForm = {
          catId: null,
          name: '',
          parentCid: data.catId,
          catLevel: data.catLevel + 1,
          showStatus: 1,
          sort: 0,
          icon: '',
          productUnit: ''
        }

        this.dialogVisible = true
      },

      // 修改分类
      async editCategory (data) {
        this.isEdit = true
        this.dialogTitle = '修改分类'
        this.dialogVisible = true

        try {
          // 从数据库获取最新数据
          const response = await http({
            url: http.adornUrl(`/product/category/info/${data.catId}`),
            method: 'get',
            params: http.adornParams()
          })

          if (response.data && response.data.code === 0) {
            this.categoryForm = { ...response.data.data }
            // 获取父分类名称 - 使用API返回数据中的parentCid
            this.getParentCategoryName(response.data.data.parentCid)
          } else {
            this.$message.error(response.data.msg || '获取分类信息失败')
            this.dialogVisible = false
          }
        } catch (error) {
          console.error('获取分类信息失败:', error)
          this.$message.error('获取分类信息失败')
          this.dialogVisible = false
        }
      },

      // 提交表单
      submitForm () {
        this.$refs.categoryForm.validate(async (valid) => {
          if (valid) {
            this.submitLoading = true
            try {
              const url = this.isEdit ? '/product/category/update' : '/product/category/save'
              const method = this.isEdit ? 'post' : 'post'

              // 添加时不传递catId，修改时保留catId
              let submitData = { ...this.categoryForm }
              if (!this.isEdit) {
                delete submitData.catId
              } else {
                // 修改时，移除不应该修改的字段
                delete submitData.catLevel
                delete submitData.deleted
                delete submitData.parentCid
                delete submitData.productCount
                delete submitData.children
              }

              const response = await http({
                url: http.adornUrl(url),
                method: method,
                data: http.adornData(submitData)
              })

              if (response.data && response.data.code === 0) {
                this.$message.success(this.isEdit ? '修改成功' : '添加成功')
                this.dialogVisible = false

                // 添加成功后展开父节点
                if (!this.isEdit && this.categoryForm.parentCid && this.categoryForm.parentCid !== 0) {
                  this.expandedKeys = [this.categoryForm.parentCid]
                }

                // 重新加载数据
                await this.getCategoryTree()
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

      // 获取父分类名称
      getParentCategoryName (parentCid) {
        if (parentCid === 0) {
          this.parentCategoryName = '顶级分类'
        } else {
          // 从当前树数据中查找父分类
          const findParent = (categories, targetId) => {
            for (const category of categories) {
              if (category.catId === targetId) {
                return category.name
              }
              if (category.children && category.children.length > 0) {
                const result = findParent(category.children, targetId)
                if (result) return result
              }
            }
            return null
          }
          const parentName = findParent(this.data, parentCid)
          this.parentCategoryName = parentName || '该分类已经是最顶级分类'
        }
      },

      // 对话框关闭处理
      handleDialogClose () {
        this.$refs.categoryForm.resetFields()
        this.parentCategoryName = '' // 重置父分类名称

        this.categoryForm = {
          catId: null,
          name: '',
          parentCid: 0,
          catLevel: 1,
          showStatus: 1,
          sort: 0,
          icon: '',
          productUnit: ''
        }
      }
    },
    // 生命周期钩子
    beforeCreate () {}, // 生命周期 - 创建前
    async created () {
      // 生命周期 - 创建完成（可以访问当前this）
      await this.getCategoryTree()
    },
    beforeMount () {}, // 生命周期 - 挂载前
    mounted () {}, // 生命周期 - 挂载完成（可以访问DOM元素）
    beforeUpdate () {}, // 生命周期 - 更新前
    updated () {}, // 生命周期 - 更新后
    beforeDestroy () {}, // 生命周期 - 销毁前
    destroyed () {}, // 生命周期 - 销毁后
    activated () {} // 如果页面有keep-alive缓存功能，这个函数会触发
  }
</script>
<style scoped>
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 14px;
  padding-right: 8px;
}

.custom-tree-node span:first-child {
  margin-right: 10px;
}
</style>