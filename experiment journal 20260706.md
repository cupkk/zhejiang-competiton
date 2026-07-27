# 浙江校园成长平台研究进展日志

## 总体研究进展

### 项目目标

当前主线继续以 `D:\github\zhejiang-competiton` 为准，目标是把校园成长平台打磨成可真实使用的微信小程序/H5 产品：界面要像校内工具而不是 AI 生成样稿，核心路径要有可靠返回、稳定列表、真实内容和可持续的数据补充机制。

### 当前研究方向

- 保留现有 H5 + Express API + 小程序 web-view 壳路线。
- 不直接接管 `D:\github\zhejiang\zhejiang-competiton` 的重构结果。
- 前端方向参考 CC98 这类校内社区工具：朴素、信息密度适中、入口清晰、少营销视觉。
- 数据方向先接官方公开资讯，抓取后进入“资讯”分类，不冒充为已核验报名条目。

### 当前关键结论

1. `D:\github\zhejiang\zhejiang-competiton` 的外层仓库没有有效提交，真正可比对路径是 `D:\github\zhejiang\zhejiang-competiton`。
2. 另一个项目的日志显示它曾尝试更重的原生小程序、课程、支付和管理后台扩展，并在服务器上线后回滚到当前旧 release。
3. 另一个项目当前工作区不适合直接并入：关键功能很多在 Git index 中，磁盘工作树缺失大量文件；生产小程序配置也曾指向本地 API。
4. 可借鉴内容是方向，不是代码整体合并：端到端冒烟脚本、后台扩展思路、课程/支付作为二期规划。
5. 当前第一阶段继续坚持：免费资源、竞赛资讯、社区、组队、微信真实登录；支付和课程商业化暂缓。

## 2026-07-06

### 本次操作

- 使用 `frontend-skill` 约束前端改造方向：减少营销感、减少大圆角强阴影、保留清晰信息层级。
- 对比 `D:\github\zhejiang-competiton` 与 `D:\github\zhejiang\zhejiang-competiton`：
  - 读取另一个项目的 2026-06-29 与 2026-07-06 研究日志。
  - 检查另一个项目 Git 状态、暂存区新增文件和部分关键文件内容。
  - 抽样查看 `server/school-course-service.ts`、`scripts/e2e-smoke.mjs`、原生小程序首页文件。
- 改造用户端核心视觉：
  - `PageHeader` 增加返回 fallback，直接打开详情页时不会只能依赖浏览器返回。
  - `Layout`、`BottomNav`、`ui.tsx` 降低大圆角、强阴影和装饰感。
  - 首页从大图 Banner 改为工具型结构：品牌、搜索、快捷入口、置顶、推荐竞赛、热门资源。
  - 竞赛、资源、社区筛选区改为朴素边框块。
  - 竞赛卡片、资源卡片、帖子卡片收敛为 8px 左右圆角和低装饰列表样式。
- 新增社区“资讯”分类：
  - 更新前端类型、领域常量和后端公开白名单。
- 新增官方资讯抓取脚本：
  - `scripts/sync-competition-news.ts`
  - 默认 dry-run，只有传 `--apply` 才写入数据库。
  - 当前来源为全国大学生创业服务网首页公开动态。
  - 抓取内容写入社区 `资讯` 分类，正文保留来源和原文链接，并提示以官方原文为准。
- 新增定时任务模板：
  - `deploy/systemd/campus-growth-news-sync.service`
  - `deploy/systemd/campus-growth-news-sync.timer`

### 涉及文件

- `frontend/src/app/components/PageHeader.tsx`
- `frontend/src/app/components/Layout.tsx`
- `frontend/src/app/components/BottomNav.tsx`
- `frontend/src/app/components/ui.tsx`
- `frontend/src/app/pages/Home.tsx`
- `frontend/src/app/pages/Competitions.tsx`
- `frontend/src/app/pages/Resources.tsx`
- `frontend/src/app/pages/Community.tsx`
- `frontend/src/app/components/CompetitionCard.tsx`
- `frontend/src/app/components/ResourceCard.tsx`
- `frontend/src/app/components/PostCard.tsx`
- `frontend/src/types/entities.ts`
- `frontend/src/app/lib/domain-options.ts`
- `server/community-service.ts`
- `scripts/sync-competition-news.ts`
- `deploy/systemd/campus-growth-news-sync.service`
- `deploy/systemd/campus-growth-news-sync.timer`

### 验证结果

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。
- `npm.cmd run sync:competition-news -- --limit=3`：dry-run 成功，抓到 3 条官方资讯。
- `npm.cmd run sync:competition-news -- --limit=5 --apply`：本地 SQLite 插入 4 条资讯。
- 本地 API 重启后，`/api/posts?category=资讯` 返回 4 条资讯。
- Playwright 390x844 截图已生成：
  - `output/playwright/home-390.png`
  - `output/playwright/resources-390.png`
  - `output/playwright/competitions-390.png`
  - `output/playwright/competition-detail-390.png`
  - `output/playwright/community-390-after.png`

### 当前判断

- 这轮前端已经从“营销型大卡片”明显转向“校园工具型信息流”，但详情页还有大标题、大圆角内容块，下一轮应继续收敛。
- 返回按钮问题已先从公共组件解决，详情页直接打开也有 fallback。
- 数据抓取不应直接生成竞赛报名条目；先进入资讯流更稳妥。
- 线上定时抓取暂不建议立即启用，需先确认来源白名单、运营审核口径和日志监控。

### 后续接手步骤

1. 继续细化详情页、发布页、个人页的大圆角和强装饰问题。
2. 给资讯抓取脚本增加更多官方来源，例如浙江大学校内竞赛通知、学院创新创业通知。
3. 把抓取内容先进入后台审核队列，而不是直接 `approved`，需要新增数据表或复用 moderation 机制。
4. 在服务器部署前，先确认 PostgreSQL 备份和脚本运行日志。
5. 如果启用定时任务，安装 `campus-growth-news-sync.service/timer` 后执行一次 `systemctl start campus-growth-news-sync.service` 冒烟。

### 本轮继续更新：详情页/个人页/发布页收敛与资讯审核队列

#### 本次操作

- 继续收敛用户端视觉，重点处理详情页、个人页、发布页和公共状态卡：
  - `CompetitionDetail`、`ResourceDetail`、`TeamDetail`、`PostDetail`：去掉大圆角强阴影卡片，改为 `rounded-xl + border` 的低装饰分组；详情页返回 fallback 分别指向竞赛、资源、队伍、社区列表。
  - `ResourceDetail`：修正移动端标题被文件类型和价格挤窄的问题，让资源类型/价格在顶部一行，标题独占一行。
  - `Profile`：移除渐变头图、光斑和大头像卡，改成更接近 iOS 设置页的头像信息块、统计分组和分组列表。
  - `ProfileEdit`、`AccountSettings`、`ProfileForm`、`ProfileCompletionGate`：同步收敛个人资料和账号设置路径的大圆角、强阴影和解释性文案。
  - `PublishPost`、`PublishTeam`、`PublishResource`：表单容器改为浅边框分组，分类/关联竞赛选择改为更克制的矩形按钮，返回 fallback 指向合适列表或个人页。
  - `StateCard`：公共 loading/error/auth/empty 状态卡改为低圆角、浅边框、短标签，避免发布页未登录态回到旧风格。
- 改造官方竞赛资讯抓取脚本：
  - `scripts/sync-competition-news.ts` 只保留国内官方来源 `https://cy.ncss.cn/`，并增加允许域名检查。
  - 标题过滤收紧到“中国国际大学生创新大赛 / 挑战杯 / 全国大学生 / 大学生创新创业”等官方白名单竞赛线索。
  - 新抓取内容不再直接公开，写入 `posts.moderation_status = pending`，并创建 `moderation_tasks` 审核任务。
  - dry-run 输出增加 `scope`，`--apply` 输出 `queued/pending/updated/rejected`，便于定时任务日志判断。
