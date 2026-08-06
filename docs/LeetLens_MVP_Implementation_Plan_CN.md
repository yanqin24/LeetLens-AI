# LeetLens Chrome 插件 MVP 开发实施计划

## 1. 文档目标

本文档将 LeetLens MVP 的 PRD 和技术设计拆分为可执行的开发任务。

目标是让项目可以按照清晰的阶段推进：

```text
项目骨架 -> 本地数据层 -> LeetCode 采集 -> 错因确认 -> Dashboard -> 复习与导出
```

每个阶段包含：

- 开发任务
- 验收标准
- 技术风险
- 面试可讲点

## 2. 开发原则

第一版遵循以下原则：

- 先完成端到端闭环，再优化体验
- 本地优先，不引入登录和云同步
- 采集失败时允许降级保存
- 用户错因确认流程必须轻量
- 数据模型要为后续 AI 和云同步预留扩展空间

## 3. Milestone 1：插件基础架构

### 目标

创建可运行的 Chrome Extension MVP 基础工程。

### 开发任务

- 初始化 Vite + React + TypeScript 项目
- 配置 Chrome Extension Manifest V3
- 创建 background service worker 入口
- 创建 content script 入口
- 创建 popup 页面入口
- 创建 dashboard 页面入口
- 配置基础构建脚本
- 配置 ESLint / TypeScript 检查
- 准备基础目录结构

### 验收标准

- Chrome 可以通过 `Load unpacked` 加载插件
- 点击插件图标可以打开 popup
- 可以打开 dashboard 页面
- content script 可以在 `leetcode.com/problems/*` 页面运行
- background service worker 可以接收测试消息
- TypeScript 编译通过

### 技术风险

- Vite 多入口构建 Chrome Extension 需要额外配置
- Manifest V3 service worker 生命周期不是常驻进程
- content script 和 extension page 运行在不同上下文中

### 面试可讲点

- 使用 Manifest V3 架构拆分 popup、content script、service worker
- 通过 TypeScript 定义跨上下文通信协议
- 使用最小权限原则配置 extension permissions

## 4. Milestone 2：本地数据层

### 目标

建立 IndexedDB + Dexie.js 本地数据层，支持错题数据持久化。

### 开发任务

- 安装并配置 Dexie.js
- 定义核心 TypeScript 类型
- 创建 IndexedDB schema
- 实现 Problem repository
- 实现 SubmissionAttempt repository
- 实现 MistakeRecord repository
- 实现 ReviewState repository
- 实现 ReviewLog repository
- 实现 settings 存储
- 实现基础 seed / mock 数据

### 验收标准

- 可以创建和查询 Problem
- 可以保存一次 failed SubmissionAttempt
- 可以创建 uncategorized MistakeRecord
- 可以创建或更新 ReviewState
- 可以查询今日待复习题目
- 可以清空所有本地数据

### 技术风险

- IndexedDB 查询比关系型数据库更依赖索引设计
- schema migration 需要从第一版开始考虑
- service worker 中访问 IndexedDB 需要确保异步流程稳定

### 面试可讲点

- 设计 local-first persistence layer
- 使用 normalized stores 表达 Problem、Attempt、Mistake、Review 的关系
- 使用 IndexedDB indexes 支持 dashboard 查询和复习列表

## 5. Milestone 3：LeetCode 页面采集

### 目标

在 LeetCode 题目页自动检测失败提交并提取关键数据。

### 开发任务

- 判断当前页面是否为 LeetCode problem page
- 从 URL 解析 problem slug
- 从 DOM 提取题目标题、题号、难度
- 尝试提取题目标签
- 提取当前编程语言
- 提取当前编辑器代码
- 使用 MutationObserver 监听提交结果区域
- 识别失败状态：Wrong Answer、TLE、Runtime Error、Compile Error
- 提取错误信息、失败用例、expected / actual output
- 生成 submission fingerprint
- 防止同一次提交重复记录
- 通过 message passing 发送 capture 请求

### 验收标准

- Wrong Answer 可以被捕捉
- Time Limit Exceeded 可以被捕捉
- Runtime Error 可以被捕捉
- Compile Error 可以被捕捉
- 同一次提交不会重复记录
- 代码提取失败时仍能保存题目和错误类型
- Accepted 不创建 MistakeRecord

### 技术风险

- LeetCode 页面结构可能变化
- Monaco Editor 内容不一定容易从 content script 读取
- 页面结果可能异步多次渲染
- DOM 文案和布局可能因 LeetCode A/B 测试变化

### 面试可讲点

- 使用 MutationObserver 处理 SPA 页面异步渲染
- 设计降级采集策略，保证核心数据不丢失
- 使用 fingerprint 去重，避免重复写入

## 6. Milestone 4：错因确认 UI

### 目标

在失败提交后展示页面内浮层，让用户快速确认错因。

### 开发任务

- 创建 In-Page Mistake Panel
- 显示题目名称、提交结果、语言
- 展示主错因选项
- 展示子错因选项
- 支持用户添加备注
- 支持保存错因
- 支持忽略本次记录
- 支持不再记录当前题
- 支持关闭浮层
- 保存成功后展示状态反馈

### 验收标准

