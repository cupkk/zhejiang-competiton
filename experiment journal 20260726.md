# 研究进展总览

## 项目目标

- 把校园成长平台整理成可内测的 H5 + Express API + 微信 `web-view` 小程序版本。
- 用户端采用紧凑、清晰的移动端界面；平台管理员和学校管理员形成真实数据闭环。
- 平台内容按平台/学校范围隔离，学校用户只访问当前学校允许的内容；关键内容由人工审核和发布。
- 正式审核前完成登录、内容、权限、文件、限流、备份、对象存储和真机体验版验收。

## 当前主线状态

- P0 微信登录循环：`0.1.17` 已真机确认修复；重复原生头像昵称页已从代码中删除。
- P1 首页：已只保留搜索、竞赛、资源和组队三块真实数据预览；390/414 px 无横向溢出。
- P2 内容：12 项高频国家级赛事已补结构化稳定信息，3 份平台原创资源已支持真实文件领取和下载。
- P3 后台：已增加平台竞赛草稿/发布/归档、平台/学校管理员真实文件发布、权限隔离和审计日志。
- P4 安全：本地代码与自动化主体已完成；生产部署与微信 `0.1.18` 上传尚未执行。

## 外部门槛

- 曾在对话中出现的微信 AppSecret 必须在微信公众平台轮换，不能继续视为安全凭据。
- 阿里云短信和邮件真实发送仍需控制台资质、签名、模板、发送域名和生产凭据。
- 在上述配置和真机体验版完整通过前，不提交微信正式审核。

## 下一步

1. 重新执行最终本地发布验证，确认本地登录图和最新安全修改进入构建。
2. 创建生产 PostgreSQL 备份，构建并部署 P1-P4 release。
3. 生产环境执行官方内容补全脚本，验证 PostgreSQL、S3 下载、学校隔离和后台。
4. 同步 Nginx CSP 等安全头，生成微信 `0.1.18` 预览二维码并上传开发版本。
5. 真机验收后再判断是否具备提交正式审核条件。

# 2026-07-26 P1-P4 收尾与安全核验

## 已完成代码

- 删除微信壳 bearer fragment 交接，仅通过 `wx.login` 一次性 code 进入 H5；壳版本提升为 `0.1.18`。
- 新增 `normalizeInternalRoute()`，接入用户登录、管理员登录、学校选择和微信壳入口；拒绝外部 URL、协议相对路径、反斜杠、控制字符和多层编码路径。
- 新增 `scripts/test-internal-routes.ts`，覆盖 H5、管理员登录和微信壳恶意路径样例。
- 竞赛关联资源和组队接口现在会先确认竞赛为 `published`；草稿和归档状态统一返回 404。
- Express 关闭 `X-Powered-By`。
- 新增 `scripts/smoke-admin-content-security.ts`，覆盖：
  - 学校管理员不能管理平台竞赛；
  - 竞赛 draft -> published -> archived；
  - 草稿/归档不能从列表、详情、关联资源和组队接口访问；
  - 平台/学校管理员资源发布范围由服务端强制；
  - 伪装 PDF 返回 415；
  - 审计日志存在；
  - 第 11 次管理员登录尝试返回 429，限流桶只保存 SHA-256 键；
  - 响应不暴露 Express 标识。
- 冒烟脚本为每轮使用独立保留网段 IP，并在结束时清理限流桶，避免自动化反复运行后锁住自身。
- 管理后台竞赛状态标签增加不换行约束，修复“已发布”被压成两行；服务端创建/更新竞赛改为按 ID 读取结果，避免同名竞赛和 20 条限制导致返回空值。
- 删除已废弃的 bearer token 用户读取函数 `fetchCurrentUserWithToken`。
- 登录页将 Unsplash 运行时外链改为本地 `frontend/public/campus-login.webp`，避免国内网络 QUIC/CDN 错误；来源记录写入 `frontend/ATTRIBUTIONS.md`。
- 新增发布、备份和恢复工具：
  - `scripts/build-release-package.ps1`
  - `scripts/create-production-backup.sh`
  - `scripts/verify-production-backup-restore.sh`
  - `scripts/verify-production-s3-access.sh`
