# 校园成长平台内测上线核验报告 20260706

## 结论

当前线上版本已可进入内测。核心 API、HTTPS、真实微信登录配置、支付关闭状态、管理员审核闭环均已验证。平台公开端已补充 26 条国家级白名单/官方竞赛基础条目；资源和经验索引已进入后台审核队列，需管理员审核通过后才会公开。

## 线上版本

- 域名：`https://campusgrow.top`
- 当前 release：`/opt/campus-growth/releases/20260706210132`
- API health：`postgres`、`s3`、`real`、`paymentsEnabled=false`
- HTTP：`http://campusgrow.top/` 返回 301 跳转 HTTPS
- HTTPS：`https://campusgrow.top/` 返回 200

## 本轮上线内容

### 内容补全

- 新增脚本：`scripts/sync-beta-content.ts`
- 新增 npm 命令：`npm run sync:beta-content`
- 生产执行结果：
  - 公开竞赛：26 条
  - 待审资源索引：13 条
  - 待审经验/索引帖子：4 条
  - 待处理审核任务：17 条
- 来源策略：
  - 竞赛目录可作为平台基础库公开展示。
  - 资源和经验索引只保存短摘要、来源名称和原文链接，先进入后台审核，不自动公开。
  - 不复制第三方全文，不伪造用户发布内容。

### 资源模型

- `resources` 增加 `source_url`。
- 官方来源索引审核通过后，资源详情显示“查看来源”，不走“免费领取/下载资源”。
- 下载服务移除无文件时的占位文本兜底；无真实文件时返回明确错误，避免内测用户下载到假文件。

### 用户体验

- 新增轻量 toast 反馈组件。
- 核心路径已替换系统弹窗：
  - 竞赛收藏/报名
  - 资源收藏/领取/下载
  - 帖子点赞/收藏/评论/举报
  - 发布帖子、发布组队、资源投稿
  - 我的资源下载
  - 消息标记已读
  - 队伍申请和队长审批
  - 个人资料保存
- 帖子举报从浏览器 prompt 改为页面内举报输入框。
- 发布页增加基础必填校验，后端也补了最小字段校验。

### 管理后台

- 审核任务增加来源链接展示：
  - 资源任务读取 `source_url`
  - 帖子任务从“原文：”内容行提取链接
- 资源审核页增加“来源”按钮。
- 管理员登录页改为 form 结构，补齐 `name` 和 `autocomplete`，清除浏览器密码框语义警告。

## 生产数据状态

```text
current_release|/opt/campus-growth/releases/20260706212540
competitions|85
resources_approved|8
resources_pending|25
posts_approved|10
posts_pending|2
tasks_approved|18
tasks_pending|27
beta_approval_audit_logs|16
mock_users|0
smoke_users|0
smoke_tasks|0
```

当前首页运营位已上线：

- 推荐竞赛：4 条
- 热门资源：4 条
- 社区精选：4 条
- 资源公开列表：8 条官方来源索引
- 社区公开列表：10 条经验/资讯

仍保留 25 条资源和 2 条帖子在后台待审，后续应由管理员分批审核，不建议一次性全量公开。

## 验证记录

### 本地验证

- `npm.cmd run lint`：通过
- `npm.cmd run typecheck:frontend`：通过
- `npm.cmd run build:frontend`：通过
- `npm.cmd run sync:beta-content -- --apply` 使用临时 SQLite：通过
- `npm.cmd run sync:competition-news -- --limit=1`：dry-run 通过并能正常退出
- `npm.cmd run sync:beta-content -- --apply` 使用临时 SQLite 幂等验证：
  - 第一次：85 条竞赛、33 条资源待审、8 条帖子待审
  - 第二次：不重复创建审核任务

### 生产验证

- `curl -I http://campusgrow.top/`：301
- `curl -I https://campusgrow.top/`：200
- `curl https://campusgrow.top/api/health`：正常
- `npm run sync:beta-content -- --apply`：生产通过，新增 59 条竞赛，更新 26 条竞赛，新增 20 条资源待审和 4 条帖子待审。
- `npm run approve:beta-content`：生产通过，通过真实后台 API 审核 8 条资源和 6 条帖子，并更新首页运营位。
- `npm run sync:competition-news -- --limit=1`：生产 dry-run 通过，仍为审核优先，不自动写库。
- 最终 release `20260706212540` 已修复同步脚本 dry-run 初始化数据库的问题，dry-run 不再出现 SQLite experimental warning。
- `scripts/smoke-admin-miniapp-closure.ts`：通过
  - 发帖待审、处理中不可见、通过后公开
  - 评论待审、通过后公开
  - 组队待审、通过后公开
  - 队伍申请、队长审批、申请人可见联系方式
  - 资源上传、审核、收藏、免费获取
  - 举报提交、后台处理、状态 resolved
  - 审核消息写入消息中心
- smoke 清理后：测试用户和测试审核任务均为 0

### 浏览器检查

移动端视口：390x844。

- `production-beta-home-after-content-20260706.png`
- `production-beta-competitions-after-content-20260706.png`
- `production-beta-resources-after-content-20260706.png`
- `production-beta-community-after-content-20260706.png`
- `production-beta-admin-login-after-content-20260706.png`
- `production-beta-console-clean-session-20260706.md`

结果：

- 首页加载正常，首屏有真实校园图、快捷入口、推荐竞赛和资源内容。
- 竞赛列表显示官方竞赛，截止信息为“以官网为准 / 查看官网”，没有伪造截止倒计时。
- 资源页不再为空，显示 8 条官方来源索引，按钮为“官方来源”。
- 社区页不再为空，显示经验贴和官方资讯索引。
- 后台未登录会进入登录页，干净浏览器会话控制台为 0 错误、0 警告。

## 内测前人工操作

1. 用微信开发者工具或手机真机走一遍：
   - 真实 `wx.login`
   - 浏览竞赛
   - 收藏竞赛/资源
   - 获取一个真实文件资源
   - 发帖
   - 组队申请
   - 举报
   - 后台审核
2. 管理员继续分批审核剩余资源索引和帖子索引，每批建议 5 到 8 条。
3. 若内容审核后首页需要更多展示，进入后台首页配置调整排序，不直接改数据库。
4. 若发现某个赛事官网链接失效，先回退到中国高等教育学会公开目录页，再人工补官网。

## 注意事项

- 这次没有启用自动定时抓取。建议先人工审核口径稳定后再启用 timer。
- 部分竞赛使用中国高等教育学会竞赛目录作为来源页，不强行填写不确定官网。
- 当前线上仍不开放支付，付费资源不应进入内测主路径。
