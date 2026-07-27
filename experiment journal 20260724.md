# 校园成长平台研究进展日志

## 总体研究进展

- 项目目标：面向高校学生提供按学校隔离的竞赛、资料、社区和组队服务，学校认证用于约束本校内容的访问与发布。
- 当前阶段：生产已切换到 release `20260724191306`，外网用户端、管理端入口和公开 API 验收通过；微信开发版本 `0.1.15` 已上传。真实邮件与短信发送仍待阿里云资源审核和代码接入。
- 当前结论：本地发布门槛、96 条路由矩阵、微信壳编译、登录按钮、学校认证表单和核心列表返回记忆均已验证，最新前端已部署到 PostgreSQL、S3、真实微信登录的生产环境。学校认证接入生产发送服务前仍需补齐学校邮箱域名绑定、持久化限流、短验证码安全哈希、发送失败处理、目标唯一性和发送审计。
- 当前阻塞：阿里云短信签名/模板、邮件推送发信域名/发信地址和生产凭证尚未就绪；微信开发版本 `0.1.15` 仍需在微信公众平台手动选为体验版，并完成真机头像、昵称、上传和返回学校步骤回归。
- 下一步：在微信公众平台将 `0.1.15` 设为体验版，使用新二维码完成真机闭环；随后继续办理阿里云短信与邮件资源审核及首批学校官方邮箱域名确认。

## 2026-07-24 阿里云邮件与短信接入前代码审计

### 已完成的代码链路

- `frontend/src/app/pages/SchoolVerify.tsx` 已提供教育邮箱、手机号、发送验证码和完成验证界面。
- `frontend/src/app/lib/api.ts` 已调用：
  - `POST /api/users/me/school-verification/code`
  - `POST /api/users/me/school-verification/verify`
- `server/school-service.ts` 已生成 6 位验证码，以用户、学校、通道、目标和验证码计算 SHA-256，并写入 `school_verification_codes`。
- 验证码有效期为 10 分钟，错误 5 次后锁定；邮箱和手机号都通过后，学校会员关系才变为 `verified`。
- `server/index.ts` 已有 10 分钟最多 5 次发送、最多 20 次校验的内存限流。
- `.env.example` 已列出阿里云短信和邮件变量，但 `server/config.ts` 尚未读取这些变量，根依赖也尚未安装阿里云 SDK。

### 关键缺口

1. `requestSchoolVerificationCode` 当前只生成并保存验证码，没有调用任何邮件或短信服务；页面显示“验证码已发送”并不代表真实发送成功。
2. `VERIFICATION_PROVIDER` 当前未被服务端读取，调试码显示仍错误地依赖 `WECHAT_LOGIN_MODE`，发送模式与微信登录模式耦合。
3. 教育邮箱校验只判断域名字符串包含 `.edu`，没有校验该邮箱域名是否属于用户选择的学校。用户可以选择任意学校并使用其他教育域名完成认证，这是当前最重要的业务安全缺口。
4. 6 位验证码只有 100 万种，普通 SHA-256 即使带公开上下文，数据库泄露后仍可离线穷举。生产环境应使用服务器端秘密参与的 HMAC，或足够高成本的密码哈希；秘密不得入库。
5. 当前限流保存在单进程内存中，重启即清空，多实例之间不共享；而且没有覆盖 60 秒冷却、用户全局上限、IP 上限和 24 小时上限。
6. 验证码记录没有 provider、发送状态、阿里云 requestId/bizId、失败原因类别等审计字段；发送失败后的记录处置也未定义。
7. `education_email` 和 `phone` 没有唯一性约束或占用检查，同一目标可被多个账号复用。
8. 接入 SDK 后申请验证码会变为异步操作，`school-service.ts` 和 Express 路由都需要改为 `async/await`，并统一映射阿里云失败为不泄露内部信息的错误文案。

### 阿里云当前前置项核对

