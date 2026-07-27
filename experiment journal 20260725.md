# 校园成长平台研究进展日志

## 总体研究进展

- 项目目标：构建面向全国高校、按学校隔离内容的竞赛、资源、组队与社区平台，同时提供平台管理员和学校管理员两级人工运营后台。
- 当前阶段：停止继续提交微信正式审核，先处理真机登录循环，再重构首页和视觉体系，之后补齐真实竞赛详情、可下载资源、校内组队和人工内容维护后台。
- 当前关键结论：生产服务和真实微信 `code2Session` 接口本身可用，但“退出登录后重新体验完整引导”会在微信原生头像昵称页与 H5 之间循环。当前微信开发版本 `0.1.15` 不满足正式审核条件。
- 当前内容结论：生产已有 85 个竞赛、33 个资源和 12 篇帖子，但多数只是目录或官网入口，详情完整度不足；公开组队接口为空。问题是内容深度和可用性，不只是条目数量。
- 下一步：先做 P0 登录热修复与真机验收；通过后按“首页信息架构 -> iOS/中国超级应用风格视觉系统 -> 真实内容 -> 人工后台 -> 安全审计”顺序推进。

## 2026-07-25 产品反馈梳理与登录故障定位

### 本次边界

- 用户明确要求先梳理、不开始实现。本次只读取代码、生产访问日志、生产公开数据、`参考/产品手册1.docx` 和本地 `apple-design`、`emil-design-eng`、`design-review` 指南。
- 没有修改业务代码、数据库或生产配置，没有重新部署或上传微信版本。
- 为复现 session fragment 交接，仅启动现有本地 SQLite 预览服务并执行只读浏览器统计。

### P0 真机登录循环

- 生产 Nginx 日志确认真实微信 `POST /api/auth/wechat/login` 多次返回 200，`PATCH /api/users/me/identity` 也返回 200，因此不是 AppID、AppSecret、HTTPS 或 `code2Session` 整体不可用。
- 同一轮真机操作在 17:52 一分钟内产生 137 次 `/api/users/me`，并出现 4 次微信登录和 2 次身份保存，说明原生资料页与 H5 会话接管发生循环。
- 根因链条：
  1. `frontend/src/app/lib/app-service.ts` 的 `logout()` 调用 `markOnboardingForReplay(userId)`。
  2. `OnboardingGate.resolveInitialStep()` 遇到 replay 标记固定返回公告步骤。
  3. 公告“继续”逻辑只要 replay 仍为 pending，就强制进入 identity 步骤。
  4. identity 步骤在微信 web-view 中自动打开原生 `pages/profile/index`。
  5. 原生资料保存后通过 `wx.reLaunch` 返回 web-view，但 replay 标记要到最后的 bio 步骤才清除。
  6. 新 H5 再次从公告和 identity 开始，形成无法抵达后续步骤的闭环。
- 本地仅模拟 `#mp_session=local-zju-session-token` 时，10 秒内 `/api/users/me` 为 4 次且页面稳定，说明问题只在微信原生 `reLaunch + replay` 生命周期出现。
- 附带问题：`useSession()` 被 20 多个页面和组件独立调用，每个实例都可能触发 `syncCurrentUser()`；H5 登录桥对登录失败采用静默 `catch`。热修复应同时做全局单次刷新去重、显式错误与重试，但不能把这些附带问题误判为 replay 主根因。

### 首页改造共识

- 删除首页校内通知、图片公告和四宫格快捷入口；保留顶部搜索。
- 搜索下方直接放竞赛、资源、组队三个核心模块。移动端不做三个狭窄并排方块，而做三个单层模块面板，每个面板包含 1-2 条真实预览，避免卡片套卡片和横向滚动。
- 竞赛预览展示名称、级别、截止状态和组队人数；资源预览展示类型、官方/用户来源和是否可直接领取；组队预览展示本校、缺少角色和投入时间。
- 当前产品经理反馈要求删除首页公告，优先级高于产品手册中“公告做滚动横幅”的旧建议。重大通知改放消息中心；确有强提醒时使用可关闭的临时状态条，不常驻首页。
- 首页不再展示经验贴模块，社区继续保留独立入口；底部导航保持首页、竞赛、资源、组队、我的。

### 视觉方向

