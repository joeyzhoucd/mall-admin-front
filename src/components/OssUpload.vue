<template>
  <div class="oss-upload">
    <el-upload
      ref="upload"
      action="#"
      :http-request="doUpload"
      :before-upload="beforeUpload"
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
import { presignAndPut } from '@/utils/objectStorage'

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
    // 上传前的本地校验。
    //
    // 注意这里的大小检查【只是体验优化】，不是安全边界：
    // 预签名 PUT 无法把大小限制签进签名里（不像 OSS 的 PostObject policy 有
    // content-length-range），绕过前端直接 PUT 一个大文件是可行的。
    // 真正的限制要放在 bucket policy 或网关上，目前还没做。
    beforeUpload (file) {
      const isLtMaxSize = file.size / 1024 / 1024 < this.maxSize
      if (!isLtMaxSize) {
        this.$message.error(`文件大小不能超过 ${this.maxSize}MB!`)
        return false
      }
      if (!file.type.startsWith('image/')) {
        this.$message.error('只能上传图片文件!')
        return false
      }
      this.uploading = true
      return true
    },

    // 自定义上传：向后端要预签名地址，再把文件直接 PUT 到对象存储。
    // 用 :http-request 覆盖 el-upload 默认的表单 POST —— S3 的预签名是 PUT，
    // 表单 POST 那套（policy/signature/OSSAccessKeyId 字段）已经不适用了。
    async doUpload ({ file, onProgress }) {
      try {
        const { url } = await presignAndPut(file, { onProgress })
        this.uploading = false
        this.fileUrl = url
        this.$emit('input', url)
        this.$emit('success', { url, file })
        this.$message.success('上传成功')
      } catch (e) {
        this.uploading = false
        // 把真实原因带出来。对象存储的失败（签名不匹配 / CORS / 权限）长得都一样，
        // 只说"上传失败"的话没法判断该去改配置还是改代码。
        console.error('上传失败:', e)
        this.$message.error(e.message || '上传失败')
        this.$emit('error', e)
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
