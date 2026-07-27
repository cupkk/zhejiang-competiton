# 校园成长平台研究进展日志

## 总体进展

- 项目目标：面向高校学生提供竞赛、资料、社区和组队服务，并完成微信小程序内测上线。
- 当前线上版本：`20260713163040`，微信开发版本为 `0.1.9`。
- 当前重点：修复真实登录、退出与首次引导之间的状态闭环，继续收敛移动端交互细节。
- 已完成基础能力：真实微信登录、连续资料引导、学校维度数据隔离、内容审核、资源与组队闭环、管理后台和生产部署。
- 后续工作：完成本次回归验证后发布新的生产 release 和微信开发版本，并进行真机复验。

## 2026-07-14 退出后无法重新体验完整引导

### 问题

- 用户首次完成引导后，主动退出并再次登录，系统直接进入业务页面，无法重新体验完整引导。
- 原因一：`campus-growth:onboarding-complete:{userId}` 完成标记一直保留。
- 原因二：即使删除完成标记，`resolveInitialStep` 仍会因用户资料已经完整而跳过引导。
- 引导页顶部同时显示了进度条和 `1/6` 等数字，不符合当前只保留视觉进度条的设计要求。

### 修改

- 新增 `frontend/src/app/lib/onboarding-state.ts`，按用户维护“主动退出后重播引导”标记。
- `logout()` 在清理 session 前读取当前用户 ID 并写入重播标记，因此个人主页和个人信息页的退出入口都会生效。
- `OnboardingGate` 优先识别重播标记，已完成资料的用户再次登录后也从公告页开始，并完整进入头像昵称、学校、方向、技能、组队状态和个人简介步骤。
- 完成最后一步后清除重播标记，避免同一次登录反复弹出。
- 重播时保留并预填已有资料；跳过个人简介不会清空原有简介。
- `OnboardingShell` 删除 `1/6` 等数字，只保留进度条，并添加 `progressbar` 无障碍语义。

### 验证结果

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- Playwright 390px 本地闭环：
  - 构造资料完整且已有完成标记的用户。
  - 点击“退出登录”后 session 已清除，`onboarding-replay` 为 `pending`。
  - 再次登录后先显示“内测公告”，确认后进入“先认识一下你”。
  - 完整经过学校、竞赛方向、技能、组队状态和个人简介，最终到达“资料已保存”。
  - 完成后 `onboarding-replay` 已删除，完成标记仍为 `done`。
  - 进度条 `aria-valuenow=1`、`aria-valuemax=6`，页面不存在 `1/6` 至 `6/6` 文本。
  - 视口宽度 390px，横向溢出为 0。
- 截图：
  - `output/playwright/onboarding-replay-identity-20260714.png`
  - `output/playwright/onboarding-replay-complete-20260714.png`

### 生产发布与微信同步

- 生产 release：`20260714165035`。
- 发布包：`.deploy/campus-growth-20260714165035.tar.gz`。
- SHA-256：`8CC9831508D65B6A91B1ABB2440187B288C604C27C1AC2C21819CA10101FFB88`。
- 当前线上：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260714165035`。
- API 健康状态：PostgreSQL、S3、真实微信登录、支付关闭。
- 生产资源：`assets/index-BxeS7SjR.js`，包含新的 `onboarding-replay` 逻辑，CSS 查询版本为 `20260714165035`。
- 生产域名 Playwright 回归结果：
  - 退出后 `session=null`、`replay=pending`。
  - 重登显示“内测公告”，随后进入“先认识一下你”。
  - 不显示数字步骤，横向溢出为 0。
  - 截图：`output/playwright/production-onboarding-replay-identity-20260714165035.png`。
- 微信开发者工具：
  - 新预览二维码：`output/wechat-preview/campus-growth-preview-20260714165035.png`。
  - 开发版本 `0.1.10` 上传成功。
  - 描述：`修复退出重登引导与进度条 20260714`。

## 2026-07-14 登录引导增加参赛目标

### 需求与设计

- 在“你关注哪些竞赛？”步骤增加“参赛主要为了什么？”多选区。
- 选项：冲国奖、保研加分、创业落地、兴趣体验、评奖学金。
- 最多选择 2 项，至少选择 1 项后才能继续。
- 与竞赛方向共用简洁标签按钮，不增加图标、渐变或独立卡片。

### 数据处理

- 参赛目标继续保存到真实用户字段 `focusTags`，与现有 API 和后台数据保持兼容。
- `guidedTags` 纳入目标选项，避免目标被误识别为额外标签。
- 登录引导和个人资料编辑的标签上限由 8 调整为 10，避免方向、目标、技能和组队意向合计超过 8 项时静默丢失。
- 已有目标会在再次进入引导时自动回填。

### 验证与发布

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过；主 JS gzip 约 139 kB，Vite 提示原始 chunk 略超过 500 kB，后续可单独进行路由拆包。
- Playwright 390px 本地测试：
  - 未选择方向和目标时“下一步”禁用。
  - 选择“冲国奖、保研加分”后，再点“兴趣体验”不会超过 2 项上限。
  - 保存请求的真实 `focusTags` 为 `创新创业、冲国奖、保研加分`。
  - 下一步成功进入技能页面，横向溢出为 0。
  - 截图：`output/playwright/onboarding-goals-selected-20260714.png`。
- 生产 release：`20260714170619`。
- 发布包 SHA-256：`12D7740DE9D15E2C6CA2941309279AD95CD3487C23A29A448E944D524F5C7DB4`。
- 当前线上：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260714170619`，API 健康。
- 生产资源：`assets/index-DpRWcqft.js`，已确认包含“参赛主要为了什么”。
- 生产 Playwright 390px 验证通过，选中方向及两个目标后横向溢出为 0。
- 生产截图：`output/playwright/production-onboarding-goals-20260714170619.png`。
- 微信开发版本 `0.1.11` 上传成功，描述为 `登录引导增加参赛目标 20260714`。
- 新预览二维码：`output/wechat-preview/campus-growth-preview-20260714170619.png`。
