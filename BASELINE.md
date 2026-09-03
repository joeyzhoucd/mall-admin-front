# 旧 Vue 后台的行为基线（React 重写的验收清单）

> 由 `tools/extract-baseline.js` 从源码自动提取，不是手写的。
> 重写每一页之后，对照这里的「接口」和「动作」逐条验收 ——
> 界面长得像不代表行为一样，最容易出的错是「点下去调错了接口或漏了参数」，而且不报错。

## 总量

| 项 | 数 |
|---|---|
| 页面/组件文件 | 73 |
| 去重后的后端接口 | 105 |
| 用到的 Element 组件种类 | 39 |
| 源码行数 | 13030 |

## Element 组件 → 需要的 MUI/TanStack 等价物

这一列是 P0 就要决定的：缺哪个等价物，对应的页面在 P3–P6 就会卡住。

```
el-button  el-upload  el-tree  el-table-column  el-dialog  el-col  el-form  el-form-item  el-input  el-row  el-radio  el-radio-group  el-alert  el-card  el-dropdown  el-dropdown-item  el-dropdown-menu  el-tab-pane  el-tabs  el-badge  el-menu  el-menu-item  el-submenu  el-pagination  el-table  el-tag  el-input-number  el-option  el-select  el-switch  el-cascader  el-checkbox  el-date-picker  el-checkbox-group  el-divider  el-step  el-steps  el-popover  el-tooltip
```

## 逐页清单

### `src/components/OssUpload.vue`

**动作**：

- …
- 删除 → removeFile

### `src/router/index.js`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/menu/nav`

### `src/utils/objectStorage.js`

**接口**（重写后必须一个不少、一个不多）：

- `/thirdparty/oss/presign`

### `src/views/common/404.vue`

**动作**：

- 返回上一页 → $router.go(-1)
- 进入首页 → $router.push({ name: 'home' })

### `src/views/common/login.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/captcha.jpg?uuid={}`
- `/sys/login`

**动作**：

- 登录 → dataFormSubmit()

### `src/views/demo/ueditor.vue`

**动作**：

- 确定 → dialogVisible = false
- 获得内容 → getContent()

**对话框**：「内容」

### `src/views/main-navbar-update-password.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/user/password`

**动作**：

- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「修改密码」

### `src/views/main-navbar.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/logout`

### `src/views/main.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/user/info`

### `src/views/modules/job/schedule-add-or-update.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/schedule/info/{}`
- `/sys/schedule/{}`

**动作**：

- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/job/schedule-log.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/scheduleLog/info/{}`
- `/sys/scheduleLog/list`

**动作**：

- 查询 → getDataList()

**对话框**：「日志列表」

### `src/views/modules/job/schedule.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/schedule/delete`
- `/sys/schedule/list`
- `/sys/schedule/pause`
- `/sys/schedule/resume`
- `/sys/schedule/run`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.jobId)
- 删除 → deleteHandle(scope.row.jobId)
- 恢复 → resumeHandle(scope.row.jobId)
- 批量删除 → deleteHandle()
- 批量恢复 → resumeHandle()
- 批量暂停 → pauseHandle()
- 批量立即执行 → runHandle()
- 新增 → addOrUpdateHandle()
- 日志列表 → logHandle()
- 暂停 → pauseHandle(scope.row.jobId)
- 查询 → getDataList()
- 立即执行 → runHandle(scope.row.jobId)

### `src/views/modules/member/level.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/member/memberlevel/delete`
- `/member/memberlevel/list`

**动作**：

- 保存 → submit
- 删除 → del(scope.row)
- 取消 → dialogVisible=false
- 批量删除 → batchDel
- 新增 → addOrUpdate()
- 查询 → search
- 编辑 → addOrUpdate(scope.row)

**对话框**：「dialogTitle」

### `src/views/modules/oss/oss-config.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/oss/config`

**动作**：

- 关闭 → visible = false

**对话框**：「云存储配置」

### `src/views/modules/oss/oss-upload.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/oss/confirm`

**对话框**：「上传文件」

### `src/views/modules/oss/oss.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/oss/delete`
- `/sys/oss/list`

**动作**：

- 上传文件 → uploadHandle()
- 云存储配置 → configHandle()
- 删除 → deleteHandle(scope.row.id)
- 批量删除 → deleteHandle()

### `src/views/modules/product/attr-group.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/attr/unrelated/{}`
- `/product/attrattrgrouprelation/delete/{}/{}`
- `/product/attrattrgrouprelation/getAttrsByGroupId/{}`
- `/product/attrattrgrouprelation/saveBatch`
- `/product/attrgroup/delete`
- `/product/attrgroup/delete/{}`
- `/product/attrgroup/list`

**动作**：

- 保存 → saveAttrRelation
- 修改 → editGroup(scope.row)
- 关联属性 → manageAttrRelation(scope.row)
- 删除 → deleteGroup(scope.row)
- 取消 → attrRelationDialogVisible = false
- 取消 → dialogVisible = false
- 批量删除 → batchDelete
- 新增 → addGroup
- 查询 → searchGroups
- 确定 → submitForm

**对话框**：「`关联属性 - ${currentAttrGroup ? currentAttrGroup.attrGroupName : ''}`」、「dialogTitle」

### `src/views/modules/product/attr-sale.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/attr/sale/delete`
- `/product/attr/sale/delete/{}`
- `/product/attr/sale/list`
- `/product/attr/sale/updateEnable`

**动作**：

- (无文案) → addValue
- 删除 → deleteAttr(scope.row)
- 取消 → dialogVisible = false
- 批量删除 → batchDelete
- 新增 → addAttr
- 查询 → searchAttrs
- 确定 → submitForm
- 编辑 → editAttr(scope.row)

**对话框**：「dialogTitle」

### `src/views/modules/product/attr-spec.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/attr/spec/delete`
- `/product/attr/spec/delete/{}`
- `/product/attr/spec/list`
- `/product/attr/spec/updateEnable`
- `/product/attrgroup/list`

**动作**：

- (无文案) → addValue
- 修改 → editAttr(scope.row)
- 删除 → deleteAttr(scope.row)
- 取消 → dialogVisible = false
- 批量删除 → batchDelete
- 新增 → addAttr
- 查询 → searchAttrs
- 确定 → submitForm

**对话框**：「dialogTitle」

### `src/views/modules/product/brand-select.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/categorybrandrelation/getRelationsByCategoryId/{}`

### `src/views/modules/product/brand.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/brand/delete/{}`
- `/product/brand/list`
- `/product/brand/updateStatus`
- `/product/category/list/tree`
- `/product/categorybrandrelation/getRelationsByBrandId/{}`
- `/product/categorybrandrelation/updateRelations/{}`

**动作**：

- 保存 → saveCategoryRelation
- 关联分类 → manageCategoryRelation(scope.row)
- 删除 → deleteBrand(scope.row)
- 取消 → categoryRelationDialogVisible = false
- 取消 → dialogVisible = false
- 新增品牌 → addBrand
- 确定 → submitForm
- 编辑 → editBrand(scope.row)

**对话框**：「dialogTitle」、「品牌关联分类」

### `src/views/modules/product/category.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/category/delete`
- `/product/category/info/{}`
- `/product/category/list/tree`
- `/product/category/save/drag`

**动作**：

- append(data)">添加
- deleteCategory(data)">删除
- editCategory(data)">修改
- 取消 → dialogVisible = false
- 属性分组管理 → goToAttrGroup
- 批量保存 → batchSave
- 批量删除 → batchDelete
- 确定 → submitForm

**对话框**：「dialogTitle」

### `src/views/modules/product/sku.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/coupon/coupon/list`
- `/coupon/couponspurelation/bind`
- `/coupon/memberprice/save`
- `/coupon/seckill/activate/{}`
- `/coupon/seckill/scheduler/save`
- `/coupon/skufullreduction/save`
- `/coupon/skuladder/save`
- `/member/memberlevel/list`
- `/product/brand/list`
- `/product/category/list/tree`
- `/product/skuimages/delete`
- `/product/skuimages/list`
- `/product/skuimages/save`
- `/product/skuinfo/batchPublish`
- `/product/skuinfo/delete`
- `/product/skuinfo/list`
- `/product/skuinfo/update`
- `/ware/waresku/updateStock`

**动作**：

- 保存 → submitDiscount
- 保存 → submitEdit
- 保存 → submitMemberPrice
- 保存 → submitReduction
- 保存 → submitSeckill
- 保存 → submitStock
- 保存 → submitUploadImages
- 取消 → dlg.coupon=false
- 取消 → dlg.discount=false
- 取消 → dlg.edit=false
- 取消 → dlg.memberPrice=false
- 取消 → dlg.reduction=false
- 取消 → dlg.seckill=false
- 取消 → dlg.stock=false
- 取消 → dlg.uploadImages=false
- 批量上架 → batchPublish(1)
- 批量下架 → batchPublish(0)
- 批量删除 → batchDelete
- 查询 → getDataList()
- 立即上线 → activateSeckill
- 绑定 → submitCoupon
- 编辑 → editHandle(scope.row)
- 评论 → commentHandle(scope.row.skuId)
- 重置 → resetDataForm()
- 预览 → previewHandle(scope.row.skuId)

**对话框**：「上传图片」、「会员价格」、「参与秒杀」、「库存管理」、「折扣设置（阶梯价）」、「满减设置」、「绑定优惠券」、「编辑SKU」

### `src/views/modules/product/spu-add.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/member/memberlevel/list`
- `/product/attr/sale/list/{}`
- `/product/attrgroup/withattr/{}`
- `/product/category/list/tree`
- `/product/spuinfo/save`

**动作**：

- +自定义 → showInput(sidx)
- … → next
- 上一步 → prev

### `src/views/modules/product/spu-spec.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/skuinfo/delete`
- `/product/skuinfo/list`
- `/product/skuinfo/update`
- `/product/spuinfo/info/{}`

**动作**：

- 保存所有 → saveAll
- 删除 → deleteSku(scope.row.skuId)
- 取消 → goBack
- 编辑 → editSku(scope.row)
- 返回 → goBack

### `src/views/modules/product/spu.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/product/brand/list`
- `/product/category/list/tree`
- `/product/spuinfo/delete`
- `/product/spuinfo/list`
- `/product/spuinfo/unpublish`
- `/product/spuinfo/{}/up`

**动作**：

- 上架 → publishHandle(scope.row.id)
- 下架 → unpublishHandle(scope.row.id)
- 删除 → deleteHandle(scope.row.id)
- 查询 → getDataList()
- 规格 → specHandle(scope.row.id)
- 重置 → resetDataForm()

### `src/views/modules/sys/config-add-or-update.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/config/info/{}`
- `/sys/config/{}`

**动作**：

- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/sys/config.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/config/delete`
- `/sys/config/list`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.id)
- 删除 → deleteHandle(scope.row.id)
- 批量删除 → deleteHandle()
- 新增 → addOrUpdateHandle()
- 查询 → getDataList()

