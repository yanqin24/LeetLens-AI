# LeetLens Chrome 插件 MVP PRD

## 1. 产品概述

**产品名称：** LeetLens

**产品类型：** Chrome 插件

**目标用户：** 正在刷 LeetCode、准备北美 SDE 面试的学生和求职者

**核心目标：** 自动记录用户在 LeetCode 上的失败提交，帮助用户沉淀错因、形成错题本，并根据复习状态安排后续复习。

LeetLens 第一版不是完整的 AI Agent，而是一个本地优先的 LeetCode 错题记录与复习工具。它的核心价值是把用户每次失败提交转化为可追踪、可分类、可复习的数据。

## 2. 用户问题

用户在刷 LeetCode 时常见的问题包括：

- 提交失败后没有系统记录错误原因
- 手动整理错题成本高，容易中断刷题节奏
- 复习时只知道某道题错过，但忘了为什么错
- 高频错误模式不容易被发现
- 缺少基于个人错误数据的复习计划

## 3. MVP 产品目标

第一版需要完成以下闭环：

```text
失败提交 -> 自动记录 -> 用户确认错因 -> 错题沉淀 -> 定期复习
```

MVP 目标：

- 自动检测 LeetCode 失败提交
- 自动保存题目信息、提交代码、提交结果和错误信息
- 允许用户快速选择错因和添加备注
- 提供错题 Dashboard
- 支持查看单题历史错误
- 提供今日待复习列表
- 所有数据默认本地存储
- 支持数据导出和清空

## 4. 非目标

第一版暂不包含：

- AI 自动错因分析
- AI Agent 问答
- 用户登录
- 云同步
- 多设备同步
- leetcode.cn 支持
- Run Code 失败记录
- 类题推荐
- 社区功能
- 复杂统计图表

## 5. 支持范围

MVP 仅支持：

```text
leetcode.com
```

仅记录：

```text
Submit 后的失败结果
```

失败类型包括：

- Wrong Answer
- Time Limit Exceeded
- Runtime Error
- Compile Error

Accepted 提交第一版不作为错题记录，但可以用于更新题目状态。

## 6. 核心用户流程

### 6.1 失败提交记录流程

```text
用户在 LeetCode 点击 Submit
↓
LeetCode 返回失败结果
↓
插件检测页面提交状态
↓
插件自动抓取题目、代码、语言、错误信息
↓
插件创建一条 SubmissionAttempt
↓
页面浮层提示“已记录本次错误”
↓
用户选择错因和备注
↓
MistakeRecord 更新完成
```

默认行为：

- 插件自动保存失败提交为未分类错题
- 用户不填写错因时，记录仍然保留
- 用户可以之后在 Dashboard 中补充错因

### 6.2 复习错题流程

```text
用户打开 Dashboard
↓
查看今日待复习题目
↓
点击某道题进入详情页
↓
查看历史错误代码、错因、备注
↓
用户重新复习或重做题目
↓
标记复习结果
↓
系统更新下次复习时间
```

### 6.3 查看薄弱点流程

```text
用户打开 Dashboard
↓
查看高频错因和薄弱标签
↓
按错因或标签筛选错题
↓
集中复习同类错误
```

## 7. 页面结构

### 7.1 LeetCode 页面内浮层

触发时机：

- Submit 返回失败结果后自动出现

展示字段：

- 题目名称
- 提交结果
- 使用语言
- 主错因选择
- 可选子错因
- 用户备注
- 保存状态

用户操作：

- 选择主错因
- 选择子错因
- 添加备注
- 保存
- 忽略
- 标记不记录此题

### 7.2 插件 Popup

点击 Chrome 插件图标后展示。

展示字段：

- 今日待复习数量
- 本周新增错题数量
- 最近 3 条错题
- 当前页面是否为 LeetCode 题目页
- 打开 Dashboard 按钮

Popup 只作为快捷入口，不承担复杂管理功能。

### 7.3 Dashboard

Dashboard 是主要管理页面。

顶部统计：

- 今日待复习数量
- 本周新增错题数量
- 最高频错因
- 最薄弱题目标签

筛选条件：

- 错因
- 难度
- 标签
- 复习状态
- 提交结果
- 时间范围

错题列表字段：

- 题号
- 题目名称
- 难度
- 标签
- 最近错误时间
- 错误次数
- 最近失败类型
- 主要错因
- 下次复习时间
- 掌握状态

### 7.4 单题详情页

展示字段：

- 题目基本信息
- LeetCode 原题链接
- 历史失败提交
- 每次失败代码
- 错误信息
- 错因分类
- 用户备注
- 复习历史
- 当前掌握状态

用户操作：

- 修改错因
- 添加备注
- 标记复习结果
- 删除记录
- 打开 LeetCode 原题

## 8. 错因分类

第一版采用两层分类。

### 8.1 主错因

```text
1. 语法 / API 错误
2. 题意理解错误
3. 思路错误
4. 边界条件遗漏
5. 实现细节错误
6. 复杂度问题
7. 调试习惯问题
```

