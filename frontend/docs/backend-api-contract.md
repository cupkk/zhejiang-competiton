# 校园成长小程序前后端接口定义

更新时间：2026-03-31

适用范围：
- 微信登录
- 首页聚合流
- 竞赛主链路
- 资源主链路
- 组队主链路

前端对接入口：
- `frontend/src/services/app-service.ts`
- `frontend/src/services/backend-api.ts`
- `frontend/src/types/entities.ts`
- `frontend/src/types/api.ts`

## 1. 基础约定

### 1.1 Base URL

开发环境建议：

```text
http://127.0.0.1:8080/api
```

### 1.2 统一返回包

所有接口统一返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

约定：
- `code = 0` 表示成功
- 非 `0` 表示业务失败
- HTTP `401` 表示登录失效，前端会清空本地会话并要求重新登录

### 1.3 鉴权方式

登录成功后返回 `token`，后续受保护接口通过 `Authorization` 头传递：

```text
Authorization: Bearer <token>
```

### 1.4 常用枚举

```text
CompetitionStatus: 报名中 | 即将截止 | 报名未开始 | 已截止
CompetitionSort: 推荐 | 最热 | 即将截止 | 最新
ResourcePriceType: 全部 | 免费 | 付费
MessageCategory: 全部 | 系统 | 组队 | 审核 | 订单
PostCategory: 推荐 | 经验贴 | 问答 | 避坑
TeamRecruitStatus: 招募中 | 审核中 | 已满员
OrderStatus: 已完成 | 待支付 | 退款中
SearchScope: all | competitions | resources | posts | teams
```

## 2. 登录与用户

### 2.1 微信登录

`POST /auth/wechat/login`

请求体：

```json
{
  "code": "wx-login-code"
}
```

响应体：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "jwt-or-session-token",
    "mode": "remote",
    "user": {
      "id": "u1",
      "name": "李同学",
      "mark": "李",
      "school": "A大",
      "major": "软件工程",
      "grade": "大三",
      "bio": "围绕竞赛、组队和产品方向持续积累",
      "focusTags": ["挑战杯", "小程序", "前端"],
      "stats": {
        "favorites": 12,
        "teams": 3,
        "resources": 5,
        "unreadMessages": 2
      }
    }
  }
}
```

### 2.2 当前登录用户

`GET /users/me`

需要鉴权。

返回字段与登录响应里的 `user` 完全一致。

## 3. 首页

### 3.1 首页聚合流

`GET /feeds/home`

当前前端按公开接口接入，不强制鉴权。

响应体：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "heroPrompt": "看见机会，找到资源，拉起队伍，然后真正开始行动。",
    "urgentCompetitions": [],
    "hotResources": [],
    "latestTeams": [],
    "featuredPosts": []
  }
}
```

字段要求：
- `urgentCompetitions` 使用完整 `Competition` 结构
- `hotResources` 使用完整 `ResourceItem` 结构
- `latestTeams` 使用完整 `TeamItem` 结构
- `featuredPosts` 使用完整 `PostItem` 结构

## 4. 竞赛主链路

### 4.1 竞赛列表

`GET /competitions`

Query 参数：

```text
keyword?: string
level?: string
sort?: 推荐 | 最热 | 即将截止 | 最新
limit?: number
```

返回：
- `Competition[]`

### 4.2 竞赛详情

`GET /competitions/{id}`

返回：
- 单个 `Competition`

### 4.3 某竞赛关联资源

`GET /competitions/{id}/resources`

返回：
- `ResourceItem[]`

### 4.4 某竞赛关联组队

`GET /competitions/{id}/teams`

返回：
- `TeamItem[]`

### 4.5 收藏竞赛

`PATCH /competitions/{id}/favorite`

需要鉴权。

请求体：

```json
{
  "favorite": true
}
```

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "targetId": "c1",
    "favorite": true
  }
}
```

### 4.6 报名竞赛

`POST /competitions/{id}/enrollments`

需要鉴权。

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "competitionId": "c1",
    "enrolled": true,
    "status": "enrolled"
  }
}
```

### 4.7 Competition 对象

```json
{
  "id": "c1",
  "title": "第十五届全国大学生数学竞赛",
  "level": "国家级",
  "category": "学科竞赛",
  "host": "中国数学会",
  "target": "全日制本科生",
  "status": "报名中",
  "deadline": "2026-04-15",
  "daysLeft": 16,
  "views": 12500,
  "difficulty": "中高",
  "coverLabel": "数学竞赛",
  "coverGradient": "linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)",
  "tags": ["理科", "个人赛", "保研加分"],
  "description": "竞赛简介",
  "recommendedFor": ["数学基础扎实", "希望冲刺保研"],
  "actionHints": ["先补近三年真题", "梳理高数与线代重点"],
  "viewer": {
    "isFavorited": false,
    "isEnrolled": false
  }
}
```

## 5. 资源主链路

### 5.1 资源列表

`GET /resources`

Query 参数：

```text
keyword?: string
priceType?: 全部 | 免费 | 付费
category?: string
limit?: number
```

返回：
- `ResourceItem[]`

### 5.2 资源详情

`GET /resources/{id}`

返回：
- 单个 `ResourceItem`

### 5.3 我的资源

`GET /users/resources`

需要鉴权。

返回：
- `OwnedResourceItem[]`

### 5.4 订单列表

`GET /orders`

需要鉴权。

返回：
- `OrderItem[]`

### 5.5 收藏资源

`PATCH /resources/{id}/favorite`

需要鉴权。

请求体：

