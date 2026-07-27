# 校园成长平台研究进展日志

## 总体研究进展

- 项目目标：面向全国高校学生提供按学校隔离的竞赛、资料、社区和组队服务，并由平台管理员与学校管理员分级运营。
- 当前阶段：服务器已过期，本阶段仅完成本地 P1 界面与业务闭环，不连接服务器、不上传微信体验版。
- 本轮目标：完成核心体验，并补齐平台公共内容与学校内容的明确范围、双通道学校认证访问门槛。
- 当前结果：核心体验、`platform / school` 内容范围、教育邮箱与手机号双验证门槛、双学校自动化测试矩阵和本校首页内容均已完成；使用独立 SQLite 预览库、真实本地 API、学校隔离和审核状态完成 API 与浏览器闭环，390px 与 414px 移动视口验收通过。
- 当前阻塞：无本地功能阻塞。生产构建仍有单个 JS 包大于 500 kB 的性能警告，后续可通过路由懒加载处理，但不影响本轮本地预览。
- 下一步：等待体验确认后处理路由级代码分割、正式短信邮件配置和上线前生产环境复核；恢复服务器前不执行部署和微信上传。后续新增内容必须显式写入 `content_scope` 与正确的 `school_id`。

## 2026-07-22 P1 前三项实现

### 1. 首页补充本校内容

- `frontend/src/app/pages/Home.tsx`
  - 增加单行公告入口。
  - 增加“本校正在组队”，首页最多展示 2 条已审核招募。
  - 增加“本校经验”，首页最多展示 2 条已审核帖子。
  - 内容顺序调整为：本校组队、推荐竞赛、本校经验、热门资源。
- 首页继续使用真实 `/api/feeds/home` 数据，不增加静态假数据。
- API 验证结果：`latestTeams=2`、`featuredPosts=2`、`urgentCompetitions=2`、`hotResources=2`。

### 2. 组队大厅双模式

- `frontend/src/app/pages/Teams.tsx`
  - 增加“找队伍 / 求加入 / 我的发布”三段切换。
  - URL 分别为 `/teams`、`/teams?type=member_available`、`/teams?mine=true`。
  - 搜索条件和缓存 key 均包含 `listingType`，避免两类列表串数据。
  - 悬浮发布按钮根据当前模式进入“发布招募”或“发布求队”。
- `frontend/src/app/components/TeamCard.tsx`
  - 招募卡片显示人数、缺口角色、参赛目标和截止时间。
  - 求加入卡片显示个人能力、参赛目标和每周投入。
- 不增加站内私聊。用户主动公开微信、邮箱等联系方式，平台只提供信息媒介。

### 3. 结构化组队发布

- `frontend/src/app/pages/PublishTeam.tsx`
  - 支持“发布招募 / 发布求队”切换。
  - 从真实竞赛列表选择关联竞赛。
  - 增加项目简介或个人介绍、当前人数、计划人数、招募角色、已有能力、参赛目标、合作方式、每周投入、要求、有效期和联系方式。
  - 固定展示当前学校范围，并实时复用 `TeamCard` 生成发布预览。
  - 提交后进入原有审核队列，审核通过前不进入公开列表。
- `frontend/src/app/pages/TeamDetail.tsx`
  - 根据招募或求加入类型展示对应结构化字段。
  - 联系操作继续复制公开联系方式。
- `frontend/src/app/lib/domain-options.ts`
  - 集中维护参赛目标、角色、合作方式和投入时间选项。

### 4. 数据模型和服务端

- 修改 `frontend/src/types/entities.ts`、`frontend/src/types/api.ts`、`server/models.ts`、`server/db.ts`、`server/catalog-service.ts`。
- `teams` 表新增并兼容旧记录：
  - `listing_type`
  - `goal_tags_json`
  - `capabilities_json`
  - `collaboration_mode`
  - `weekly_commitment`
- 旧记录默认按 `team_recruit` 处理。
- `/api/teams` 支持 `listingType` 查询，搜索覆盖目标和能力字段。
- `member_available` 不允许创建队伍申请，避免求加入信息被错误用于申请流程。
- 两类发布均复用现有学校范围和后台审核队列。