- 短信继续使用 `Dysmsapi 2017-05-25 SendSms`，请求参数包括 `PhoneNumbers`、`SignName`、`TemplateCode` 和 JSON 字符串 `TemplateParam`；响应 `Code=OK` 才表示接口请求成功，应保存 `BizId` 和 `RequestId` 用于排查。
- 邮件继续使用 Direct Mail `SingleSendMail`。需要先创建并验证发信域名及发信地址，再配置发件账号、别名、收件地址、主题和正文。
- 阿里云当前文档说明，新发信域名需要所有权、SPF、DKIM、DMARC、MX 等控制台要求全部通过；DNS 传播可能不是即时完成，必须以控制台验证状态为准。
- 凭证优先考虑 ECS 实例 RAM 角色或临时凭证。若现阶段必须使用长期 AccessKey，只给专用 RAM 用户最小权限，并设置来源 IP 限制、轮换与泄露应急；禁止使用主账号 AccessKey。
- 2026-07-24 查询到的 Node.js SDK 版本：`@alicloud/dysmsapi20170525@4.6.0`、`@alicloud/dm20151123@1.10.2`。安装时仍应锁定仓库实际写入的版本并通过类型检查。

### 推荐实施顺序

1. 在阿里云控制台提交短信资质、签名和验证码模板；模板变量固定为 `code`。
2. 为 `mail.campusgrow.top` 或其他独立子域配置 Direct Mail，完成控制台要求的 DNS 验证并创建 `no-reply` 发信地址。
3. 建立首批学校与官方教育邮箱域名白名单，例如学校 ID 对应一个或多个精确域名；未配置域名的学校暂不开放邮箱认证。
4. 扩展配置校验和数据库结构，再实现 `DebugVerificationSender` 与 `AliyunVerificationSender`，让学校服务只依赖统一接口。
5. 按“检查限流 -> 生成验证码 -> 保存待发送记录 -> 调用阿里云 -> 写回成功或失败状态”处理申请；API 仅在阿里云受理成功后返回成功。
6. 增加发送器单元测试、服务层限流测试、接口冒烟和阿里云白名单真实试发；本地默认继续使用 debug provider，生产强制关闭明文调试码。
7. 先开放给内部白名单账号，核对阿里云控制台记录、数据库审计、日志脱敏和失败告警，再向内测用户开放。

### 本次操作边界

- 本次只完成代码、配置、已有文档和阿里云当前官方资料核对，没有安装 SDK、修改业务代码、连接生产服务器或发出真实短信/邮件。
- 未发现或使用任何真实 AccessKey。
- 工作区已有大量历史修改和未跟踪文件，本次未整理、回滚或删除它们。

### 官方资料

- 阿里云短信 `SendSms`：https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms
- 阿里云 OpenAPI `SingleSendMail` 调试页：https://api.aliyun.com/api/Dm/2015-11-23/SingleSendMail
- 阿里云发信域名配置：https://help.aliyun.com/zh/direct-mail/user-guide/how-to-configure-sending-domain-names
- 阿里云 RAM AccessKey：https://help.aliyun.com/zh/ram/user-guide/create-an-accesskey-pair

## 2026-07-24 生产部署与微信版本同步

### 发布前检查

- 线上域名 `campusgrow.top` 解析到 `121.43.58.9`，部署账号继续使用既有 `ecs-user` 和 `.deploy/school_ssh.pem`，未修改服务器认证配置。
- 部署前线上 release 为 `/opt/campus-growth/releases/20260714170619`；`campus-growth-api`、`nginx` 均为 active，磁盘剩余约 32 GB。
- `npm run verify:local-release` 通过：服务端类型检查、前端类型检查、双学校核心业务冒烟和前端生产构建全部成功。
- 前端主包为 473.77 kB，gzip 136.02 kB；管理后台保持路由拆包，无大于 500 kB 的构建警告。

### 数据备份与首次回滚

- 部署前生成 PostgreSQL 压缩备份：
  - `/opt/campus-growth/backups/predeploy-20260724114612.sql.gz`
  - 大小 107 kB，权限 `0640`，所有者 `campus:campus`。
- 首次候选 release `20260724114612` 启动失败，发布脚本在健康检查窗口结束后自动回滚到 `20260714170619`；外网首页和 API 恢复正常。
- 根因一：`server/db.ts` 的整段 `db.exec()` 使用 SQLite 专用 `INSERT OR IGNORE`，PostgreSQL 在 `OR` 附近报语法错误。
- 根因二：迁移 SQL 使用 `COALESCE(created_at, CURRENT_TIMESTAMP)`，而项目时间字段为 `TEXT`，PostgreSQL拒绝 text 与 timestamptz 混用。
- 修复：
  - 改为跨 SQLite/PostgreSQL 的 `INSERT ... ON CONFLICT DO NOTHING`。
  - 改为 `COALESCE(created_at, CAST(CURRENT_TIMESTAMP AS TEXT))`。