- 失败提交后浮层自动出现
- 用户 5 秒内可以完成主错因选择
- 错因保存后 Dashboard 可见
- 用户不选择错因时记录仍保留为 uncategorized
- 不记录当前题后，后续该题失败不再自动保存

### 技术风险

- LeetCode 页面样式可能影响浮层展示
- content script 注入 React UI 需要隔离样式
- 浮层不能遮挡用户核心做题操作

### 面试可讲点

- 将自动采集和用户确认拆成两步，提高数据质量
- 在第三方网页中注入可控 UI，同时避免样式污染
- 优化用户流程，降低手动记录成本

## 7. Milestone 5：Dashboard 和单题详情

### 目标

实现错题管理、筛选、统计和单题复盘页面。

### 开发任务

- 创建 dashboard layout
- 实现顶部统计卡片
- 实现今日待复习列表
- 实现错题列表
- 实现筛选器：难度、标签、错因、状态、提交结果、时间范围
- 实现列表排序：下次复习时间、最近错误时间、错误次数
- 实现单题详情页
- 展示历史失败提交
- 展示错误代码和错误信息
- 支持编辑错因和备注
- 支持删除单条记录
- 支持打开原 LeetCode 题目

### 验收标准

- Dashboard 可以展示所有错题
- 顶部统计数据正确
- 筛选条件生效
- 单题详情可以看到历史错误
- 用户可以修改错因和备注
- 用户可以跳转回 LeetCode 原题

### 技术风险

- IndexedDB 聚合查询需要在应用层处理
- 多筛选组合可能导致状态管理复杂
- 错误代码展示需要处理长文本和格式化

### 面试可讲点

- 设计面向复习决策的 dashboard
- 使用本地索引和应用层聚合生成统计数据
- 按题目聚合 attempts，同时保留历史失败详情

## 8. Milestone 6：复习状态、导出和设置

### 目标

完成复习闭环、数据导出和用户设置。

### 开发任务

- 实现 ReviewState 更新逻辑
- 实现 ReviewLog 创建逻辑
- 支持复习结果：forgot、partially remembered、remembered、solved again、failed again
- 根据复习结果计算 nextReviewAt
- 支持 JSON 导出
- 支持 Markdown 导出
- 支持清空所有数据
- 支持自动记录开关
- 支持页面浮层开关
- 支持默认加入复习开关

### 验收标准

- 今日待复习列表根据 nextReviewAt 正确生成
- 用户标记复习结果后，下次复习时间正确更新
- 连续掌握后可以标记 mastered
- JSON 导出包含所有核心数据
- Markdown 导出可读
- 清空数据后 dashboard 进入空状态
- 设置项生效

### 技术风险

- 复习时间计算需要处理本地时区
- 导出数据需要避免字段丢失
- 清空数据需要确保所有 stores 一致删除

### 面试可讲点

- 实现 explainable spaced repetition scheduling policy
- 支持数据可携带性和用户隐私控制
- 使用 review logs 构建长期学习行为数据

## 9. 推荐开发顺序

建议实际开发顺序：

```text
1. 初始化项目骨架
2. 建立类型系统和数据模型
3. 实现 Dexie 本地数据层
4. 做 popup 和 dashboard 的 mock 数据展示
5. 实现 content script 基础检测
6. 接通 content script -> background -> IndexedDB
7. 实现页面内错因确认浮层
8. 完善 dashboard 筛选和详情页
9. 实现复习规则
10. 实现导出、清空和设置
11. 做端到端测试和手动测试
```

这个顺序的好处是：

- 先保证工程可以运行
- 先保证数据层稳定
- 再处理 LeetCode 页面采集的不确定性
- 最后补齐体验和复习闭环

## 10. MVP 完成定义

MVP 可以认为完成，当以下功能全部可用：

- 插件可以安装并加载
- 用户在 leetcode.com 提交失败后，插件可以自动记录
- 记录中包含题目、语言、代码、结果和错误信息
- 用户可以选择错因和备注
- Dashboard 可以查看和筛选错题
- 单题详情可以查看历史失败记录
- 用户可以完成复习并更新掌握状态
- 用户可以导出 JSON / Markdown
- 用户可以清空本地数据

## 11. 面试项目叙事

项目可以这样介绍：

```text
I built LeetLens, a local-first Chrome extension that automatically captures failed LeetCode submissions and turns them into a structured mistake review system for coding interview preparation.
```

可强调的工程点：

- Manifest V3 Chrome Extension architecture
- Content script extraction from a third-party SPA
- Background service worker message routing
- IndexedDB / Dexie local-first persistence
- Normalized client-side data model
- Deduplication strategy for repeated DOM updates
- Review scheduling algorithm
- Privacy-first design
- React dashboard with filtering and aggregation

## 12. 简历 Bullet 草稿

英文简历可使用：

```text
- Built LeetLens, a Manifest V3 Chrome extension using TypeScript and React to automatically capture failed LeetCode submissions and convert them into structured mistake review records.
- Designed a local-first IndexedDB/Dexie persistence layer with normalized stores for problems, submission attempts, mistake classifications, and spaced repetition review states.
- Implemented content scripts with DOM observation and deduplication logic to extract problem metadata, source code, runtime errors, and failed test cases from LeetCode pages.
- Developed a React dashboard for filtering coding mistakes by topic, difficulty, error category, frequency, and next review date.
```