- 采用“iOS grouped utility + 中国超级应用信息密度”方向：结构清楚、内容充实、颜色有层次，但不使用营销页大标题、彩色渐变堆叠、装饰性 logo、漂浮光球或无意义动画。
- 主色使用清晰蓝色；资源状态可少量使用绿色，截止/提醒使用橙色或红色。每个模块最多一个辅助色，不能让整页变成多彩入口集合。
- 内容卡最大圆角继续遵循 8 px；搜索框、头像、圆形图标按钮可使用胶囊或圆形。通过真实图片、分组底色、细分割线、字重和留白提升品质，而不是把圆角无限放大。
- 按钮按下反馈控制在 100-160 ms，展开搜索和弹层控制在 150-250 ms，使用 ease-out；高频列表跳转不增加动画。支持 `prefers-reduced-motion`。
- 搜索采用折叠状态：默认只占一行；点击后进入固定顶部的完整搜索模式，显示取消、历史/建议和必要筛选。返回后恢复原筛选和滚动位置。

### 产品手册中继续采纳的内容

- 竞赛分类标签必须基于真实数据聚类，并与首次引导中的关注方向一致。
- 浏览量和收藏量进入真实排序，不用静态假数。
- 组队“找队伍”和“求加入”保持两个明确视图，字段与队长发布表单一一对应。
- 页面要紧凑、内容充实，并保留组队详情安全提示。
- 竞赛详情必须成为可阅读的结构化页面，不能只导向官网。
- 不采纳“直接复制赛氪全文和图片”。第三方站点只作为线索，最终事实以主办方官网、官方通知和公开附件为准，保留来源和最后核验时间，避免版权和事实风险。

### 生产内容审计

- 竞赛：85 条，全部为国家级；分类分布为创新创业 24、电子硬件 14、学术科研 13、编程算法 11、设计艺术 9、商科案例 6、语言外语 5、数学建模 3。
- 85 条竞赛中：报名开始 0、竞赛开始 0、竞赛结束 0、组队人数 2、赛制阶段 2、奖项 2、官方联系方式 0、附件 0、通知记录 0、最后核验时间 2。85 条都有 sourceUrl，但精确 2026 日期为 0。
- 资源：33 条，全部免费且都有 sourceUrl，但 fileAssetId 为 0；本质是官网入口，不是用户可以领取或下载的资料。
- 帖子：12 条，均无用户作者和官方来源字段，属于平台种子内容。
- 公开组队：0。组队必须继续按学校隔离；本地或演示数据可以模拟，但生产环境不能伪装成真实用户发布，至少标记“内测示例”，更优方案是组织首批真实内测同学发布。

### 两级后台现状与缺口

- 已有能力：平台管理员/学校管理员 scope、服务端 school_id 强制隔离、学校启停与热门设置、学校管理员创建/重置/停用、本校首页运营、资源/审核/举报、批量通过与审计日志。
- 学校管理员与平台管理员共用 `/admin` 登录入口，登录后按 scope 展示不同菜单；功能存在但缺少明确交付入口、账号开通说明和真实学校管理员验收。
- 关键缺口：没有竞赛目录人工 CRUD，没有竞赛结构化编辑器，没有附件/通知版本管理，没有资源由管理员直接上传并发布的入口，没有 CSV/Excel 导入预览、差异确认、草稿和回滚流程，也没有内容核验到期队列。
- 后续原则：AI 只做网页字段提取、重复检测和草稿建议；所有竞赛、资源和学校关键状态必须由人工确认后发布，并写入管理员、来源、时间和变更差异审计。

### 分阶段实施与验收

#### P0 登录热修复

- 为 replay 引导增加跨原生/H5 的明确 resume step 或一次性 handoff 状态，原生 identity 完成后直接恢复到 school，而不是重新从 notice 开始。
- replay 标记只控制“是否完整重放”，不能同时充当当前步骤；增加防重复打开 native profile 的 nonce/consumed 标记。
- 将用户会话刷新收敛到一个 provider 或一个全局 in-flight promise；每个 H5 首次进入最多一次 `/users/me` 主动同步。
- `/users/me` 和其他鉴权响应增加 `Cache-Control: private, no-store`；登录桥错误不得静默，必须展示失败原因、重新登录和先浏览。
- 真机验收：首次用户、已有用户、退出后重放三条路径；单次流程只允许一次 identity 页面，10 秒 `/users/me` 不超过 2 次，能够完成 notice -> identity -> school -> directions -> skills -> team -> bio -> home。