### 双数据库验证

- SQLite：重新启动独立本地预览库并执行 `npm run verify:local-release`，全部通过。
- PostgreSQL：在服务器创建临时 schema `preflight_20260724114612`，预复制生产 `schools` 表以跳过大规模学校种子导入，在独立端口 `18080` 启动候选 API。
- 临时 API 返回 `status=ok`、`databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`；随后停止临时进程并删除临时 schema，未触碰生产 `public` schema。
- 最终清理复核：独立端口 `18080` 无监听，`information_schema.schemata` 中 `preflight_20260724114612` 计数为 0。

### 最终发布

- 第二次部署前备份：`/opt/campus-growth/backups/predeploy-20260724115757.sql.gz`，大小 188 kB。
- 最终发布包：`.deploy/campus-growth-20260724115757.tar.gz`。
- 发布包 SHA-256：`144687CBAD5D5571467AADF2E7A8D4D63ED5A334D2510545C126C2B506BB697C`。
- 包内共 75 个条目，包含全部服务端 TypeScript、`schools-seed.json`、前端构建、`frontend/src/data/mock.ts`、共享类型和微信业务域名校验文件；检查确认不含 `.env`、SSH 密钥、数据库、上传目录、日志和 `node_modules`。
- 当前生产 symlink：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260724115757`。
- 线上健康：`databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`、`paymentsEnabled=false`。
- 公开接口 `/api/schools`、`/api/competitions`、`/api/resources`、`/api/posts`、`/api/teams` 均返回 200；业务域名校验文件返回 200。

### 移动端验收

- Playwright Chrome + iPhone 13 打开 `https://campusgrow.top/login?next=/resources/r1&v=20260724115757`。
- 指标：`innerWidth=390`、`scrollWidth=390`、横向溢出 0、`visualViewport.scale=1`。
- 控制台：0 error、0 warning。
- 登录页正确显示“登录后继续领取资料”，截图无重叠：`output/playwright/production-login-20260724115757.png`。

### 微信同步状态

- 已上传开发版本：`0.1.12`。
- 描述：`学校认证与核心体验优化 20260724`。
- 微信开发者工具 CLI 首次 preview/upload 准备阶段返回 `code 10 需要重新登录`；使用 `output/wechat-preview/wechat-login-20260724.png` 扫码后，登录结果为 `SUCCESS`。
- 新预览码：`output/wechat-preview/campus-growth-preview-20260724115757.png`。
- 预览信息：`output/wechat-preview/campus-growth-preview-20260724115757.json`，总大小 2561 字节。
- 上传信息：`output/wechat-preview/upload-20260724115757.json`，总大小 2561 字节；CLI 明确返回 `upload` 成功。
- 微信 CLI 不能把开发版本直接设为体验版，仍需在微信公众平台手动选择 `0.1.12` 为体验版；在完成该操作前，应表述为“开发版本已上传”，不能表述为“体验版已切换”。

## 2026-07-24 短信控制台资质申请确认

- 根据阿里云当前签名申请文档，控制台顺序为：申请资质并审核通过 -> 申请短信签名并审核通过 -> 申请验证码模板并审核通过 -> 使用 `SendSms` 联调。
- 用户截图位于阿里云“新增资质”页面。若短信签名所属企业与当前阿里云账号实名认证企业完全一致，应选择“自用”；只有签名所属主体与账号实名认证主体不一致时才选择“他用”，且他用通常需要委托授权书。
- 本项目建议资质名称填写为便于内部识别的名称，例如“校园成长平台短信资质”；备注可写“用于校园成长平台学校认证验证码，仅发送用户主动触发的验证码，不含营销内容”。资质名称不是最终展示给用户的短信签名。
- 资质审核通过后，签名建议申请与现有品牌、网站或企业证明材料一致的名称。不要为了追求短名称填写无法由营业执照、商标、网站备案或其他材料证明的品牌名。
- 签名通过后再创建“验证码”类型模板，模板变量统一使用 `code`，并保留“10 分钟内有效、请勿泄露、非本人操作请忽略”等安全文案。

## 2026-07-24 移动端界面与微信资料登录优化

### 本次目标与设计判断

