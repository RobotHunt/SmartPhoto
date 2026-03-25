# 纯 Session 流程改造策略（暂时抛弃用户体系）

## 1. 适用目标

本文档描述的是一个 **短期可落地方案**：

- 暂时不做正式用户体系闭环
- 暂时不要求登录/注册
- 暂时不要求 `History`、账户资产、钱包、订单、用户归档
- 先让上传、识别、参数、策略、主图、高清图、详情图整条链路都能只靠 `session_id` 跑通

这套方案适合：

- 甲方优先体验完整 AI 生图链路
- 先验证主图与详情图能力
- 先不把“资产归档到账户”作为第一阶段阻塞项

这套方案 **不是最终产品方案**，只是一个阶段性简化方案。

---

## 2. 方案目标

### 2.1 要达到的效果

1. 前端无需登录即可开始完整生图流程
2. 整条流程仍然是真实后端链路，不是本地假数据
3. 所有页面只依赖 `session_id`
4. 生成主图、高清图、详情图都以当前 `session_id` 继续
5. 登录/注册、账户、历史记录、资产归档暂时不做

### 2.2 暂时接受的取舍

1. 不提供正式用户登录态
2. 不提供 `History`
3. 不提供用户钱包/订单/支付真实闭环
4. 高清图只按当前 session 视角访问
5. 用户关闭浏览器后，若 session_id 丢失，则不保证找回

---

## 3. 总体改造思路

这套方案的关键是：

### 前端

- 全流程只维护 `current_session_id`
- 不依赖 `auth_token`
- 去掉流程中的登录门禁
- 所有页面只依赖当前 session 数据继续

### 后端

- session 接口允许匿名访问
- 不再强制 `get_current_user_id`
- session 记录允许 `user_id = null`
- 所有会话链路只靠 `session_id` 查找与继续

---

## 4. 前端改造策略

前端工作目录：

- `C:\Users\asus\Documents\New project\dev_free_work`

### 4.1 需要保留的页面链路

主图链路：

1. `upload`
2. `analyze`
3. `platform`
4. `generate`
5. `strategy`
6. `result`
7. `payment`
8. `hd-result`

详情图链路：

1. `hd-result`
2. `copywriting`
3. `detail-confirm`
4. `detail-result`

### 4.2 前端要去掉的用户前置依赖

以下文件需要改成“不依赖登录”：

#### 1. 首页

文件：

- `client/src/pages/Home.tsx`

修改目标：

- `startCreateFlow()` 不再判断 `user`
- 直接清空流程缓存后进入 `/create/upload`

当前问题：

- 现在首页仍会未登录直接跳 `/login`

建议修改：

- 删除 `if (!user) { setLocation("/login"); return; }`

#### 2. 登录上下文

文件：

- `client/src/contexts/AuthContext.tsx`

修改目标：

- 这一阶段不让登录态成为流程阻塞条件
- 可以保留上下文，但不让创建链路依赖它

建议：

- 不删除整个 `AuthContext`
- 但创建流程页面不要再以 `user` 作为进入条件

#### 3. API 401 处理

文件：

- `client/src/lib/api.ts`

当前问题：

- 统一 `401` 会触发强制登出提示
- 这在纯 session 方案下会成为噪音

建议修改：

- 当前阶段如果路径属于 `/sessions/`、`/assets/`、`/jobs/`
- 且后端改成匿名可访问后，正常不会再 `401`
- 保留现有逻辑即可，不需要先删
- 等后端切完后再验证是否还有无意义的认证提示

### 4.3 前端需要保留并继续使用的 session 机制

以下页面已经围绕 `current_session_id` 组织，可以继续保留：

#### 1. 上传页

文件：

- `client/src/pages/create/UploadStep.tsx`

现状：

- 真正上传时创建 session
- 把 `session_id` 写入 `sessionStorage.current_session_id`
- 后续流程可继续复用

建议：

- 保留这套逻辑
- 不再让首页或登录影响它

#### 2. AI 识别页

文件：

- `client/src/pages/create/AnalyzeStep.tsx`

现状：

- 已真实按 `session_id` 触发后端识别
- 可继续复用

#### 3. 参数页

文件：

- `client/src/pages/create/GenerateStep.tsx`

现状：

- 已按 `session_id` 读取和保存参数
- 参数附件与参考图也围绕 `session_id`

#### 4. 策略页

文件：

- `client/src/pages/create/StrategyStep.tsx`

现状：

- 读取当前 session 策略预览

#### 5. 结果页

文件：

- `client/src/pages/create/ResultStep.tsx`

现状：

- 主图生成、恢复、版本切换、单图重生、整体优化都围绕 `session_id`

#### 6. 高清页

文件：

- `client/src/pages/create/PaymentStep.tsx`
- `client/src/pages/create/HDResultStep.tsx`