- 处理本地历史测试数据乱码：
  - 新增 `isLikelyCorruptText` 展示层判断。
  - 评论列表过滤全问号损坏内容。
  - 公开组队列表过滤明显损坏的组队记录，详情直链返回不可用，不删除数据库原记录。

#### 涉及文件

- `frontend/src/app/pages/CompetitionDetail.tsx`
- `frontend/src/app/pages/ResourceDetail.tsx`
- `frontend/src/app/pages/TeamDetail.tsx`
- `frontend/src/app/pages/PostDetail.tsx`
- `frontend/src/app/pages/Profile.tsx`
- `frontend/src/app/pages/ProfileEdit.tsx`
- `frontend/src/app/pages/AccountSettings.tsx`
- `frontend/src/app/pages/PublishPost.tsx`
- `frontend/src/app/pages/PublishTeam.tsx`
- `frontend/src/app/pages/PublishResource.tsx`
- `frontend/src/app/components/StateCard.tsx`
- `frontend/src/app/components/profile/ProfileForm.tsx`
- `frontend/src/app/components/profile/ProfileCompletionGate.tsx`
- `server/helpers.ts`
- `server/community-service.ts`
- `server/catalog-service.ts`
- `scripts/sync-competition-news.ts`

#### 验证结果

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。
- `npm.cmd run sync:competition-news -- --limit=5`：dry-run 成功，当前抓到 4 条国内官方竞赛资讯。
- 临时 SQLite 验证：
  - 使用 `DB_PATH=output/playwright/news-sync-queue.db` 执行 `npm.cmd run sync:competition-news -- --limit=2 --apply`。
  - 结果为 `queued: 2`。
  - 查询确认两条 `news_%` 帖子均为 `moderation_status=pending`，对应 `moderation_tasks.status=pending`、`action=post_publish_review`。
- API 冒烟：
  - `/api/posts/p1/comments` 返回空数组，损坏问号评论不再展示。
  - `/api/teams?limit=5` 不再返回本地历史损坏组队记录。
- Playwright 移动端 390x844 截图：
  - `output/playwright/profile-390-refined.png`
  - `output/playwright/competition-detail-390-refined.png`
  - `output/playwright/resource-detail-390-refined.png`
  - `output/playwright/team-detail-390-refined.png`
  - `output/playwright/post-detail-390-refined.png`
  - `output/playwright/publish-post-390-refined.png`
  - `output/playwright/publish-team-390-refined.png`
  - `output/playwright/publish-resource-390-refined.png`

#### 当前判断

- 详情页、个人页、发布页已经从“渐变大卡片/AI 样稿”进一步收敛到校内工具型界面；仍保留清晰的状态反馈和 44px 左右触控目标。
- 抓取链路现在符合“先审核后公开”的商业化底线，可以后续接入后台审核台和 systemd timer，但暂不建议直接启用生产定时任务。
- 当前抓取来源仍然只有一个国内官方站点，覆盖面不足；下一步应增加中国高等教育学会竞赛目录、教育部/省教育厅相关通知等来源，但每个来源都要先确认版权、robots、字段稳定性和运营审核口径。

#### 下一步建议

1. 后台审核台增加“资讯来源 / 原文链接 / 抓取时间”展示，方便运营判断是否通过。
2. 给抓取脚本增加来源配置文件和更细的 source id，避免继续把来源硬编码在脚本中。
3. 扩展官方白名单竞赛来源前，先列来源白名单，不抓商业培训站、公众号转载站和非官方聚合站。
4. 继续检查登录后发布表单的真实填写态截图，尤其是资源投稿的长竞赛标题和文件上传区域。

### 对 `D:\github\zhejiang\zhejiang-competiton` 的再次对比结论

#### 本次操作

- 重新确认 `D:\github\zhejiang` 的实际项目路径：外层目录只有 `.git` 和子目录，真正项目为 `D:\github\zhejiang\zhejiang-competiton`。
- 检查对方项目 Git 状态：
  - 外层 `D:\github\zhejiang` 只显示 `zhejiang-competiton/` 未跟踪。
  - 子项目分支为 `main`，HEAD 为 `f9883e0`，与主项目历史基线一致。
  - 子项目有大量暂存/工作区混合状态，很多关键文件是 `AD`，表示“暂存区有新增版本，但磁盘工作树里又被删除”，不能直接当作可合并工作树。
- 读取对方项目 2026-06-29 与 2026-07-06 日志，确认它曾尝试部署新版 release，之后线上回滚到旧稳定 release。
- 抽样读取对方暂存区关键文件：
  - `scripts/e2e-smoke.mjs`
  - `server/school-course-service.ts`
  - `frontend/src/app/pages/admin/AdminOrders.tsx`
  - `frontend/src/app/pages/admin/AdminPayments.tsx`
  - `frontend/src/app/routes.tsx`
  - `server/index.ts`
  - `wechat-shell/app.js`
  - `wechat-shell/app.json`

#### 主要差异

- 对方项目新增但当前主项目没有的方向：
  - 课程体系：`courses`、`owned_courses`、学校列表、课程获取、成长页课程资产。
  - 更完整的订单/支付后台：订单筛选、支付事件、支付配置检查、沙箱支付成功/退款成功、回调模拟。
  - 更重的原生微信小程序多页面壳：包含课程、成长、订单、消息、发布、详情等页面。
  - e2e 冒烟脚本：覆盖登录、发帖、评论、举报、组队、资源上传、资源领取、下载、课程购买、支付、退款等链路。
- 主项目已经吸收或已有的方向：
  - React + Vite H5 前端、管理后台基本框架、资源审核、举报审核、首页配置、PostgreSQL/S3、部署目录、微信 web-view 壳。
  - 主项目本轮又新增了官方竞赛资讯抓取审核队列和更收敛的用户端 UI。
- 对方项目的风险：
  - 工作树状态不可信，关键文件大量只存在 Git index 中。
  - `wechat-shell/app.js` 的 `API_BASE` 仍指向 `http://127.0.0.1:8080/api`，不能直接用于生产小程序。
  - 课程/支付方向超出当前第一阶段“免费引流 + 校园合作转化”范围。
  - 对方后台 UI 仍有大圆角、强阴影和说明书式文案，不适合作为当前前端审美来源。

#### 可借鉴项

1. 借鉴 `scripts/e2e-smoke.mjs` 的测试思路，但需要按主项目当前范围重写：去掉课程购买和真实支付，保留登录、浏览、收藏、免费资源领取、下载授权、组队申请、发帖、举报、后台审核。
2. 借鉴订单/支付后台的信息结构，作为第二阶段支付联调方案，不进入当前第一阶段。
3. 借鉴课程服务的数据模型方向，作为未来“校内合作课程/训练营”扩展储备；当前不合并。
4. 借鉴原生微信小程序壳的多页面组织方式，但当前仍以 `web-view` 壳为主，避免双端重复维护。

#### 当前决策

- 继续以 `D:\github\zhejiang-competiton` 为主项目，不从对方项目直接合并。
- 对方项目保留为参考和二期功能仓库，不作为当前上线主线。
- 下一步如要借鉴，优先只移植“主项目范围内的 e2e 冒烟测试”，不要先动课程、支付和原生多页面小程序。

### 本轮继续更新：用户端与管理员后台 UI 收敛并部署上线

#### 本次操作

