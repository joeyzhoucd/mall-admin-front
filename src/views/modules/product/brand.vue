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
          width="200">
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
        }
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
            this.brandList = response.data.page.list || []
            this.total = response.data.page.totalCount || 0
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
            // 清理DOM元素
            div.remove()
          }
        })
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
</style>
