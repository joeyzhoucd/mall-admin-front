<template>
  <div>
    <el-upload
      ref="upload"
      action="#"
      :http-request="doUpload"
      :before-upload="beforeUpload"
      :on-error="onError"
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
import { presignAndPut } from '@/utils/objectStorage'

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
      // 原来这里硬编码了 https://mall-cd.oss-cn-chengdu.aliyuncs.com ——
      // 把 bucket 名和云厂商域名钉死在前端代码里，换环境就要改代码重新构建。
      // 现在上传地址完全由后端的预签名接口给出，前端不需要知道存储在哪。
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
      if (!file.type.startsWith('image/')) {
        this.$message.error('只能上传图片文件!')
        return false
      }
      return true
    },

    // 自定义上传：向后端要预签名地址，再把文件直接 PUT 到对象存储。
    // 原来是「beforeUpload 里先去取 policy，再让 el-upload 发表单 POST」——
    // 那种两段式还有个隐患：取回来的 policy/key 存在组件的 this 上，
    // 多个文件并发上传时后一个会覆盖前一个的 key，导致两个文件传到同一个对象上。
    // 现在每次上传的预签名地址都是这次调用的局部变量，并发天然安全。
    async doUpload ({ file, onProgress }) {
      try {
        const { url } = await presignAndPut(file, { onProgress })
        const current = Array.isArray(this.value) ? this.value.slice() : []
        if (!current.includes(url)) current.push(url)
        this.emitInput(current)
        this.$message.success('上传成功')
      } catch (e) {
        console.error('[multiUpload] 上传失败:', e)
        this.$message.error(e.message || '上传失败')
      }
    },

    onError (error, file) {
      console.error('[multiUpload] 上传失败:', error)
      this.$message.error('上传失败: ' + (error.message || '未知错误'))
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