- 继续按 CC98/校内工具方向收敛 UI：浅灰底、白色分组、细边框、低阴影、短文案、少装饰。
- 用户端继续删除说明书式文案和强装饰：
  - `Messages`：去掉深色渐变大横幅，改成未读数状态条和短操作按钮。
  - `Favorites`、`History`、`Support`、`Orders`、`MyResources`、`ResourceSubmissions`、`TeamApplications`：改成浅边框列表，删除冗长说明。
  - `Teams`、`TeamCard`：去掉组队建议说明块、大圆角和强阴影，保留搜索、列表、发布按钮。
  - `Login`：去掉渐变登录卡，改为普通登录状态块。
  - `Search`、`RefundResult`、`Ai`：收敛圆角、按钮和说明文案；AI 入口默认关闭，规划页保留为内测。
  - `StateCard` 支持无 description 的短状态卡，避免为了类型要求补空话。
- 管理员后台 UI 优化：
  - 新增/使用统一后台 UI 组件，后台布局变成白色窄侧边栏 + 顶部标题 + 内容分组。
  - 总览、审核、资源、举报、首页配置页统一短标题、短按钮和低装饰列表。
  - 后台展示层将 `resource_publish_review`、`pending`、`online` 等后端枚举转为中文标签。
  - 对历史损坏文本如 `????` 做展示层兜底，显示为“内容异常”，避免后台页面显得混乱。
  - 首页配置隐藏 AI 快捷入口并保存时强制关闭，避免运营端误发布。
- 部署到服务器：
  - 本地生成 release `20260706170607`。
  - 打包时排除 `.deploy`、node_modules、本地数据库、截图、日志和本地 env。
  - 上传到 `121.43.58.9` 并执行 `/tmp/deploy-commercial-release-20260706170607.sh 20260706170607`。
  - 线上 current 已切换到 `/opt/campus-growth/releases/20260706170607`。

#### 涉及文件

- `frontend/src/app/components/StateCard.tsx`
- `frontend/src/app/components/FloatingAI.tsx`
- `frontend/src/app/components/Layout.tsx`
- `frontend/src/app/components/TeamCard.tsx`
- `frontend/src/app/components/CompetitionCard.tsx`
- `frontend/src/app/components/SectionHeader.tsx`
- `frontend/src/app/components/admin/AdminUi.tsx`
- `frontend/src/app/components/admin/AdminLayout.tsx`
- `frontend/src/app/lib/format.ts`
- `frontend/src/app/lib/home-config.ts`
- `frontend/src/app/pages/Ai.tsx`
- `frontend/src/app/pages/Favorites.tsx`
- `frontend/src/app/pages/History.tsx`
- `frontend/src/app/pages/Login.tsx`
- `frontend/src/app/pages/Messages.tsx`
- `frontend/src/app/pages/MyActivity.tsx`
- `frontend/src/app/pages/MyResources.tsx`
- `frontend/src/app/pages/Orders.tsx`
- `frontend/src/app/pages/RefundResult.tsx`
- `frontend/src/app/pages/ResourceSubmissions.tsx`
- `frontend/src/app/pages/Search.tsx`
- `frontend/src/app/pages/Support.tsx`
- `frontend/src/app/pages/TeamApplications.tsx`
- `frontend/src/app/pages/Teams.tsx`
- `frontend/src/app/pages/RouteErrorBoundary.tsx`
- `frontend/src/app/pages/admin/AdminDashboard.tsx`
- `frontend/src/app/pages/admin/AdminHomeConfig.tsx`
- `frontend/src/app/pages/admin/AdminModeration.tsx`
- `frontend/src/app/pages/admin/AdminResources.tsx`
- `frontend/src/app/pages/admin/AdminReports.tsx`
- `frontend/src/app/pages/admin/AdminLogin.tsx`

#### 验证结果

- 本地验证：
  - `npm.cmd run typecheck:frontend`：通过。
  - `npm.cmd run lint`：通过。
  - `npm.cmd run build:frontend`：通过，生成 `index-B4H1g0cb.js` 和 `index-DYgRMFt8.css`。
  - `npm.cmd run sync:competition-news -- --limit=3`：dry-run 成功，仍只抓国内官方竞赛资讯。
  - 本地 `/api/health`：正常，`paymentsEnabled=false`。
- 本地 Playwright 截图：
  - `home-ui-20260706.png`
  - `resources-ui-20260706.png`
  - `teams-ui-20260706.png`
  - `messages-ui-20260706.png`
  - `search-ui-20260706.png`
  - `admin-dashboard-ui-20260706-after.png`
  - `admin-moderation-ui-20260706.png`
  - `admin-resources-ui-20260706.png`
  - `admin-home-ui-20260706.png`
- 线上验证：
  - `http://campusgrow.top/` 返回 301 并跳转到 `https://campusgrow.top/`。
  - `https://campusgrow.top/` 返回 200。
  - `https://campusgrow.top/api/health` 返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`，并指向 release `20260706170607`。
  - 线上 HTML 已引用 `index-B4H1g0cb.js` 和 `index-DYgRMFt8.css`。
  - 服务器 `campus-growth-api` 为 active。
  - 线上截图：
    - `production-home-ui-20260706.png`
    - `production-admin-login-ui-20260706.png`

#### 当前判断

- 用户端首页、资源、组队、消息、搜索等核心路径已经明显从“AI 样稿/营销式 H5”转向校内工具风格。
- 管理后台的总览和审核页已经能以中文业务语言展示，不再直接暴露后端枚举和损坏问号文本。
- 线上 HTTPS、API health、前端新构建产物均已验证，当前可继续做小程序真机冒烟。
- 这次没有启用生产定时抓取任务；抓取脚本仍建议先手动或低频运行，确保审核口径稳定后再上 timer。

#### 后续接手步骤

1. 用真机微信小程序壳访问 `https://campusgrow.top`，完成登录、浏览、收藏、免费资源获取、发帖、组队申请、举报和后台审核冒烟。
2. 后台审核详情继续增强：给资讯审核任务展示来源、原文链接、抓取时间，避免运营只看到帖子标题。
3. 建议新增一个主项目范围内的 e2e 冒烟脚本，不包含支付和课程，覆盖第一阶段真实路径。
4. 如果继续优化 UI，优先处理表单填写态和长文本极端情况，而不是再改整体风格。

### 本轮继续更新：微信小程序壳冒烟、生产问题修复和再部署

#### 本次操作

- 按 QA 冒烟方式检查微信小程序壳相关链路：
  - `wechat-shell/app.js` 指向 `https://campusgrow.top`。
  - `wechat-shell/pages/webview/index.js` 使用 `wx.login` 获取 code，并把 `mp_login_code`、`mp_entry`、`mp_login_ts` 传给 H5。
  - `frontend/src/app/components/WechatMiniProgramLoginBridge.tsx` 会读取 `mp_login_code` 调 `/api/auth/wechat/login`，失败后清理 URL 参数。
- 用 Playwright 移动视口检查生产 H5：首页、资源、资源详情、社区、帖子详情、组队、队伍详情、我的页。
- 用生产 API 检查公开浏览、认证保护、搜索、资源详情和后台审核。
- 创建 smoke 记录文档：
  - `wechat real device smoke 20260706.md`
- 保存截图证据：
  - `wechat-smoke-resources-after-fix-20260706.png`
  - `wechat-smoke-teams-20260706.png`
  - `wechat-smoke-profile-20260706.png`
  - `wechat-smoke-resources-after-fix-20260706.md`

#### 发现的问题与修复

1. 资源列表和详情不可访问：
   - 现象：生产首页有 `hotResources`，但 `/api/resources` 返回空数组，`/api/resources/r1` 返回 403。
   - 原因：`server/catalog-service.ts` 的商业阶段资源公开判断用 `row.category` 匹配 `模板/资料包/攻略`，而线上数据的 `category` 是“商业策划/软件与服务设计”，资源类型在 `row.type`。
   - 修复：改成按 `row.type` 判断公开类型，并让资源列表筛选兼容 `category` 或 `type`。

