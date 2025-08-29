<template>
  <div>
    <div class="block">
      <p>商品分类管理</p>
      <div class="switch-container">
        <el-row>
          <el-switch
            v-model="draggable"
            active-text="允许拖拽"
            inactive-text="禁止拖拽">
          </el-switch>
          <el-button v-if="draggable" type="danger" @click="batchSave">批量保存</el-button>
          <el-button type="danger" @click="batchDelete">批量删除</el-button>
        </el-row>
      </div>
      <el-tree
        ref="tree"
        :data="data"
        show-checkbox
        node-key="catId"
        :expand-on-click-node="false"
        :default-expanded-keys="expandedKeys"
        :props="defaultProps"
        :draggable="draggable"
        :allow-drop="allowDrop"
        @node-drop="handleDrop"
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
        // 控制是否允许拖动
        draggable: true,
        // 记录拖拽改动的节点
        draggedNodes: new Map(), // 存储拖拽后的节点信息
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

      // 获取下一个排序号
      getNextSort (parentCid, level) {
        let maxSort = 0
        const findMaxSort = (categories) => {
          for (const category of categories) {
            if (category.parentCid === parentCid && category.catLevel === level) {
              maxSort = Math.max(maxSort, category.sort || 0)
            }
            if (category.children && category.children.length > 0) {
              findMaxSort(category.children)
            }
          }
        }
        findMaxSort(this.data)
        return maxSort + 1
      },

      // 批量保存拖拽改动
      async batchSave () {
        if (this.draggedNodes.size === 0) {
          this.$message.warning('没有需要保存的改动')
          return
        }

        try {
          await this.$confirm(`确定要保存 ${this.draggedNodes.size} 个分类的改动吗？`, '确认保存', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })

          const updateData = Array.from(this.draggedNodes.values()).map(node => ({
            catId: node.catId,
            parentCid: node.parentCid,
            catLevel: node.catLevel,
            sort: node.sort
          }))

          const response = await http({
            url: http.adornUrl('/product/category/save/drag'),
            method: 'post',
            data: http.adornData(updateData)
          })

          if (response.data && response.data.code === 0) {
            this.$message.success('批量保存成功')
            // 获取最后拖拽的节点ID，用于展开
            const lastDraggedNodeId = Array.from(this.draggedNodes.keys()).pop()
            this.draggedNodes.clear() // 清空改动记录
            await this.getCategoryTree() // 重新加载数据

            // 展开最后拖拽的节点
            if (lastDraggedNodeId) {
              this.expandedKeys = [lastDraggedNodeId]
            }
          } else {
            this.$message.error(response.data.msg || '批量保存失败')
          }
        } catch (error) {
          if (error !== 'cancel') {
            console.error('批量保存失败:', error)
            this.$message.error('批量保存失败')
          }
        }
      },

      // 批量删除选中的分类
      async batchDelete () {
        if (this.selectedIds.length === 0) {
          this.$message.warning('请先选择要删除的分类')
          return
        }

        try {
          await this.$confirm(`确定要删除选中的 ${this.selectedIds.length} 个分类吗？`, '确认删除', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })

          const response = await http({
            url: http.adornUrl('/product/category/delete'),
            method: 'post',
            data: this.selectedIds
          })

          if (response.data && response.data.code === 0) {
            this.$message.success('批量删除成功')
            this.selectedIds = [] // 清空选中
            this.draggedNodes.clear() // 清空拖拽记录
            await this.getCategoryTree() // 重新加载数据
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

      handleDrop (draggingNode, dropNode, dropType, ev) {
        console.log('tree drop: ', draggingNode, dropNode.label, dropType)

        // 记录拖拽改动的节点信息
        const draggedData = draggingNode.data
        const dropData = dropNode.data

        // 计算新的层级和父级ID
        let newLevel, newParentCid, newSort

        if (dropType === 'inner') {
          // 拖拽到节点内部
          newLevel = dropData.catLevel + 1
          newParentCid = dropData.catId
          newSort = this.getNextSort(dropData.catId, newLevel)
        } else {
          // 拖拽到节点前后
          newLevel = dropData.catLevel
          newParentCid = dropData.parentCid
          newSort = this.getNextSort(newParentCid, newLevel)
        }

        // 记录拖拽节点及其所有子节点的改动信息
        this.recordNodeAndChildrenChanges(draggedData, newParentCid, newLevel, newSort)

        console.log('拖拽改动记录: ', this.draggedNodes)
      },

      // 递归记录节点及其子节点的改动
      recordNodeAndChildrenChanges (nodeData, newParentCid, newLevel, newSort) {
        // 记录当前节点
        this.draggedNodes.set(nodeData.catId, {
          catId: nodeData.catId,
          name: nodeData.name,
          parentCid: newParentCid,
          catLevel: newLevel,
          sort: newSort,
          showStatus: nodeData.showStatus,
          icon: nodeData.icon,
          productUnit: nodeData.productUnit,
          originalData: { ...nodeData }
        })

        // 递归处理子节点
        if (nodeData.children && nodeData.children.length > 0) {
          nodeData.children.forEach((child, index) => {
            const childNewLevel = newLevel + 1
            const childNewSort = this.getNextSort(newParentCid, childNewLevel) + index
            this.recordNodeAndChildrenChanges(child, nodeData.catId, childNewLevel, childNewSort)
          })
        }
      },

      allowDrop (draggingNode, dropNode, type) {
        // 计算拖拽节点的子节点最大深度
        const draggingMaxLevel = this.getDraggingNodeMaxLevel(draggingNode)
        console.log('draggingMaxLevel: ', draggingMaxLevel)
        console.log('dropNode.level: ', dropNode.level)

        if (type === 'inner') {
          // 拖拽到节点内部：目标节点层级 + 1 + 拖拽节点的子节点最大深度 <= 3
          return dropNode.level + 1 + draggingMaxLevel <= 3
        }
        if (type === 'prev' || type === 'next') {
          // 拖拽到节点前后：目标节点层级 + 拖拽节点的子节点最大深度 <= 3
          return dropNode.level + draggingMaxLevel <= 3
        }
        return false
      },

      // 获取拖拽节点的子节点最大深度
      getDraggingNodeMaxLevel (node) {
        console.log('node---: ', node)
        if (!node || !node.childNodes || node.childNodes.length === 0) {
          return 0 // 没有子节点，深度为0
        }

        // 直接遍历所有子节点，找出最大的level
        let maxChildLevel = node.level
        const findMaxLevel = (children) => {
          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            console.log('child.level: ', child.level)
            if (child.level > maxChildLevel) {
              maxChildLevel = child.level
            }
            if (child.childNodes && child.childNodes.length > 0) {
              findMaxLevel(child.childNodes)
            }
          }
        }

        findMaxLevel(node.childNodes)
        // 返回子节点的最大深度 = 最大子节点level - 当前节点level
        return maxChildLevel - node.level
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

.switch-container {
  margin: 15px 0 15px 25px;
}
</style>