## 本地闭环验证

### 运行环境

- 前端预览：`http://127.0.0.1:3001/`
- API：`http://127.0.0.1:8080/api`
- 数据库：`server/data/campus-growth-p1-preview.db`
- 健康状态：`sqlite + local storage + mock WeChat + payments disabled`
- 预览库从原本地库复制，未修改 `server/data/campus-growth.db`。

### 真实数据闭环

- 测试用户：陈同学，浙江大学，计算机科学与技术，大三。
- 已审核招募：`t_335c5cf7e1104ab3`。
- 已审核求加入：`t_17a7ed445b034777`。
- 页面提交求加入：`t_ac9ec09f0fd34e36`，状态为审核中。
- 页面提交结构化招募：`t_cf57747f23044474`，状态为审核中。
- 新招募真实入库字段已核对：`listingType=team_recruit`、浙江大学 `schoolId=sch_114`、岗位、能力、目标、合作方式和投入时间均正确。

### 视觉和交互验收

- 390x844：发布招募页横向溢出为 0，所有可见按钮、链接和表单控件均不小于 44px。
- 414x896：首页、找队伍、求加入、发布招募页横向溢出均为 0，所有可见交互目标均不小于 44px。
- 浏览器 console 最终为 0 error、0 warning。
- 悬浮发布按钮位于底部导航上方，底部导航固定；结构化表单标签可正常换行，固定提交区未遮挡末尾内容。

### 截图

- `output/playwright/p1-home-390x844-20260722.png`
- `output/playwright/p1-teams-recruit-390x844-20260722.png`
- `output/playwright/p1-teams-member-390x844-20260722.png`
- `output/playwright/p1-publish-member-390x844-20260722.png`
- `output/playwright/p1-member-detail-390x844-20260722.png`
- `output/playwright/p1-publish-recruit-390x844-20260722.png`
- `output/playwright/p1-home-414x896-20260722.png`
- `output/playwright/p1-teams-recruit-414x896-20260722.png`
- `output/playwright/p1-teams-member-414x896-20260722.png`
- `output/playwright/p1-publish-recruit-414x896-20260722.png`

## 静态检查

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过，1684 个模块完成构建。
- 构建提示：主 JS 约 511 kB，gzip 后约 143 kB，后续可安排路由级代码分割。

## 交接说明

- 本轮未连接过期服务器，未修改线上环境，未上传微信开发版或体验版。
- 本地预览服务在 `3001` 和 `8080` 运行，供当前会话查看。
- 工作区包含大量历史改动和未跟踪文件，不应为整理本轮提交而批量删除或回滚。
- 后续继续前先阅读 `产品反馈建议修改清单 20260721.md` 和本日志，保持现有灰白背景、蓝色交互色、低圆角、低阴影风格。

## 2026-07-22 P1 第 4-6 项实现

本节对应产品反馈清单总编号 7-9：组队信息密度、竞赛筛选重整、竞赛详情结构化。

### 1. 组队卡片、详情与联系方式披露

- `frontend/src/app/pages/TeamDetail.tsx`
  - 详情按项目简介、招募岗位、已有能力、合作要求、发起人、联系方式分区。
  - 联系方式默认折叠，非发布者的详情接口不再直接下发联系方式。
  - 用户主动点击后调用真实披露接口；页面可显示并复制，但不增加站内私聊。
  - 底部保留统一操作区，增加不转账、不缴押金、不提交身份证/银行卡信息的安全提示。
  - 过期组队详情显示“已结束”，关闭联系方式入口。
- `server/catalog-service.ts`、`server/index.ts`
  - 新增 `POST /api/teams/:id/contact-views`。
  - 新增 `team_contact_views` 表，按队伍、用户和上海自然日去重记录披露行为。
  - 过期组队从公开列表、首页和竞赛关联区自动下架；作者的历史记录和详情直链仍可保留查看。