- 对公开态、未认证态、已认证态和管理端页面做逐页基线检查，重点处理登录页假微信图标、公告页卡片化、个人中心卡片堆叠、消息页信息冗余和已认证页面仍显示无效表单等问题。
- 微信当前不应依赖静默读取用户资料。头像采用小程序原生 `button open-type="chooseAvatar"`，昵称采用 `input type="nickname"`，由用户主动确认；保留“使用现有资料/稍后设置”选项。
- 不使用 `web-view bindmessage` 传登录结果，因为该事件不能保证在当前交互时机立即触发。原生页先调用现有微信登录 API，再通过小程序 storage 和只存在于 URL fragment 的一次性 H5 交接参数传 token；H5 读取后立即清除 fragment，并用 `/users/me` 校验 token 后写入现有会话。

### 已完成改动

- 登录页 `frontend/src/app/pages/Login.tsx`：使用 `frontend/public/wechat-logo.svg` 中的真实微信双气泡标识；删除装饰性毕业帽、同步说明和首次登录说明；压缩标题和操作文案，按钮改为“微信登录/先逛逛”。图标来源与商标边界记录在 `frontend/ATTRIBUTIONS.md`。
- 公告与首页：`OnboardingGate.tsx` 将原编号卡片公告改为三条必要规则和单一“继续”操作；`Home.tsx` 将公告改为简洁分隔行，删除多余图标和 CTA 文案。
- 通用状态与页面结构：`StateCard.tsx` 删除“加载中/暂时不可用/暂无内容”等重复徽标；`PageHeader.tsx` 收紧标题尺度与顶部留白；用户端和管理端 28 个文件的 `rounded-xl` 统一收敛为最大 8 px 的 `rounded-lg`。
- 消息与个人中心：`Messages.tsx` 删除巨型未读汇总卡、已读标签和重复操作文案，改为紧凑分类栏及分隔列表；`Profile.tsx` 删除无实际反馈能力的入口和重复说明，个人摘要、统计改为全宽信息带；`AccountSettings.tsx` 删除数字 ID，并统一退出操作为白底红字。
- 签到与学校认证：`Checkin.tsx` 删除“积分权益后续开放/抽奖内测中”等空功能；`SchoolVerify.tsx` 对已认证用户只显示学校、认证目标和成功状态，不再显示整套禁用表单。
- 删除无入口、无实际提交能力的 `/support` 路由及 `Support.tsx`，避免向用户展示尚未实现的反馈说明页。
- 新增 `wechat-shell/pages/profile/` 原生页面，完成微信登录、头像选择、昵称建议、头像上传、身份保存、使用现有资料和进入 H5 的完整流程；`wechat-shell/pages/webview/` 增加首次资料选择和 session fragment 交接，加载页只保留转圈和“正在进入”。
- `WechatMiniProgramLoginBridge.tsx`、`api.ts`、`app-service.ts` 和 `quick-login.ts` 增加原生 token 接管、校验、清除 fragment 及从 H5 跳转原生资料页的逻辑。未修改服务端接口，复用 `/api/auth/wechat/login`、`/api/uploads/avatar`、`/api/users/me/identity` 和 `/api/users/me`。

### 验证结果与证据

- `npm run verify:local-release` 全部通过，覆盖服务端类型检查、前端类型检查、学校隔离与核心业务冒烟以及生产构建；前端主包 468.80 kB，gzip 134.88 kB，无大于 500 kB 警告。
- `node --check` 验证新增 `wechat-shell/pages/profile/index.js` 和修改后的 webview 脚本通过，两个 JSON 配置可正常解析。
- 模拟 `#mp_session=local-zju-session-token` 进入 H5 后，页面成功取得 `local_zju_student` 会话，URL hash 被立即清空，证明原生到 H5 的交接闭环可用。
- 微信开发者工具 CLI `preview` 成功，AppID 为 `wxda8641cd650537a4`，包体 18,057 字节。预览码与信息分别保存为：
  - `output/wechat-preview/ui-profile-preview-20260724.png`
  - `output/wechat-preview/ui-profile-preview-20260724.json`
- 完整 Playwright 矩阵覆盖 96 个公开、用户、学校管理员和平台管理员路由组合。首次运行只有公开首页出现一次浏览器环境 `ERR_NO_BUFFER_SPACE`；新建浏览器页单独复跑后首页 390 px 视口无控制台错误、无横向溢出且主导航存在，因此判定为长会话网络缓冲误报。
- 登录、首页、消息、个人中心、签到、个人信息、学校认证和公告截图保存在 `output/playwright/ux-audit-20260724-after/`；目标页面均未发现横向溢出、文本重叠或“后续开放/内测中”占位文案。

