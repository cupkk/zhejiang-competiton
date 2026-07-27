# 管理后台与小程序真实闭环验证 20260706

## 结论

- 已部署 release：`20260706201808`
- 线上 API：`https://campusgrow.top/api`
- 健康状态：PostgreSQL、S3、真实微信登录模式、支付关闭。
- 历史 mock/seed 数据已清理：mock 用户、seed 竞赛、seed 资源、seed 队伍、seed 帖子均为 0。
- 后台和用户端闭环已通过生产 API smoke：用户端提交内容后进入后台审核；后台处理后，用户端公开列表、详情页、我的动态、消息和资源领取状态同步变化。
- 当前公开端内容为 0 条，后台待审队列有 4 条官方国内竞赛资讯，来源为全国大学生创业服务网，均为 `pending`，不会直接公开。

## 本次修复

1. 组队发布改为待审核
   - `server/catalog-service.ts`
   - 新队伍写入 `moderation_status='pending'`。
   - 发起人收到“组队招募已提交”的审核消息。
   - 审核通过后才进入公开组队大厅。

2. 审核状态不再被“处理中”误公开
   - `server/community-service.ts`
   - `processing` 只更新审核任务状态，不改内容公开状态。
   - `approved/rejected` 才回写帖子、评论、组队、资源的内容状态。

3. 审核结果同步到用户端
   - `server/community-service.ts`
   - 帖子、评论、组队、资源审核通过或驳回后，向作者写入消息通知。

4. 队伍审核状态透出给前端
   - `frontend/src/types/entities.ts`
   - `server/catalog-service.ts`
   - `frontend/src/app/pages/TeamDetail.tsx`
   - `frontend/src/app/pages/MyActivity.tsx`
   - `frontend/src/app/components/TeamCard.tsx`
   - 发起人可在详情页和我的动态中看到“审核中/未通过/已通过”。

5. 后台审核台显示真实内容摘要
   - `server/models.ts`
   - `server/helpers.ts`
   - `frontend/src/app/lib/admin-types.ts`
   - `frontend/src/app/pages/admin/AdminModeration.tsx`
   - `frontend/src/app/pages/admin/AdminResources.tsx`
   - `/moderation/tasks` 增加 `targetTitle`、`targetSummary`、`targetOwner`、`targetStatus`。

6. demo 数据清理脚本补全
   - `scripts/clear-demo-data.ts`
   - 补充遗漏的 `r4`、`t3` 和已知乱码资源 ID。
   - 增加孤儿审核任务清理。

7. 增加生产闭环 smoke 脚本
   - `scripts/smoke-admin-miniapp-closure.ts`
   - 临时创建两名测试用户和 session，走真实线上 API，验证完成后自动清理。

## 线上数据清理结果

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

## 生产闭环 smoke 覆盖

脚本：`scripts/smoke-admin-miniapp-closure.ts`

结果：

```json
{
  "ok": true,
  "apiBaseUrl": "https://campusgrow.top/api",
  "checked": [
    "post submit -> hidden -> processing hidden -> approved public",
    "comment submit -> hidden -> approved public",
    "team submit -> hidden -> approved public",
    "team application -> owner approve -> applicant contact visible",
    "resource upload -> submit -> hidden -> approved public -> favorite -> free acquire",
    "report submit -> admin process -> resolved",
    "moderation notifications"
  ]
}
```

smoke 清理后：

```text
smoke_users|0
smoke_posts|0
smoke_resources|0
smoke_teams|0
smoke_reports|0
smoke_tasks|0
totals|0|0|0|0|0|0|0
```

## 官方资讯抓取

执行 `scripts/sync-competition-news.ts --apply --limit=4`，从国内官方来源写入后台审核队列。

当前待审：

```text
news_4fe80800ec2c03|中国国际大学生创新大赛港澳区域赛在香港举办|pending
news_69e8a1b7cf77bd|关于报送中国国际大学生创新大赛（2025）总决赛项目的通知|pending
news_af772af459216e|关于公示中国国际大学生创新大赛（2025） 拟获奖项目名单的通知|pending
news_7d1aeb07e2a027|教育部关于公布中国国际大学生创新大赛（2025）获奖名单的通知|pending
```

公开端验证：

```json
{
  "publicPosts": 0
}
```

后台审核任务验证：

```json
{
  "taskCount": 4,
  "first": {
    "id": "news_4fe80800ec2c03",
    "title": "中国国际大学生创新大赛港澳区域赛在香港举办",
    "summary": "资讯 / 全国大学生创业服务网：中国国际大学生创新大赛港澳区域赛在香港举办",
    "status": "pending",
    "targetStatus": "pending"
  }
}
```

## 本地验证

```text
npm run lint
npm run typecheck:frontend
npm run build:frontend
```

三项均通过。

## 仍需人工确认

- 真机微信 `wx.login` code 只能通过微信开发者工具或手机预览产生，本次未伪造 `demo-code`。
- 真实小程序壳登录仍需在微信开发者工具或手机上点一次，确认微信后台合法域名、web-view 业务域名和 code2Session 正常。
- 当前官方资讯都在后台待审，管理员需要进入审核台人工通过后才会公开到小程序社区。