- Nginx 模板新增 CSP 和 Permissions-Policy，保留微信 JS SDK、同源 API、本地图片和 HTTPS 图片所需最小范围。

## 本地自动化结果

- `npm run verify:local-release` 已通过一次：根目录类型检查、前端类型检查、路由安全、双学校用户/管理员闭环、竞赛/资源安全闭环和生产构建全部成功。
- 构建主包为 481.89 kB，gzip 138.56 kB。
- Playwright 对 `/`、竞赛列表/详情、资源列表/详情、组队、个人页和登录页执行 390 x 896 与 414 x 896 巡检：全部横向溢出 0、首次进入滚动位置 0，首批可见按钮高度均不小于 44 px。
- 管理员恶意 `next=https://evil.example/steal` 登录后停留在同源 `/admin`，开放重定向验证通过。
- 截图：
  - `output/playwright/p4-home-390-20260725.png`
  - `output/playwright/p4-admin-competitions-1440-20260725.png`
  - `output/playwright/p4-login-local-image-390-20260725.png`
- 登录本地图片替换发生在上述全量构建之后，因此仍需重新跑最终发布验证。

## 生产只读核验

- 当前 release：`/opt/campus-growth/releases/20260725192142`。
- 正确 systemd 单元为 `campus-growth-api.service`，不是旧名称 `campus-growth.service`；当前 `active/running`，`NRestarts=0`，本机和外网 `/api/health` 均为 200。
- Nginx 配置检查通过；HTTPS 已有 HSTS、nosniff、SAMEORIGIN 和 Referrer-Policy。当前生产尚未部署本轮 CSP。
- API 日志由 systemd journal 管理，当前占用 128 MB；Nginx logrotate 存在。没有独立 `/etc/logrotate.d/campus-growth` 不代表 API 日志未管理。
- 最新备份 `predeploy-20260725192142.sql.gz` 已恢复到临时 PostgreSQL 数据库：37 个公开表，核心计数为 schools 2995、users 3、competitions 85、resources 33、posts 12、teams 0、admins 1；恢复检查通过，临时库和脚本已删除。
- S3 `HeadBucket` 通过，桶 ACL 仅 1 个 owner grant，没有 AllUsers 或 AuthenticatedUsers 公共授权；临时核验脚本已删除。

## 依赖审计

- 根目录生产依赖使用 npm 官方审计端点：0 个漏洞。
- 前端 `react-router 7.18.1` 报 1 个高危公告 `GHSA-qwww-vcr4-c8h2`，仅影响 React Server Components mode。
- 当前项目为 React 18 + Vite 纯 SPA，没有 RSC server/action 路径，因此公告路径不可达，但仍需记录例外并跟踪升级。
- 已核验 `react-router 8.3.0` 要求 Node >=22.22、React/ReactDOM >=19.2.7；当前运行栈不满足，不能在本轮无验证地升级。

## 保留与清理

- 保留双学校本地测试数据，用于学校隔离和管理员权限验证。
- 已清理一条此前冒烟遗留的本地平台竞赛“本地后台闭环测试竞赛”。
- 所有新增自动化临时竞赛、资源、文件、管理员、审计记录和限流桶均在 `finally` 中清理。

# 2026-07-26 P1-P4 正式部署与微信开发版本

## 最终本地门槛

- 替换本地登录图后重新执行 `npm run verify:local-release`，以下全部通过：
  - 根目录 TypeScript；
  - 前端 TypeScript；
  - H5/管理员/微信壳站内路由安全；
  - 双学校用户与管理员闭环；
  - 竞赛发布生命周期、资源范围、文件魔数、审计、限流和响应头；
  - Vite 生产构建。
- 最终主包 `index-CiMEgi_A.js` 为 480.19 kB，gzip 137.81 kB。
- 发布包由 `scripts/build-release-package.ps1` 生成：
  - release：`20260726102158`
  - 文件：`.deploy/campus-growth-20260726102158.tar.gz`
  - 大小：1,969,961 字节
  - 条目：90
  - 敏感条目：0
  - SHA-256：`92E5F1B0EB94FA8503A5F7CC94FF83A6E774CBCE5BAD02751C3B88F38B66DEB1`