### 当时边界（随后已发布）

- 该次界面实现与本地验证阶段尚未连接生产服务器、部署 release 或调用微信 `upload`；随后已在下方“界面生产发布与真实后端确认”阶段完成生产发布和 `0.1.13` 上传。
- 预览编译只能证明页面与配置能构建，仍需真机点击“选择头像”，确认微信头像选择面板、昵称建议、安全审核、上传域名和图片展示全部正常。
- 生产发布和开发版本上传已完成；仍需管理员在微信公众平台手动设置体验版并执行上述真机回归。

### 微信官方资料

- 用户头像昵称能力：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html
- Button `chooseAvatar`：https://developers.weixin.qq.com/miniprogram/dev/component/button.html
- Input `nickname`：https://developers.weixin.qq.com/miniprogram/dev/component/input.html
- Web-view 事件边界：https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html

## 2026-07-24 界面生产发布与真实后端确认

### 发布前门槛

- 本轮沿用 `npm run verify:local-release` 的通过结果：服务端类型检查、前端类型检查、学校隔离与核心业务冒烟、生产构建均通过。
- 发布前线上 release 为 `/opt/campus-growth/releases/20260724115757`，`campus-growth-api` 为 active，磁盘剩余约 32 GB。
- 实时健康接口确认生产为 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`，没有回退到本地 SQLite、local storage 或 mock 微信登录。
- 生产公开接口返回真实线上数据：竞赛 ID 示例 `wl_zhou_peiyuan`，资源 ID 示例 `official_resource_wl_computer_design`；内容带官方来源入口，组队接口当前按真实状态返回空数组。前端生产构建使用相对 `/api`，不会携带或读取本地预览数据库。

### 备份与问题处理

- 第一次通过 PowerShell 内联 SSH 命令备份时，`$POSTGRES_URL` 被错误转义，`pg_dump` 失败并只生成 20 字节 gzip；发布立即停止，没有切换 release。
- 第二次尝试通过 PowerShell here-string 向远端 `bash -s` 传脚本仍返回非零，未继续发布。最终改为生成不含凭证的固定 Bash 脚本、先 `scp` 再由远端 `campus` 用户执行，并启用 `set -euo pipefail`。
- 有效备份：`/opt/campus-growth/backups/predeploy-20260724150802.sql.gz`，大小 111 KB，权限 `0640`，所有者 `campus:campus`，`gzip -t` 通过。
- 备份 SHA-256：`e3e1bbd7b0e5a5634e44d34809e60de98e5ec64d59c2e15b0937cbab105a0dfc`。
- 后续 Windows 到 Linux 的生产备份禁止使用包含环境变量的多层内联引号；应复用固定脚本或上传临时脚本，并要求 `pipefail`、非空文件和 `gzip -t` 三项同时通过。

### 发布包与生产切换

- 发布包：`.deploy/campus-growth-20260724150802.tar.gz`，共 76 个条目。
- 发布包 SHA-256：`D07E1C40304EBB1A099B624C9528D72ACBD21C0343218121274152FB1836D6DD`；服务器接收后的哈希一致。
- 包含新的 `frontend/dist/wechat-logo.svg`、前端构建、全部服务端 TypeScript、`schools-seed.json` 和服务端运行所需共享类型/数据文件。
- 检查确认不含 `.env`、SSH 密钥、数据库、上传目录、日志、测试截图和 `node_modules`。
- `scripts/deploy-commercial-release.sh` 完成切换；当前 symlink 为 `/opt/campus-growth/current -> /opt/campus-growth/releases/20260724150802`。
- 服务重启窗口内出现三次预期的 8080 连接拒绝，随后健康检查成功，没有触发回滚。最终服务为 active，外网 `/api/health` 返回 `status=ok`、PostgreSQL、S3、真实微信登录。
- 上传到 `/tmp` 的发布包、部署脚本和备份脚本已经删除，生产 release 与数据库备份保留。

### 外网移动端与真实数据验收

- Playwright 390 x 844 打开 `https://campusgrow.top/login?next=/resources/official_resource_wl_computer_design&v=20260724150802`：`scrollWidth=390`，登录提示正确，真实微信 Logo 存在，旧首次登录说明不存在。
- 生产首页 390 px 视口无控制台错误、无横向溢出、主导航存在，页面不含“本地测试”内容。
- 浏览器从同域 `/api/health` 读取到 PostgreSQL/S3/真实微信状态，从 `/api/competitions` 读取到生产竞赛 `wl_zhou_peiyuan`，证明页面使用真实生产后端而非本地 mock。
- 截图：
  - `output/playwright/production-login-20260724150802.png`
  - `output/playwright/production-home-20260724150802.png`