```json
{
  "favorite": true
}
```

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "targetId": "r1",
    "favorite": true
  }
}
```

### 5.6 领取 / 购买资源

`POST /resources/{id}/acquisitions`

需要鉴权。

请求体：

```json
{
  "mode": "free"
}
```

或：

```json
{
  "mode": "paid"
}
```

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "resourceId": "r1",
    "accessStatus": "owned",
    "ownedResource": {
      "id": "mr3",
      "resourceId": "r1",
      "title": "【挑战杯】历年国奖优秀商业计划书合集",
      "type": "PDF / Word",
      "accessType": "free",
      "acquiredAt": "2026-03-31",
      "downloadCount": 0,
      "tags": ["挑战杯", "商分模板", "高分必看"]
    }
  }
}
```

付费资源未支付时返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "resourceId": "r2",
    "accessStatus": "pending_payment",
    "order": {
      "id": "o3",
      "title": "Python 数据分析速成笔记",
      "itemType": "resource",
      "amount": 9.9,
      "status": "待支付",
      "createdAt": "2026-03-31 14:00",
      "resourceId": "r2",
      "coverLabel": "资源订单"
    }
  }
}
```

### 5.7 ResourceItem 对象

```json
{
  "id": "r1",
  "title": "【挑战杯】历年国奖优秀商业计划书合集",
  "type": "PDF / Word",
  "category": "模板",
  "price": 0,
  "downloads": 4520,
  "rating": 4.9,
  "authorName": "学长带飞",
  "authorMark": "飞",
  "authorTitle": "国奖得主",
  "coverLabel": "计划书",
  "coverGradient": "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
  "tags": ["挑战杯", "商分模板", "高分必看"],
  "description": "资源简介",
  "sizeLabel": "12.5 MB",
  "suitableFor": "适合挑战杯、大创、创业赛中前期材料准备",
  "previewPoints": ["排版参考", "赛道结构拆解", "答辩材料延展思路"],
  "relatedCompetitionIds": ["c2"],
  "viewer": {
    "isFavorited": false,
    "accessStatus": "not_acquired"
  }
}
```

## 6. 组队主链路

### 6.1 组队列表

`GET /teams`

Query 参数：

```text
keyword?: string
compId?: string
status?: string
mineOnly?: boolean
```

说明：
- `mineOnly=true` 时返回当前登录用户发起或参与的队伍

返回：
- `TeamItem[]`

### 6.2 组队详情

`GET /teams/{id}`

返回：
- 单个 `TeamItem`

### 6.3 发布组队

`POST /teams`

需要鉴权。

请求体：

```json
{
  "title": "挑战杯项目招前端，已有人做后端和 UI",
  "compId": "c2",
  "compName": "挑战杯创业计划竞赛",
  "target": "准备做校园二手交易小程序",
  "missingRoles": ["前端开发", "PPT 美化"],
  "deadline": "2026-04-10",
  "requirements": ["稳定同步进度", "有基础小程序经验"],
  "schoolLimit": true,
  "contactHint": "审核通过后开放群二维码"
}
```

返回：
- 新创建的 `TeamItem`

### 6.4 申请加入队伍

`POST /teams/{id}/applications`

需要鉴权。

请求体：

```json
{
  "message": "我可以负责前端和答辩稿整理。"
}
```

返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "teamId": "t1",
    "applied": true,
    "status": "pending"
  }
}
```

### 6.5 TeamItem 对象

```json
{
  "id": "t1",
  "title": "大创国家级项目寻靠谱前端，已有后端和 UI",
  "compId": "c2",
  "compName": "挑战杯创业计划竞赛",
  "status": "招募中",
  "target": "开发一款校园二手交易小程序",
  "current": 3,
  "max": 4,
  "missingRoles": ["前端开发", "PPT 美化"],
  "deadline": "2026-04-02",
  "authorName": "李同学",
  "authorMark": "李",
  "authorGrade": "大三",
  "authorMajor": "软件工程",
  "schoolLimit": true,
  "requirements": ["能稳定同步进度", "有基础小程序经验"],
  "contactHint": "通过审核后开放群二维码",
  "viewer": {
    "hasApplied": false,
    "applicationStatus": "none"
  }
}
```

## 7. 辅助接口

这些页面已经在前端里接好了，后端可以按同样结构补齐：

### 7.1 消息中心

`GET /notifications`

Query 参数：

```text
category?: 全部 | 系统 | 组队 | 审核 | 订单
```

返回：
- `NotificationItem[]`

### 7.2 搜索建议

`GET /search/suggestions`

返回：
- `SearchSuggestion[]`

### 7.3 全站搜索

`GET /search`

Query 参数：

```text
keyword: string
scope: all | competitions | resources | posts | teams
```

返回：
- `SearchResultItem[]`

### 7.4 发帖

`POST /posts`

需要鉴权。

请求体：

```json
{
  "title": "我是怎么在大二拿下挑战杯省奖的",
  "category": "经验贴",
  "content": "正文内容",
  "tags": ["挑战杯", "经验分享", "组队"]
}
```

返回：
- 新创建的 `PostItem`

## 8. 后端落地建议

建议优先级：

1. `POST /auth/wechat/login`
2. `GET /users/me`
3. `GET /feeds/home`
4. `GET /competitions`
5. `GET /competitions/{id}`
6. `GET /resources`
7. `GET /resources/{id}`
8. `GET /teams`
9. `GET /teams/{id}`
10. `POST /teams`

前端切换真实接口方式：

1. 保持 `frontend/src/services/backend-api.ts` 的路径不变。
2. 当前 `frontend/config/dev.ts` 已默认使用 `TARO_APP_PREFER_REMOTE=true`。
3. 将 `TARO_APP_API_BASE_URL` 指到真实后端。
4. 初期保留 `TARO_APP_ENABLE_MOCK_FALLBACK=true`，便于未完成接口自动回退。