#### P1 首页与设计系统

- 先确定颜色、字号、间距、阴影、8 px 卡片圆角、状态色和动效 token，再改首页及三个核心列表，避免逐页自行配色。
- 首页只保留折叠搜索和竞赛/资源/组队三个模块；每个模块有真实预览、统一加载骨架、错误重试和空状态。
- 验收 390 x 844、414 x 896 和桌面窄容器；无横向溢出，底栏固定，触控目标至少 44 px，搜索展开/取消/返回保持状态。

#### P2 真实内容与竞赛详情

- 第一批选择 12 个高频国家级赛事逐条完成官方核验，再扩到 30-50 条；不能先铺 85 个空壳。
- 强制字段：主办方、适用人群、主题/赛道、团队人数、报名方式、报名起止、比赛阶段、提交材料、费用、奖项、官方联系方式、附件、官方来源和最后核验时间。
- 官方未公布的字段显示“当届通知暂未公布”，不得推断或编造。
- 资源首批应为官方章程、报名指南、公开模板或自制摘要；第三方资料必须确认授权。资源应有实际文件或可交付内容，不能继续把链接命名为资料。
- 组队演示只进入本地/测试学校并明确标记；生产优先组织真实内测用户发布。

#### P3 人工运营后台

- 平台后台新增竞赛目录、资源库、来源管理、批量导入、核验队列和发布历史。
- 学校后台新增本校帖子、组队、资源、认证用户与本校首页管理，并提供清晰的学校名和权限提示。
- 内容工作流统一为 draft -> pending_review -> published -> archived；支持预览、定时发布、撤回、批量操作、差异审阅和审计日志。
- CSV/Excel 导入必须先预览、校验、去重和人工确认；禁止导入即发布。

#### P4 安全与上线门槛

- 轮换曾暴露在对话中的微信 AppSecret，并复核所有生产凭据、管理员密码和最小权限。
- 登录/验证码限流迁移为可共享持久化方案；会话 handoff 改为短时一次性 code，避免长期 bearer token 暴露在 URL fragment 生命周期中。
- 上传验证扩展名、MIME、文件魔数、大小和恶意文件；S3 私有、短期签名下载；富文本统一消毒。
- 增加平台/学校越权矩阵、文件上传、XSS、开放重定向、批量操作审计和备份恢复测试。
- 最终门槛：本地完整闭环、微信开发者工具、真机体验版、生产灰度和日志观察全部通过后，才提交微信正式审核。

## 2026-07-25 P0 微信登录重放循环热修复

### 完成的代码修改

- `wechat-shell/pages/profile/index.js` 记录原生资料页来源；当来源为 onboarding 时，保存成功后通过 `wx.reLaunch` 返回 web-view，并附带一次性 `resume=school`。
- `wechat-shell/pages/webview/index.js` 校验 resume 只允许 `school`，把它与 session token 一起放入 H5 fragment：`mp_session + mp_onboarding_resume`。
- `frontend/src/app/lib/onboarding-state.ts` 增加带 5 分钟有效期的 resume 读取、存储和清理；能够在首次渲染时直接读取 URL 中的 `mp_onboarding_resume`。
- `OnboardingGate.tsx` 优先恢复 resume step，进入学校步骤后清除一次性参数；replay pending 保留到完整引导完成，确保不是跳过重放，而是从原生身份页之后继续。
- `useSession.ts` 删除每个 hook 实例自动请求 `/users/me` 的逻辑；`Layout.tsx` 只在顶层按 token 同步一次。
- `app-service.ts` 为并发的 `syncCurrentUser()` 增加同 token in-flight 合并，并避免旧 token 响应覆盖新会话。
- `http.ts` 对所有带用户/管理员 Authorization 的请求使用 `cache: no-store`。
- `server/index.ts` 对 `/api/auth/*`、`/api/users/*`、`/api/admin/*` 及所有带 Authorization 的请求返回 `Cache-Control: private, no-store`、`Pragma: no-cache` 和 `Vary: Authorization`。
- `WechatMiniProgramLoginBridge.tsx` 不再静默吞掉登录失败；新增“登录未完成”提示、“重新登录”和“先浏览”，退出错误状态时清除 handoff 与 resume 参数。