### 微信版本同步

- 微信开发者工具 CLI 已上传开发版本 `0.1.13`，描述为“界面与微信头像昵称优化 20260724”，上传成功，包体 18,084 字节。
- 上传信息：`output/wechat-preview/upload-20260724150802.json`。
- 新预览码：`output/wechat-preview/campus-growth-preview-20260724150802.png`；预览信息为 `output/wechat-preview/campus-growth-preview-20260724150802.json`。
- CLI 只完成开发版本上传，无法把版本设为体验版。仍需管理员进入微信公众平台，在版本管理中把 `0.1.13` 选为体验版，再执行真机头像、昵称、上传和登录回归。

## 2026-07-24 微信头像昵称流程位置纠正

### 用户反馈与修正判断

- 用户真机截图说明目标不是在小程序首次打开时增加独立资料页，而是保留现有“先认识一下你”引导步骤的结构和尺寸，仅把该步骤的头像、昵称输入替换为微信官方能力。
- `0.1.13` 的首次启动原生资料页位置不符合预期，因此不能继续作为拟选体验版；后续以修正后的 `0.1.14` 为准。
- 微信 `chooseAvatar` 和 `input type="nickname"` 只能用于小程序原生组件，不能直接嵌入 H5 web-view。修正方案是在 H5 引导进入 `identity` 步骤时才调用 `wx.miniProgram.navigateTo` 打开同版式原生页，保存后重新进入 web-view 并由最新用户资料继续到学校步骤。

### 已完成修改

- `wechat-shell/pages/webview/index.js` 删除首次启动时读取 `campus-growth-profile-ready` 并跳转资料页的逻辑；首次打开始终按原流程先完成微信登录并进入 H5。
- `frontend/src/app/lib/quick-login.ts` 将重新登录目标恢复为 `pages/webview/index`，并新增只供 onboarding identity 步骤调用的 `openWechatIdentityProfile`。
- `OnboardingGate.tsx` 仅在当前步骤为 `identity` 且运行于微信小程序 web-view 时打开原生资料页；普通浏览器继续使用原 H5 表单作为兼容回退。
- 原生资料页重新对齐现有页面：标题“先认识一下你”、相同说明、1/6 进度、96 px 头像、24 字昵称、底部“下一步”；头像使用 `open-type="chooseAvatar"`，昵称使用 `type="nickname"`。
- 页面采用 `100vh` 纵向 flex、可滚动主体和固定底部操作栏；所有横向尺寸使用 `width:100%`、`box-sizing:border-box` 和 20 px 等效边距，避免窄屏溢出。

### 当前验证

- `npm run verify:local-release` 通过，覆盖服务端/前端类型检查、核心业务冒烟和生产构建；主包 469.53 kB，gzip 134.98 kB。
- 微信开发者工具 CLI preview 通过，修正后小程序包体 19,745 字节；预览码为 `output/wechat-preview/corrected-onboarding-preview-20260724.png`。
- Playwright H5 对照页在 320、390、430 px 宽度下均无横向溢出；头像始终 96 x 96 px，输入框和底部按钮未越界。截图为 `output/playwright/corrected-identity-h5-390x844.png`。
- 该条为发布前状态；修正内容随后已发布，结果见下方。

### 修正版发布结果

