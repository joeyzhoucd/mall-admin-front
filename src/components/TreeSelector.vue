<template>
  <div class="tree-selector">
    <div class="tree-header">
      <span class="tree-title">{{ title }}</span>
    </div>
    <el-tree
      ref="tree"
      :data="treeData"
      :props="defaultProps"
      :node-key="nodeKey"
      :default-expanded-keys="expandedKeys"
      :highlight-current="true"
      @node-click="handleNodeClick"
      class="tree-content">
      <span class="custom-tree-node" slot-scope="{ node }">
        <span class="tree-node-label">{{ node.label }}</span>
      </span>
    </el-tree>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'TreeSelector',
  props: {
    title: {
      type: String,
      default: '分类树'
    },
    nodeKey: {
      type: String,
      default: 'catId'
    },
    apiUrl: {
      type: String,
      default: '/product/category/list/tree'
    },
    defaultProps: {
      type: Object,
      default: () => ({
        children: 'children',
        label: 'name'
      })
    }
  },
  data () {
    return {
      treeData: [],
      expandedKeys: [],
      loading: false
    }
  },
  methods: {
    // 获取树数据
    async getTreeData () {
      this.loading = true
      try {
        const response = await http({
          url: http.adornUrl(this.apiUrl),
          method: 'get'
        })
        if (response.data && response.data.code === 0) {
          this.treeData = response.data.data || []
        } else {
          this.$message.error(response.data.msg || '获取树数据失败')
        }
      } catch (error) {
        console.error('获取树数据失败:', error)
        this.$message.error('获取树数据失败')
      } finally {
        this.loading = false
      }
    },

    // 处理节点点击
    handleNodeClick (data, node) {
      // 只允许点击第三级节点
      if (data.catLevel === 3) {
        this.$emit('node-click', data, node)
      }
    },

    // 设置展开的节点
    setExpandedKeys (keys) {
      this.expandedKeys = keys
    },

    // 获取当前选中的节点
    getCurrentNode () {
      return this.$refs.tree.getCurrentNode()
    }
  },
  async created () {
    await this.getTreeData()
  }
}
</script>

<style scoped>
.tree-selector {
  width: 100%;
  height: 100%;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  background: #fff;
}

.tree-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e6e6e6;
  background: #f5f5f5;
}

.tree-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.tree-content {
  padding: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.tree-node-label {
  color: #333;
}

/* 第三级节点样式 */
.el-tree-node[data-level="3"] .tree-node-label {
  color: #409eff;
  font-weight: 500;
}

/* 非第三级节点禁用点击 */
.el-tree-node:not([data-level="3"]) {
  cursor: default;
}

.el-tree-node:not([data-level="3"]) .tree-node-label {
  color: #999;
}
</style>
