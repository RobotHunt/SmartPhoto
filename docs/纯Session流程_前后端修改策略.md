# 纯 Session 流程前后端修改策略

## 1. 目的
这份文档描述一套阶段性方案：

- 暂时弱化用户体系
- 让整条创作链路优先围绕 `session_id` 跑通
- 上传、识别、参数、策略、主图、详情图都按真实后端接口执行
- History、账户、正式支付、资产归档等放在后续阶段逐步补齐

这不是最终产品形态，而是一套“先让真实 AI 链路稳定可跑”的落地方案。

## 2. 适用场景
适合以下阶段目标：
- 优先让甲方完整体验整条 AI 生图流程
- 先验证主图与详情图能力
- 暂时不以账户体系作为链路门禁
- 暂时不要求真实支付闭环

## 3. 前端侧策略
前端目录：
- `C:\Users\asus\Documents\New project\dev_free_work`

### 3.1 前端保留的链路
主图链路：
- `upload -> analyze -> platform -> generate -> strategy -> result -> payment -> hd-result`

详情图链路：
- `hd-result -> copywriting -> detail-confirm -> detail-result`

### 3.2 前端核心状态
前端在这套方案里优先维护这些状态：
- `current_session_id`
- `current_result_version`
- `detail_current_version`
- `selected_asset_ids`
- `selectedImgCount`
- `detail_result_autostart`

登录状态可以保留，但不应成为前面创作链路的门禁条件。

### 3.3 前端页面要求
#### Home
文件：
- `client/src/pages/Home.tsx`

要求：
- 点击“立即生图”直接进入 `/create/upload`
- 清空上一次创作流程缓存
- 不强制跳登录

#### Upload
文件：
- `client/src/pages/create/UploadStep.tsx`

要求：
- 真上传时创建 session
- `session_id` 写入 `sessionStorage`
- 之后所有流程基于这个 session 继续

#### Analyze / Platform / Generate / Strategy
要求：
- 全部围绕 `session_id` 调后端真实接口
- 不因未登录而中断

#### Result
要求：
- 主图生成、单图重生、整体优化都以当前 `session_id` 为主线
- 页面刷新时优先恢复已有 job 或已有结果版本
- 不因未登录而中断

#### Payment / HD Result
要求：
- 先允许按当前联调逻辑走高清页面
- 不要求真实支付系统
- 高清结果页继续基于当前 `session_id + version`

#### Detail Confirm / Detail Result
要求：
- 详情图策略与详情图生成继续围绕同一个 `session_id`
- 刷新页面时优先恢复已存在的详情图任务或版本

### 3.4 前端当前适合去掉的门禁
如果采用纯 session 方案，前端以下门禁应先移除：
- 首页“开始生图”先登录
- 上传前先登录
- 参数页前先登录
- 主图生成前先登录
- 详情图生成前先登录

可以保留但不强制的：
- 结果页上的登录 CTA
- 高清结果页上的登录 CTA
- 详情图结果页上的登录 CTA

### 3.5 前端当前不必强求的功能
纯 session 阶段可先不做：
- 正式 History 资产沉淀
- 订单与真实支付闭环
- 登录后自动认领全部历史 guest session
- 账户维度额度管理 UI

## 4. 后端侧策略
后端目录：
- `C:\Users\asus\Desktop\smartphoto_backend-feature_free-sign\smartphoto_backend-feature_free-sign`

### 4.1 最小目标
让所有创作能力优先按 `session_id` 跑通，而不是按用户体系卡住。

### 4.2 核心要求
#### 1. session 可匿名访问
相关文件：
- `app/core/deps.py`
- `app/api/v2/sessions.py`

要求：
- 没有 Bearer token 时，不要直接拒绝所有 session 接口
- 允许 guest actor 基于 cookie + session_id 继续工作

#### 2. session 归属不强依赖 user_id
相关文件：
- `app/models/session.py`
- `app/services/repo.py`

要求：
- session 可以在 guest 模式下存在
- 用户态和 guest 态都能围绕相同 `session_id` 获取和推进流程

#### 3. 真正的创作接口可被 guest 使用
至少应包括：
- `POST /api/v2/sessions`
- `GET|POST|DELETE /api/v2/sessions/{id}/images*`
- `POST|GET /api/v2/sessions/{id}/analysis*`
- `PUT /api/v2/sessions/{id}/platform-selection`
- `POST|GET|PUT /api/v2/sessions/{id}/parameters*`
- `GET|PUT /api/v2/sessions/{id}/copy`
- `POST /api/v2/sessions/{id}/copy/regenerate`
- `POST /api/v2/sessions/{id}/strategy/preview`
- `POST /api/v2/sessions/{id}/generations`
- `GET /api/v2/sessions/{id}/results`
- `POST /api/v2/sessions/{id}/results/global-edit`
- `POST /api/v2/assets/{asset_id}/regenerate`
- `POST /api/v2/sessions/{id}/detail-pages/strategy/preview`
- `POST /api/v2/sessions/{id}/detail-pages/generations`
- `GET /api/v2/sessions/{id}/detail-pages/results`

#### 4. 可先限制下载
允许先把下载保留为登录后能力：
- `GET /api/v2/sessions/{id}/download`
- `GET /api/v2/sessions/{id}/detail-pages/download`

### 4.3 推荐保留的字段
为便于前端统一控制页面表现，建议后端稳定返回：
- `auth_mode`
- `can_download`
- `can_continue_editing`
- `login_required_actions`
- `latest_generate_job_id`
- `latest_detail_generate_job_id`
- `latest_result_version`
- `detail_latest_result_version`

## 5. 阶段性取舍
### 5.1 先接受的现实
- payment 页可以不是正式支付
- hd-result 可以先看作高清结果页壳
- detail-confirm 可以暂时用占位示意图
- guest 不能下载可以接受

### 5.2 暂时不做
- 正式 History 归档
- 订单系统
- 账户余额严谨扣费闭环
- 全站统一登录门禁

## 6. 后续回到正式用户体系时怎么衔接
纯 session 跑通之后，再恢复到正式产品方案时，建议按下面顺序接：

1. 保留当前 guest 全流程能力
2. 在 `hd-result` / `detail-result` 增加登录后 claim
3. claim 后让当前 session 进入用户 History
4. 再补真实支付与高清解锁
5. 最后再完善账户资产、订单、钱包和下载体系

## 7. 当前对后端的建议
如果后端当前要优先支持前端演示，建议优先保证：

1. guest 真实可跑主图和详情图全流程
2. session 快照字段稳定
3. 已有 job 可恢复
4. claim 接口幂等
5. 下载与 History 可先留待登录后处理