- API 验证：普通详情返回 `contactHint=''`；主动披露后返回真实联系方式；过期内容披露返回 409。

### 2. 竞赛筛选和真实热度

- `frontend/src/app/pages/Competitions.tsx`
  - 分类和级别拆分为两个独立选择器。
  - 分类与登录引导共用方向语义：创新创业、数学建模、编程算法、商科案例、电子硬件、设计艺术、学术科研、语言外语。
  - 级别独立为国家级、省级、校级。
  - 排序保留推荐、最热、即将截止、最新，全部写入 URL。
  - 单次列表限制为 30 条，减少移动端首次渲染压力，其他内容可通过分类和搜索定位。
- `frontend/src/app/components/CompetitionCard.tsx`
  - 卡片同时展示分类、级别、浏览量和真实收藏数。
- `server/catalog-service.ts`
  - `CompetitionQuery` 新增 `category`，分类和级别使用独立 SQL 条件。
  - “最热”先按真实收藏数排序，再按去重浏览量排序。
  - “最新”按数据创建时间排序。
- `server/db.ts`
  - 旧竞赛按标题和标签迁移到统一分类池，电子设计、物联网等不再误归为设计艺术。
  - 有明确日期的赛事按上海日期重算状态和剩余天数，避免过期赛事仍显示“即将截止”。

### 3. 竞赛结构化详情

- `competitions` 表新增：报名开始/结束、比赛开始/结束、团队人数、赛程阶段、奖项、费用、官方联系方式、来源链接、最后核验时间、创建时间。
- 新增 `competition_notices` 表：标题、发布日期、来源地址、文件类型、本地/对象存储地址。
- 新增 `competition_view_events` 表：详情浏览按竞赛、用户或匿名标识、上海自然日去重。
- `frontend/src/app/pages/CompetitionDetail.tsx`
  - 详情顺序为基本信息、赛程阶段、参赛说明、官方通知、相关组队、相关资料、经验帖。
  - 官方通知和赛事官网均为可直接点击链接。
  - 显示最后核验时间及“以赛事官网为准”。
  - 新增竞赛关联经验帖真实接口，继续执行学校隔离：匿名用户看不到浙江大学经验，浙江大学登录用户可以看到。
- 只为已实际验证可访问的挑战杯官方入口补充来源：`https://www.tiaozhanbei.net/`，HEAD 请求返回 200。
- 未核实的报名开始时间、比赛时间、官方联系方式和附件保持空值，页面显示“以官方通知为准”或“待核验”，未编造数据。

### 4. API 与数据库闭环

- `/api/competitions?category=电子硬件` 能返回电子设计、智能汽车、机器人等统一分类内容。
- `/api/competitions?sort=最热` 返回真实 `favoriteCount`，当前样例顺序为收藏 2、1、0。
- `/api/competitions/c2` 返回结构化赛程、官方来源、核验时间和通知入口。
- `/api/competitions/c2/posts` 返回关联经验帖 `p1`。
- `competition_view_events` 中 `c2` 对测试用户在 2026-07-22 只有 1 条记录，多次访问未重复增加浏览量。
- `team_contact_views` 中 `t1` 对测试用户在 2026-07-22 只有 1 条记录，多次查看未重复写入。
- 本轮仍使用 `server/data/campus-growth-p1-preview.db`，未修改原本地数据库，未连接线上服务器。

### 5. 视觉与静态验证

- 390x844：竞赛列表、竞赛详情和组队详情横向溢出为 0，交互目标均不小于 44px。
- 414x896：默认竞赛列表、筛选结果、竞赛详情和组队详情横向溢出为 0，交互目标均不小于 44px。
- 干净 Playwright 会话：0 console error、0 warning。
- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- 构建仍提示主 JS 约 515 kB，gzip 后约 144 kB；路由懒加载继续作为后续性能任务，不阻塞本地预览。

### 6. 新增截图