- 修正版生产 release：`20260724152635`；发布包 SHA-256 为 `783E437F6D02E097827694829162E0215B89DC2CECDEA0F77289FF99F6964698`，共 76 个条目且敏感文件检查为 0。
- 发布前 PostgreSQL 备份：`/opt/campus-growth/backups/predeploy-20260724152635.sql.gz`，111 KB，`gzip -t` 通过，SHA-256 为 `c29cb4b1b5cbbe942567691eaa825e65f64b4065c4eb849bee41ae102af8b741`。
- 当前 symlink：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260724152635`；API active，外网健康仍为 PostgreSQL、S3、真实微信登录。
- 线上主包为 `/assets/index-uzkV0cCX.js`，检查确认包含 `source=onboarding` 的按步骤原生跳转，不包含旧 `campus-growth-profile-ready` 首次启动逻辑。
- 微信开发版本 `0.1.14` 已上传，描述“修正微信资料步骤位置 20260724”，包体 19,745 字节；`0.1.13` 不应再选为体验版。
- `0.1.14` 预览码：`output/wechat-preview/campus-growth-preview-20260724152635.png`；上传记录：`output/wechat-preview/upload-20260724152635.json`。
- 服务器 `/tmp` 发布包和临时脚本已清理；生产 release、数据库备份与本地发布证据保留。

## 2026-07-24 中断任务恢复与本地 QA 收口

### 恢复依据与代码修复

- 根据本日志和中断任务记录继续处理学校认证页。`frontend/src/app/pages/SchoolVerify.tsx` 的教育邮箱、手机号、两类验证码及操作按钮均已有稳定且唯一的可访问名称；目标输入增加唯一 `id`、`name`、`aria-label`，可见标签通过 `htmlFor` 正确关联。
- 发现 `scripts/dev-local.ts` 在 `3001/8080` 已占用时仍会先执行种子化，Vite 还会自动改用其他端口，随后 API 因冲突退出，导致控制台地址与实际服务不一致。
- 启动脚本已改为在种子化前探测 `3001` 和 `8080`，占用时明确退出；Vite 增加 `--strictPort`，不再静默切换端口。重复启动验证返回“端口 8080 已被占用”，原有本地服务健康状态不受影响。

### 自动化与视觉验证

- 完整路由矩阵覆盖 96 个公开、已认证、未认证、学校管理员和平台管理员路由组合，异常数为 0。
- 学校认证页在 390 x 844 下：文档横向溢出为 0，8 个表单控件名称唯一，未标注输入数为 0，小于 44 px 的触控目标数为 0。截图：`output/playwright/qa-20260724/qa-resume-school-verify-390x844.png`。
- 本地登录页“微信登录”按钮真实点击后生成会话并进入目标资源详情 `/resources/r1`，不再出现点击无反应。
- 返回滚动记忆按真实用户滚动方式复核：竞赛列表从 4207 px 点击完整可见卡片进入详情，浏览器返回后仍为 4207 px；资源、社区和组队列表也恢复到进入详情前的位置。此前直接设置 `scrollTop` 的脚本会被新页面置顶定时器覆盖，且 Playwright 点击半可见卡片会自动滚动，因此该次失败属于自动化误报，不是用户路径回归。
- 自动化中的唯一 404 是测试为写入同源 storage 临时打开 `/school-logos/fudan.png` 时浏览器额外请求 `/favicon.ico`；应用页面使用 `index.html` 内联 favicon，自身页面未出现该请求失败。

### 发布门槛与数据边界

- 修改后重新执行 `npm run verify:local-release`：服务端类型检查、前端类型检查、双学校核心业务与管理员闭环冒烟、生产构建全部通过。前端主包 476.53 kB，gzip 137.28 kB，无 500 kB 构建警告。
- 根目录和 `frontend` 分别使用 npm 官方 registry 执行 `npm audit --json`，两处漏洞总数均为 0。
- `output/playwright/qa-db-inspect.mjs` 确认本地预览库不存在 `QA自动测试` 帖子、组队、资料或附件，因此没有执行删除脚本；最后一次复核仍为全部空数组。
- 微信壳 `pages/profile/index.js`、`pages/webview/index.js`、`app.js` 通过 `node --check`，三个对应 JSON 文件逐个解析成功。
- 微信开发者工具 CLI 已登录并成功执行 preview，AppID 为 `wxda8641cd650537a4`，包体 19,745 字节。新预览码：`output/wechat-preview/qa-resume-preview-20260724.png`；信息：`output/wechat-preview/qa-resume-preview-20260724.json`。
- 只用于自动化审计的 `3999` 临时服务已经停止，Playwright 页面已经关闭；本地应用继续保留在 `http://127.0.0.1:3001/`，API 为 `http://127.0.0.1:8080/api/health`。

### 尚需外部或真机完成

- CLI preview 证明配置和小程序包能够编译，但不能替代真机对 `chooseAvatar`、昵称建议、头像上传、返回学校步骤和微信域名白名单的验证。
- 本轮没有重新部署生产或上传新微信版本；服务器资源恢复前继续以本地预览为准。正式发布时必须重新检查 PostgreSQL、S3、真实微信登录和 HTTPS，不能沿用历史健康结论直接宣称当前线上可用。
- 邮件与短信仍等待阿里云资质、模板、发信域名和生产凭证，当前本地验证码仅用于 mock 测试。