### 自动化验证

- 根目录类型检查、前端类型检查、微信壳 JS 语法与 JSON 解析全部通过。
- 普通 `#mp_session` 交接在 10 秒内由修改前 4 次 `/api/users/me` 降为 2 次，session 成功保存，hash 被清除。
- replay + `mp_onboarding_resume=school` 在 0、20、50、100、200、400、800、1500、2500 ms 九个采样点均稳定显示“你在哪所学校？”，没有回到公告或头像昵称。
- 自动化完成学校 -> 关注方向 -> 技能 -> 组队状态 -> 个人简介 -> 保存完成 -> 首页，最终 replay 标记为 null、complete 标记为 done。
- 无效 token 显示“登录未完成”，点击“先浏览”后 alert、session、resume 和 hash 均清除。
- VM 壳层断言通过：原生 profile 返回 URL 包含 `resume=school`；web-view 最终 URL 为 session 与 resume 的组合 fragment。
- 本地鉴权接口返回 `Cache-Control: no-store, private`、`Pragma: no-cache`、`Vary: Authorization`。
- `npm run verify:local-release` 通过：服务端类型检查、前端类型检查、双学校核心业务与管理员闭环冒烟、生产构建全部成功。主包 479.00 kB，gzip 137.82 kB。
- 390 x 844 截图无横向溢出：
  - `output/playwright/p0-wechat-resume-school-20260725.png`
  - `output/playwright/p0-wechat-login-error-20260725.png`

### 生产发布

- 热修复 release：`20260725185954`。
- 发布包：`.deploy/campus-growth-20260725185954.tar.gz`，1,653,820 字节，76 个条目，敏感条目 0。
- 发布包 SHA-256：`034EE8B2CE8AA5D25CD66E09E89A9221541A7CD76F91C060436432CC12EA6FC2`，远端哈希一致。
- 发布前 PostgreSQL 备份：`/opt/campus-growth/backups/predeploy-20260725185954.sql.gz`，114,852 字节，权限 `0640`，`gzip -t` 通过。
- 备份 SHA-256：`5CD7F1BF849A4C05F5C538D5EA24A215200F5D9D54337FDD42D2FAB5D752CA9B`。
- 当前 symlink：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260725185954`；服务 active，`NRestarts=0`。
- 外网健康继续为 PostgreSQL、S3、真实微信登录、支付关闭；线上主包 `index-f36icFZQ.js` 包含 resume 与可见错误逻辑。
- 外网未认证 `/api/users/me` 返回 401，同时正确带有 `private, no-store`；390 px 首页和错误界面无横向溢出、页面错误为 0。
- 生产截图：`output/playwright/production-p0-login-error-20260725185954.png`。

### 微信版本与当前门槛

- 微信 CLI preview 成功，包体 20,070 字节；二维码：`output/wechat-preview/p0-login-hotfix-20260725185954.png`。
- 微信开发版本 `0.1.16` 上传成功，描述“修复真机登录重放循环 20260725”；上传记录：`output/wechat-preview/upload-20260725185954.json`。
- 服务器 `/tmp` 发布包和临时脚本已清理，本地临时备份脚本也已删除。
- 当前唯一未完成门槛是真机验证。测试必须使用 `0.1.16`，依次执行：已有用户退出 -> 微信登录 -> 公告 -> 原生头像昵称 -> 学校 -> 方向 -> 技能 -> 组队状态 -> 简介 -> 首页；确认原生头像昵称页只出现一次。
- 在真机确认前，任务进度保持“P0 已实现并部署、真机待确认”，不启动 P1 首页重构，也不提交微信正式审核。

## 2026-07-25 P0.1 微信 WebView 旧缓存修复

### 真机复核与第二层根因

- `0.1.16` 真机仍反复回到旧“使用说明”；生产日志显示微信登录和身份保存均成功，但同一轮流程累计出现大量 `/api/users/me` 请求。
- 根因是原生资料页保存后返回无查询参数的 `https://campusgrow.top/#...`，微信 WebView 复用了旧 `index.html/JS`。旧前端既不识别 `mp_onboarding_resume`，又保留旧会话刷新逻辑，因此 P0 的服务端和新前端修复没有在该次 WebView 中生效。