- `output/playwright/p1-competitions-filters-390x844-20260722.png`
- `output/playwright/p1-competition-detail-final-390x844-20260722.png`
- `output/playwright/p1-team-detail-contact-folded-390x844-20260722.png`
- `output/playwright/p1-team-detail-contact-revealed-390x844-20260722.png`
- `output/playwright/p1-competitions-414x896-20260722.png`
- `output/playwright/p1-competitions-filtered-414x896-20260722.png`
- `output/playwright/p1-competition-detail-authenticated-414x896-20260722.png`
- `output/playwright/p1-team-detail-folded-414x896-20260722.png`

## 2026-07-22 社区问答与本地预览闭环

### 1. 社区问答

- `posts` 表新增 `question_status` 和 `accepted_comment_id`。
- `PostItem` 增加问题状态、采纳评论、作者权限；评论增加 `isAccepted`。
- 社区问答增加“最新 / 待回答 / 已解决”三段筛选，状态写入 URL。
- “待回答”只返回未解决且审核通过评论数为 0 的问答。
- 问答卡片显示“待回答 / 讨论中 / 已解决”，状态来自数据库。
- 发布问答时可以关联真实竞赛，并选择报名、组队、材料、赛制标签。
- 新增 `PATCH /api/posts/:id/accepted-comment`：
  - 只有发帖人可以采纳。
  - 只能采纳当前问答下已审核的回答。
  - 采纳后问题变为 `resolved`，评论显示“已采纳”，回答者收到真实站内通知。
- 修复 `fetchPostComments` 未携带登录令牌的问题，学校私有帖子评论区不再错误返回 403。

### 2. 本地一键启动

- 新增 `npm run dev:local`。
- 命令使用 `server/data/campus-growth-local-preview.db`，自动执行种子脚本并同时启动 API 与前端。
- 默认环境：SQLite、local storage、mock 微信登录、支付关闭。
- 第一次 Windows 实测发现 `spawn` 无法直接执行 `npm.cmd`，已增加 Windows shell 兼容和明确错误输出。
- 最终实测一条命令成功完成种子、API `8080` 和前端 `3001` 启动。

### 3. 双学校测试数据

- 新增 `scripts/seed-local-preview.ts`。
- 固定准备浙江大学、复旦大学各自的测试用户、认证 membership、经验帖、问答、组队和学校管理员。
- 本地学校管理员：`local_zju_admin`、`local_fdu_admin`，仅用于隔离数据库。
- 种子脚本拒绝 PostgreSQL 和非 `local-preview` / `p1-preview` 路径，避免写入生产库。
- 新增 `scripts/smoke-local-core.ts` 和 `npm run test:local-core`。

### 4. 自动化验证

- API 健康状态必须为 `sqlite + mock WeChat`。
- 匿名用户看不到任何 `local_*` 学校帖子。
- 浙江大学用户只能看到浙江大学帖子和组队，复旦大学用户只能看到复旦大学帖子和组队。
- 复旦大学用户访问浙江大学帖子详情被拒绝。
- 非发帖人采纳回答被拒绝。
- 发帖人采纳后，问题状态、采纳评论和已解决筛选同步正确。
- `npm run test:local-core` 最终通过。

### 5. 浏览器用户流程

- 浙江大学会话完成：
  - 首页查看本校组队和本校经验。
  - 组队大厅、结构化发布、竞赛列表和结构化详情正常。
  - 问答最新、待回答、已解决切换正常。
  - 问答详情完成“讨论中 → 采纳回答 → 已解决”。
  - 发布新问答，真实保存竞赛关联、材料标签并进入审核队列。
- 复旦大学会话完成：社区与组队只出现复旦大学本地测试内容，不出现浙江大学测试内容。
- 390x844 问答列表、发布页、详情页横向溢出为 0。
- 414x896 首页、组队、组队发布、竞赛、竞赛详情、社区问答、问答详情、个人页横向溢出均为 0。
- 修复评论区“回复 / 举报”按钮宽度 40px 的问题，最终所有可见交互目标不小于 44px。
- Playwright 最终 0 console error、0 warning。