建议：

- 继续按当前逻辑使用 `current_session_id + current_result_version`
- 不让登录成为前提

#### 7. 详情图链路

文件：

- `client/src/pages/create/CopywritingStep.tsx`
- `client/src/pages/create/DetailConfirmStep.tsx`
- `client/src/pages/create/DetailResultStep.tsx`

建议：

- 全部围绕同一个 `session_id` 延续

### 4.4 前端阶段性建议

当前阶段建议对以下页面做进一步简化：

#### 1. `hd-result`

文件：

- `client/src/pages/create/HDResultStep.tsx`

建议：

- 暂时去掉“登录/注册”提示条的业务含义
- 可以保留模板 UI，但按钮不必强依赖登录
- 也可以暂时隐藏按钮

#### 2. `detail-result`

文件：

- `client/src/pages/create/DetailResultStep.tsx`

建议：

- 同上
- 这阶段不要求 session 归档

#### 3. `History`

文件：

- `client/src/pages/History.tsx`

建议：

- 直接先不开放或隐藏入口
- 因为 session-only 阶段没有正式用户资产体系

---

## 5. 后端改造策略

后端目录：

- `C:\Users\asus\Desktop\smartphoto_backend-main\smartphoto_backend-main`

### 5.1 纯 session 方案的核心原则

后端当前需要从“用户驱动”改成“session 驱动”：

- 所有生成相关接口优先以 `session_id` 为主键
- 不再强依赖当前登录用户
- session 允许 `user_id = null`

### 5.2 需要重点改动的文件

#### 1. 鉴权依赖

文件：

- `app/core/deps.py`

当前问题：

- `get_current_user()` 默认要求 `Bearer token`
- `get_current_user_id()` 进一步要求必须有用户

纯 session 方案建议：

方案 A：最小侵入改法

- 新增一个依赖，例如：
  - `get_optional_user()`
  - `get_optional_user_id()`

行为：

- 有 token 就取 user
- 没 token 返回 `None`
- 不直接抛 `401`

然后 session 相关接口改成依赖可选用户。

方案 B：快速测试改法

- 直接修改 `get_current_user()`，允许无 token 返回 `None`

不推荐原因：

- 会影响所有依赖该函数的接口
- 范围过大

推荐最终采用方案 A。

#### 2. Session 查询

文件：

- `app/services/repo.py`

当前方法：

- `get_session_or_404(db, session_id, user_id=None)`

当前逻辑：

- 传 `user_id` 时，会过滤 `SessionModel.user_id == user_id`

纯 session 方案建议：

- 保留现方法不动
- 但所有匿名流程接口在调用时不要再传 `user_id`

这样：

- 用户态可继续传 `user_id`
- 纯 session 流程只按 `session_id` 查

#### 3. Session 主接口

文件：

- `app/api/v2/sessions.py`

这是本次需要改动最多的文件。

需要处理的接口包括：

1. `POST /sessions`
2. `GET /sessions/{id}`
3. `POST /sessions/{id}/images`
4. `GET /sessions/{id}/images`
5. `DELETE /sessions/{id}/images/{image_id}`
6. `POST /sessions/{id}/analysis`
7. `GET /sessions/{id}/analysis`
8. `PUT /sessions/{id}/platform-selection`
9. `GET /sessions/{id}/parameters`
10. `PUT /sessions/{id}/parameters`
11. `POST /sessions/{id}/parameters/extract`
12. `GET /sessions/{id}/copy`
13. `PUT /sessions/{id}/copy`
14. `POST /sessions/{id}/copy/regenerate`
15. `POST /sessions/{id}/strategy/preview`
16. `POST /sessions/{id}/generations`
17. `GET /sessions/{id}/results`
18. `POST /sessions/{id}/results/global-edit`
19. `POST /assets/{asset_id}/regenerate` 对应使用的 session 校验链路
20. `POST /sessions/{id}/detail-pages/strategy/preview`
21. `POST /sessions/{id}/detail-pages/generations`
22. `GET /sessions/{id}/detail-pages/results`
23. `GET /sessions/{id}/detail-pages/download`

纯 session 方案的统一改法：

- 把 `user_id: str = Depends(get_current_user_id)` 改成：
  - `user_id: str | None = Depends(get_optional_user_id)`

然后在调用 `get_session_or_404` 时：

- 当前阶段统一传：
  - `get_session_or_404(db, session_id)`

而不是：

- `get_session_or_404(db, session_id, user_id=user_id)`

这样生成链路就可以完全靠 `session_id` 访问。

#### 4. Session 创建

文件：

- `app/api/v2/sessions.py`
- `app/models/session.py`

需要确认：

- `SessionModel.user_id` 是否已经允许空值

如果目前数据库层 `user_id` 不可空：

