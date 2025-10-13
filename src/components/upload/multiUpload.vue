<template>
  <div>
    <el-upload
      ref="upload"
      :action="uploadUrl"
      :headers="uploadHeaders"
      :data="uploadData"
      :before-upload="beforeUpload"
      :on-success="onSuccess"
      :on-error="onError"
      :on-progress="onProgress"
      :show-file-list="showFile"
      :list-type="listType"
      :file-list="fileList"
      :limit="maxCount"
      :on-exceed="handleExceed"
      :on-remove="handleRemove"
      :on-preview="handlePreview"
      :accept="accept"
    >
      <i class="el-icon-plus"></i>
    </el-upload>
    <el-dialog :visible.sync="dialogVisible">
      <img width="100%" :src="dialogImageUrl" alt />
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'MultiUpload',
  props: {
    value: Array,
    maxCount: { type: Number, default: 30 },
    listType: { type: String, default: 'picture-card' },
    showFile: { type: Boolean, default: true },
    accept: { type: String, default: 'image/*' }
  },
  data () {
    return {
      uploadUrl: 'https://mall-cd.oss-cn-chengdu.aliyuncs.com',
      uploadHeaders: {},
      uploadData: {},
      dialogVisible: false,
      dialogImageUrl: null
    }
  },
  mounted () {
    console.log('[multiUpload] 组件已挂载 - 版本2.0')
  },
  computed: {
    fileList () {
      const list = []
      const val = Array.isArray(this.value) ? this.value : []
      for (let i = 0; i < val.length; i++) {
        list.push({ name: `image_${i}`, url: val[i] })
      }
      return list
    }
  },
  methods: {
    emitInput (urls) {
      console.log('[multiUpload] emitInput 接收到的URLs:', urls)
      this.$emit('input', urls)
    },
    handleRemove (file, fileList) {
      const urls = fileList.map(f => f.url)
      this.emitInput(urls)
    },
    handlePreview (file) {
      this.dialogVisible = true
      this.dialogImageUrl = file.url
    },
    handleExceed () {
      this.$message({ message: '最多只能上传' + this.maxCount + '张图片', type: 'warning', duration: 1000 })
    },
    beforeUpload (file) {
      console.log('[multiUpload] beforeUpload 被调用，文件:', file && file.name)

      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        this.$message.error('只能上传图片文件!')
        return false
      }

      return this.getOssToken(file).then(() => {
        console.log('[multiUpload] OSS token获取成功，开始上传')
        return true
      }).catch(error => {
        console.error('[multiUpload] OSS token获取失败:', error)
        this.$message.error('获取上传凭证失败')
        return false
      })
    },
    onSuccess (response, file, fileList) {
      console.log('[multiUpload] onSuccess被调用! 响应:', response)

      // 仅回写OSS的公网可访问地址，禁止使用本地blob
      let imageUrl = ''
      if (response && response.Location) {
        imageUrl = response.Location
        console.log('[multiUpload] 从Location获取URL:', imageUrl)
      } else {
        imageUrl = this.uploadUrl + '/' + this.uploadData.key
        console.log('[multiUpload] 备用方案拼接URL:', imageUrl)
      }

      // 合并去重
      const current = Array.isArray(this.value) ? this.value.slice() : []
      if (!current.includes(imageUrl)) current.push(imageUrl)
      console.log('[multiUpload] 最终图片URL列表:', current)
      this.emitInput(current)
      this.$message.success('上传成功')
    },
    onError (error, file) {
      console.error('[multiUpload] 上传失败:', error)
      this.$message.error('上传失败: ' + (error.message || '未知错误'))
    },
    onProgress (event, file) {
      console.log('[multiUpload] 上传进度:', event.percent + '%')
    },
    getOssToken (file) {
      return new Promise((resolve, reject) => {
        http({
          url: http.adornUrl('/thirdparty/oss/policy'),
          method: 'get'
        }).then(response => {
          if (response.data && response.data.code === 0) {
            const ossData = response.data.data
            this.uploadUrl = ossData.host

            const cleanDir = ossData.dir ? ossData.dir.trim() : ''
            const fileName = this.generateFileName(file)
            const key = cleanDir + fileName

            this.uploadData = {
              key: key,
              policy: ossData.policy,
              OSSAccessKeyId: ossData.accessKeyId,
              signature: ossData.signature,
              success_action_status: '201'
            }

            console.log('[multiUpload] OSS参数设置完成:', {
              url: this.uploadUrl,
              key: key
            })
            resolve()
          } else {
            reject(new Error('获取OSS策略失败'))
          }
        }).catch(error => {
          console.error('[multiUpload] 获取OSS策略失败:', error)
          reject(error)
        })
      })
    },
    generateFileName (file) {
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 1000)
      const uuid = this.generateUUID()
      const extension = file.name.split('.').pop()
      return `${timestamp}_${random}_${uuid}.${extension}`
    },
    generateUUID () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }
  }
}
</script>

<style scoped>
</style>