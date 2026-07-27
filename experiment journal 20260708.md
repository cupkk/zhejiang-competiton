# 校园成长平台进展日志 20260708

## 整体研究进展

项目目标是把校园成长平台整理成可内测、可微信小程序承载、可后续多学校运营的商业化版本。当前主线仍以 `D:\github\zhejiang-competiton` 为准，用户端采用 React + Vite H5，被 `wechat-shell` 通过小程序 `web-view` 加载；后端为 Express API，线上使用 PostgreSQL + S3，微信登录模式为 real，支付入口关闭。

已完成的关键方向包括：商业化一期规划、支付关闭、真实微信登录链路、小程序壳预览、用户端 iOS/CC98 风格收敛、组队大厅入口、返回滚动记忆、后台审核效率优化、登录后轻量引导、学校选择页。当前重点是上线内测前继续消除“AI 感”、补真实内容和数据、完善学校维度隔离与学校管理员体系。

当前线上 release：`/opt/campus-growth/releases/20260708092956`。线上健康检查显示 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`、`paymentsEnabled=false`。

## 2026-07-08 学校校徽与移动端宽度修复

### 本次目标

- 学校选择页中的每个学校显示真实校徽，减少文字头像带来的临时感。
- 页面宽度完全适配微信手机小程序 WebView，避免左右滑动、横向溢出和视觉缩放错觉。
- 保持学校选择页简洁、低装饰、接近真实小程序产品形态。

### 代码与资源改动

- 新增本地校徽资源：
  - `frontend/public/school-logos/*.png`
  - 共 20 所学校，图片均为 200x200 PNG。
  - 来源为公开高考学校数据接口和静态 logo CDN：
    - `https://api.eol.cn/gkcx/api/`
    - `https://static-data.gaokao.cn/upload/logo/{school_id}.png`
- `frontend/src/app/lib/schools.ts`
  - `SchoolOption` 新增 `logoUrl` 字段。
  - 首批已开通学校全部补齐本地校徽路径。
- `frontend/src/app/pages/SchoolSelect.tsx`
  - `SchoolLogo` 改为优先渲染真实校徽图片，加载失败时回退学校简称。
  - 图片固定 `width`/`height`，添加 `alt`，列表下方图片 lazy 加载。
  - 当前选择区域也展示校徽。
  - 热门学校和列表按钮补充 `aria-label` 与 focus-visible 状态。
  - 搜索框补充 `name`、`autoComplete="off"`、`enterKeyHint="search"`。
- `frontend/src/app/components/ui.tsx`
  - `bareInputClass` 增加 `app-bare-input`，用于压住兜底 input 样式。
- `frontend/src/styles/index.css`
  - 增加图片 `display:block`、按钮 `touch-action: manipulation`、`#root overflow-x:hidden`。
  - 增加 `.app-bare-input`，去掉搜索框内部被兜底 CSS 套出的白色边框。
- `frontend/index.html`
  - viewport 改为 `width=device-width, initial-scale=1.0, viewport-fit=cover`。
  - 增加 `theme-color`。
  - 兜底样式增加 `width/max-width/overflow-x:hidden` 和 `touch-action: pan-y`。
- `frontend/ATTRIBUTIONS.md`
  - 记录校徽缓存来源和后续替换建议。

### 验证结果

- 本地静态检查：
  - `npm.cmd run typecheck:frontend` 通过。
  - `npm.cmd run lint` 通过。
  - `npm.cmd run build:frontend` 通过。
- 构建产物：
  - `frontend/dist/assets/index-s4JvC45c.js`
  - `frontend/dist/assets/index-Pa61dxMa.css`
  - `frontend/dist/school-logos/` 中存在 20 个校徽 PNG。
- Playwright 本地移动端验证：
  - 390x844、414x896 均通过。
  - `bodyScrollWidth`、`documentScrollWidth` 均等于视口宽。
  - `visualViewport.scale=1`。
  - 校徽图片全部 `naturalWidth=200`、`naturalHeight=200`，无破图。
  - `overflowElements=[]`，没有元素越过视口。
  - 搜索框内部 input 计算样式为 `borderTopWidth=0px`、`backgroundColor=transparent`、`paddingLeft=0px`。
- Playwright 线上移动端验证：
  - 地址：`https://campusgrow.top/schools`
  - 390 宽度下 `bodyScrollWidth=390`、`documentScrollWidth=390`。
  - 校徽图片加载成功，无控制台 error/warning。
  - 截图：`output/playwright/school-logos-responsive-20260708/schools-production-390.png`
  - 报告：`output/playwright/school-logos-responsive-20260708/report-production.json`

### 部署

- 新 release 包：
  - `.deploy/campus-growth-20260708092956.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708092956.tar.gz`
- 执行：
  - `bash /tmp/deploy-commercial-release.sh 20260708092956`
- 服务器当前指向：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708092956`
- 线上健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上静态校徽检查：
  - `https://campusgrow.top/school-logos/zju.png` 返回 200，`Content-Type=image/png`，大小 82977 bytes。

### 注意事项

- 当前校徽来自公开数据源，适合内测阶段提升真实感；后续学校正式入驻时，应允许平台总后台或学校管理员上传学校提供的官方校徽资源。
- 本次未使用 `user-scalable=no` 或 `maximum-scale=1` 禁止缩放；横向问题通过容器宽度、overflow 和触控约束修复，避免牺牲可访问性。
- 真实微信真机仍需用户扫码确认学校页是否与线上 Playwright 结果一致。小程序壳加载线上 H5，因此无需改 `wechat-shell` 代码即可看到本次校徽和宽度修复。

## 2026-07-08 多学校体系、学校认证与列表隔离

### 本次目标

- 按用户要求把学校选择从少量本地学校扩展为全国高校数据。
- 新增学校认证页：教育邮箱验证码 + 手机号绑定。
- 数据库新增 `schools`、`user_school_memberships`、`school_verification_codes`，并给 `users`、`competitions`、`resources`、`teams`、`posts` 增加 `school_id`。
- 列表接口按当前用户学校过滤；`school_id` 为空的竞赛保留为平台统一官方赛事，避免国家级白皮书赛事被误锁到单校。
- 新页面保持现有 iOS/CC98 克制风格，避免大段说明和默认蓝色按钮污染。

### 代码改动

- 后端：
  - 新增 `server/school-service.ts`，提供学校列表、选校、会员列表、验证码发送与验证码校验。
  - 新增 `server/schools-seed.json`，包含 2994 所高校，来源为公开高考学校数据；已知学校优先使用本地校徽，其余使用公开 CDN logo。
  - `server/db.ts` 新增学校、学校会员、验证码表；补充学校相关索引和内容表 `school_id` 迁移。
  - `server/helpers.ts` 新增学校读取、当前活跃学校会员、当前学校 ID 等工具。
  - `server/catalog-service.ts`、`server/community-service.ts` 增加学校可见性判断；列表、详情、搜索、收藏、发布、组队申请等路径补学校隔离。
  - `server/index.ts` 新增接口：`GET /api/schools`、`GET /api/users/me/school-memberships`、`POST /api/users/me/school-verification/code`、`POST /api/users/me/school-verification/verify`。
  - `server/config.ts` 新增 `VERIFICATION_DEBUG_CODE_VISIBLE` 行为：非 real 登录模式默认返回内测验证码，real 模式默认隐藏。
- 前端：
  - `frontend/src/types/entities.ts`、`frontend/src/types/api.ts` 增加学校、学校会员、认证结果等类型。
  - `frontend/src/app/lib/api.ts`、`frontend/src/app/lib/app-service.ts` 增加学校与认证 API 包装，并在认证成功后同步本地 session。
  - `frontend/src/app/pages/SchoolSelect.tsx` 改为请求后端全国高校列表，热门学校和搜索结果使用统一白底圆形校徽，旧本地 20 所仅作为静态资源来源。
  - 新增 `frontend/src/app/pages/SchoolVerify.tsx`，包含教育邮箱和手机号两个认证卡片。
  - `frontend/src/app/pages/Profile.tsx` 增加学校认证入口和认证状态标签。
  - `frontend/src/app/components/onboarding/OnboardingGate.tsx` 扩展公告为三条短句：学校空间、选择学校、认证可信度。
  - `frontend/index.html` 删除污染全局按钮的蓝色背景兜底，避免小程序页面按钮被默认渲染成整片蓝色。

### 本地验证

- `npm.cmd run lint` 通过。
- `npm.cmd run typecheck:frontend` 通过。
- `npm.cmd run build:frontend` 通过。
- 隔离本地 API 冒烟：
  - `GET /api/health` 返回 ok。
  - `GET /api/schools?keyword=浙江大学&limit=5` 返回浙江大学。
  - 混合登录后可选中 `sch_114` 浙江大学。
  - 教育邮箱验证码验证后会员状态为 `pending`。
  - 教育邮箱 + 手机号均验证后会员和用户状态均为 `verified`。
- Playwright 移动端验证：
  - 390x844、414x896 检查 `/schools`、`/school-verify`。
  - 最终结果：无横向溢出、无越界元素、无小触控目标。
  - 截图输出：
    - `output/playwright/schools-final-390.png`
    - `output/playwright/schools-final-414.png`
    - `output/playwright/school-verify-final-390.png`
    - `output/playwright/school-verify-final-414.png`

### 线上部署与问题修复

- 首次部署包 `20260708102255` 启动失败：
  - 原因：线上 PostgreSQL 已有旧 `schools` 表，但缺少 `province/city` 等列；代码在补列前创建 `idx_schools_search`，触发 `column "province" does not exist`。
  - 修复：调整 `server/db.ts` 迁移顺序，先 `ensureColumn`，再创建索引。
- 第二次部署包 `20260708102531` 启动失败：
  - 原因：旧表 `city` 列带 NOT NULL 约束，而部分全国高校种子城市为空。
  - 修复：学校种子写入时将空 `sourceId/code/province/city/logoUrl` 统一落为空字符串，不写 NULL。
- 第三次部署包 `20260708102708` 启动成功：
  - 首次 upsert 2994 所学校导致 API 监听延迟约 30 秒，健康检查随后恢复。
  - 发现旧线上学校数据存在 `school_zju`，搜索“浙江大学”出现重复。
  - 修复：`listSchools` 按学校名去重，并优先返回 `sch_*` 新种子和热门学校；`getSchoolRowByName`、`getSchoolIdByName` 也按同样优先级查找。
- 最终部署包：
  - `.deploy/campus-growth-20260708103008.tar.gz`
  - 服务器当前指向：`/opt/campus-growth/releases/20260708103008`

### 线上验收

- `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- `https://campusgrow.top/api/schools?keyword=浙江大学&limit=5`
  - 返回 `sch_114` 浙江大学、`sch_3429` 浙江大学医学院。
  - 旧重复 `school_zju` 已不再出现在列表。
- `https://campusgrow.top/schools` 返回 200。
- `https://campusgrow.top/school-verify` 返回 200。
- `https://campusgrow.top/school-logos/zju.png` 返回 200。
- `systemctl is-active campus-growth-api` 返回 active。

### 后续建议

- 现在认证验证码只完成平台侧记录；正式上线如果要真实发邮件/短信，需要接入邮件服务和短信服务，并增加发送频率限制。
- 目前学校隔离对帖子、组队、资源生效；`school_id` 为空的竞赛作为官方公共赛事保留，后续如果学校管理员要发布校内竞赛，再写入对应 `school_id`。
- 管理后台下一步应增加学校维度筛选和学校管理员角色，平台总后台可以跨校看，学校管理员默认只看本校。

## 2026-07-08 后台学校筛选、学校管理员权限与阿里云邮件短信调研

### 本次目标

- 后台审核、资源审核、举报处理增加学校维度筛选。
- 增加 `school_admin` 学校管理员角色，本校管理员只能查看和处理本校内容。
- 给学校管理员账号创建提供可执行脚本，避免手工改库。
- 调研真实邮件/短信验证码服务，优先使用阿里云，并形成内部接入指南。

### 代码改动

- `frontend/src/types/api.ts`
  - `AdminRole` 增加 `school_admin`。
  - `AdminProfile` 增加 `scope`、`schoolId`、`schoolName`。
- `server/config.ts`
  - `school_admin` 默认权限为 `home:read`、`moderation:read`、`moderation:write`。
  - 未授予 `home:write`，避免学校管理员影响平台首页配置。
- `server/db.ts`
  - `admin_users` 新增 nullable 字段 `school_id`、`school_name`。
  - 新增 `idx_admin_users_school`。
  - bootstrap 超级管理员强制保持平台范围，不绑定学校。
- `server/helpers.ts`
  - `buildAdminProfile` 返回平台/学校范围。
  - `resolveAdminSession` 每次读取 `admin_users` 当前角色和学校范围，避免 token 中旧角色继续生效。
  - 新增内容目标学校解析：resource、post、team、comment、report 均可解析到 `schoolId/schoolName`。
  - `mapModerationTask` 返回 `schoolId/schoolName`。
- `server/community-service.ts`
  - `listModerationTasks(query, scope)` 按管理员范围过滤。
  - `reviewModerationTask(taskId, payload, scope)` 阻止学校管理员跨校处理，返回 `admin_scope_forbidden`。
  - `listReports(query, scope)` 按举报目标所属学校过滤，并返回学校字段。
- `server/index.ts`
  - 管理员中间件把 `adminRole/adminSchoolId/adminSchoolName` 写入 `res.locals`。
  - `/api/moderation/tasks` 支持 `schoolId` query。
  - `/api/reports` 支持 `schoolId` query。
  - 跨校处理映射为 403：`当前管理员不能处理该学校的内容。`
- `frontend/src/app/components/admin/AdminSchoolFilter.tsx`
  - 新增后台学校范围筛选组件。
  - 平台管理员可搜索学校并选择；学校管理员显示固定本校标签。
- `frontend/src/app/pages/admin/AdminModeration.tsx`
  - 接入学校筛选，审核卡片显示学校。
- `frontend/src/app/pages/admin/AdminResources.tsx`
  - 接入学校筛选，资源审核卡片显示学校。
- `frontend/src/app/pages/admin/AdminReports.tsx`
  - 接入学校筛选，举报卡片显示学校。
- `frontend/src/app/components/admin/AdminLayout.tsx`
  - 侧栏展示“平台后台”或本校名称。
- `scripts/create-school-admin.ts`
  - 新增学校管理员创建/更新脚本。
  - 使用方式：`npm run create:school-admin -- --username=admin_zju --password=*** --school-id=sch_114 --display-name=浙江大学管理员`
- `package.json`
  - 新增脚本：`create:school-admin`。
- `.env.example`
  - 新增学校管理员脚本变量和阿里云验证码服务变量占位符。
- `阿里云邮件短信接入指南 20260708.md`
  - 新增阿里云短信、邮件推送、RAM、环境变量、后端设计、限流、安全、验收步骤。

### 阿里云调研结论

- 短信推荐使用阿里云短信服务 `SendSms`，关键参数是 `PhoneNumbers`、`SignName`、`TemplateCode`、`TemplateParam`。
- 短信签名和模板必须先在控制台申请并审核通过；验证码建议单条发送，方便限流和审计。
- 邮件推荐使用阿里云邮件推送 Direct Mail，先配置发信域名，完成 SPF/DKIM/MX/CNAME 等 DNS 验证，再使用 OpenAPI 或 SMTP 发送。
- 密钥必须用 RAM 用户 AccessKey，不能使用主账号密钥；线上只写入 `/etc/campus-growth/api.env`。
- 当前项目本次只完成配置、文档和后端设计建议，真实 `VerificationSender` 还未接入。

### 本地验证

- `npm.cmd run lint` 通过。
- `npm.cmd run typecheck:frontend` 通过。
- `npm.cmd run build:frontend` 通过。
- 本地 API 冒烟：
  - 使用 `API_PORT=8091`、`DB_PATH=server/data/smoke-school-admin.db` 启动隔离 API。
  - 创建临时学校管理员 `school_zju`，绑定 `sch_114` 浙江大学。
  - 插入两条资源审核任务：`smoke_resource_zju` 属于 `sch_114`，`smoke_resource_other` 属于 `sch_1`。
  - 平台管理员 `scope=platform`，能按 `schoolId=sch_114` 和 `schoolId=sch_1` 分别看到对应任务。
  - 学校管理员 `scope=school`、`schoolId=sch_114`，默认只能看到 `smoke_resource_zju`。
  - 学校管理员即使请求 `schoolId=sch_1`，仍只返回 `smoke_resource_zju`。
  - 学校管理员尝试审核 `smoke_resource_other` 返回 403。
  - 冒烟结束后已删除临时 SQLite 文件。

### 线上部署与验收

- 新发布包：
  - `.deploy/campus-growth-20260708105926.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708105926.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 执行：
  - `bash /tmp/deploy-commercial-release.sh 20260708105926`
- 服务器当前指向：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708105926`
- 服务状态：
  - `systemctl is-active campus-growth-api` 返回 `active`。
- 线上健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 后台未登录检查：
  - `https://campusgrow.top/api/admin/me` 返回 401，符合预期。
- 学校接口检查：
  - `https://campusgrow.top/api/schools?keyword=%E6%B5%99%E6%B1%9F%E5%A4%A7%E5%AD%A6&limit=2` 返回 `sch_114` 浙江大学和 `sch_3429` 浙江大学医学院。
- 后台入口检查：
  - `https://campusgrow.top/admin` 返回 200。
  - `https://campusgrow.top/admin/moderation` 返回 200。

### 注意事项

- 当前没有做管理员账号管理页面。学校管理员先通过脚本创建，后续如果学校运营规模扩大，再做平台总后台的管理员管理界面。
- 学校管理员拥有审核权限，不拥有首页配置写权限；这是为了保证每个学校的内容自治，同时平台首页仍由总后台统一控制。
- 平台公共内容 `school_id` 为空时，学校管理员默认不可见；这符合“同校空间隔离”原则。若后续希望学校管理员能审核平台公共投稿，需要单独设计权限。
- 真实邮件/短信发送下一步应实现 `VerificationSender`，并补发送限流表或复用验证码表做频率控制。

## 2026-07-08 上线前完整性复查、后端加固与生产验收

### 本次目标

- 回答“除邮件和短信外是否已经完成、用户是否可以正常使用”。
- 做上线前复查，优先修复会影响内测的后端安全和部署问题。
- 部署新版本并完成线上 API、页面、管理员闭环验收。

### 发现的问题

- 线上旧 release 为 `/opt/campus-growth/releases/20260708105926`，健康检查正常，但本地新修复尚未部署。
- 后端上传接口没有文件类型白名单：
  - `/api/uploads/resource-file` 可接受任意扩展和 MIME。
  - `/api/admin/home-config/hero-image` 可接受 SVG/HTML 等不适合直接作为运营图的内容。
- 管理员登录、微信登录、学校验证码发送/校验没有应用层限流。
- 部署脚本复用上一版 `node_modules` 时会形成多层符号链接。新 release `20260708112712` 首次启动失败，日志为 `sh: tsx: command not found` 和 `Too many levels of symbolic links`。
- 社区公开列表为空，原因是官方经验帖被学校回填为浙江大学内容，未登录或其他学校上下文不可见。
- 组队公开列表仍为空。这里保留为真实队长发布，不抓取或伪造带联系方式的组队信息。

### 代码改动

- `server/index.ts`
  - 新增上传白名单：
    - 首页运营图仅允许 JPG、PNG、WebP，最大 5MB，并校验图片文件头。
    - 资料文件允许 PDF、Office、图片、TXT、CSV、Markdown、ZIP，最大 30MB。
  - 对上传错误增加友好业务返回：415 类型不支持、413 文件过大。
  - 新增应用层限流：
    - 微信登录：10 分钟 30 次。
    - 管理员登录：15 分钟 10 次。
    - 学校验证码发送：10 分钟 5 次。
    - 学校验证码校验：10 分钟 20 次。
  - 保持 CORS 白名单逻辑，未知 Origin 的 OPTIONS 返回 403。
- `server/storage-service.ts`
  - 首页图片读取不再把未知扩展默认当成 JPEG。
  - 移除 SVG/GIF/AVIF 的首页图片 Content-Type 推断，降低脚本型图片风险。
- `scripts/deploy-commercial-release.sh`
  - 复用依赖时使用 `readlink -f` 解析真实 `node_modules` 路径，避免链式 symlink 循环。
- `scripts/smoke-admin-miniapp-closure.ts`
  - smoke 用户补齐 `users.school_id` 和 `user_school_memberships`，适配学校认证后的发布要求。
  - 审核通过后的可见性断言改为“同校用户可见”，不再误判为全公开。
- `scripts/sync-beta-content.ts`
  - 官方经验/资讯索引强制 `school_id=NULL`，作为平台公共内容。
- `scripts/sync-competition-news.ts`
  - 官方新闻同步更新/插入同样保持 `school_id=NULL`。

### 本地验证

- `npm.cmd run lint` 通过。
- `npm.cmd run typecheck:frontend` 通过。
- `npm.cmd run build:frontend` 通过。
- `npm.cmd audit --audit-level=high --registry=https://registry.npmjs.org` 通过 high 阈值；仅剩 `esbuild` 低危开发服务器问题，不进入生产运行路径。
- 隔离 API 冒烟：
  - `GET /api/health` 正常。
  - 允许 Origin `https://campusgrow.top` 的 CORS 预检返回 204。
  - 未知 Origin 的 CORS 预检返回 403。
  - 管理员错误登录第 11 次返回 429。
  - HTML 资料上传返回 415。
  - PDF 资料上传成功。
  - SVG 首页图片上传返回 415。
  - 学校验证码第 6 次发送返回 429。
- Playwright 线上页面检查：
  - 390x844 移动端和 1280x800 桌面端检查 `/`、`/competitions`、`/resources`、`/teams`、`/community`、`/schools`、`/school-verify`、`/admin/login`、`/admin/moderation`。
  - 全部 200、无 console error、无横向溢出。

### 部署与线上修复

- 新发布包：
  - `.deploy/campus-growth-20260708112712.tar.gz`
- 服务器当前指向：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708112712`
- 首次部署问题：
  - API 启动失败，原因是 `node_modules` 多层 symlink 形成循环，npm 找不到 `tsx`。
  - 已手动修复当前 release：`/opt/campus-growth/releases/20260708112712/node_modules -> /opt/campus-growth/releases/20260405103753/node_modules`。
  - 已修复本地和服务器当前 release 的部署脚本，后续不会继续链接到上一版 symlink。
- 线上健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 入口检查：
  - `http://campusgrow.top/` 返回 301 到 `https://campusgrow.top/`。
  - `https://campusgrow.top/` 返回 200。
  - HTTPS 响应包含 HSTS、`X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy`。
- CORS 检查：
  - `Origin: https://campusgrow.top` 预检返回 204 并回显 Origin。
  - `Origin: https://evil.example` 预检返回 403。

### 生产闭环 smoke

- 在服务器使用 systemd 同一份环境文件运行：
  - `/usr/local/bin/node ./node_modules/tsx/dist/cli.mjs scripts/smoke-admin-miniapp-closure.ts`
- 结果通过：
  - 发帖提交后隐藏，审核 processing 仍隐藏，审核 approved 后同校可见。
  - 评论提交后隐藏，审核 approved 后同校可见。
  - 组队发布后隐藏，审核 approved 后同校可见。
  - 组队申请提交后，队长通过，申请人可见联系方式。
  - 资源上传、投稿、审核、收藏、免费领取闭环通过。
  - 举报提交、后台处理、状态 resolved 通过。
  - 审核通知可送达。
  - smoke 测试数据已自动清理。

### 内容补充

- 执行官方内容同步：
  - `scripts/sync-beta-content.ts --apply`
  - 更新竞赛 85 条。
  - 更新资源 33 条。
  - 更新官方经验/资讯 8 条。
- 执行精选内容审批：
  - `scripts/approve-beta-content.ts`
  - 精选资源和经验帖已为 approved。
  - 首页配置状态为 online。
- 线上复查：
  - `/api/posts?limit=8` 返回 8 篇官方经验帖。
  - `/api/feeds/home` 返回精选竞赛、资源和帖子。
  - `/community` 移动端页面不再是空态。

### 当前上线判断

- 除真实邮件/短信发送外，核心用户路径和管理后台闭环已经可以支撑内测：
  - 浏览竞赛、资料、社区内容。
  - 微信登录服务端处于 real 模式。
  - 选学校、同校隔离、发布帖子/组队/资源、后台审核、举报处理、通知、免费资源领取闭环通过。
  - 管理后台 school filter 和 school_admin 权限已接入。
- 不能宣称“正式全量商用完全完成”：
  - 邮件/短信未接入，学校认证验证码无法真实送达。
  - 本次没有在微信真机上重新扫码验证 `wx.login -> web-view -> API`，需要用户在微信开发者工具/真机预览再走一遍。
  - 组队内容仍为空，不建议伪造带联系方式的组队信息。首批内测应让真实队长发布，管理员批量审核。
  - 部署依赖仍复用旧 release 的 `node_modules`，短期已可运行，长期应改成固定共享依赖目录或每个 release 安装依赖。

### 下一步建议

1. 接入阿里云短信和邮件推送，实现真实 `VerificationSender`。
2. 真机小程序预览走一遍：登录、选校、发帖、组队发布、资源领取、举报、后台审核。
3. 首批招募 3-5 个真实队长发布组队招募，由管理员批量通过，避免组队大厅空。
4. 把发布脚本改成部署前检查真实 `node_modules`，或在服务器建立 `/opt/campus-growth/shared/node_modules`。

## 2026-07-08 微信真机预览二维码

## 2026-07-08 微信登录确认、列表返回缓存与预览二维码更新

### 本轮目标

- 回答并验证微信登录是否已经接入。
- 修复用户从竞赛/资源/社区/组队列表进入详情后返回时重新加载、滚动位置丢失的问题。
- 将修复部署到线上 `https://campusgrow.top`，再生成微信真机预览二维码，避免手机预览仍看到旧版本。

### 关键结论

- 微信登录不是发布后自动接入，当前项目已显式接入：
  - `wechat-shell/pages/webview/index.js` 通过 `wx.login` 获取 code。
  - 小程序壳将 `mp_login_code` 带入 `https://campusgrow.top`。
  - `frontend/src/app/components/WechatMiniProgramLoginBridge.tsx` 读取 code，并调用 `/api/auth/wechat/login`。
  - 线上 `/api/health` 显示 `wechatLoginMode=real`，具备真实微信登录模式。
- 本地默认无 `.env` 时是 `hybrid`，仅用于本地开发；线上仍以 `/etc/campus-growth/api.env` 为准。

### 修改内容

- 新增前端轻量缓存：
  - `frontend/src/app/lib/query-cache.ts`
  - 支持内存 + `sessionStorage`，默认 5 分钟 TTL。
  - 缓存键覆盖首页、竞赛列表/详情、资源列表/详情、帖子列表/详情、组队列表/详情等主路径。
- 更新请求状态 hook：
  - `frontend/src/app/hooks/useRequestState.ts`
  - 支持 `cacheKey`、`cacheTtlMs`、`forceRefresh`、`revalidate`。
  - 有缓存时先渲染缓存，避免返回列表出现加载卡片。
- 登录/学校切换时清理缓存：
  - `frontend/src/app/lib/app-service.ts`
  - `frontend/src/app/lib/http.ts`
  - 登录、退出、切换学校、认证成功、401 失效都会清除前端内容缓存，避免跨用户或跨学校串数据。
- 微信 web-view 登录兜底：
  - `frontend/index.html` 增加微信 JSSDK。
  - `frontend/src/app/lib/quick-login.ts` 在 `window.wx.login` 不可用时，通过 `wx.miniProgram.redirectTo/navigateTo/reLaunch` 回到壳页面重新获取 code。
- 列表页缓存和详情预热：
  - `frontend/src/app/pages/Competitions.tsx`
  - `frontend/src/app/pages/Resources.tsx`
  - `frontend/src/app/pages/Community.tsx`
  - `frontend/src/app/pages/Teams.tsx`
  - 列表请求成功后预热对应详情缓存。
- 详情页先用缓存、再静默刷新：
  - `frontend/src/app/pages/CompetitionDetail.tsx`
  - `frontend/src/app/pages/ResourceDetail.tsx`
  - `frontend/src/app/pages/PostDetail.tsx`
  - `frontend/src/app/pages/TeamDetail.tsx`
- 修复滚动记忆覆盖：
  - `frontend/src/app/components/Layout.tsx`
  - 用户返回列表时恢复原 scrollY。
  - 恢复定时器在用户滚动/触摸/点击/键盘操作后取消，避免把页面拉回旧位置。
  - 离开列表后如果详情页高度导致 scrollY 被夹到较小非零值，不再覆盖真实列表位置。

### 本地验证

- `npm run typecheck:frontend` 通过。
- `npm run build:frontend` 通过。
- `npm run lint` 通过。
- 本地 API：
  - `http://127.0.0.1:8080/api/health` 正常。
  - 本地无 `.env`，显示 `databaseProvider=sqlite`、`storageProvider=local`、`wechatLoginMode=hybrid`、`paymentsEnabled=false`。
- Playwright 390x844 本地验证：
  - 竞赛列表滚动到 `scrollY=1260`。
  - 点击可见竞赛卡片进入详情。
  - 返回后仍为 `scrollY=1260`。
  - 未出现“正在加载竞赛列表”。
  - 文档宽度 `375`，视口 `390`，无横向溢出。
- 本地资源、社区、组队列表当前为空，未能做详情返回数据流验证；对应代码路径已接入同一缓存和滚动机制。

### 线上部署

- 新发布包：
  - `.deploy/campus-growth-20260708140821.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708140821.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 执行：
  - `bash /tmp/deploy-commercial-release.sh 20260708140821`
- 当前线上 release：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708140821`
- 线上 node_modules：
  - `/opt/campus-growth/current/node_modules -> /opt/campus-growth/releases/20260405103753/node_modules`

### 线上验收

- `https://campusgrow.top/` 返回 200。
- `https://campusgrow.top/api/health` 返回：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- Playwright 390x844 线上验证：
  - 路径：`https://campusgrow.top/competitions`
  - 点击前 `scrollY=1260`
  - 进入详情：`/competitions/wl_structural_design`
  - 返回后 300ms 和 1700ms 均为 `scrollY=1260`
  - 未出现“正在加载竞赛列表”
  - fetch 记录只有详情相关接口：
    - `/api/competitions/wl_structural_design`
    - `/api/competitions/wl_structural_design/resources`
    - `/api/competitions/wl_structural_design/teams`
  - 没有重新请求竞赛列表接口。
  - 文档宽度 `375`，视口 `390`，无横向溢出。

### 微信预览二维码

- 微信开发者工具安装路径：
  - `D:\Program Files (x86)\Tencent\微信web开发者工具\`
- 使用已运行 IDE server 端口：
  - `63746`
- 生成命令：
  - `cli.bat preview --project D:\github\zhejiang-competiton\wechat-shell --qr-format image --qr-output D:\github\zhejiang-competiton\output\wechat-preview\campus-growth-preview-20260708140821.png --info-output D:\github\zhejiang-competiton\output\wechat-preview\campus-growth-preview-20260708140821.json --port 63746`
- 二维码文件：
  - `output/wechat-preview/campus-growth-preview-20260708140821.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708140821.json`
  - 包体积 `2561` bytes。

### 后续建议

1. 用真机扫码后重点验证：微信授权登录、学校选择/认证、竞赛详情返回列表位置、底部导航固定、是否还有横向滑动。
2. 生产资源、社区、组队列表如果仍为空，需要继续同步/审核内容，否则内测用户会感觉平台没有内容。
3. 如果真机里某些受保护操作提示“不在微信小程序内登录”，优先检查微信 JSSDK 是否被 web-view 正常加载，以及小程序业务域名是否仍为 `https://campusgrow.top`。

### 本次操作

- 使用微信开发者工具 CLI 为小程序壳生成真机预览二维码。
- 小程序项目路径：
  - `D:\github\zhejiang-competiton\wechat-shell`
- AppID：
  - `wxda8641cd650537a4`
- 生成命令：
  - `cli.bat preview --project D:\github\zhejiang-competiton\wechat-shell --qr-format image --qr-output D:\github\zhejiang-competiton\output\wechat-preview\preview-20260708114333.png`

### 结果

- CLI 成功启动 IDE server，并完成 preview。
- 预览码文件：
  - `D:\github\zhejiang-competiton\output\wechat-preview\preview-20260708114333.png`
- 文件大小：
  - `46215` bytes

### 后续

- 该二维码会过期，用户需要尽快使用微信扫码预览。
- 真机预览时重点验证：
  - 微信登录是否正常进入 H5。
  - 首页、竞赛、资料、组队、社区、我的页面是否可浏览和返回。
  - 选校、发帖、组队发布、资源领取、举报、后台审核闭环是否符合内测要求。

## 2026-07-08 14:35 浮动发布入口与上线前判断

### 本次目标

- 修复组队页右下角发布加号被底部菜单栏遮挡的问题。
- 在资源页补充与组队页一致的浮动发布入口。
- 对当前版本是否可内测、是否可提交微信审核做上线前判断。

### 修改内容

- `frontend/src/app/components/ui.tsx`
  - 新增并统一使用 `floatingCreateButtonClass`。
  - 将浮动按钮位置调整为 `bottom-[calc(env(safe-area-inset-bottom)+8.25rem)]`，避免被微信底部安全区和应用底部导航遮挡。
- `frontend/src/app/pages/Teams.tsx`
  - 组队发布按钮改用统一浮动按钮样式。
- `frontend/src/app/pages/Community.tsx`
  - 社区发布按钮同步使用统一样式，保持底部交互一致。
- `frontend/src/app/pages/Resources.tsx`
  - 新增右下角“发布资源”浮动加号，跳转 `routes.publishResource`。
  - 移除顶部筛选区里的文字“投稿”入口，只保留“我的投稿”，降低顶部拥挤感。

### 本地验证

- `npm run typecheck:frontend` 通过。
- `npm run build:frontend` 通过。
- `npm run lint` 通过。
- 本地 390x844 视口 Playwright 检查：
  - `/teams`：文档宽度 `390`，无横向溢出；加号底边 `712`，底部导航顶边 `766.5`，间距 `54.5px`。
  - `/resources`：文档宽度 `390`，无横向溢出；加号底边 `712`，底部导航顶边 `766.5`，间距 `54.5px`。

### 线上部署

- 新 release：
  - `.deploy/campus-growth-20260708143545.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708143545.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 执行命令：
  - `bash /tmp/deploy-commercial-release.sh 20260708143545`
- 当前线上版本：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708143545`

### 线上验收

- `https://campusgrow.top/` 返回 200。
- `http://campusgrow.top/` 返回 301 到 `https://campusgrow.top/`。
- `https://campusgrow.top/api/health` 返回：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上 390x844 视口 Playwright 检查：
  - `https://campusgrow.top/teams`：文档宽度 `390`，无横向溢出；加号底边 `712`，底部导航顶边 `766.5`，间距 `54.5px`。
  - `https://campusgrow.top/resources`：文档宽度 `390`，无横向溢出；加号底边 `712`，底部导航顶边 `766.5`，间距 `54.5px`。
- 留档截图：
  - `output/playwright/production-teams-plus-20260708143545.png`
  - `output/playwright/production-resources-plus-20260708143545.png`

### 微信预览

- 使用微信开发者工具 CLI 生成新预览码：
  - `D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat preview --project D:\github\zhejiang-competiton\wechat-shell --qr-format image`
- 小程序壳 AppID：
  - `wxda8641cd650537a4`
- 预览码：
  - `output/wechat-preview/campus-growth-preview-20260708143545.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708143545.json`
  - 包体积 `2561` bytes。

### 上线判断

- 当前版本可以继续做真机内测和小范围邀请体验。
- 不建议今天直接提交微信正式审核，除非先完成并记录一轮真机闭环验收。
- 审核前必须确认：
  - 微信后台 request 合法域名、业务域名均已配置为 `https://campusgrow.top`。
  - 真实微信登录、学校选择、学校认证、资源领取、发帖、组队发布、举报、后台审核、管理员登录均通过真机测试。
  - 隐私政策、用户协议、个人信息收集说明和账号注销/联系渠道已补齐。
  - 教育邮箱验证码和短信服务如果尚未接入真实服务，需要在产品内避免承诺“已发送真实验证码”，或先关掉强依赖入口。
  - 组队大厅当前线上仍缺少真实招募内容，内测吸引力不足，需要继续补充或邀请种子用户发布。

### 后续任务

1. 用新二维码做真机冒烟，重点看浮动加号、底部导航、返回滚动记忆、微信登录和横向滑动。
2. 补齐学校认证的真实邮件/短信服务，优先走阿里云邮件推送或 DirectMail + 短信服务。
3. 给组队大厅补充真实审核通过的招募内容，避免新用户进入后看到空页。
4. 提交微信审核前整理一份验收记录，包含截图、操作路径、通过/失败项和待修复项。

## 2026-07-08 15:05 线上完整闭环测试与资源公开修复

### 用户反馈

- 用户反馈当前界面中很多功能无法使用，要求检查并跑一轮完整闭环：
  - 登录
  - 浏览
  - 收藏
  - 免费资源获取
  - 发帖
  - 组队发布
  - 举报
  - 后台审核

### 后端 API 闭环

- 在服务器 `/opt/campus-growth/current` 使用线上环境变量运行：
  - `SMOKE_API_BASE_URL=https://campusgrow.top/api npm exec --yes tsx scripts/smoke-admin-miniapp-closure.ts`
- 结果通过，覆盖：
  - 发帖提交、待审隐藏、处理中隐藏、审核通过后同校可见。
  - 评论提交、审核通过后可见。
  - 组队发布、审核通过后同校可见。
  - 组队申请、队长通过、申请人可见联系方式。
  - 资源上传、投稿、审核通过、同校可见、收藏、免费领取。
  - 举报提交、后台处理、举报 resolved。
  - 审核通知。

### 发现的问题

- UI 闭环首次跑到资源领取时失败：
  - 资源投稿已成功提交并在后台审核通过。
  - 作者在“我的投稿”能看到。
  - 但同校普通用户调用 `/api/resources?keyword=...&priceType=免费` 查不到该资源。
- 根因：
  - `server/catalog-service.ts` 的 `isResourcePublicInCurrentCommercialPhase` 只判断 `row.type` 是否在公开集合中。
  - 用户投稿页的 `type` 是 `PDF / PPT / TXT` 这类文件类型。
  - 真正的资源公开分类在 `row.category`，例如 `资料包`。
  - 因此用户投稿资源即使审核通过，也只对作者可见，导致普通用户无法收藏和免费领取。

### 修复内容

- 修改 `server/catalog-service.ts`：
  - 资源公开判断从只看 `row.type` 改为同时接受 `row.type` 或 `row.category` 命中公开资源集合。
  - 修复后，审核通过的免费投稿资源可以被同校用户在资源列表中看到。

### 验证

- 本地验证：
  - `npm run typecheck:frontend` 通过。
  - `npm run build:frontend` 通过。
  - `npm run lint` 通过。
- 线上部署：
  - 新 release：`20260708145718`
  - 当前线上：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260708145718`
  - `https://campusgrow.top/api/health` 返回：
    - `databaseProvider=postgres`
    - `storageProvider=s3`
    - `wechatLoginMode=real`
    - `paymentsEnabled=false`
- 修复后复测：
  - 同校申请人可通过资源列表接口查到审核通过的投稿资源。
  - 再跑 UI 完整闭环，结果通过。

### UI 完整闭环结果

- 使用 Playwright + 临时线上测试用户跑通：
  - 浏览首页、竞赛、资源、社区、组队、我的。
  - 发布帖子并进入待审详情。
  - 发布组队并进入待审详情。
  - 投稿资源并进入“我的投稿”。
  - 管理后台分别审核通过帖子、组队、资源。
  - 同校用户进入帖子详情，收藏帖子并提交举报。
  - 同校用户进入资源详情，收藏资源并免费领取。
  - 同校用户在组队列表看到审核通过的组队。
  - 管理后台处理举报并确认成立。
- UI 测试结果文件：
  - `output/ui-smoke/result-2026-07-08T06-58-36-681Z.json`
- 留档截图：
  - `output/ui-smoke/browse-profile-2026-07-08T06-58-36-681Z.png`
  - `output/ui-smoke/resource-submission-pending-2026-07-08T06-58-36-681Z.png`
  - `output/ui-smoke/admin-moderation-approved-2026-07-08T06-58-36-681Z.png`
  - `output/ui-smoke/resource-acquired-2026-07-08T06-58-36-681Z.png`
  - `output/ui-smoke/team-visible-2026-07-08T06-58-36-681Z.png`
  - `output/ui-smoke/admin-report-resolved-2026-07-08T06-58-36-681Z.png`

### 清理

- UI 冒烟测试创建的临时用户、会话、帖子、组队、资源、举报均已清理。
- 早先失败时残留的 `cg_ui_*` 测试用户也已列出并清理。
- 删除服务器 `/tmp/ui-smoke-session.json` 和 `/tmp/ui-smoke-session.ts`，避免临时 token 留在服务器临时目录。
- 删除本地 `output/ui-smoke/session.json`，避免临时 token 留在工作区。

### 仍需注意

- 本轮已验证“已登录状态下”的前端和后端闭环。
- 真正的微信 `wx.login -> code2Session -> H5 写入登录态` 仍需要用微信真机扫码最终确认，因为浏览器无法生成真实小程序 `code`。
- 提交微信审核前，需要至少一次真机验证登录、选校、认证入口、发布、审核后的同校可见性。

### 新微信预览码

- 生成时间：2026-07-08 15:08。
- 小程序 AppID：`wxda8641cd650537a4`。
- 二维码：
  - `output/wechat-preview/campus-growth-preview-20260708145718.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708145718.json`
  - 包体积 `2561` bytes。

## 2026-07-08 15:27 微信小程序开发版本上传

### 用户反馈

- 用户反馈真实微信登录链路 `wx.login -> code2Session -> H5 写入登录态` 仍然不稳定，询问是否需要上传到小程序后台。
- 结论：
  - `wx.login` 不必须正式发布后才可用，开发者工具真机预览和体验版通常也可以拿到 code。
  - 但上传为微信后台开发版本并设为体验版，更接近正式环境，适合做内测登录验证。

### 使用的本地微信小程序 skill

- 已读取并参考：
  - `wxa-skills-generate`
  - `wxa-skills-validate`
  - `wxa-skills-eval`
- 说明：
  - 这些 skill 主要面向“小程序 AI Skill / wx.modelContext”产物。
  - 当前项目 `wechat-shell` 是普通 `web-view` 小程序壳，没有 `agent.skills` 分包，因此不走 AI Skill 生成/execute/render 流程。
  - 本次实际可复用的是微信开发者工具 CLI 的预览、构建和上传流程。

### 上传前检查

- `wechat-shell/project.config.json`
  - `appid=wxda8641cd650537a4`
  - `compileType=miniprogram`
  - `urlCheck=true`
- `wechat-shell/app.js`
  - `webOrigin=https://campusgrow.top`
- `wechat-shell/pages/webview/index.js`
  - `wx.login` 成功后把 `mp_login_code` 注入 H5 URL。
- 线上域名：
  - `https://campusgrow.top/api/health` 正常。
  - `https://campusgrow.top/djVGWes8Fi.txt` 返回 200，业务域名校验文件可公网访问。
- 服务器微信配置：
  - `WECHAT_APP_ID=wxda8641cd650537a4`
  - `WECHAT_LOGIN_MODE=real`
  - `API_PUBLIC_ORIGIN=https://campusgrow.top`
  - `WECHAT_APP_SECRET` 存在，长度 32，未在日志中暴露明文。

### 微信开发者工具 CLI

- 登录状态：
  - `cli.bat islogin` 返回 `{"login":true}`。
- 预览编译：
  - `cli.bat preview --project D:\github\zhejiang-competiton\wechat-shell ...` 通过。
  - 包体积 `2561` bytes。
- 上传命令：
  - `cli.bat upload --project D:\github\zhejiang-competiton\wechat-shell -v 0.1.8 -d "内测版：真实登录与完整闭环修复 20260708145718"`
- 上传结果：
  - `upload` 成功。
  - 开发版本包体积 `2634` bytes。
  - 上传信息文件：`output/wechat-preview/upload-20260708145718.json`。

### 下一步

1. 登录微信公众平台，在“版本管理 / 开发版本”中找到版本 `0.1.8`。
2. 先设置为体验版，添加体验成员后真机测试。
3. 真机重点验证：
   - 小程序启动后是否自动进入 `https://campusgrow.top`。
   - 是否完成真实微信登录并进入已登录状态。
   - 登录后能否选校、浏览、收藏、免费领取、发帖、组队发布、举报。
4. 如果体验版登录仍失败，下一步查看服务器日志中 `/api/auth/wechat/login` 的 `code2Session` 错误信息，重点排查：
   - 微信后台 request 合法域名和 web-view 业务域名是否都含 `https://campusgrow.top`。
   - AppSecret 是否与当前 AppID 匹配。
   - 体验成员是否使用该 AppID 对应小程序扫码。

## 2026-07-08 17:25 个人信息、头像昵称引导与轻量签到积分

### 用户反馈

- 用户希望个人资料页参考朵朵校友圈：头像、昵称、学校、手机号、校园认证、数字 ID 等以列表形式展示。
- 用户希望微信登录后的首次资料补充参考截图，只先填写头像和昵称，学校与其他信息后续在个人主页补充。
- 用户希望签到模块简单，不做复杂兑换；当前只增加积分，后续积分可用于广告、礼品兑换或抽奖。

### 本次决策

- 签到一期只做“每日签到 +5 积分”和连续签到天数，不接入兑换券、商城、抽奖消耗或支付相关逻辑，避免上线前引入新的交易闭环。
- 数据库只新增 `users.points`、`users.checkin_streak`、`users.last_checkin_date` 和 `point_ledger` 积分流水表。
- H5 web-view 不能直接使用小程序原生 `button open-type="chooseAvatar"`。本次在 H5 里提供头像链接可选项和昵称保存；真正的微信头像授权后续应在 `wechat-shell` 增加原生资料页，再把昵称/头像同步给 H5。

### 代码改动

- 后端：
  - 新增 `server/checkin-service.ts`，按 `Asia/Shanghai` 自然日计算签到。
  - `GET /api/users/me/checkin` 返回积分、连续签到、本月签到日期和日历。
  - `POST /api/users/me/checkin` 首次签到加 5 分，重复签到返回 0 分，不重复写积分。
  - `server/db.ts` 新增用户积分列、签到日期列、`point_ledger` 表和签到日期唯一索引。
  - `server/helpers.ts` 的用户统计返回 `points`、`checkinStreak`。
- 前端：
  - 新增 `frontend/src/app/pages/Checkin.tsx`，包含积分概览、今日签到按钮、本月日历、轻量权益入口。
  - `frontend/src/app/lib/api.ts`、`frontend/src/app/lib/app-service.ts` 接入签到 API，签到成功后同步本地 session 用户。
  - `frontend/src/app/routes.tsx`、`frontend/src/app/lib/routes.ts` 新增 `/checkin`。
  - `frontend/src/app/pages/Profile.tsx` 改为列表式“我的”页，加入积分和签到入口，减少大卡片和冗余文字。
  - `frontend/src/app/pages/AccountSettings.tsx` 改为“个人信息”列表页，包含头像、昵称、学校、年级、专业、手机号、校园认证、数字 ID。
  - `frontend/src/app/components/onboarding/OnboardingGate.tsx` 将首次资料补充改为头像昵称面板，并保留简短公告和选校引导。
  - `frontend/src/types/entities.ts`、`frontend/src/types/api.ts` 收窄签到/积分类型，移除未进入一期的兑换中心类型。
  - `frontend/src/data/mock.ts` 补齐积分相关 mock 字段。

### 本地验证

- 静态验证通过：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `npm run build:frontend`
- 临时本地 API：
  - 使用 `API_PORT=8094`、`DB_PATH=server/data/checkin-smoke.db`、`WECHAT_LOGIN_MODE=mock` 启动。
  - `/api/auth/wechat/login` 登录临时用户。
  - `/api/users/me/checkin` 首次返回 0 分。
  - 首次 `POST /api/users/me/checkin` 后积分为 5、`awardedPoints=5`、连续签到为 1。
  - 再次 `POST /api/users/me/checkin` 返回 `awardedPoints=0`，不重复加分。
- Playwright 移动端验证：
  - 390x844 检查 `/profile`、`/account-settings`、`/checkin`。
  - 三个页面 `bodyScrollWidth=390`、`documentScrollWidth=390`，没有横向溢出。
  - 未发现低于 40px 的按钮/链接/输入框触控目标。
  - 点击签到后页面即时从 0 分变为 5 分，按钮变为“今日已签到”，当天日历格标记为已签到。
  - 浏览器控制台无 error/warning，仅有 React DevTools info。
- 留档截图：
  - `output/playwright/checkin-profile-20260708/profile-390.png`
  - `output/playwright/checkin-profile-20260708/account-settings-390.png`
  - `output/playwright/checkin-profile-20260708/checkin-390.png`
  - `output/playwright/checkin-profile-20260708/checkin-after-390.png`

### 注意事项

- 本次尚未部署到线上前，线上用户看不到新签到页和个人信息页改版。
- 如果要让用户真正“一键使用微信头像”，下一步不是继续改 H5，而是改 `wechat-shell` 原生层：新增资料授权页，使用 `open-type="chooseAvatar"` 和昵称输入，再把数据传给 H5 或直接调用后端身份接口。
- 积分当前只做积累，不做兑换、抽奖消耗、排行榜或广告权益；这些应等内测验证用户活跃后再设计。

## 2026-07-08 17:45 签到与个人资料改版线上部署、生产烟测和微信预览

### 本次目标

- 将头像昵称引导、个人信息页、我的页和轻量签到积分模块部署到线上。
- 验证线上 PostgreSQL 迁移、签到接口、原有发布/审核/资源/举报闭环没有被破坏。
- 生成新的微信真机预览二维码，方便用户扫码检查真实小程序壳体验。

### 线上部署

- 使用已生成 release 包：
  - `.deploy/campus-growth-20260708172410.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708172410.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 执行：
  - `bash /tmp/deploy-commercial-release.sh 20260708172410`
- 当前线上版本：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708172410`
- 服务状态：
  - `systemctl is-active campus-growth-api` 返回 `active`。
- 线上健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

### 生产验证

- 页面检查：
  - `https://campusgrow.top/profile` 返回 200。
  - `https://campusgrow.top/account-settings` 返回 200。
  - `https://campusgrow.top/checkin` 返回 200。
- Playwright 390x844 移动端检查：
  - `/profile`、`/account-settings`、`/checkin` 的 `bodyScrollWidth` 与 `documentScrollWidth` 均为 390。
  - 三个页面 `overflowCount=0`，没有横向溢出元素。
  - 三个页面 `smallTargets=0`，未发现低于 40px 的触控目标。
  - 控制台 `Errors: 0, Warnings: 0`。
- 留档截图：
  - `output/playwright/checkin-profile-production-20260708172410/profile-390.png`
  - `output/playwright/checkin-profile-production-20260708172410/account-settings-390.png`
  - `output/playwright/checkin-profile-production-20260708172410/checkin-390.png`

### 线上闭环烟测

- 运行服务器生产闭环脚本：
  - `SMOKE_API_BASE_URL=https://campusgrow.top/api npm exec --yes tsx scripts/smoke-admin-miniapp-closure.ts`
- 结果通过，覆盖：
  - 发帖提交、隐藏、审核通过后同校可见。
  - 评论提交、审核后可见。
  - 组队发布、后台审核、组队申请、队长通过、申请人可见联系方式。
  - 资源上传、投稿、审核通过、收藏、免费领取。
  - 举报提交、后台处理、通知。
- 单独签到生产烟测通过：
  - 临时创建已认证用户和会话。
  - `GET /api/users/me/checkin` 初始积分为 0，今日奖励为 5。
  - 首次 `POST /api/users/me/checkin` 后积分为 5，`awardedPoints=5`。
  - 重复 `POST /api/users/me/checkin` 后 `awardedPoints=0`，积分仍为 5。
  - `point_ledger` 仅有一条签到流水。
  - 临时用户、会话、学校会员和积分流水已清理。

### 微信预览

- 微信开发者工具登录状态：`login=true`。
- 生成命令：
  - `cli.bat preview --project D:\github\zhejiang-competiton\wechat-shell --qr-format image --qr-output D:\github\zhejiang-competiton\output\wechat-preview\campus-growth-preview-20260708172410.png --info-output D:\github\zhejiang-competiton\output\wechat-preview\campus-growth-preview-20260708172410.json --port 63746`
- 预览码：
  - `output/wechat-preview/campus-growth-preview-20260708172410.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708172410.json`
  - 包体积 `2561` bytes。

### 后续建议

- 本次是 H5 和 API 改动，`wechat-shell` 未变；正式内测前可直接用新预览码真机检查最新线上页面。
- 如果用户坚持使用微信头像一键授权，下一步应改小程序原生壳，使用 `button open-type="chooseAvatar"` 和昵称输入，再同步到后端。
- 积分目前只积累，不做兑换、抽奖消耗和广告权益；这些不应在内测前临时接入，避免引入新审核和运营风险。

## 2026-07-08 18:27 头像更换改为手机相册上传

### 用户反馈

- 用户指出头像更换应该从手机本地相册上传，不应该让用户填写图片链接。

### 本次修改

- 后端：
  - `server/storage-service.ts` 新增头像图片存储与读取能力，复用 local/S3 存储抽象。
  - `server/index.ts` 新增 `POST /api/uploads/avatar`，要求登录后上传头像图片。
  - `server/index.ts` 新增 `GET /api/uploads/avatars/:fileName`，用于读取头像图片。
  - 头像上传限制：JPG、PNG、WebP，最大 3 MB，并校验图片文件头，避免仅靠扩展名判断。
- 前端：
  - `frontend/src/app/pages/AccountSettings.tsx` 删除“头像链接”输入，改为“从相册选择”。
  - `frontend/src/app/components/onboarding/OnboardingGate.tsx` 删除首次资料引导里的“头像链接”输入，改为本地图片选择。
  - `frontend/src/app/lib/api.ts` 新增 `uploadUserAvatarImage(file)`。
  - `frontend/src/app/lib/app-service.ts` 导出头像上传 API。
  - `frontend/src/types/api.ts` 新增 `AvatarImageUploadResult`。
  - 修复个人信息页在登录态异步更新后打开编辑弹层时昵称状态不同步的问题：打开编辑器时重新从当前用户同步昵称和头像。

### 本地验证

- 静态检查通过：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `npm run build:frontend`
- 本地 API 头像上传烟测通过：
  - mock 登录后上传 `frontend/public/school-logos/zju.png`。
  - `POST /api/uploads/avatar` 返回 `/api/uploads/avatars/...png`。
  - `PATCH /api/users/me/identity` 保存头像后，`/api/users/me` 中头像地址更新。
  - 头像 URL 可访问，返回 200。
- Playwright 本地移动端验证：
  - 页面：`/account-settings`，390x844。
  - 弹层中不再出现“头像链接”。
  - 弹层出现“从相册选择”，file input `accept=image/jpeg,image/png,image/webp`。
  - 上传本地 PNG 后头像预览切换到 `/uploads/avatars/...`。
  - 保存后个人信息页头像更新。
  - 无横向溢出、无过小触控目标、控制台无 error。
  - 截图：
    - `output/playwright/avatar-upload-20260708/account-settings-sheet-390-after.png`
    - `output/playwright/avatar-upload-20260708/account-settings-uploaded-390.png`
    - `output/playwright/avatar-upload-20260708/account-settings-saved-390.png`

### 线上部署

- 新 release：
  - `.deploy/campus-growth-20260708182321.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708182321.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 当前线上版本：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708182321`
- 健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

### 线上验证

- 生产头像上传烟测通过：
  - 临时创建已认证用户和会话。
  - 上传 PNG 到 `POST /api/uploads/avatar`。
  - 保存到 `PATCH /api/users/me/identity`。
  - 读取 `https://campusgrow.top/api/uploads/avatars/avatar_583c8373d9d4471e.png` 返回成功且 `Content-Type=image/png`。
  - 临时用户、会话和学校会员记录已清理。
- 线上 Playwright 390x844 验证：
  - `/account-settings` 文档宽度为 390，无横向溢出。
  - 弹层中不再出现“头像链接”。
  - 弹层出现“从相册选择”，file input accept 正确。
  - 无过小触控目标，控制台 0 error/0 warning。
  - 截图：
    - `output/playwright/avatar-upload-20260708/production-account-settings-390.png`
    - `output/playwright/avatar-upload-20260708/production-account-settings-sheet-390.png`

### 微信预览

- 已生成新真机预览二维码：
  - `output/wechat-preview/campus-growth-preview-20260708182321.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708182321.json`
  - 包体积 `2561` bytes。

### 注意事项

- 当前头像图片支持 JPG、PNG、WebP。若真机相册选择 HEIC 图片被微信 WebView 原样传上来，服务器会拒绝并提示重新选择；后续如大量用户遇到 HEIC，可增加客户端压缩/转码或小程序原生 `chooseMedia` 处理。
- 本次仍是 H5 + API 改动，`wechat-shell` 代码未变；小程序壳加载线上 H5 后即可看到新头像上传体验。

## 2026-07-08 19:05 学校认证校徽与个人信息单项编辑

### 用户反馈

- 学校认证页左侧仍是通用图标，浙江大学等学校应显示真实校徽。
- 个人信息页编辑资料不应进入大表单页，应该像截图一样点某个字段就单独编辑该字段。
- 删除旧的“编辑资料”界面，不要再出现图 3 那种大表单。
- 个人信息页需要增加“个人简介”。

### 本次修改

- `frontend/src/app/components/SchoolLogo.tsx`
  - 新增通用学校校徽组件，支持校徽图片加载失败后回退学校简称。
- `frontend/src/app/pages/SchoolSelect.tsx`
  - 改为复用通用 `SchoolLogo`，避免重复实现。
- `frontend/src/app/pages/SchoolVerify.tsx`
  - 根据当前学校名和 `schoolId` 拉取学校数据，学校卡片左侧显示真实校徽。
  - 浙江大学命中 `/school-logos/zju.png`。
- `frontend/src/app/pages/AccountSettings.tsx`
  - 重写个人信息编辑交互。
  - 头像行点击后直接打开本地相册/文件选择并自动上传保存，不再出现头像昵称底部弹层。
  - 昵称、年级、专业、个人简介改为单项编辑页：标题为“修改昵称 / 修改年级 / 修改专业 / 修改个人简介”，只有对应输入框和保存按钮。
  - 新增个人简介行。
  - 删除“头像链接”入口。
- `frontend/src/app/routes.tsx`
  - `/profile/edit` 不再渲染旧 `ProfileEdit` 大表单，改为渲染 `AccountSettings`，旧链接也不会出现“编辑资料”。

### 本地验证

- 静态检查通过：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `npm run build:frontend`
- Playwright 390x844 本地验证：
  - `/school-verify` 登录态下显示浙江大学，校徽 `school-logos/zju.png` 加载成功。
  - `/account-settings` 显示“个人简介”，不显示“编辑资料”，不显示“头像链接”。
  - 点击昵称进入“修改昵称”单项编辑页，输入框带当前昵称，保存按钮可见。
  - `/profile/edit` 旧路径显示“个人信息”，不再显示旧“编辑资料”。
  - 检查页面无横向溢出，无过小触控目标，控制台无 error。
  - 截图：
    - `output/playwright/profile-school-edit-20260708/school-verify-390.png`
    - `output/playwright/profile-school-edit-20260708/account-settings-390.png`
    - `output/playwright/profile-school-edit-20260708/edit-name-390.png`
    - `output/playwright/profile-school-edit-20260708/profile-edit-legacy-390.png`

### 线上部署

- 新 release：
  - `.deploy/campus-growth-20260708190501.tar.gz`
- 当前线上版本：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708190501`
- 健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

### 线上验证

- 为线上视觉检查临时创建浙江大学用户和会话，随后已清理。
- Playwright 390x844 线上验证：
  - `/school-verify` 登录态下显示浙江大学，校徽来源 `https://campusgrow.top/school-logos/zju.png`。
  - `/account-settings` 登录态下显示“个人简介”，不显示“编辑资料”，不显示“头像链接”。
  - `/profile/edit` 旧路径显示“个人信息”，不再显示旧大表单。
  - 三个页面文档宽度均为 390，无横向溢出，控制台无 error。
  - 截图：
    - `output/playwright/profile-school-edit-20260708/production-school-verify-logged-in-390.png`
    - `output/playwright/profile-school-edit-20260708/production-account-settings-logged-in-390.png`
- 临时线上用户清理结果：
  - `cg_visual_1783508759978_6205d8_user` 已删除。

### 微信预览

- 新真机预览二维码：
  - `output/wechat-preview/campus-growth-preview-20260708190501.png`
- 预览信息：
  - `output/wechat-preview/campus-growth-preview-20260708190501.json`
  - 包体积 `2561` bytes。

### 后续注意

- 学校认证页校徽依赖学校数据中的 `logoUrl`。全国高校列表中有 logo 的学校会显示真实校徽；缺 logo 或加载失败时回退学校简称。
- 旧 `ProfileEdit.tsx` 文件仍留在仓库中，但路由不再使用。后续清理代码时可以删除该文件和 `routes.profileEdit` 常量，前提是确认没有旧入口依赖。

## 2026-07-08 19:38 个人信息单项编辑页移动端缩放与横向滑动修复

### 用户反馈

- 在手机真机里点击“昵称、年级、专业、个人简介”等单项编辑入口后，页面会被放大，随后可以左右滑动。
- 个人信息编辑页必须完全适配微信小程序手机宽度，不允许出现横向滚动。

### 本次修改

- `frontend/index.html`
  - `viewport` 增加 `maximum-scale=1, user-scalable=no`，用于微信 web-view 下禁止页面级缩放，降低输入框聚焦或手势缩放导致横向滑动的风险。
  - 首屏内联样式中给 `input`、`textarea`、`select` 明确设置 `font-size: 16px` 和 `max-width: 100%`，作为 CSS 加载前后的兜底。
- 保留此前 `frontend/src/app/pages/AccountSettings.tsx` 中的单项编辑页约束：
  - 编辑输入框类名继续使用 `app-mobile-edit-control`。
  - 输入框和 textarea 均为 `16px`、`w-full`、`min-w-0`、`max-w-full`。
  - 编辑页容器、表单和输入区域均为 `overflow-x-hidden`。
- 删除本次宽度验证过程中产生的本地临时 session token 文件：
  - `output/playwright/edit-width-20260708/prod-width-user.json`

### 本地验证

- 静态检查通过：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `npm run build:frontend`
- Playwright MCP 390x844 本地验证通过：
  - `/account-settings` 注入本地登录态。
  - 依次点击“昵称、年级、专业、个人简介”并聚焦输入框。
  - 四个编辑页均满足：
    - `viewportMeta=width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
    - `visualViewportScale=1`
    - `docScrollWidth=390`
    - `bodyScrollWidth=390`
    - `rootScrollWidth=390`
    - `activeFontSize=16px`
    - `overflow=0`

### 线上部署

- 新 release：
  - `.deploy/campus-growth-20260708193736.tar.gz`
- 上传到服务器：
  - `/tmp/campus-growth-20260708193736.tar.gz`
  - `/tmp/deploy-commercial-release.sh`
- 当前线上版本：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260708193736`
- 线上健康检查：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上 HTML 确认：
  - `viewport` 已包含 `maximum-scale=1, user-scalable=no`
  - CSS 链接带版本号 `?v=20260708193736`

### 线上验证

- Playwright MCP 390x844 生产验证通过：
  - 页面：`https://campusgrow.top/account-settings?v=20260708193736`
  - 通过路由拦截 `/api/users/me` 注入临时登录态，未创建新的生产用户。
  - 依次点击“昵称、年级、专业、个人简介”并聚焦输入框。
  - 四个编辑页均满足：
    - `visualViewportScale=1`
    - `docScrollWidth=390`
    - `bodyScrollWidth=390`
    - `rootScrollWidth=390`
    - `activeFontSize=16px`
    - `overflow=0`
- 对上一轮宽度验证遗留的生产临时用户做幂等清理：
  - `cg_width_1783509805387_0228b0_user`
  - 清理确认：`users=0`、`sessions=0`、`user_school_memberships=0`

### 后续注意

- 这次修的是微信 web-view/H5 层的页面缩放与横向溢出兜底。若真机仍出现左右滑动，应优先检查微信开发者工具或真机是否加载了旧缓存包；可重新生成小程序预览二维码后再测。
- 如果后续又新增表单页，输入框字号不得低于 `16px`，外层容器必须保持 `w-full min-w-0 max-w-full overflow-x-hidden`，否则 iOS 聚焦输入框仍可能触发放大。