### 已完成的修复

- `wechat-shell/pages/webview/index.js` 将壳版本提升为 `0.1.17`，所有 H5 入口增加 `mp_shell_build=0.1.17` 和唯一 `mp_entry_ts`；session 返回地址和 fallback 地址也使用新的查询参数，避免只更新 fragment 时复用旧页面。
- `frontend/src/app/components/WechatMiniProgramLoginBridge.tsx` 接管 session 后同时清理 `mp_shell_build`、`mp_entry_ts`、handoff fragment，避免临时参数污染后续路由。
- `deploy/nginx/campus-growth-https.conf` 对 SPA 入口增加 `expires -1`，要求每次重新验证 `index.html`；哈希资源 `/assets/` 继续保留 7 天 immutable 缓存。

### 发布前验证

- `npm run lint`、`npm run typecheck:frontend`、微信壳 JS 语法检查、`npm run verify:local-release` 全部通过。
- VM 壳层断言确认返回地址同时包含版本查询参数、唯一时间戳、session 和 `resume=school`。
- 本地真机等价流程稳定显示“你在哪所学校？”，临时 query/hash 均被清理，`/api/users/me` 恰好 2 次，390 px 横向溢出为 0。
- 待发布 release：`20260725192142`；发布包 `.deploy/campus-growth-20260725192142.tar.gz`，1,653,825 字节，76 个条目，敏感条目 0。
- 发布包 SHA-256：`03CD05BD27C5AE5328E1A7AD4DCA3E05D62F08112A20B832F703127BAB66D5C9`。
- 下一步：生产 PostgreSQL 备份 -> 上传并部署 release -> 同步并校验 Nginx 缓存规则 -> 外网验收 -> 生成 `0.1.17` 真机预览二维码并上传微信开发版本。

### 生产发布与外网验收

- 发布前 PostgreSQL 备份：`/opt/campus-growth/backups/predeploy-20260725192142.sql.gz`，115,680 字节，owner `campus:campus`，权限 `0640`，`gzip -t` 通过。
- 数据库备份 SHA-256：`9f2631e450c5550d781d8c750406acb29d096c2374961ffdd101d133a98821ea`。
- 发布包远端 SHA-256 与本地一致；release 已原子切换至 `/opt/campus-growth/releases/20260725192142`。
- API 当前 `active/running`，`NRestarts=0`；健康信息为 PostgreSQL、S3、真实微信登录、支付关闭。
- systemd 在停止旧 Node 进程时记录 `status=143`，同一秒正常启动新进程；这是 restart 的 SIGTERM 记录，新进程随后稳定监听 8080，不是新 release 启动失败。
- Nginx 原配置备份为 `/etc/nginx/conf.d/campus-growth.conf.pre-20260725192142`；新配置 `nginx -t` 通过并已 reload。
- `http://campusgrow.top/` 返回 301 到 HTTPS；带 `mp_shell_build=0.1.17` 和时间戳的 HTTPS 入口返回 200、`Cache-Control: no-cache`。
- 线上主包为 `assets/index-CFsrzUIe.js`，包含 `mp_shell_build`、`mp_entry_ts`、`mp_onboarding_resume` 和可见登录错误逻辑；哈希资源继续返回 7 天 immutable 缓存。
- Playwright 390 x 844 生产冒烟：页面横向溢出 0，控制台错误 0、警告 0；截图 `output/playwright/production-p0-webview-cache-hotfix-20260725192142.png`。

### 微信 `0.1.17`