- 需要修改模型与 migration，让 `user_id` 可空

如果目前数据库已可空：

- `POST /sessions` 创建时直接允许 `user_id=None`

#### 5. Job 归属

文件：

- `app/models/job.py`
- `app/services/jobs.py`
- `app/workers/tasks.py`

需要确认：

- `JobModel.user_id` 是否可空

如果不可空：

- 需要改成可空

原因：

- 纯 session 流程中，analysis / parameter extract / generation / detail generation 都可能没有正式 user

#### 6. 钱包/额度扣费

文件：

- `app/services/user_accounts.py`
- `app/services/pricing.py`
- `app/api/v2/sessions.py`

当前问题：

- 主图整体优化、详情图生成等接口会调用额度扣费
- 这通常依赖 `user_id`

纯 session 方案建议：

短期测试阶段，二选一：

方案 A：临时跳过扣费

- 在生成相关接口里，如果 `user_id is None`
- 则跳过 `charge_wallet_for_action(...)`

方案 B：给匿名 session 一个测试额度账户

- 实现更复杂，不推荐短期做

当前阶段推荐方案 A。

#### 7. History / Account 相关

文件：

- `app/api/v2/account.py`
- `app/services/account_*`

当前阶段建议：

- 不改
- 前端直接不走 history / account

---

## 6. 推荐的后端实际改法（最小可跑版）

### 第一步：新增可选用户依赖

文件：

- `app/core/deps.py`

新增：

1. `get_optional_user(...)`
2. `get_optional_user_id(...)`

逻辑：

- 有 token -> 返回当前用户
- 没 token -> 返回 `None`
- 不抛 `401`

### 第二步：生成相关 session 接口全部改用可选用户

文件：

- `app/api/v2/sessions.py`

改法：

- 所有生成链路接口，把 `Depends(get_current_user_id)` 改成 `Depends(get_optional_user_id)`
- `get_session_or_404` 不再传 `user_id`

### 第三步：创建 session 允许匿名

文件：

- `app/models/session.py`
- `app/api/v2/sessions.py`

改法：

- `SessionModel.user_id` 允许空
- 创建 session 时如果没有用户，就写 `None`

### 第四步：jobs 允许匿名

文件：

- `app/models/job.py`
- `app/services/jobs.py`

改法：

- `JobModel.user_id` 允许空

### 第五步：生成扣费逻辑暂时绕过

文件：

- `app/api/v2/sessions.py`
- `app/services/user_accounts.py`

改法：

- 只要当前 `user_id is None`
- 所有主图、详情图、整体优化等额度校验直接跳过

说明：

- 这是阶段性测试方案
- 正式版不能长期保留

---

## 7. 推荐的前端实际改法（最小可跑版）

### 第一步：首页不强制登录

文件：

- `client/src/pages/Home.tsx`

改法：

- `startCreateFlow()` 直接去 `/create/upload`
- 不再判断 `user`

### 第二步：上传页继续沿用真实 session

文件：

- `client/src/pages/create/UploadStep.tsx`

改法：

- 保留当前真实创建 session / 上传图片逻辑

### 第三步：去掉结果页/支付页的登录门禁

文件：

- `client/src/pages/create/ResultStep.tsx`
- `client/src/pages/create/PaymentStep.tsx`
- `client/src/pages/create/HDResultStep.tsx`
- `client/src/pages/create/DetailResultStep.tsx`

改法：

- 不再因为未登录阻断流程
- 先按纯 session 跑通

### 第四步：隐藏或冻结账户相关入口

文件：

- `client/src/pages/Home.tsx`
- `client/src/App.tsx`
- `client/src/pages/History.tsx`
- `client/src/pages/Account.tsx`

改法：

- 首页不引导 `History` / `Account`
- 暂时隐藏导航中的账户入口
- `History` 可暂时下线或不可达

---

## 8. 这套方案的优点

1. 改动目标非常明确
2. 可以最快让甲方体验完整真实 AI 链路
3. 不会被登录/注册/归档逻辑阻塞
4. 不需要前端伪造本地假结果

---

## 9. 这套方案的缺点

1. 没有用户归档
2. 没有正式 `History`
3. 关闭浏览器后 session 可能丢
4. 生成能力默认对匿名开放，安全性低
5. 后续仍要回到 `guest session + claim` 或正式用户体系

---

## 10. 推荐结论

如果目标是：

- 先最快让甲方体验完整真实链路
- 暂时不追求用户、历史、支付、归档

那么建议先上这套 **纯 session 方案**。

如果目标是：

- 最终符合产品正式形态
- 支持登录后认领、History 归档、资产找回

那么下一阶段仍然建议切回：

- `guest session + claim`

一句话概括：

**纯 session 方案适合短期演示与联调，guest session + claim 方案适合正式产品化。**