### 8.2 子错因

**语法 / API 错误**

- 语法写错
- 变量名错误
- 类型错误
- 标准库 API 用错
- 语言特性不熟

**题意理解错误**

- 输入输出理解错
- 约束条件漏看
- 目标条件理解错
- 特殊规则漏看

**思路错误**

- 算法选择错误
- 数据结构选择错误
- 状态定义错误
- 转移关系错误
- 贪心条件错误
- 搜索剪枝错误

**边界条件遗漏**

- 空输入
- 单元素
- 重复元素
- 负数 / 零
- 越界
- 最大最小值
- 奇偶长度

**实现细节错误**

- 下标错误
- 循环条件错误
- 初始化错误
- 更新顺序错误
- 返回值错误
- 指针移动错误

**复杂度问题**

- 时间复杂度过高
- 空间复杂度过高
- 重复计算
- 没有使用缓存
- 数据结构操作低效

**调试习惯问题**

- 没有手动跑样例
- 没有检查极端 case
- 修改后引入新 bug
- 过早提交
- 没有验证复杂度

## 9. 数据模型

### 9.1 Problem

```ts
type Problem = {
  id: string
  leetcodeId: string
  title: string
  slug: string
  url: string
  difficulty: "Easy" | "Medium" | "Hard"
  tags: string[]
  firstSeenAt: string
  lastSeenAt: string
}
```

### 9.2 SubmissionAttempt

```ts
type SubmissionAttempt = {
  id: string
  problemId: string
  submittedAt: string
  language: string
  code: string
  result:
    | "Wrong Answer"
    | "Time Limit Exceeded"
    | "Runtime Error"
    | "Compile Error"
    | "Accepted"
  errorMessage?: string
  failedTestCase?: string
  expectedOutput?: string
  actualOutput?: string
}
```

### 9.3 MistakeRecord

```ts
type MistakeRecord = {
  id: string
  problemId: string
  attemptId: string
  primaryReason: string
  secondaryReason?: string
  note?: string
  confidence: "user_confirmed" | "auto_detected" | "uncategorized"
  createdAt: string
  updatedAt: string
}
```

### 9.4 ReviewState

```ts
type ReviewState = {
  id: string
  problemId: string
  status: "new" | "to_review" | "reviewing" | "mastered"
  mastery: 1 | 2 | 3 | 4 | 5
  nextReviewAt: string
  lastReviewedAt?: string
  reviewCount: number
}
```

### 9.5 ReviewLog

```ts
type ReviewLog = {
  id: string
  problemId: string
  reviewedAt: string
  result:
    | "remembered"
    | "partially_remembered"
    | "forgot"
    | "solved_again"
    | "failed_again"
  note?: string
}
```

## 10. 技术要求

推荐技术栈：

```text
TypeScript
React
Vite
Chrome Extension Manifest V3
IndexedDB
Dexie.js
chrome.storage.local
```

本地存储策略：

- IndexedDB：保存题目、提交、错因、复习记录
- chrome.storage.local：保存用户设置

默认隐私策略：

- 数据只保存在用户本地
- 第一版不上传代码
- 用户可以导出数据
- 用户可以清空所有数据

## 11. 复习调度规则

MVP 使用简单、可解释的复习规则：

```text
首次错误：1 天后复习
复习失败：1 天后复习
部分掌握：3 天后复习
已掌握一次：7 天后复习
连续掌握两次：标记为已掌握
```

## 12. MVP 成功指标

第一版成功标准：

- 失败提交可以被自动捕捉
- 错题记录可以稳定保存
- 用户愿意在失败后选择错因
- Dashboard 能帮助用户找到待复习题目
- 用户可以通过错因和标签发现薄弱点
- 数据可以稳定导出和删除

## 13. 第一版开发里程碑

### Milestone 1：插件基础架构

- 创建 Manifest V3 Chrome 插件
- 配置 TypeScript、React、Vite
- 实现 popup、dashboard、content script 基础入口

### Milestone 2：LeetCode 失败提交检测

- 识别 leetcode.com 题目页
- 监听 Submit 后的页面结果变化
- 抓取题目、语言、代码、错误信息
- 避免重复记录同一次提交

### Milestone 3：本地数据层

- 使用 IndexedDB + Dexie.js
- 建立 Problem、SubmissionAttempt、MistakeRecord、ReviewState、ReviewLog 表
- 实现增删查改和基础索引

### Milestone 4：错因确认体验

- 实现 LeetCode 页面内浮层
- 支持主错因、子错因、备注
- 支持忽略或不记录某题

### Milestone 5：Dashboard 和复习流程

- 实现错题列表
- 实现筛选和基础统计
- 实现单题详情页
- 实现复习状态更新

### Milestone 6：导出和设置

- 支持 JSON / Markdown 导出
- 支持清空所有本地数据
- 支持自动记录开关