2. 搜索接口 PostgreSQL 失败：
   - 现象：`/api/search?keyword=挑战杯&scope=all` 返回 `column "rowid" does not exist`。
   - 原因：服务端仍保留 SQLite 专用 `ORDER BY rowid DESC`。
   - 修复：改为 `created_at DESC, id DESC`，并在 `teamSelect`、`postSelect` 和 `server/models.ts` 中补齐 `created_at` 字段。

3. 长列表页底部导航不固定：
   - 现象：社区长列表中底部导航被内容推到页面末尾。
   - 修复：`frontend/src/app/components/Layout.tsx` 将移动端壳容器固定为 `100dvh`，内容区内部滚动。

4. 组队列表没有返回按钮：
   - 现象：从首页“找队友”进入 `/teams` 后只能依赖浏览器返回。
   - 修复：`frontend/src/app/pages/Teams.tsx` 启用 `PageHeader` 的 `back`，fallback 到首页。

5. 搜索帖子结果链接错误：
   - 现象：搜索“挑战杯”返回的帖子链接是 `/community/p1`，但真实帖子详情路由是 `/posts/p1`。
   - 修复：帖子搜索结果链接改为 `/posts/:id`。

#### 部署记录

- 本轮共部署 5 个小修 release，最终线上版本为：
  - `/opt/campus-growth/releases/20260706173920`
- 中间版本：
  - `20260706172008`：修复资源公开判断。
  - `20260706172422`：修复 PostgreSQL `rowid` 搜索问题。
  - `20260706172922`：修复底部导航固定问题。
  - `20260706173155`：修复组队页返回按钮。
  - `20260706173920`：修复搜索帖子结果链接。

#### 验证结果

- 本地验证：
  - `npm run typecheck:frontend`：通过。
  - `npm run build:frontend`：通过，最终生成 `index-CFmL223Y.js` 和 `index-DFhrSp5o.css`。
  - `npm run lint`：通过。
- 线上验证：
  - `https://campusgrow.top/api/health`：`postgres`、`s3`、`real`、`paymentsEnabled=false`。
  - `/api/resources`：返回 2 条免费已审核资源。
  - `/api/resources/r1`：返回 200。
  - `/api/search?keyword=挑战杯&scope=all`：返回 3 条结果，链接为 `/competitions/c2`、`/posts/p1`、`/teams/t1`。
  - `/api/teams`：返回 3 条。
  - `/api/posts`：返回 3 条。
  - 未登录收藏、免费资源领取、发帖、组队申请、举报均返回 401。
  - 后台审核 smoke：临时插入 `mod_smoke_*` 审核任务，通过管理员 API 审核为 `rejected`，随后删除；残留 smoke 任务数为 0。
- 移动端 Playwright：
  - 资源页已显示免费资源卡片。
  - 社区页底部导航固定在视口底部。
  - 组队页显示 44px 返回按钮。
  - 资源详情、帖子详情、队伍详情均有返回按钮。
  - 普通浏览器点击登录/发帖会提示“请在微信小程序内登录。”，符合真实微信登录策略。

#### 当前判断

- 自动化可验证部分已经通过，可以进入真实手机小程序壳点测。
- 真实登录成功、登录后的收藏、免费领取、发帖、组队申请、举报创建和后台审核闭环仍必须用手机完成，因为线上 `WECHAT_LOGIN_MODE=real`，普通浏览器无法生成真实 `wx.login` code。

#### 后续接手步骤

1. 使用微信开发者工具或手机预览小程序壳，打开线上 H5，确认真实登录成功。
2. 按 `wechat real device smoke 20260706.md` 的“仍需手机真机点测”清单完成 7 条闭环。
3. 若真机登录失败，优先查微信后台合法域名、web-view 业务域名和 `/api/auth/wechat/login` 的 code2Session 返回。
4. 真机通过后再提交小程序审核；不要在未完成真实登录闭环前提交正式审核。

### 本轮继续更新：管理后台与小程序真实闭环、清 demo 数据和生产 smoke

#### 本次目标

- 回应“管理后台是不是和小程序没有完全联通、不要虚拟数据、都要真实、后台和小程序闭环并测试验证”。
- 重点不是继续做视觉改版，而是把用户端提交、后台审核、用户端可见性和消息反馈串成真实数据库闭环。

#### 代码修复

- `server/catalog-service.ts`
  - 修复组队发布绕过审核的问题：新队伍从 `approved` 改为 `pending`。
  - 组队发布后给发起人写入审核消息。
  - `mapTeam` 增加 `moderationStatus`，让前端可展示队伍审核状态。
- `server/community-service.ts`
  - `processing` 不再把帖子、评论、组队、资源误改为公开。
  - `approved/rejected` 才回写内容状态。
  - 帖子、评论、组队审核结果会给作者写消息通知。
- `server/helpers.ts`、`server/models.ts`
  - `/moderation/tasks` 增加真实目标摘要：`targetTitle`、`targetSummary`、`targetOwner`、`targetStatus`。
- `frontend/src/app/pages/admin/AdminModeration.tsx`、`frontend/src/app/pages/admin/AdminResources.tsx`
  - 审核台不再只展示 target id，而是展示真实标题、摘要、提交人和内容状态。
- `frontend/src/types/entities.ts`、`frontend/src/app/pages/TeamDetail.tsx`、`frontend/src/app/pages/MyActivity.tsx`、`frontend/src/app/components/TeamCard.tsx`、`frontend/src/app/pages/PublishTeam.tsx`
  - 队伍审核状态在详情页、我的动态和列表卡片中可见。
  - 发布按钮文案改为“提交审核”，提交后提示通过后才公开。
- `scripts/clear-demo-data.ts`
  - 补充清理 `r4`、`t3` 和已知乱码资源 ID。
  - 增加孤儿审核任务清理。
- `scripts/smoke-admin-miniapp-closure.ts`
  - 新增生产闭环 smoke：临时创建测试用户和 session，走真实线上 API 验证闭环，最后清理所有测试数据。

#### 本地验证

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- 最终前端产物：`index-BVgrctlE.js`、`index-DFhrSp5o.css`。

#### 部署记录

- 中间 release：`20260706201550`。
- 最终 release：`20260706201808`。
- 线上 health：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

#### 生产数据清理

清理前：

```text
users|1|1
competitions|3
resources|7
teams|3
posts|3
moderation_pending|8
seed_ids|3|7|3|3
```

清理后：

```text
users|0|0
competitions|0
resources|0
teams|0
posts|0
moderation_pending|0
seed_ids|0|0|0|0
```

发现并清理了 8 条待处理孤儿审核任务，目标内容均已不存在。补丁已写入 `scripts/clear-demo-data.ts`，后续重复执行可幂等清理。

#### 生产闭环 smoke 结果

- 脚本：`scripts/smoke-admin-miniapp-closure.ts`
- API：`https://campusgrow.top/api`
- 结果：通过。
- 覆盖链路：
  - 帖子提交后待审，公开端不可见；后台处理中仍不可见；后台通过后公开可见。
  - 评论提交后待审，公开评论列表不可见；后台通过后可见。
  - 组队发布后待审，组队大厅不可见；后台通过后可见。
  - 组队申请由队长审批，通过后申请人详情页可查看联系方式。
  - 资源上传和投稿后待审，资源列表不可见；后台通过后可见；收藏和免费领取进入我的资源。
  - 举报提交后进入后台，后台处理为成立后 report 状态为 resolved。
  - 审核消息写入用户消息中心。
- smoke 清理后：

```text
smoke_users|0
smoke_posts|0
smoke_resources|0
smoke_teams|0
smoke_reports|0
smoke_tasks|0
totals|0|0|0|0|0|0|0
```

