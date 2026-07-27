# 微信小程序壳冒烟记录 20260706

## 结论

本轮已完成生产环境的微信小程序壳相关自动化冒烟：线上 H5、API、web-view 登录桥失败回退、资源列表/详情、搜索、未登录保护、后台审核 API 都已验证。真实微信登录成功、登录后的收藏/领取/发帖/组队申请/举报创建，仍需要用手机进入小程序壳获取真实 `wx.login` code 后点测。

当前线上版本：`/opt/campus-growth/releases/20260706173920`

## 已自动化验证

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| HTTP 跳 HTTPS | 通过 | `http://campusgrow.top/` 返回 301 到 `https://campusgrow.top/` |
| HTTPS 首页 | 通过 | `https://campusgrow.top/` 返回 200 |
| API 健康检查 | 通过 | `postgres`、`s3`、`real`、`paymentsEnabled=false` |
| 小程序壳配置 | 通过 | `wechat-shell/app.js` 指向 `https://campusgrow.top`，壳通过 `wx.login` 传 `mp_login_code` |
| H5 登录桥失败回退 | 通过 | 无效 `mp_login_code` 会清理 URL 并回到首页，不白屏 |
| 浏览：首页/资源/社区/组队/个人 | 通过 | Playwright 移动视口打开正常，主要页面无新增 console warning |
| 免费资源列表 | 通过 | `/api/resources` 返回 2 条免费已审核资源 |
| 免费资源详情 | 通过 | `/api/resources/r1` 返回 200 |
| 免费资源未登录领取 | 通过 | 点击“免费领取”跳转 `/login?next=/resources/r1`，不生成订单 |
| 搜索 | 通过 | `/api/search?keyword=挑战杯&scope=all` 返回 3 条结果 |
| 收藏/领取/发帖/组队申请/举报未登录保护 | 通过 | 对应 API 未带 token 时均返回 401 |
| 后台审核读写 | 通过 | 创建临时 smoke 审核任务，管理员 API 审核为 `rejected` 后删除，残留任务数 0 |

## 本轮发现并修复

1. 资源列表和详情不可访问  
   原因：商业阶段公开判断用 `resource.category` 匹配 `模板/资料包/攻略`，但线上数据的 `category` 是“商业策划”等业务分类，资源类型在 `resource.type`。  
   修复：改用 `resource.type` 判断公开类型；列表筛选兼容 `category` 和 `type`。

2. 搜索接口在 PostgreSQL 下失败  
   原因：服务端仍有 SQLite 专用 `ORDER BY rowid DESC`。  
   修复：改为 `created_at DESC, id DESC`，并补齐 `teamSelect`、`postSelect` 的 `created_at` 字段。

3. 长列表页底部导航被内容推到底部  
   原因：移动端容器没有固定视口高度，`BottomNav` 的 absolute 定位相对整页内容。  
   修复：移动端壳容器改为 `100dvh` 高度，内部滚动。

4. 组队列表没有返回按钮  
   修复：`Teams` 页面启用 `PageHeader` 的 `back`，fallback 到首页。

5. 搜索帖子结果链接错误  
   原因：帖子搜索结果返回 `/community/:id`，但真实详情路由是 `/posts/:id`。  
   修复：帖子搜索结果链接改为 `/posts/:id`。

## 本轮改动文件

- `server/catalog-service.ts`
- `server/models.ts`
- `frontend/src/app/components/Layout.tsx`
- `frontend/src/app/pages/Teams.tsx`

## 截图证据

- `wechat-smoke-resources-after-fix-20260706.png`
- `wechat-smoke-teams-20260706.png`
- `wechat-smoke-profile-20260706.png`
- `wechat-smoke-resources-after-fix-20260706.md`

## 仍需手机真机点测

请在微信开发者工具或手机预览小程序壳中完成以下路径。这里必须用真实微信环境，因为线上 `WECHAT_LOGIN_MODE=real`，普通浏览器没有 `wx.login`。

1. 登录  
   打开小程序壳，确认进入 H5 后“我的”页显示真实用户信息，浏览器地址栏不残留 `mp_login_code`。

2. 收藏  
   进入竞赛详情或资源详情，点收藏，返回“我的/收藏”确认出现记录；再取消收藏确认状态同步。

3. 免费资源获取  
   进入 `创新创业商业计划书模板包`，点“免费领取”，确认进入“我的资源”并可生成下载授权。

4. 发帖  
   社区点“发帖”，发布一条带 `真机冒烟` 标识的测试帖，确认进入后台审核队列或前台可见状态符合审核策略。

5. 组队申请  
   进入任一非本人队伍详情，填写申请留言并提交，确认状态变为已申请。

6. 举报  
   进入帖子详情，点举报，提交原因，确认后台“举报”页出现记录。

7. 后台审核  
   管理员登录后台，处理上面的发帖/举报/资源/组队相关审核任务，确认状态变更后前台同步。

## 判定

自动化层面：通过，可以继续真机点测。  
真机完整闭环：待手机完成登录后复测。