### 6. 构建与截图

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- 主 JS 约 520 kB，gzip 后约 145 kB，仍建议后续进行路由懒加载。
- 新增截图：
  - `output/playwright/p1-community-qa-latest-390x844-20260722.png`
  - `output/playwright/p1-publish-question-390x844-20260722.png`
  - `output/playwright/p1-question-before-accept-390x844-20260722.png`
  - `output/playwright/p1-question-resolved-390x844-20260722.png`
  - `output/playwright/p1-core-home-414x896-20260722.png`
  - `output/playwright/p1-core-community-qa-414x896-20260722.png`
  - `output/playwright/p1-core-question-resolved-414x896-20260722.png`

## 2026-07-22 内容范围与学校认证硬权限

### 1. 数据模型与迁移

- 竞赛、资源、组队、帖子统一增加 `content_scope`，只允许 `platform` 或 `school`。
- `platform` 内容允许匿名或未完成学校认证的用户访问；`school` 内容必须同时满足学校一致、认证状态为 `verified`、教育邮箱已验证、手机号已验证。
- 默认与写入规则：官方竞赛、官方资源、官方资讯为 `platform`；用户投稿资源、组队和帖子为 `school`。
- 历史用户投稿资源优先按作者的有效学校会员关系回填 `school_id`。3 条作者未选择学校且没有会员记录的旧资源无法真实归属，未强制归入浙江大学，已改为 `rejected` 并写入“作者未完成学校认证”。
- 本地库一致性结果：竞赛 88 条、资源 41 条、组队 5 条、帖子 22 条，范围值、平台内容空学校、可公开校内内容学校 ID 均无异常。

### 2. 统一服务端权限

- `server/helpers.ts` 集中提供已认证学校解析、内容范围判断、详情拒绝和通知目标范围判断，未知范围失败关闭。
- 首页、列表、详情、竞赛关联内容、搜索、收藏、用户活动、消息、组队申请、举报、发布和评论全部复用统一规则。
- 删除作者绕过学校认证的行为；认证失效后，作者也不能继续读取或操作原校内内容。
- 评论点赞增加所属帖子范围校验，不能通过已知评论 ID 跨校操作。
- 通知列表、单条已读、批量已读和个人页未读数使用同一可见范围，不再出现隐藏消息仍计数的问题。
- 前端全站搜索补上登录令牌，已认证用户可搜索本校内容，未认证用户只得到平台结果。
- 业务错误 `school_verification_required` 返回 HTTP 403 和“请先完成教育邮箱和手机号认证”。校内详情不可访问统一返回 HTTP 403。

### 3. 前端认证引导

- 新增统一 `SchoolVerificationNotice`，首页、组队大厅、社区、发布组队、发布帖子、资源投稿和评论区共用。
- 未认证用户仍可浏览平台竞赛、平台免费资源和平台资讯；校内列表为空，三个发布页不渲染表单，只显示认证入口。
- 认证按钮进入现有 `/school-verify`，未创建重复认证流程。

### 4. 本地双学校与未认证夹具

- 新增未认证会话 `local-zju-unverified-session-token`，已选择浙江大学但邮箱和手机号均未验证。
- 浙江大学与复旦大学各增加 1 条明确 `school` 范围的本地资源，用于列表、详情和搜索隔离验证。
- 增加未认证用户的校内收藏、平台收藏、校内消息和平台消息夹具，验证接口过滤和可见统计一致。
- 所有夹具仅写入 `server/data/campus-growth-local-preview.db`，种子脚本继续拒绝 PostgreSQL 和非预览库路径。

### 5. 运行时缺陷与修复

- 增强冒烟首次执行发现 `/api/users/favorites` 返回 500：收藏查询没有选择竞赛新增的赛制、时间和 `stages_json` 字段，映射时解析到 `undefined`。
- 已补齐收藏竞赛 SQL 选择列和真实收藏数，重新执行后接口正常。
- Playwright 首次发布页检查误用了 `/teams/publish` 等不存在路径，被路由解释为详情页并返回 404；核对 `routes.tsx` 后使用真实 `/publish-team`、`/publish-post`、`/publish-resource` 复测，产品路由本身无错误。

