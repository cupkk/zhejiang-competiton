# 校园成长小程序壳

这是第一阶段上线用的小程序壳工程，只负责两件事：

- 通过 `wx.login` 获取一次性 code。
- 用 `web-view` 打开 `https://campusgrow.top`，并把 code 传给 H5 完成真实微信登录。

## 上传前检查

微信公众平台需要已完成：

- request 合法域名：`https://campusgrow.top`
- web-view 业务域名：`https://campusgrow.top`
- 业务域名校验文件可访问：`https://campusgrow.top/djVGWes8Fi.txt`

线上 API 应返回：

```bash
curl https://campusgrow.top/api/health
```

关键字段应为：

- `databaseProvider=postgres`
- `storageProvider=s3`
- `wechatLoginMode=real`
- `paymentsEnabled=false`

## 微信开发者工具操作

1. 打开微信开发者工具。
2. 导入项目目录：`D:\github\zhejiang-competiton\wechat-shell`
3. AppID 使用：`wxda8641cd650537a4`
4. 编译后检查首页是否打开 `https://campusgrow.top`。
5. 在真机预览中测试登录、浏览、收藏、免费资源获取、组队发布、邮件联系、发帖和消息。
6. 预览通过后上传版本。

## 注意

- 不要把 AppSecret 写入本工程。
- 不要在小程序壳里加入支付入口。
- 如需打开指定 H5 路径，可进入：

```text
pages/webview/index?path=%2Fresources
```