- 远端发布包哈希和条目数与本地一致。

## 生产备份与发布

- 发布前 PostgreSQL 备份：
  - `predeploy-20260726102223.sql.gz`
  - 116,010 字节，权限 0640
  - SHA-256：`69375ab266d98856bd6ce8aa6fe8d1470cdd62f687caa39ca16076f01247450d`
- release 已切换到 `/opt/campus-growth/releases/20260726102158`；`campus-growth-api` 为 active，`NRestarts=0`。
- 健康信息：PostgreSQL、S3、真实微信登录、支付关闭。
- Nginx CSP 和 Permissions-Policy 已部署；`nginx -t` 通过后 reload。旧配置备份：`/etc/nginx/conf.d/campus-growth.conf.pre-20260726102158`。
- 内容写入前第二份 PostgreSQL 备份：
  - `precontent-20260726102401.sql.gz`
  - 116,271 字节，权限 0640
  - SHA-256：`5f38291a7e989074007cbc8159a511078cf7bf0806dde9d65746ad39390e0bfd`

## 生产内容与资源闭环

- 第一次执行内容脚本失败于交互 shell 使用旧 Node，错误为不支持 `node:sqlite`；失败发生在数据库初始化导入阶段，没有写入。
- 核验 systemd 使用 Node v24.14.1；在 sudo 子进程显式设置 `/usr/local/bin` PATH 后重试成功。
- `scripts/enrich-official-content.ts --apply --confirm-production` 结果：12 项竞赛、3 份资源写入完成，数据库为 PostgreSQL、存储为 S3。
- `scripts/verify-public-content.ts` 通过外网 API 验证：12 项竞赛和 3 份资源，`incomplete=0`。
- 生产资源闭环：
  - 资源：`platform_competition_verification_checklist`
  - 免费领取：`owned`
  - 下载：HTTP 200
  - 类型：`text/markdown`
  - 缓存：`private, no-store`
  - 文件：1,379 字节
- 首次闭环后发现临时用户清理 SQL 没有展开变量，残留 1 条。已改为 heredoc 参数化 SQL并增加 `--cleanup-only`；清理后重新完整跑一遍，结果通过，随后 `DELETE 0`、剩余临时用户 0。

## 外网 UI 与安全验收