### 6. 自动化与浏览器验收

- `npm run test:local-core` 覆盖：未认证用户平台竞赛/资源列表与详情、首页、校内帖子/组队/资源直链、搜索、收藏、用户活动、消息、消息已读、发帖、组队、资源投稿、评论、点赞、举报，以及浙江大学/复旦大学双向隔离。
- 已认证浙江大学用户可见浙江大学组队、资源和问答，不出现复旦大学内容；复旦大学用户访问浙江大学详情返回 403。
- 390x844：首页、组队、社区横向溢出为 0，认证提示可见，校内内容不泄露，底部导航为 `fixed`，可见交互目标最小 44px。
- 414x896：三个发布页横向溢出为 0，只显示认证入口且不渲染发布表单；已认证浙江大学组队与资源页横向溢出为 0。
- 正确路由下 Playwright 最终 0 console error、0 warning。
- 新增截图：
  - `output/playwright/content-scope-unverified-home-390x844-20260722.png`
  - `output/playwright/content-scope-unverified-teams-390x844-20260722.png`
  - `output/playwright/content-scope-unverified-community-390x844-20260722.png`
  - `output/playwright/content-scope-unverified-publish-team-414x896-20260722.png`
  - `output/playwright/content-scope-zju-teams-414x896-20260722.png`