#### 真实官方内容入队

- 执行 `scripts/sync-competition-news.ts --apply --limit=4`。
- 来源：全国大学生创业服务网 `https://cy.ncss.cn/`。
- 写入 4 条中国国际大学生创新大赛相关资讯，全部为 `pending`。
- 公开端 `/api/posts` 返回 0，说明待审资讯没有直接公开。
- 后台 `/api/moderation/tasks?targetType=post` 返回 4 条，且包含真实标题和摘要。

#### 新增报告

- `admin miniapp real closure smoke 20260706.md`

#### 当前判断

- 管理后台和用户端核心闭环已经打通，且已经用生产 API 和真实 PostgreSQL 验证。
- 线上不再保留历史 mock/seed 公开内容。
- 真实内容入口现在是“抓取官方资讯进入后台审核队列”，不是直接公开。
- 当前公开端会比较空，这是刻意结果：没有管理员审核通过前，不展示虚拟内容。

#### 后续接手步骤

1. 管理员进入线上审核台，人工审核 4 条官方资讯。通过后再检查小程序社区公开列表。
2. 用微信开发者工具或手机预览完成真实 `wx.login` 点测。本轮 smoke 没有使用 `demo-code`，但也无法在命令行生成微信真实 code。
3. 如果希望首页不空，应优先建设“真实竞赛导入/审核”后台能力，而不是恢复 seed 数据。
4. 定时抓取建议继续保持“先入审核队列”，不要自动公开。

### 本轮继续更新：内测前内容补全、上线 QA 与体验收口启动

#### 本次目标

- 面向即将内测，重点处理三件事：
  1. 平台不能空，补充真实竞赛、官方资讯、资源索引和经验索引。
  2. 管理后台和小程序核心功能继续做上线前 QA。
  3. 优化用户反馈、弹窗、空状态和交互文案，减少“样板/AI 感”。

#### 关键边界

- 不恢复历史 seed/mock 数据。
- 竞赛条目以官方白名单/官网为依据，可以作为平台基础内容公开。
- 经验贴和资源不能整篇搬运他站内容；先做“来源索引 + 短摘要 + 原文链接 + 后台审核”，避免版权和审核风险。
- 定时抓取仍坚持先进入后台审核队列，不自动公开。

#### 当前执行计划

1. 梳理现有内容模型，确认竞赛、帖子、资源的入库方式和公开条件。
2. 扩展抓取脚本，覆盖更多国内官方竞赛官网和白名单相关来源。
3. 补充资源/经验索引内容，后台可审核，前端可展示来源。
4. 做本地构建和生产闭环 QA。
5. 部署后更新报告，给内测前人工验收清单。

### 本轮继续更新：内测前内容补全、交互反馈优化和最终部署

#### 本次目标

- 面向即将内测，解决“平台内容太少、用户进入后空、反馈弹窗粗糙、后台审核不便判断来源”的问题。
- 保持真实数据底线：不恢复 mock/seed，不伪造用户，不搬运第三方全文。
- 竞赛作为官方基础目录公开；资源/经验索引先进入后台审核。

#### 代码改动

- 新增内容补全脚本：
  - `scripts/sync-beta-content.ts`
  - `package.json` 新增 `sync:beta-content`
  - 一次性整理 26 条国家级白名单/官方竞赛基础条目。
  - 生成 13 条官方资源入口索引和 4 条经验/入口索引帖子，默认 `pending` 并创建审核任务。
  - 修复脚本在 PostgreSQL worker 下不退出的问题，避免未来 systemd timer 卡住。
- 扩展资源模型：
  - `server/db.ts`：`resources.source_url`
  - `server/models.ts`、`server/catalog-service.ts`、前端类型：透传 `sourceUrl`
  - `server/payment-service.ts`：无真实文件时不再返回联调用占位文件，改为明确错误。
  - `server/index.ts`：补充 `resource_file_missing`、`external_resource_not_downloadable` 等错误映射。
- 管理后台审核增强：
  - `server/helpers.ts`：审核任务增加 `targetSourceUrl`
  - `frontend/src/app/pages/admin/AdminModeration.tsx`：展示来源链接
  - `frontend/src/app/pages/admin/AdminResources.tsx`：资源审核卡片增加“来源”按钮
  - `frontend/src/app/pages/admin/AdminLogin.tsx`：登录区域改成 form，补齐 `name` 与 `autocomplete`
- 用户端交互反馈：
  - 新增 `frontend/src/app/components/Toast.tsx`
  - `ResourceDetail`：官方来源索引显示“查看来源”，不再领取/下载；收藏、领取、下载改 toast。
  - `ResourceCard`：官方来源索引显示“官方来源 / 来源索引”。
  - `CompetitionDetail`、`CompetitionCard`：对“以官网通知为准”的竞赛不显示虚假倒计时；行动建议里的“官网：”渲染成可点击链接。
  - `PostDetail`：举报从 `window.prompt` 改为页面内输入框；点赞、收藏、评论、举报改 toast。
  - `PublishPost`、`PublishTeam`、`PublishResource`：增加基础必填校验和 toast。
  - `Messages`、`MyResources`、`ProfileEdit`、`TeamApplications`、`TeamDetail`：移除系统弹窗，改为页面内反馈。
- 后端最小输入校验：
  - `createPost`：空标题/正文拒绝。
  - `createTeamRecruit`：空标题、竞赛、目标、联系方式、缺口角色拒绝。
  - `createResourceSubmission`：空标题、类型、分类、描述拒绝。

#### 本地验证

- `npm.cmd run sync:beta-content -- --apply` 使用临时 SQLite：通过。
  - 26 条竞赛插入。
  - 13 条资源索引待审。
  - 4 条帖子索引待审。
  - 17 条审核任务创建。
- `npm.cmd run sync:competition-news -- --limit=1`：dry-run 通过，脚本能正常退出。
- `npm.cmd run lint`：通过。
- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run build:frontend`：通过，最终前端产物包含 `index-CVvlqbhX.js`。

#### 部署记录

- 中间 release：
  - `20260706205059`：首次内容补全、source_url、toast 等改动上线。
  - `20260706205521`：修复同步脚本在 Postgres worker 下不退出。
- 最终 release：
  - `/opt/campus-growth/releases/20260706210132`
- 线上 health：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

#### 生产内容状态

```text
competitions|26
resources_pending|13
posts_pending|4
tasks_pending|17
mock_users|0
smoke_users|0
smoke_tasks|0
```

- 公开竞赛接口已返回官方竞赛条目，例如中国国际大学生创新大赛、挑战杯、数学建模等。
- 资源公开列表当前为 0 是预期结果：13 条资源索引仍在后台待审。
- 资讯公开接口当前返回 4 条。

#### 生产验证结果

- `http://campusgrow.top/`：301 到 HTTPS。
- `https://campusgrow.top/`：200。
- `https://campusgrow.top/api/health`：正常。
- `scripts/smoke-admin-miniapp-closure.ts`：生产通过。
  - 覆盖发帖、评论、组队、队伍申请、资源上传/审核/免费获取、举报、后台审核、消息通知。
  - smoke 清理后无测试用户和测试审核任务残留。
- Playwright MCP 移动端 390x844 检查：
  - `production-beta-home-20260706.png`
  - `production-beta-competitions-20260706.png`
  - `production-beta-resources-20260706.png`
  - `production-beta-admin-login-final-20260706.png`
  - 首页、竞赛列表、资源空状态、后台登录页均能加载。

#### 新增报告

- `internal beta readiness 20260706.md`

#### 当前判断