- [用户端](https://campusgrow.top/) 和 [管理后台](https://campusgrow.top/admin) 已切换新 release。
- 外网 `/`、竞赛列表/详情、资源列表/详情、组队和登录页在 390 px 下横向溢出 0、首次滚动位置 0、控制台错误 0。
- 生产首页可以看到结构化竞赛和原创资源；登录页使用本地 `campus-login.webp`，不再请求 Unsplash CDN。
- 响应头已确认：CSP、Permissions-Policy、HSTS 生效，`X-Powered-By` 不存在。
- 生产截图：
  - `output/playwright/production-p1-p4-home-390-20260726.png`
  - `output/playwright/production-p1-p4-login-390-20260726.png`

## 微信 `0.1.18`

- 微信开发者工具 CLI 登录状态为 true，AppID 校验正确。
- `wechat-shell/pages/webview/index.js` 通过语法检查，`app.json` 和 `project.config.json` 解析通过。
- preview 成功，包体 3,047 字节：
  - 二维码：`output/wechat-preview/p1-p4-release-20260726102158.png`
  - 信息：`output/wechat-preview/p1-p4-release-20260726102158.json`
- 开发版本 `0.1.18` 上传成功，描述“首页内容与后台安全优化 20260726”：
  - `output/wechat-preview/upload-20260726102158.json`
- CLI 不能把开发版本自动设为体验版，仍需在微信公众平台手动选择 `0.1.18`。

## 发布后清理与最终边界

- 服务器 `/tmp` 中发布包、部署脚本、Nginx 临时配置和所有验收脚本均已删除。
- 当前 symlink、服务、登录图片和两份新备份均复核存在且状态正确。
- 内测门槛文档：`deploy/internal-beta-release-gates-20260726.md`。
- 可以进入体验版内测，但暂不应提交正式审核；剩余硬门槛是轮换曾暴露的微信 AppSecret、配置真实阿里云邮件/短信、把 `0.1.18` 设为体验版并完成真机全闭环。

# 2026-07-26 核心界面与内容质量返工启动

## 用户复核与真实差距

- 用户指出首页和搜索观感仍接近旧版，搜索框没有实现收起/展开，生产竞赛仍大量显示“见官方”类文案，组队为空。
- 重新审计确认用户判断成立：
  - 首页搜索只是整行跳转链接，组队页搜索是固定大输入框，没有折叠状态。
  - 上一轮视觉改动主要是颜色、8 px 圆角和局部阴影，未形成 `emil-design-eng` / `apple-design` 驱动的结构和交互重做。
  - 生产竞赛 85 项；只有 12 项具有团队人数、至少 3 个赛程阶段和至少 3 项提交材料。
  - 85 项全部命中“关注官网、以官网通知为准、暂未公布”等模板表达；官方联系方式为 0。
  - 生产公开组队和首页组队均为 0。
- 已与用户锁定：公开 30 项完整竞赛；其余 55 项进入审核队列；浙江大学、北京大学、中国石油大学（北京）各放 3 条明示内测示例；视觉覆盖核心浏览链路。

## Emil / Apple 设计审查基线

| Before | After | Why |
| --- | --- | --- |
| 首页搜索始终占满一行并跳转 | 默认 96 px 胶囊，点击后在固定顶栏原位展开并自动聚焦 | 减少常驻占用，同时保持操作来源和空间连续性 |
| 首页三个模块结构和权重完全相同 | 每块使用标题、真实数量、主预览和次预览两级层次 | 信息密度更高且更容易扫描 |
| `transition` 用于宽泛属性 | 只动画 transform、opacity、width/background-color，100-180 ms 强 ease-out | 避免迟滞和无意动画 |
| 底栏近乎不透明白色 | 使用轻量半透明材质、清晰选中态和安全区 | 形成 iOS 式浮动功能层，不遮挡内容 |
| 组队空状态只有一句提示 | 同校示例补充真实结构，并明确标记“内测示例” | 让内测用户看见完整体验，同时不冒充真实发布 |
| 竞赛未知字段重复写“见官网” | 届次状态集中展示，未知模块隐藏，55 项低质量内容不公开 | 降低模板感并保持事实诚实 |

## 实施顺序

1. 增加竞赛质量与届次字段，组队示例字段和数据库迁移。
2. 扩充 30 项官方内容并让公开接口只返回 verified。
3. 添加三校示例、同校隔离、自动隐藏和后台归档能力。
4. 重做首页、搜索、竞赛、资源、组队核心页面和底栏。
5. 本地闭环、多视口截图、生产备份、部署和微信 `0.1.19`。

## 2026-07-26 示例组队与后台闭环修复

### 问题定位

- 9 条内测示例并未被物理删除；API 初始化中的历史归属清理会把没有认证作者的学校内容设为 `school_id=NULL` 和 `moderation_status=pending`。
- 示例属于平台明确生成且已标记 `is_example=1` 的学校范围内容，不应走普通用户历史内容回填规则。
- 竞赛模型增加届次与质量字段后，收藏接口仍使用旧的自定义 SELECT，调用 `mapCompetition()` 时对缺失 JSON 字段解析失败，表现为 `/users/favorites` 返回 500。

### 修复

- `server/db.ts`：历史组队归属清理和待审任务生成明确排除 `is_example=1`。
- `scripts/seed-local-preview.ts`：普通本地组队种子显式写入 `is_example=0`、`example_expires_at=NULL`。
- `package.json`：`npm run seed:local` 现在连续执行双学校种子和官方内容增强，一键得到 30 项竞赛、3 份原创资源、9 条示例组队。
- `server/catalog-service.ts`：收藏竞赛查询补齐 `edition_label`、`schedule_status`、`registration_method`、`tracks_json` 和 `quality_status`。
- 新增管理员内测示例接口：
  - `GET /api/admin/team-examples`
  - `PATCH /api/admin/team-examples/archive`
- 管理后台审核页新增“内测示例”视图，支持学校、使用状态筛选、全选和批量归档；归档动作写管理员审计日志。
- `scripts/smoke-local-core.ts` 增加以下断言：
  - 浙江大学可见本校 3 条示例，复旦大学不可见；
  - 跨校详情返回 403；
  - 示例联系方式返回 409；
  - 同校真实有效组队达到 3 条后示例自动隐藏；
  - 平台管理员可见 9 条，学校管理员只能看和归档本校示例；
  - 批量归档测试结束后恢复示例原状态，不污染预览库。

### 验证结果

- 内容脚本应用结果：30 项竞赛、3 份资源、9 条示例。
- API 重启后数据库仍为浙江大学、北京大学、中国石油大学（北京）各 3 条示例。
- `npm run lint` 通过。
- `npm run test:local-core` 通过；覆盖用户/管理员学校隔离、发布审核、举报、审计和本轮示例闭环。

### 下一步

1. 完成搜索页和三个核心详情页的 Emil / Apple 视觉统一。
2. 运行完整本地 release 验证和竞赛质量验证。
3. 使用 Playwright 检查 390、414、430 px 的溢出、搜索交互、空/错/加载状态和截图。
4. 通过后再执行生产备份、部署和微信 `0.1.19` 上传。

## 2026-07-26 核心界面与 30 项竞赛发布完成

### 视觉与交互

- 按 `emil-design-eng` 和 `apple-design` 的审查基线完成首页、紧凑搜索、独立搜索页、竞赛/资源/组队列表与详情、底部导航的统一。
- 首页为三块 grouped dashboard；搜索默认收起、点击原位展开、自动聚焦、支持清除、取消和回车提交。
- 修复列表页双重 sticky、搜索关键词收起后不可见、Chromium 原生清除按钮与自定义按钮重复、搜索页触控目标不足 44 px。
- 管理后台移动端不再横向滚动整排导航，改为原生下拉导航。
- Playwright 覆盖 390x844、414x896、430x932：用户端核心页面 `scrollWidth=clientWidth`，无越界、无控制台错误；搜索焦点、键盘提交和 reduced-motion 均通过。
- 主要截图：`output/playwright/core-home-390-20260726.png`、`core-search-390-20260726.png`、`core-home-search-expanded-390-after-20260726.png`、`core-competition-detail-390-20260726.png`、`core-team-detail-390-20260726.png`、`core-admin-examples-390-after-20260726.png`。

### 发布级验证

- `npm run verify:local-release` 全部通过：lint、前后端类型检查、内部路由安全、用户/管理员学校隔离与审核闭环、竞赛发布生命周期、上传文件魔数、审计、限流和生产构建。
- `scripts/verify-public-content.ts`：30 项竞赛、3 份资源、`incomplete=0`。
- 微信壳 JavaScript 语法与两个 JSON 配置解析通过。
- 完整验证中发现并修复：收藏接口未选择新增竞赛届次字段导致 500；旧管理员安全测试未满足新的竞赛发布质量门槛；搜索结果把未公布日期的 `daysLeft=9999` 展示为“剩余 9999 天”，现统一显示“本届时间待发布”。

### 生产备份与部署

- 初次 release：`20260726135448`；搜索文本热修复后最终 release：`20260726140538`。
- 最终发布包 1,986,093 字节、90 个条目、敏感条目 0，SHA-256：`FEBEB730FDE0DC40D3491C4DFB866C637F869F4686A7ADBCA26AFC347395DA19`；远端哈希一致。
- 备份：
  - `predeploy-core-ui-20260726135702.sql.gz`，120,790 字节，SHA-256 `bb8778f488dadb16d438e94cbfb743e93186f527d68b0bf302d5311576269cd7`；恢复验证 38 张公开表并清理临时库。
  - `precontent-core-ui-20260726135810.sql.gz`，121,515 字节。
  - `prehotfix-search-20260726140616.sql.gz`，127,342 字节。
- 最终 symlink 指向 `/opt/campus-growth/releases/20260726140538`；服务 active，`NRestarts=0`。
- 外网健康为 PostgreSQL + S3 + real WeChat + payments disabled；HTTPS、HSTS、CSP 正常，未暴露 `X-Powered-By`。
- 生产内容核验：公开 verified 竞赛 30，平台原创资源 3，内测示例 9；浙江大学、北京大学、中国石油大学（北京）各 3 条。
- 外网 390 px 首页、竞赛列表/详情、资源和搜索无横向溢出、初始滚动为 0、控制台错误 0。

### 微信 `0.1.19`

- `wechat-shell/pages/webview/index.js` 的 `SHELL_BUILD` 更新为 `0.1.19`。
- 微信开发者工具 CLI 登录状态为 true，AppID 为 `wxda8641cd650537a4`。
- preview 与 upload 均成功，包体 3,047 字节：
  - 二维码：`output/wechat-preview/core-ui-release-20260726140538.png`
  - 预览信息：`output/wechat-preview/core-ui-release-20260726140538.json`
  - 上传信息：`output/wechat-preview/upload-20260726140538.json`
- CLI 无法自动设为体验版；仍需在微信公众平台手动将 `0.1.19` 选为体验版并完成真机闭环。

### 正式审核边界

- 当前可进入体验版内测，不应直接宣称已满足正式审核。
- 仍需轮换曾暴露的微信 AppSecret、接入真实阿里云邮件/短信、设置体验版并完成真机登录与业务闭环。

## 2026-07-26 小程序端优先深化启动

### 用户优先级调整

- 暂停管理端功能扩展，优先完成小程序用户端的数据真实性、内容密度、视觉和真机体验。
- 复核线上 30 项竞赛后确认：30 项全部为 `scheduleStatus=not_announced`、`editionLabel=长期规则信息`、空截止日期。这虽然避免了编造日期，但用户体验仍等同于“空壳”，需要逐项改为当前届或最近一届的可核验数据。
- 首页结构已符合“搜索 + 竞赛/资源/组队三块”的基本要求，后续重点是内容真实性、视觉层级和详情信息质量，不恢复公告、大图或四宫格。

### 产品手册取舍

- 采纳：紧凑且充实的信息密度、真实浏览/收藏排序、组队优先、组队与求加入分视图、详情页直接展示关键信息、安全提示、按标签推荐。
- 不采纳：直接抄袭赛氪页面、正文或公众号视觉素材；赛氪仅作为赛事线索和信息架构参考，最终事实必须落到主办方官网、官方通知或官方 PDF。
- 不进入本轮：付费资源出售、私聊、队长端复杂组队确认和敏感身份信息托管。

### 第一批事实核验

- 2026 全国大学生数学建模竞赛官网已公布：赛题发布时间为 2026-09-10 18:00；第一次通知列明比赛至 2026-09-13 20:00，全国报名截止 2026-09-07 20:00，每队 1-3 名大学生，官网公开电话和邮箱。
- 2026 全国大学生电子设计竞赛已发布多个专题赛通知；模拟电子系统设计专题赛选拔赛为 2026-07-29 至 08-01，决赛为 08-23 至 08-27；信息科技前沿专题赛也已发布主题、材料和决赛时间。
- 中国国际大学生创新大赛（2026）官方站已出现教育部通知入口和 4-8 月赛程框架；具体全国报名截止仍需读取正式通知原文后再写入。

### 执行规则

1. 当前届正式通知存在时使用当前届；只有校赛预通知时不得冒充全国截止时间。
2. 当前届全国通知尚未发布时使用最近一届，并明确标注届次，不显示“剩余天数”。
3. 官方未公开联系方式则隐藏，不从第三方网站拼接个人电话或群号。
4. 所有外部抓取结果先进入证据表和脚本校验，再写入公开数据。
