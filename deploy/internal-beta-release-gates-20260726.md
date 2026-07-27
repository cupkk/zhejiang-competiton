# 校园成长平台内测发布门槛

日期：2026-07-26

最新更新：2026-07-27

## 当前已发布版本

- 生产 release：`20260727224653`
- 用户端：[https://campusgrow.top/](https://campusgrow.top/)
- 管理后台：[https://campusgrow.top/admin](https://campusgrow.top/admin)
- 健康检查：[https://campusgrow.top/api/health](https://campusgrow.top/api/health)
- 微信开发版本：`0.1.24`
- 微信壳只保留 `pages/webview/index`，通过 `wx.login` 一次性 code 登录，不在 URL 传 bearer token。

## 已通过门槛

- PostgreSQL、S3、真实微信登录启动成功，支付关闭。
- HTTP 跳转 HTTPS；HSTS、CSP、Permissions-Policy、nosniff、SAMEORIGIN 和 Referrer-Policy 已生效。
- Express 不再暴露 `X-Powered-By`。
- 本轮生产发布前备份：`predeploy-cross-school-email-20260727214105.sql.gz`，129,584 字节，SHA256 `c2ca3f0984e15844ce739b1188160ec9011338db79f0b37c75963e00f028d354`。
- 本轮备份已恢复到临时 PostgreSQL：39 张公开表，核心数据计数检查通过，临时库已删除。
- 上线前最终备份：`predeploy-content-monitor-20260727223518.sql.gz`，130,301 字节，SHA256 `ff17be193becd5a5c413f375f6438eb478370436ebc9218b5ed9a73bdddaee83`；恢复到临时库验证通过。
- 本轮内容写入前备份：`precontent-core-ui-20260726135810.sql.gz`；搜索热修复前备份：`prehotfix-search-20260726140616.sql.gz`。
- 本轮发布前备份已成功恢复到临时 PostgreSQL：38 个公开表，恢复后临时库已删除。
- S3 `HeadBucket` 通过，ACL 没有 AllUsers 或 AuthenticatedUsers 公共授权。
- 30 项国家级赛事具备届次、团队人数、赛程、提交材料、官方来源和最后核验日期；其余内容不向用户公开。
- 组队展示模式只保留浙江大学 4 条招募和 2 条求加入示例；匿名用户可查看明确标注的示例列表与详情，真实校内组队、联系方式和发布权限仍保持隔离。
- 真实组队支持发布者选择“仅本校 / 全部高校”，列表支持“全部高校 / 本校 / 其他学校”；跨校内容仍归属发布学校并由该校管理员审核。
- 组队联系改为发布者必填邮箱和系统邮件客户端直联；站内申请、私聊和撮合入口已关闭，示例不提供虚假邮箱。
- 3 份平台原创资源已经写入 S3；生产“免费领取 -> 下载授权 -> 文件下载”返回 200、`private, no-store`，临时用户和文件均已清理。
- 平台竞赛草稿/发布/归档、平台/学校资源发布、学校隔离、跨校审核拒绝和审计日志自动化通过。
- 390 px 和 414 px 的首页、竞赛、资源、组队、个人、登录路径无横向溢出；触控目标不小于 44 px。
- 首页首次访客会显示浙江大学组队示例，不再出现与组队大厅数据不一致的空状态；模块使用“精选”，不把预览数冒充内容总数。
- 客户端运行时错误、未处理 Promise 和路由错误会脱敏上报；API 5xx 或耗时超过 2 秒会写入服务日志。
- 每日官方内容巡检 timer 已启用；30 个官方来源只写差异记录，官方资讯新增或变化只进入后台审核队列，不自动发布。
- 微信 CLI preview 和 upload 成功，`0.1.24` 包体 3,047 字节；二维码为 `output/wechat-preview/readiness-0.1.24-20260727222030.png`。

## 仍然阻止正式审核的事项

1. 轮换微信 AppSecret

   旧 AppSecret 曾出现在对话中，必须在微信公众平台重新生成，并只写入服务器 `/etc/campus-growth/api.env`。轮换后重启 `campus-growth-api`，真机重新登录验证。不得把新值写入聊天、Git、前端变量或日志。

2. 配置真实邮件和短信

   当前学校认证页面和验证码状态机已存在，但阿里云短信签名/模板、邮件发送域名和生产凭据仍需完成。未接入前不能宣称学校认证闭环可正式使用。

3. 手动设为体验版并真机验收

   微信 CLI 只能上传开发版本，不能替代微信公众平台“选为体验版”。管理员需要把 `0.1.24` 设为体验版，并按 `微信0.1.24真机验收清单 20260727.md` 完成验证。

4. 完成微信后台材料

   核对业务域名、request 合法域名、用户隐私保护指引、服务类目、体验成员和审核说明。业务域名统一使用 `https://campusgrow.top`。

## 依赖审计例外

- 根目录生产依赖：0 个漏洞。
- 前端 `react-router 7.18.1` 命中 `GHSA-qwww-vcr4-c8h2`，公告仅影响 React Server Components mode。
- 当前项目是 React 18 + Vite SPA，没有 RSC server/action 路径，因此该攻击路径不可达。
- `react-router 8.3.0` 要求 Node >=22.22、React/ReactDOM >=19.2.7，当前栈不满足；本轮保留 7.18.1 并记录例外，后续在独立升级分支迁移 React 19 后重新审计。

## 回滚

- 上一 release：`/opt/campus-growth/releases/20260727222030`
- 当前 release：`/opt/campus-growth/releases/20260727224653`
- 应用回滚：把 `/opt/campus-growth/current` 原子切回上一 release，重启 `campus-growth-api`，确认本机和外网健康。
- 数据回滚：仅在确认数据损坏后使用对应 PostgreSQL 备份；恢复前必须先再备份当前数据库，并在临时库验证备份可读。
- Nginx 回滚：`/etc/nginx/conf.d/campus-growth.conf.pre-20260726102158`，恢复后先执行 `nginx -t` 再 reload。

## 审核结论

- 可以进入体验版内测。
- 目前不建议提交微信正式审核，直到 AppSecret 轮换、真实邮件/短信和 `0.1.24` 真机完整闭环全部完成。