- 内测可进入下一步人工验收。
- 平台已经不再是空竞赛库：26 条官方竞赛公开可浏览。
- 资源页仍空，但这是审核策略造成的正确状态；管理员通过资源索引后，资源页会显示“官方来源”卡片。
- 自动定时抓取仍不建议马上启用，应先让管理员审核几批内容，稳定口径后再接 timer。

#### 下一步建议

1. 管理员进入后台审核台，通过 5 到 8 条来源可靠的资源索引和 2 到 3 条经验索引，让资源/社区更有内容。
2. 微信开发者工具或手机真机继续走真实 `wx.login`，验证登录后收藏、获取资源、发帖、组队申请和举报。
3. 审核通过资源后，重新截资源页和首页，确认公开内容展示正常。
4. 再扩展第二批白名单赛事官网时，优先用官方赛事网站；不确定官网时使用中国高等教育学会竞赛目录页作为来源，不硬填。

### 本轮继续更新：内测前内容扩容和首页发布脚本

#### 背景

- 用户反馈：即将内测，平台不能显得空；竞赛、资源、经验帖需要补足，且后台和小程序必须共用真实数据闭环。
- 继续坚持真实数据底线：竞赛可作为官方目录基础内容公开；资源和经验帖先入后台审核队列；不恢复 mock/seed，不搬运第三方全文。

#### 信息来源

- 复核到公开榜单页说明《2023 全国普通高校大学生竞赛分析报告》列入 84 项赛事，并附参赛网站链接。
- 原页面后半部分还混有观察目录条目，本轮不把观察目录混入主竞赛库，避免内测口径混乱。
- 少数赛事只有主办单位或官网不明确，本轮统一指向中国高等教育学会公开竞赛目录页，不硬填不确定官网。

#### 代码改动

- `scripts/sync-beta-content.ts`
  - 原 26 条详细竞赛保留。
  - 新增 `catalogCompetition` 统一索引模板。
  - 新增白名单/主榜单赛事，总量扩展到 85 条。
  - 资源入口索引从前 12 个赛事扩到前 32 个赛事，加上目录入口共 33 条。
  - 经验/索引帖从 4 条扩到 8 条，新增材料检查、报名时间核对、工程实践、设计语言类选赛入口。
- `scripts/approve-beta-content.ts`
  - 新增内测发布脚本。
  - 通过后台 API 登录，不读取或写入任何明文密钥到仓库。
  - 审批精选资源和帖子审核任务，后台会产生 `admin_audit_logs`。
  - 审批后更新 `home_feed_configs`，将精选竞赛、资源、帖子写入首页运营位。
  - 首页轮播文案改为更短的内测口径：`查竞赛，找资料，约队友。`
- `package.json`
  - 新增 `approve:beta-content`。

#### 本地验证

- `npm.cmd run sync:beta-content` dry-run 通过，checksum 为 `7f2513f2df`。
- `npm.cmd run lint` 通过。
- `npm.cmd run typecheck:frontend` 通过。
- `npm.cmd run build:frontend` 通过，前端产物为 `index-CVvlqbhX.js`。
- 临时 SQLite 验证：
  - 第一次 `sync:beta-content -- --apply`：插入 85 条竞赛，创建 33 条资源待审、8 条帖子待审。
  - 第二次重复执行：只更新 85 条竞赛，资源保持 33 条 pending，帖子保持 8 条 pending，没有重复创建审核任务。

#### 下一步

1. 打包并部署新 release 到服务器。
2. 在服务器上执行 `sync:beta-content -- --apply`，把生产竞赛扩展到 85 条，并补齐待审队列。
3. 执行 `approve:beta-content`，用真实后台接口批准一批精选内容并配置首页。
4. 重新跑生产健康检查、闭环 smoke、公开接口数量检查和移动端截图。

### 本轮继续更新：上线前 UI 审查、可访问性修复、生产部署和小程序壳检查

#### 本次目标

- 按用户要求使用 `web-design-guidelines`、`gstack-design-review`、`playwright` 和微信小程序相关 skill 做上线前检查。
- 重点检查桌面/移动端响应式、文字溢出、按钮状态、可访问性、视觉层级、加载态、空状态、错误状态。
- 发现问题后直接修复，并部署到服务器，确保线上链接可以直接打开。

#### Skill 使用结论

- 已读取并执行 `web-design-guidelines` 的检查方向，重点落在表单标签、字段 `name`、触控尺寸、焦点态、开发态文案、溢出和控制台错误。
- 已按 `gstack-design-review` 的 App UI 标准检查，继续保持校内工具风格，不再增加营销式大卡片和说明书文案。
- 已使用 Playwright/Chrome 做移动端 390、414 和桌面 1440 视口矩阵截图。
- 已读取 `wxa-skills-generate`、`wxa-skills-validate`、`wxa-skills-eval`。结论：这 3 个微信 skill 是 `wx.modelContext` 小程序 AI Skill 分包生成/校验/评测链路；当前项目是普通 `web-view` 小程序壳，没有 `agent.skills`，因此不应生成 AI Skill 分包。当前上线检查应聚焦 `wechat-shell` 的 AppID、`wx.login`、`web-view` 域名、微信后台合法域名和真机预览。

#### 代码修复

- `frontend/src/app/components/admin/AdminUi.tsx`
  - `AdminButton` 新增可选 `type` 参数，支持表单提交按钮使用 `type="submit"`。
- `frontend/src/app/pages/admin/AdminLogin.tsx`
  - 管理员账号和密码输入框补齐 `id`、`htmlFor`、`aria-label`。
  - 登录按钮改为表单提交语义，不再依赖额外 `onClick`。
- `frontend/src/app/pages/admin/AdminHomeConfig.tsx`
  - 轮播图片上传的隐藏 file input 补齐 `name` 和 `aria-label`。
- `server/wechat.ts`
  - 删除早期 `demo-code` mock 登录特判。
  - mock 模式仍可用普通 code 生成稳定 mock openId；real 模式不再保留任何 `demo-code` 特例。

#### 本地验证

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run build:frontend`：通过。
- `npm.cmd run lint`：通过。
- 开发态关键词检查：`demo-code / 演示链路 / 备案通过后 / 暂未开放购买 / Lorem ipsum` 在 `frontend`、`wechat-shell`、`server` 中均未命中。
- 本地 Playwright 指向生产 API 的用户端矩阵：
  - 8 个页面 x 3 个视口，共 24 个组合。
  - 横向溢出、小触控目标、缺字段名、缺标签、三点省略号、开发态文案、控制台错误均为 0。
  - 产物目录：`output/playwright/ui-audit-20260706-mcp-after/`。
- 本地 Playwright 管理后台内页矩阵：
  - 5 个后台页面 x 3 个视口，共 15 个组合。
  - 横向溢出、小触控目标、缺字段名、缺标签、开发态文案、控制台错误均为 0。
  - 产物目录：`output/playwright/ui-audit-20260706-admin-after2/`。

#### 部署记录

- 中间 release：`20260706224930`。
- 最终 release：`20260706225849`。
- 当前线上软链：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260706225849`
- 线上 health：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上前端 HTML 已加载当前构建：
  - `index-CFOH5Tfp.js`
  - `index-RTCbqwP2.css`

#### 线上验证

- `http://campusgrow.top/`：301 到 `https://campusgrow.top/`。
- `https://campusgrow.top/`：200。
- `https://campusgrow.top/api/health`：返回 release `20260706225849`，且微信真实登录、支付关闭状态正确。
- `https://campusgrow.top/djVGWes8Fi.txt`：200，内容为 `8abc4f6f5a866b01273a8582b21ff220`。
- 线上公开内容：
  - 竞赛：85 条。
  - 资源：8 条。
  - 社区内容：10 条。
- 生产 Playwright 用户端矩阵：
  - 8 个页面 x 3 个视口，共 24 个组合，失败 0。
  - 产物目录：`output/playwright/ui-audit-20260706-production/`。