## 2026-07-24 Release 20260724191306 生产部署与微信 0.1.15 上传

### 本地门槛与受控发布包

- 执行 `npm run verify:local-release` 全部通过：服务端类型检查、前端类型检查、双学校核心业务与管理员闭环冒烟、前端生产构建均成功。
- 新构建主包为 `index-43cF8MYE.js`，476.53 kB，gzip 137.28 kB；无大于 500 kB 的构建警告。
- 发布包：`.deploy/campus-growth-20260724191306.tar.gz`，大小 1,653,050 字节，共 76 个条目。
- 发布包 SHA-256：`EAAE215B9FF280CEF4FE0820CB6F1208AB8A307A97A47D94B0C492F8306662CE`；远端接收后哈希完全一致。
- 包内包含服务端源码、`schools-seed.json`、前端生产构建、运行时共享类型和 `mock.ts`；敏感条目扫描为 0，不含 `.env`、SSH 密钥、数据库、上传目录、storage、日志和 `node_modules`。
- 与上一生产 release `20260724152635` 对比，服务端文件哈希差异数为 0。本次生产变更集中在最新前端构建和学校认证表单可访问性修复。

### 服务器预检与数据库备份

- 部署前服务器 `campus-growth-api` 与 Nginx 均为 active，当前 release 为 `20260724152635`，磁盘剩余约 32 GB，`pg_dump` 可用。
- HTTP 返回 301 到 HTTPS；HTTPS 首页为 200，HSTS、`X-Content-Type-Options`、`X-Frame-Options` 和 `Referrer-Policy` 均存在。
- 生产环境文件继续由 `/etc/campus-growth/api.env` 注入，运行用户为 `campus`，未读取或输出其中的敏感值。
- 部署前 PostgreSQL 备份：`/opt/campus-growth/backups/predeploy-20260724191306.sql.gz`，114,450 字节，所有者 `campus:campus`，权限 `0640`。
- 备份 `gzip -t` 通过，SHA-256：`8885907CF58FA7AB0DAEE8BE017387E7DFB6BC07F52ADD85A10F4BE0F435A46C`。

### 生产切换与线上验收

- `scripts/deploy-commercial-release.sh` 成功完成 release 解包、symlink 切换、服务重启和健康检查；当前 symlink 为 `/opt/campus-growth/current -> /opt/campus-growth/releases/20260724191306`。
- 重启窗口出现 3 次预期的 `127.0.0.1:8080` 连接拒绝，随后健康检查通过。systemd 日志中的旧进程退出码 143 来自主动 restart；新进程 `NRestarts=0`，持续 active，不是运行时崩溃。
- 外网 `/api/health` 返回 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`、`paymentsEnabled=false`，且 `dbPath` 指向新 release。
- `/api/schools`、`/api/competitions`、`/api/resources`、`/api/posts`、`/api/teams` 均返回 200；首页和 `/admin` 均返回 200。
- Playwright 390 x 844 验证首页、竞赛、资源、社区、组队和登录页；Playwright 1440 x 900 验证管理端登录页。7 个入口异常数为 0，无横向溢出、控制台错误、页面错误或失败请求。
- 截图：
  - `output/playwright/production-home-20260724191306.png`
  - `output/playwright/production-login-20260724191306.png`
  - `output/playwright/production-admin-20260724191306.png`
- 服务器 `/tmp` 中本次发布包、部署脚本和备份脚本已经删除；生产 release、数据库备份和本地证据保留。

### 微信端同步

- 微信开发者工具 CLI 登录状态为 true，AppID 为 `wxda8641cd650537a4`。
- preview 成功，包体 19,745 字节；二维码：`output/wechat-preview/campus-growth-preview-20260724191306.png`，信息：`output/wechat-preview/campus-growth-preview-20260724191306.json`。
- 开发版本 `0.1.15` 上传成功，描述为“认证表单与发布收口 20260724”；上传信息：`output/wechat-preview/upload-20260724191306.json`。
- CLI 不能将开发版本设为体验版。管理员仍需在微信公众平台的版本管理中手动将 `0.1.15` 设为体验版，再真机验证微信登录、头像、昵称、头像上传、学校选择与返回、浏览收藏、免费资源获取、发布、举报及后台审核。
