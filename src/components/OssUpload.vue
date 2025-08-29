<template>
  <div class="oss-upload">
    <el-upload
      ref="upload"
      :action="uploadUrl"
      :headers="uploadHeaders"
      :data="uploadData"
      :before-upload="beforeUpload"
      :on-success="onSuccess"
      :on-error="onError"
      :on-progress="onProgress"
      :show-file-list="false"
      :accept="accept"
      :disabled="disabled">
      <el-button
        :type="buttonType"
        :size="buttonSize"
        :loading="uploading"
        :disabled="disabled">
        <i class="el-icon-upload"></i>
        {{ buttonText }}
      </el-button>
      <div slot="tip" class="el-upload__tip">
        {{ tip }}
      </div>
    </el-upload>

    <!-- 预览图片 -->
    <div v-if="showPreview && fileUrl" class="image-preview">
      <img
        :src="fileUrl"
        :style="{ width: previewWidth + 'px', height: previewHeight + 'px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }"
        @click="previewImage(fileUrl)">
      <div class="image-actions">
        <el-button
          type="danger"
          size="mini"
          icon="el-icon-delete"
          @click="removeFile">
          删除
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'OssUpload',
  props: {
    // 文件URL，用于显示预览
    value: {
      type: String,
      default: ''
    },
    // 上传按钮文字
    buttonText: {
      type: String,
      default: '上传文件'
    },
    // 按钮类型
    buttonType: {
      type: String,
      default: 'primary'
    },
    // 按钮大小
    buttonSize: {
      type: String,
      default: 'small'
    },
    // 提示文字
    tip: {
      type: String,
      default: '支持jpg、png、gif格式，文件大小不超过2MB'
    },
    // 接受的文件类型
    accept: {
      type: String,
      default: 'image/*'
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      default: false
    },
    // 是否显示预览
    showPreview: {
      type: Boolean,
      default: true
    },
    // 预览图片宽度
    previewWidth: {
      type: Number,
      default: 100
    },
    // 预览图片高度
    previewHeight: {
      type: Number,
      default: 100
    },
    // 文件大小限制（MB）
    maxSize: {
      type: Number,
      default: 2
    }
  },
  data () {
    return {
      uploadUrl: '', // OSS上传地址
      uploadHeaders: {}, // 上传请求头
      uploadData: {}, // 上传额外参数
      uploading: false, // 是否正在上传
      fileUrl: this.value, // 文件URL
      currentFile: null // 当前上传的文件对象
    }
  },
  watch: {
    value: {
      handler (newVal) {
        this.fileUrl = newVal
      },
      immediate: true
    }
  },
  methods: {
    // 上传前处理
    async beforeUpload (file) {
      // 保存当前文件对象
      this.currentFile = file

      // 检查文件大小
      const isLtMaxSize = file.size / 1024 / 1024 < this.maxSize
      if (!isLtMaxSize) {
        this.$message.error(`文件大小不能超过 ${this.maxSize}MB!`)
        return false
      }

      // 检查文件类型
      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        this.$message.error('只能上传图片文件!')
        return false
      }

      this.uploading = true

      try {
        // 获取OSS上传token
        await this.getOssToken()
        return true
      } catch (error) {
        this.uploading = false
        this.$message.error('获取上传凭证失败')
        return false
      }
    },

    // 获取OSS上传token
    async getOssToken () {
      try {
        const response = await http({
          url: http.adornUrl('/thirdparty/oss/policy'),
          method: 'get'
        })

        if (response.data && response.data.code === 0) {
          const ossData = response.data.data
          this.uploadUrl = ossData.host

          // 调试：打印OSS数据
          console.log('OSS数据:', ossData)
          console.log('OSS dir:', ossData.dir)
          console.log('生成的文件名:', this.generateFileName(this.currentFile))

          // 确保dir没有空格，并正确拼接文件名
          const cleanDir = ossData.dir ? ossData.dir.trim() : ''
          const fileName = this.generateFileName(this.currentFile)
          const key = cleanDir + fileName

          this.uploadData = {
            key: key,
            policy: ossData.policy,
            OSSAccessKeyId: ossData.accessKeyId,
            signature: ossData.signature,
            success_action_status: '201'
          }
          // 调试：打印生成的key
          console.log('生成的OSS key:', this.uploadData.key)
        } else {
          throw new Error(response.data.msg || '获取上传凭证失败')
        }
      } catch (error) {
        console.error('获取OSS token失败:', error)
        throw error
      }
    },

    // 生成文件名
    generateFileName (file) {
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 1000)
      const uuid = this.generateUUID()
      const extension = file ? file.name.split('.').pop() : 'jpg'
      // 确保所有部分都是字符串，避免空格
      const fileName = `${timestamp}_${random}_${uuid}.${extension}`
      console.log('生成的文件名:', fileName)
      return fileName
    },

    // 生成UUID
    generateUUID () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    },

    // 上传成功
    onSuccess (response, file) {
      this.uploading = false

      console.log('OSS上传响应:', response) // 调试用

      // 阿里云OSS返回的是XML格式，Element UI会自动解析
      // 检查响应中是否包含Location字段
      if (response && (response.Location || response.location)) {
        // 直接使用返回的Location作为文件URL
        const fileUrl = response.Location || response.location
        this.fileUrl = fileUrl

        // 触发v-model更新
        this.$emit('input', fileUrl)

        // 触发成功事件
        this.$emit('success', {
          url: fileUrl,
          file: file
        })

        this.$message.success('上传成功')
      } else {
        // 如果没有Location，尝试构建URL
        if (this.uploadData && this.uploadData.key) {
          // 直接使用key构建URL，不进行URL编码（因为OSS已经处理了）
          const fileUrl = this.uploadUrl + '/' + this.uploadData.key
          console.log('构建的URL:', fileUrl)
          this.fileUrl = fileUrl
          this.$emit('input', fileUrl)
          this.$emit('success', {
            url: fileUrl,
            file: file
          })
          this.$message.success('上传成功')
        } else {
          this.$message.error('上传失败')
          this.$emit('error', response)
        }
      }
    },

    // 上传失败
    onError (error, file) {
      this.uploading = false
      console.error('上传失败:', error)
      this.$message.error('上传失败')
      this.$emit('error', error)
    },

    // 上传进度
    onProgress (event, file) {
      this.$emit('progress', event)
    },

    // 删除文件
    removeFile () {
      this.fileUrl = ''
      this.$emit('input', '')
      this.$emit('remove')
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

    // 手动上传文件
    uploadFile (file) {
      this.$refs.upload.upload(file)
    }
  }
}
</script>

<style scoped>
.oss-upload {
  display: inline-block;
}

.image-preview {
  margin-top: 10px;
  position: relative;
  display: inline-block;
}

.image-preview img {
  cursor: pointer;
  transition: transform 0.2s;
}

.image-preview img:hover {
  transform: scale(1.05);
}

.image-actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-preview:hover .image-actions {
  opacity: 1;
}

.el-upload__tip {
  font-size: 12px;
  color: #606266;
  margin-top: 7px;
}
</style>