### 7. 最终检查与交接

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过，1685 个模块完成构建。
- 产物：CSS 52.02 kB（gzip 9.84 kB），JS 521.21 kB（gzip 145.20 kB）。主包大于 500 kB 的既有警告仍保留为后续性能任务。
- `git diff --check`：本轮相关文件通过，仅有 Git 的 LF/CRLF 提示，无空白错误。
- 本地服务保持运行：[前端预览](http://127.0.0.1:3001/)；[API 健康检查](http://127.0.0.1:8080/api/health)。本轮未连接服务器、未部署、未上传微信版本。

## 2026-07-22 清单第 3-4 项：学校隔离矩阵与本校首页

### 1. 第 3 项学校隔离自动化测试矩阵

- `scripts/seed-local-preview.ts` 增加浙江大学、复旦大学两条明确为 `school` 范围的校级竞赛，补齐此前只有全国平台竞赛、无法验证校级竞赛隔离的问题。
- 两校各增加 1 条待审核帖子和固定审核任务，用于验证作者待审可见性、同校非作者不可见、异校不可见及学校管理员任务范围。
- `scripts/smoke-local-core.ts` 扩展为用户端与管理端统一矩阵，覆盖：
  - 全国平台竞赛和平台资源对所有学校、未认证用户可见。
  - 浙江大学/复旦大学校级竞赛、资源、帖子、组队的列表、详情、搜索和首页双向隔离。
  - 未认证用户不能读取本校内容，不能发布、评论、点赞或举报校内内容。
  - 已认证作者可以读取自己的待审帖子，同校其他用户和异校用户均返回 403。
  - 浙江大学、复旦大学学校管理员分别登录，后台身份和学校绑定真实返回。
  - 两校待审任务、举报列表互不泄露；学校管理员跨校审核返回 403。
  - 浙江大学管理员审核本校临时帖子后，同校用户可见，复旦大学用户仍不可见。
  - 本校举报审核后真实变为 `resolved`，管理员登录和审核操作真实写入 `admin_audit_logs`。
- 测试使用唯一 `User-Agent` 标记临时审计数据，并在 `finally` 中清理临时帖子、举报、审核任务、通知和测试审计日志。
- 连续运行两次 `npm run test:local-core` 均通过；运行后临时帖子、临时举报、临时审计记录均为 0，证明测试可重复且不污染预览内容。

### 2. 历史学校归属错误修复

- Playwright 首次检查发现首页将“`双非一本如何在大二拿到大创国推`”展示为浙江大学本校经验。
- 数据核验确认该帖子 `author_user_id=NULL`，没有学校会员记录；此前 `backfillContentSchoolIds()` 使用浙江大学作为默认学校，属于无法证明的错误归属。
- 同类问题共涉及 3 条历史帖子和 2 条历史组队，不只修页面过滤，而是修正数据库迁移规则：
  - 只允许根据真实、激活的学校会员关系回填 `school_id`。
  - 不再使用浙江大学默认值。
  - 官方索引内容改为 `platform` 且 `school_id=NULL`。
  - 无法核验学校归属的用户内容清空 `school_id`、设为 `pending`，并自动建立 `content_scope_review` 平台审核任务。
- 最终数据库保留 5 条待人工确认的历史归属审核任务，备注均为“历史内容缺少可核验的学校归属”；这些内容不会出现在任何学校用户端。

### 3. 第 4 项首页本校组队和经验

- `server/catalog-service.ts` 将首页经验源收紧为：`content_scope='school'`、`category='经验贴'`、`moderation_status='approved'`，并继续执行当前已认证学校判断。
- 首页运营配置中即使误选平台资讯或其他学校帖子，也会在服务端被排除，不会进入“本校经验”。
- 未认证用户首页的 `latestTeams` 和 `featuredPosts` 均为空，只保留平台竞赛、平台资源和学校认证入口。
- 已认证浙江大学首页只显示浙江大学组队和有真实浙江大学会员关系的经验；复旦大学首页只显示复旦大学内容。
- 前端最终顺序为：搜索、快捷入口、单行公告、校园图、本校正在组队、推荐竞赛、本校经验、热门资源。
- 本校组队和本校经验均最多显示 2 条；详情继续进入现有组队页和社区页，不在首页堆完整正文。

### 4. 固定上线前检查

- `package.json` 新增 `npm run verify:local-release`，依次执行：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `npm run test:local-core`
  - `npm run build:frontend`
- `README.md` 已补充执行方式和必须先保持 `npm run dev:local` 运行的前置条件。
- 本轮一键检查最终通过：1685 个模块完成构建；JS 521.21 kB、gzip 145.20 kB，仍只有既有的大包警告。

### 5. Playwright 验收

- 浙江大学 390x844：四个内容区顺序正确；浙江大学组队和经验可见；复旦大学内容为 0；横向溢出为 0；可见交互目标最小 44px。
- 复旦大学 414x896：复旦大学组队和经验可见；浙江大学内容为 0；横向溢出为 0。
- 未认证用户 414x896：不显示“本校正在组队”和“本校经验”，显示学校认证入口、推荐竞赛和热门资源；横向溢出为 0，底部导航固定。
- 正确页面最终 0 console error、0 warning。
- 新增截图：
  - `output/playwright/p34-zju-home-final-390x844-20260722.png`
  - `output/playwright/p34-fdu-home-414x896-20260722.png`
  - `output/playwright/p34-unverified-home-final-414x896-20260722.png`

### 6. 交接

- 本地服务保持运行：[前端预览](http://127.0.0.1:3001/)；[API 健康检查](http://127.0.0.1:8080/api/health)。
- 后续不得重新引入“未知学校内容默认归浙江大学”的逻辑；历史 `content_scope_review` 任务只能在查明真实来源后分配学校，否则应拒绝。
- 本轮仍未连接过期服务器、未部署、未上传微信版本。

## 2026-07-22 反馈清单剩余项收口与后台可用性复核

### 1. 完整招募正文闭环

- `teams` 表新增 `full_description TEXT NOT NULL DEFAULT ''`，新库建表和旧 SQLite 迁移均已覆盖。
- `TeamRow`、`TeamItem`、`PublishTeamPayload`、`teamSelect` 和 `mapTeam()` 已贯通该字段。
- 发布接口保存最多 3000 字的完整正文；组队搜索同时检索标题、项目简介、完整正文、角色、目标和能力字段。
- 发布页将“项目简介”收紧为 240 字摘要，新增“完整招募正文”自由文本域；求加入模式对应“补充说明”。
- 详情页在存在正文时增加“完整说明”，列表卡片仍只显示摘要，避免首页和列表信息过载。
- 浙江大学、复旦大学本地组队夹具均写入完整正文，用于真实详情和隔离验证。

### 2. 自动化增强与数据清理

- `scripts/smoke-local-core.ts` 新增完整组队发布闭环：发布待审、作者可读、同校非作者待审不可读、异校不可读、学校管理员队列隔离、跨校审核 403、本校审核通过、同校详情可读、完整正文搜索和 SQLite 直接落库断言。
- 临时组队相关审核任务、通知、联系查看、申请和组队记录统一在 `finally` 清理。
- 增加本校运营候选断言，问答不能混入“推荐经验”。
- 增强冒烟连续运行通过；测试后查询结果：临时组队、临时管理员、临时举报和临时审计记录均为 0。

### 3. 管理后台缺陷与修复

- Playwright 发现本校运营页复选框被全局 `input { width: 100%; min-height: 44px }` 覆盖，导致选项文字在视觉上完全不可见。
- 修复 `frontend/index.html`：普通输入继续保持 44px 触控高度，checkbox/radio 恢复固定 16px 尺寸和稳定 flex 宽度；本校运营、统一审核的批量选择均恢复正常。
- 本校运营推荐组队和推荐经验从前后端同时限制为最多 2 条，与用户首页真实展示上限一致；达到上限后未选项禁用。
- “推荐经验”候选在服务端限制为本校、已审核、`category='经验贴'`，不再出现后台勾选问答但用户首页不生效的情况。
- 修复候选查询时曾把 `category` 条件误加到 `teams` SQL 导致 400 的问题；读取失败响应 `no such column: category` 后已移到帖子查询，并由自动化断言覆盖。
- 平台学校管理页取消默认“浙江大学”搜索词，首次进入展示全国高校；最终本地库显示 2991 所，搜索为空。
- 审计日志把已知操作代码映射为中文动作名称，IPv4 映射地址去除 `::ffff:` 前缀；底层审计值保持不变。

### 4. 浏览器与发布前验收

- 390x844 组队发布页：横向溢出 0，39 个可见控件最小触控尺寸 44px，完整正文输入框正常。
- 414x896 组队详情：横向溢出 0，“完整说明”真实显示。
- 1440x900 学校管理员：只显示总览、本校运营、资源、审核、举报；直接访问学校管理自动回到 `/admin`。
- 1440x900 平台管理员：学校管理默认显示全国 2991 所学校，学校列表、管理员创建/重置/停用界面无横向溢出；审计日志学校、动作、日期筛选正常。
- 最终 Playwright 页面控制台均为 0 error、0 warning。
- 新增截图：
  - `output/playwright/remaining-p1-publish-team-390x844-20260722.png`
  - `output/playwright/remaining-p1-team-detail-414x896-20260722.png`
  - `output/playwright/remaining-admin-school-home-final-1440x900-20260722.png`
  - `output/playwright/remaining-admin-school-moderation-1440x900-20260722.png`
  - `output/playwright/remaining-admin-platform-schools-final-1440x900-20260722.png`
  - `output/playwright/remaining-admin-platform-audit-final-1440x900-20260722.png`

### 5. 最终结果与交接

- `npm run verify:local-release` 全部通过：`lint`、前端类型检查、双学校/后台闭环冒烟和前端生产构建均成功。
- 构建结果：1688 个模块；CSS 53.15 kB（gzip 10.06 kB），JS 538.01 kB（gzip 149.07 kB）。主包大于 500 kB 的既有警告仍存在，后续可按路由拆包，不阻塞当前本地验收。
- 35 条待审资源均为白名单竞赛官方入口索引，不是自动化残留；在来源人工复核前继续保留待审状态，不自动批准。
- 3 条历史帖子和 2 条历史组队继续留在 `content_scope_review`，用户端不可见；只有查明真实学校来源后才能归校，否则应拒绝。
- 本地服务继续运行：[前端预览](http://127.0.0.1:3001/)；[API 健康检查](http://127.0.0.1:8080/api/health)。本轮未连接服务器、未部署、未上传微信版本。