- 微信开发者工具 CLI 登录状态为 true，AppID 校验为 `wxda8641cd650537a4`。
- preview 成功，包体 20,370 字节；二维码 `output/wechat-preview/p0-webview-cache-hotfix-20260725192142.png`，信息 `output/wechat-preview/p0-webview-cache-hotfix-20260725192142.json`。
- 开发版本 `0.1.17` 上传成功，描述“修复微信WebView缓存循环 20260725”；上传记录 `output/wechat-preview/upload-20260725192142.json`。
- 当前唯一剩余门槛是真机重新扫码验证 `0.1.17`。必须使用新二维码，不能从微信最近使用或旧 `0.1.16` 入口继续测试。
- 真机验收路径：退出登录 -> 微信一键登录 -> 公告 -> 原生头像昵称 -> 学校 -> 方向 -> 技能 -> 组队状态 -> 简介 -> 首页；原生头像昵称页只能出现一次，保存后应直接进入学校步骤，不再回到“使用说明”。
- 在真机确认通过前仍不进入 P1 首页/UI 重构，也不提交微信正式审核。
- 发布清理已完成：服务器 `/tmp` 中本次发布包、部署脚本、备份脚本和 Nginx 临时配置均已删除；本地一次性 PostgreSQL 备份脚本已删除。生产 release、生产数据库备份、本地发布包、stage、二维码、上传 JSON 和 Playwright 截图均保留。

## 2026-07-25 P0 真机确认与 P1-P4 继续实施

- 用户已真机确认 `0.1.17` 不再反复回到“使用说明”，P0 登录循环正式关闭。
- 用户确认头像昵称存在两个重复界面，并指定删除截图中的原生页面。审计确认该页面为 `wechat-shell/pages/profile`，H5 `OnboardingGate` 已有同等头像、昵称和本地相册上传能力。
- 已删除 `wechat-shell/pages/profile/index.js`、`index.json`、`index.wxml`、`index.wxss`，并从 `wechat-shell/app.json` 移除页面注册。
- 已删除 `quick-login.ts` 中 `pages/profile` 地址构造与 `openWechatIdentityProfile()`，以及 `OnboardingGate.tsx` 中自动打开原生身份页的 effect；保留单一 H5 身份步骤和 web-view 微信登录交接。
- 根目录 TypeScript、前端 TypeScript、微信壳 JS 语法和 `app.json` 解析通过；源码检索无 `pages/profile` 或 `openWechatIdentityProfile` 残留。
- 下一步按 P1 首页与设计系统、P2 真实内容、P3 人工后台、P4 安全与上线门槛顺序实施。

### P1 首页与视觉系统

- `Home.tsx` 删除校内通知、图片横幅、四宫格快捷入口和经验帖区；搜索下方只保留竞赛、资源、组队三个模块。
- 三个模块直接使用 `/home` 返回的真实竞赛、资源和本校组队数据，每块最多展示 2 条，并有独立加载、错误重试和空状态。
- 新增应用级颜色、分割线、圆角、阴影和 120 ms 按压反馈 token；视觉采用蓝、绿、琥珀三个功能色，不使用渐变装饰和大标题。
- Playwright 390 x 844 截图：`output/playwright/p1-home-redesign-390-20260725.png`；三块模块数量正确，横向溢出 0。

### P2 真实内容与可下载资源

- 竞赛数据模型新增 `submissionMaterials`，数据库新增 `submission_materials_json`，详情页新增“提交材料”区。
- 新增 `scripts/enrich-official-content.ts`，默认 dry-run；`--apply` 才写库，PostgreSQL 还必须额外传 `--confirm-production`。
- 首批 12 项高频国家级赛事已补齐稳定规则：参赛对象、团队人数、三阶段赛程、3-4 项提交材料、适合人群、准备提示、官方来源和 `2026-07-25` 最后核验时间。
- 不推断当届日期和赛道人数：没有明确日期时写“当届通知暂未公布”，人数变化大的赛事写“以当届赛道/章程为准”。
- 官方来源连通性检查：创新大赛、挑战杯、数模、电赛、计算机设计、蓝桥杯、大广赛和节能减排入口返回 200；智能车官网证书过期、机械入口 502、物流入口证书域名错误，因此这三项改用可访问的教育部认可竞赛目录入口，避免给用户不可用链接。
- 新增 3 份平台原创 Markdown：`竞赛官方信息核验清单.md`、`竞赛组队分工模板.md`、`路演答辩检查清单.md`，均明确声明不是官方文件。
- 修复平台原创资源被数据库启动逻辑误判为校内未认证投稿的问题：`system:` 内容身份保持 platform scope，普通用户投稿继续按 school scope 隔离。
- 本地 12 项赛事完整性审计 `incomplete=0`；原创资源领取成功，下载返回 200、`Content-Length: 1379`、`Content-Type: text/markdown; charset=utf-8` 和 `Cache-Control: private, no-store`。
