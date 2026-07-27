# 新前端基线审计

## 来源

- Figma Make 文件：`x0GvcMiJrwnf0O8C4baVek`
- 当前本地基线目录：`frontend/`

这套前端不是旧的小程序工程，而是 Figma Make 导出的 React + Vite 移动端 Web 界面。它现在已经被提升为仓库里的正式前端基线。

## 当前结构

### 页面

- `src/app/pages/Home.tsx`
- `src/app/pages/Competitions.tsx`
- `src/app/pages/Resources.tsx`
- `src/app/pages/Community.tsx`
- `src/app/pages/Profile.tsx`

### 共用层

- `src/app/components/Layout.tsx`
- `src/app/components/BottomNav.tsx`
- `src/app/components/FloatingAI.tsx`
- `src/styles/theme.css`
- `src/styles/index.css`

### 共享层

- `src/types/entities.ts`
- `src/types/api.ts`
- `src/data/mock.ts`

这三类文件已经补回，用来继续承接后端现有的共享类型和种子数据。

## 已发现的问题

1. 原始导出代码存在明显生成式冗余。
   - `src/app/components/ui/` 带了一整套未被页面引用的 shadcn/Radix 组件。
   - 这些组件会拉高依赖面，但当前主页面并没有使用。

2. 部分中文文案存在编码污染。
   - 主要集中在 Figma Make 导出的静态页面与说明文件里。
   - 这类内容已经开始清理，后续新增页面必须直接使用 UTF-8 中文文案。

3. 这套代码是移动端 Web，不是微信小程序工程。
   - 它适合作为新的视觉和交互基线。
   - 如果最终目标仍是微信小程序，还需要二次迁移到真正的小程序技术栈。

4. 业务闭环缺失。
   - 目前只有 5 个主页面。
   - 竞赛详情、资源详情、帖子详情、消息、订单、上传、审核等业务页还没有迁到这一套新界面里。

## 这轮已完成的接入动作

- 把 `校园小程序/` 提升为正式 `frontend/`
- 补回后端共享依赖的 `src/types` 和 `src/data/mock.ts`
- 清理前端包定义，去掉明显不必要的重依赖
- 更新根目录脚本、环境示例和 README

## 接下来要做

### P0

- 继续清理主页面和导航里的编码污染
- 删除未引用的生成式 UI 目录
- 接通与后端的真实数据读取层

### P1

- 补齐详情页与长尾功能页
- 把当前静态卡片改成真实可点击链路
- 完成收藏、报名、组队、订单、下载等前端闭环

### P2

- 如果最终目标是微信小程序，按这套视觉基线迁到真正的小程序工程
- 接入埋点、测试、CI 和部署