- 生产 Playwright 管理后台矩阵：
  - 5 个后台页面 x 3 个视口，共 15 个组合，失败 0。
  - 产物目录：`output/playwright/ui-audit-20260706-production-admin/`。
- 生产闭环 smoke：
  - `scripts/smoke-admin-miniapp-closure.ts` 通过。
  - 覆盖发帖、评论、组队、组队申请、资源上传/审核/收藏/免费领取、举报、后台处理、审核通知。
  - 清理后 `smoke_users=0`、`smoke_tasks=0`。

#### 小程序壳检查

- `wechat-shell/project.config.json`：
  - AppID 为 `wxda8641cd650537a4`。
- `wechat-shell/app.js`：
  - `webOrigin` 为 `https://campusgrow.top`。
- `wechat-shell/pages/webview/index.js`：
  - 使用 `wx.login` 获取 code。
  - 注入 `mp_login_code`、`mp_entry`、`mp_login_ts` 到 H5 URL。
- 仓库检查：
  - 未发现用户提供的微信 AppSecret 出现在仓库代码中。
  - 小程序域名校验文件已经在线可访问。
- 本机未找到微信开发者工具 CLI：
  - `wechatidecli` 不在 PATH。
  - 常见 Windows 安装路径下未找到 `cli.bat`。
  - 递归搜索未命中，已停止。

#### 当前判断

- 当前线上 H5、API、管理后台闭环已经满足内测前自动化验收。
- 小程序壳源码和线上域名条件已经准备好，但命令行无法替代微信开发者工具/真机授权。
- 进入微信内测前仍必须人工完成一次真机预览：真实 `wx.login`、登录后浏览、收藏、免费资源获取、发帖、组队申请、举报和后台审核。

#### 后续接手步骤

1. 在微信开发者工具中导入 `D:\github\zhejiang-competiton\wechat-shell`。
2. 确认微信后台 request 合法域名和 web-view 业务域名均为 `https://campusgrow.top`。
3. 用真机预览完成真实微信登录和核心链路冒烟。
4. 预览通过后上传体验版，邀请内测用户。

### 本轮继续更新：生产部署、精选审核和内测验收

#### 部署

- 新 release 包：`.deploy/campus-growth-20260706211418.tar.gz`
- 最终小修 release 包：`.deploy/campus-growth-20260706212540.tar.gz`
- 打包时排除了：
  - `.deploy`
  - `.git`
  - `node_modules`
  - 本地 SQLite 数据库
  - 截图和临时日志
- 已上传到服务器 `/tmp/campus-growth-20260706211418.tar.gz`。
- 已执行服务器发布脚本并切换：
  - 中间版本：`/opt/campus-growth/releases/20260706211418`
  - 最终版本：`/opt/campus-growth/releases/20260706212540`
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260706212540`

#### 生产内容同步

- 线上 health：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上执行 `npm run sync:beta-content -- --apply`：

```json
{
  "competitionsInserted": 59,
  "competitionsUpdated": 26,
  "resourcesQueued": 20,
  "resourcesPending": 13,
  "postsQueued": 4,
  "postsPending": 4,
  "checksum": "7f2513f2df"
}
```

- 线上执行 `npm run approve:beta-content`：
  - 通过 8 条官方资源索引。
  - 通过 6 条经验/入口索引帖。
  - 更新首页运营位为上线状态。
  - 后台产生 16 条 `campus-growth-beta-approval/20260706` 审计日志。

#### 当前生产数据

```text
competitions|85
resources_approved|8
resources_pending|25
posts_approved|10
posts_pending|2
tasks_approved|18
tasks_pending|27
smoke_users|0
smoke_tasks|0
```

#### 生产闭环验证

- `scripts/smoke-admin-miniapp-closure.ts` 生产通过：
  - 发帖待审、处理中不可见、通过后公开
  - 评论待审、通过后公开
  - 组队待审、通过后公开
  - 队伍申请、队长审批、申请人可见联系方式
  - 资源上传、审核、收藏、免费获取
  - 举报提交、后台处理、状态 resolved
  - 审核消息写入消息中心
- smoke 清理确认：
  - `smoke_users=0`
  - `smoke_tasks=0`
- `npm run sync:competition-news -- --limit=1` 生产 dry-run 通过，仍只预览不写库。
- 修复 `sync-beta-content` 和 `sync-competition-news`：dry-run 不再初始化数据库，服务器 dry-run 不再出现 SQLite experimental warning。
- 最终 release `20260706212540` 部署后再次执行 `scripts/smoke-admin-miniapp-closure.ts`，结果仍通过。

#### 生产浏览器检查

移动端 390x844 已截图：

- `production-beta-home-after-content-20260706.png`
- `production-beta-competitions-after-content-20260706.png`
- `production-beta-resources-after-content-20260706.png`
- `production-beta-community-after-content-20260706.png`
- `production-beta-admin-login-after-content-20260706.png`

结果：

- 首页不再空，首屏有校园视觉图、快捷入口、推荐竞赛、资源。
- 竞赛页显示官方竞赛，未出现伪造倒计时。
- 资源页显示 8 条官方来源索引，按钮为“官方来源”。
- 社区页显示经验贴和官方资讯索引。
- 管理员登录页简洁，无明显布局溢出。
- 干净 Playwright 会话控制台：0 errors、0 warnings。

#### 仍需人工完成

1. 微信开发者工具或真机小程序壳必须再做一次真实 `wx.login` 冒烟；本轮无法替代真机授权。
2. 管理员后续继续分批审核 25 条资源和 2 条帖子，不建议一次性全量公开。
3. 若发现新增赛事中官网入口失效，先回退到中国高等教育学会公开目录页，再人工补官网。

### 本轮继续更新：上线前 UI 审查、响应式修复和小程序 Skill 适用性确认

#### 本次目标

- 按用户要求使用 `web-design-guidelines`、`gstack-design-review`、`playwright` 和微信小程序相关 skill 做上线前审查。
- 重点检查桌面/移动端响应式、文字溢出、按钮状态、可访问性、视觉层级、加载/空/错误状态，以及网站链接是否可直接点击。
- 继续以生产环境 `https://campusgrow.top` 的真实数据为审查对象，不恢复 mock/seed 数据。

#### Skill 结论

- 已读取并使用 `web-design-guidelines`、`gstack-design-review`、`playwright`。
- 已读取 `wxa-skills-generate`、`wxa-skills-validate`、`wxa-skills-eval`。
- 结论：这三个微信 skill 是 `wx.modelContext` 小程序 AI Skill 产物的生成/校验/评测链路，当前 `wechat-shell` 是标准 `web-view` 小程序壳，`app.json` 没有 `agent.skills`，所以不应强行生成 AI Skill 分包。
- 当前小程序上线应继续检查普通小程序壳：`project.config.json` 的 AppID、`web-view` 指向 `https://campusgrow.top`、`wx.login` code 注入、微信后台 request/web-view 合法域名、开发者工具编译和真机登录。

#### Playwright 初检发现

- 390px 用户端：
  - 竞赛、资源、社区筛选按钮高度为 36px，低于移动端 44px 触控目标。
  - 搜索输入框内部真实输入区域高度偏小，虽然外层容器足够高，仍应让 input 本身接近触控目标。
  - 资源卡标题单行截断过早，官方入口类资源不易辨识。
  - 竞赛详情的官方白名单条目底部主按钮显示“立即报名”，容易误导为平台可直接报名。
  - 帖子详情中“原文”链接以裸文本显示，不可点击。
  - 组队空态文案“暂无内容 / 暂无匹配队伍”偏生硬。
  - 资源详情的官方索引仍显示 `0.0 评分 / 官网 大小`，像模板占位。