### `src/views/modules/sys/log.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/log/list`

**动作**：

- 查询 → getDataList()

### `src/views/modules/sys/menu-add-or-update.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/menu/info/{}`
- `/sys/menu/select`
- `/sys/menu/{}`

**动作**：

- (无文案) → iconActiveHandle(item)
- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/sys/menu.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/menu/delete/{}`
- `/sys/menu/list`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.menuId)
- 删除 → deleteHandle(scope.row.menuId)
- 新增 → addOrUpdateHandle()

### `src/views/modules/sys/role-add-or-update.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/menu/list`
- `/sys/role/info/{}`
- `/sys/role/{}`

**动作**：

- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/sys/role.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/role/delete`
- `/sys/role/list`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.roleId)
- 删除 → deleteHandle(scope.row.roleId)
- 批量删除 → deleteHandle()
- 新增 → addOrUpdateHandle()
- 查询 → getDataList()

### `src/views/modules/sys/user-add-or-update.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/role/select`
- `/sys/user/info/{}`
- `/sys/user/{}`

**动作**：

- 取消 → visible = false
- 确定 → dataFormSubmit()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/sys/user.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/user/delete`
- `/sys/user/list`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.userId)
- 删除 → deleteHandle(scope.row.userId)
- 批量删除 → deleteHandle()
- 新增 → addOrUpdateHandle()
- 查询 → getDataList()

### `src/views/modules/ware/purchase.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/sys/user/list`
- `/ware/purchase/assign`
- `/ware/purchase/delete`
- `/ware/purchase/finish`
- `/ware/purchase/list`
- `/ware/purchase/receive`

**动作**：

- 分配 → openAssign(scope.row)
- 删除 → delOne(scope.row.id)
- 取消 → dlg.assign=false
- 取消 → dlg.edit=false
- 取消 → dlg.finish=false
- 完成 → doFinish
- 批量删除 → batchDelete
- 新增 → openEdit()
- 查询 → getDataList
- 确定 → doAssign
- 确定 → submit()
- 编辑 → openEdit(scope.row)
- 重置 → resetQuery

**对话框**：「form.id ? '编辑采购单' : '新建采购单'」、「分配采购员」、「完成采购」

### `src/views/modules/ware/purchasedetail.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/ware/purchase/list`
- `/ware/purchase/merge`
- `/ware/purchasedetail/delete`
- `/ware/purchasedetail/list`
- `/ware/wareinfo/list`

**动作**：

- 删除 → delOne(scope.row.id)
- 取消 → dlg.edit=false
- 取消 → dlg.merge=false
- 合并 → doMerge
- 新增 → addOrUpdate()
- 查询 → getDataList
- 确定 → submit()
- 编辑 → addOrUpdate(scope.row)
- 重置 → resetQuery

**对话框**：「form.id ? '编辑采购项' : '新增采购项'」、「合并到采购单」

### `src/views/modules/ware/ware-info.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/ware/wareinfo/delete`
- `/ware/wareinfo/info/{}`
- `/ware/wareinfo/list`
- `/ware/wareinfo/{}`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.id)
- 删除 → deleteHandle(scope.row.id)
- 取消 → addOrUpdateVisible = false
- 批量删除 → batchDelete
- 新增 → addOrUpdateHandle()
- 查询 → getDataList()
- 确定 → dataFormSubmit()
- 重置 → resetDataForm()

**对话框**：「!dataForm.id ? '新增' : '修改'」

### `src/views/modules/ware/ware-sku.vue`

**接口**（重写后必须一个不少、一个不多）：

- `/ware/wareinfo/list`
- `/ware/waresku/delete`
- `/ware/waresku/info/{}`
- `/ware/waresku/list`
- `/ware/waresku/{}`

**动作**：

- 修改 → addOrUpdateHandle(scope.row.id)
- 删除 → deleteHandle(scope.row.id)
- 取消 → addOrUpdateVisible = false
- 批量删除 → batchDelete
- 新增 → addOrUpdateHandle()
- 查询 → getDataList()
- 确定 → dataFormSubmit()
- 重置 → resetDataForm()

**对话框**：「!dataForm.id ? '新增' : '修改'」