- 后台：
  - 桌面总览和审核台无英文枚举泄露，无明显横向溢出。
  - 后台登录页预填 `admin`，不适合内测上线。
  - 后台审核台 390px 下侧边栏占据大半屏，内容横向溢出约 133px，需要移动端顶部导航。
  - 后台导航、筛选、审核操作按钮普遍为 36/40px，需要统一到 44px。

#### 已完成代码修复

- `frontend/src/app/components/ui.tsx`
  - 搜索输入框内部 input 改为 `min-h-11`。
  - 搜索外壳去掉额外纵向 padding，保持整体高度清爽。
  - `ActionButton` / `ActionLink` 统一 `min-h-11`。
- 用户端页面：
  - `Competitions`、`Resources`、`Community`：筛选 chip 提升到 44px。
  - `Resources`：投稿、我的投稿按钮提升到 44px。
  - `ResourceCard`：资源标题改成两行截断；官方来源索引不再显示下载数 0。
  - `ResourceDetail`：官方来源索引改成“官方 / 来源”“官网 / 入口”，去掉无意义评分和大小字段。
  - `CompetitionDetail`：有官网链接的竞赛底部主按钮改为“查看官网”，点击直接打开官方链接；非官网条目保留“记录意向”。
  - `PostDetail`：`原文：https://...` 和裸 URL 自动渲染为可点击链接，并支持长链接换行。
  - `Teams`：空态改为“还没有队伍 / 发布后审核通过，再公开显示。”
  - `Home`、`Messages`、`MyResources`、`ResourceSubmissions`、`RefundResult`、`PublishPost`、`PublishResource`、`Search`：常见小按钮提高到 44px。
- 管理后台：
  - `AdminLayout`：移动端改为顶部横向导航，桌面仍为左侧栏；移动端提供顶部退出按钮。
  - `AdminUi`：后台页标题 action 支持换行，后台按钮默认 `min-h-11`。
  - `AdminLogin`：用户名不再预填 `admin`。
  - `AdminModeration`、`AdminResources`：筛选、来源、操作按钮提高到 44px。

#### 本地验证

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。
- 最新前端构建产物：
  - `index-CsrY8lSY.js`
  - `index-B2EwZOEI.css`

#### 下一步

1. 启动本地前端并指向线上 API，重新用 Playwright 截图验证修复结果。
2. 部署新 release 到服务器。
3. 部署后重新验证 `https://campusgrow.top` 用户端和管理员后台。
4. 尝试定位本机微信开发者工具 CLI；若本机没有 CLI，只能给出普通小程序壳的源码/域名/线上健康检查结论，并保留真机预览为人工项。

### 本轮最终收口：已完成部署和上线前验收

#### 当前最新状态

- 上一节“下一步”已经执行完成。
- 当前线上 release：`20260706225849`。
- 当前线上入口：
  - `https://campusgrow.top`
  - `https://campusgrow.top/admin/login`
  - `https://campusgrow.top/djVGWes8Fi.txt`

#### 最终代码修复

- `frontend/src/app/components/admin/AdminUi.tsx`
  - `AdminButton` 支持 `type="submit"`。
- `frontend/src/app/pages/admin/AdminLogin.tsx`
  - 管理员登录输入框补齐显式 `id/htmlFor/aria-label`。
  - 登录按钮改为真正的表单提交。
- `frontend/src/app/pages/admin/AdminHomeConfig.tsx`
  - 轮播图片上传 input 补齐 `name` 和 `aria-label`。
- `server/wechat.ts`
  - 删除 `demo-code` mock 特判，真实微信登录模式下不保留演示 code 分支。

#### 最终验证

- 本地：
  - `npm.cmd run typecheck:frontend` 通过。
  - `npm.cmd run build:frontend` 通过。
  - `npm.cmd run lint` 通过。
  - 开发态关键词 `demo-code / 演示链路 / 备案通过后 / 暂未开放购买 / Lorem ipsum` 未命中。
- 线上：
  - `http://campusgrow.top/` 301 到 HTTPS。
  - `https://campusgrow.top/` 200。
  - `https://campusgrow.top/api/health` 返回 `postgres / s3 / real / paymentsEnabled=false`，release 为 `20260706225849`。
  - `https://campusgrow.top/djVGWes8Fi.txt` 返回 `8abc4f6f5a866b01273a8582b21ff220`。
  - 公开内容数量：竞赛 85、资源 8、社区 10。
- Playwright：
  - 生产用户端 8 页 x 3 视口，共 24 个组合，失败 0。
  - 生产管理后台 5 页 x 3 视口，共 15 个组合，失败 0。
  - 截图和报告目录：
    - `output/playwright/ui-audit-20260706-production/`
    - `output/playwright/ui-audit-20260706-production-admin/`
- 生产闭环 smoke：
  - `scripts/smoke-admin-miniapp-closure.ts` 通过。
  - 覆盖发帖、评论、组队、组队申请、资源上传/审核/收藏/免费领取、举报、后台处理、审核通知。
  - 清理后 `smoke_users=0`、`smoke_tasks=0`。

#### 小程序壳结论

- `wechat-shell/project.config.json` AppID 为 `wxda8641cd650537a4`。
- `wechat-shell/app.js` 指向 `https://campusgrow.top`。
- `wechat-shell/pages/webview/index.js` 使用 `wx.login` 并注入 `mp_login_code`。
- 仓库未发现用户提供的微信 AppSecret。
- 本机未找到微信开发者工具 CLI 或 `wechatidecli`，因此无法代替开发者工具完成预览/上传。

#### 下一个人接手只需要做

1. 打开微信开发者工具，导入 `D:\github\zhejiang-competiton\wechat-shell`。
2. 确认微信后台 request 合法域名和 web-view 业务域名都是 `https://campusgrow.top`。
3. 真机预览测试真实 `wx.login`、浏览、收藏、免费资源获取、发帖、组队申请、举报和后台审核。
4. 真机通过后上传体验版，进入内测邀请。

## 2026-07-07

### 微信开发者工具导入与预览

#### 本次操作

- 继续执行“导入 `D:\github\zhejiang-competiton\wechat-shell`，真机预览通过后上传”的任务。
- 重新查找微信开发者工具 CLI：
  - `wechatidecli` 不在 PATH。
  - 常见 `C:\Program Files` 路径未命中。
  - 注册表显示微信开发者工具版本 `2.01.2510280`。
  - 实际 CLI 路径为 `D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`。
- 使用 CLI 开启服务端口：
  - 端口：`63746`。
- 用户完成微信开发者工具登录后，`cli.bat islogin --port 63746` 返回 `{"login":true}`。
- 使用 CLI 打开项目：
  - `D:\github\zhejiang-competiton\wechat-shell`
  - 返回 `open` 成功。
- 使用 CLI 生成真机预览二维码：
  - 预览图：`output/wechat-devtools/preview-qr.png`
  - 信息文件：`output/wechat-devtools/preview-info.json`
  - 包体大小：`2.5 KB`，`2561 Byte`
  - AppID：`wxda8641cd650537a4`

#### 当前状态

- 微信开发者工具已登录。
- 小程序壳项目已导入并成功生成预览包。
- 尚未上传体验版，原因是用户要求“真机预览通过后上传”，当前仍等待用户扫码预览并确认通过。

#### 下一步

1. 用户用微信扫描 `output/wechat-devtools/preview-qr.png`。
2. 真机确认登录、浏览、收藏、免费资源获取、发帖、组队申请、举报等链路。
3. 用户回复“通过”后，执行：
   - `cli.bat upload --project D:\github\zhejiang-competiton\wechat-shell --version <version> --desc <desc> --port 63746`
4. 上传完成后记录上传结果和版本号。
