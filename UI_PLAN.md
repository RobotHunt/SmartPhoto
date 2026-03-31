# SmartPhoto 客户 UI 复刻与支付/等待页重构计划

## Summary
- 本次目标不是局部润色，而是把当前前端里“主图付费页、详情独立付费链路、等待页”整体拉回客户参考稿的销售型 UI 逻辑，同时保留客户认可的更优文案内容。
- 客户想复刻的基准以参考工程 [ai-ecommerce-image-studio(3)/client/src/pages/create](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/pages/create) 为主，尤其是主图付费页、高清结果页、详情确认页的移动端信息层级、价格锚点、按钮节奏和转化导向。
- 当前项目的主要偏差集中在 [App.tsx](/home/wppjkw/SmartPhoto/client/src/App.tsx)、[generationStatus.ts](/home/wppjkw/SmartPhoto/client/src/lib/generationStatus.ts) 和现有 create 流程页：主图 paywall 被改成“确认当前版本结果”，详情链路缺少独立付费页，等待态仍然偏“进度条/百分比/排队中”。

## 客户需求整理
- 主图付费页：
  绿色圈出的结构必须保留原设计，也就是“划线原价 + 大号现价 + 橙色首套优惠角标 + 权益清单 + 大 CTA”的促转化布局。
- 主图付费页：
  红色圈出的文字区允许替换成我们现在更好的文案，但必须放回客户原版的销售页结构里，而不是继续保留当前“确认当前版本结果”的确认页样式。
- 详情图链路：
  详情图必须单独付费，不能和主图共用同一解锁状态，也不能从详情确认页直接进入结果页；要补齐一段独立详情付费页。
- 等待页：
  需要重新设计，不再让用户感知为“排队中”“卡住了”“不知道在等什么”，而是让用户感知到 AI 正在工作、流程有进展、等待是值得的。
- 复刻标准：
  优先复刻客户参考工程里的结构和销售心理，而不是只做到“视觉接近”。

## 客户原始想复刻的页面
- 主图付费参考：
  [PaymentStep.tsx](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/pages/create/PaymentStep.tsx)
  页面核心特征是已选缩略图、套餐名、价格锚点、橙色优惠角标、权益列表、渐变主按钮、底部协议。
- 高清付费参考：
  [HDPaymentStep.tsx](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/pages/create/HDPaymentStep.tsx)
  结构和主图付费页一致，说明客户认可的是这套 paywall 骨架本身。
- 详情确认参考：
  [DetailConfirmStep.tsx](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/pages/create/DetailConfirmStep.tsx)
  核心是“带水印预览确认 + 底部固定 CTA”，这比当前项目里偏规划卡片的详情确认页更接近客户预期。
- 详情结果参考：
  [DetailResultStep.tsx](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/pages/create/DetailResultStep.tsx)
  可以作为详情生成成功后结果页的视觉参考，但不能替代“详情独立付费”这一步。
- 步骤条参考：
  [StepIndicator.tsx](/home/wppjkw/SmartPhoto/ai-ecommerce-image-studio(3)/client/src/components/StepIndicator.tsx)
  客户更接受“明确步骤推进 + 第 5 步围绕生成/支付”的语义，而不是当前“支付确认/确认继续”的弱销售表达。

## Implementation Changes
- 主图支付页恢复为销售型 paywall，保留现有真实数据源，但页面结构固定为：
  步骤条、返回、已选数量、3 张缩略图、套餐标题、原价划线、现价大字、橙色优惠角标、全宽 CTA、权益清单、底部协议。
- 主图支付页文案处理采用“双轨”原则：
  销售结构完全复刻客户参考；权益说明和说明性文案可以替换为我们当前更好的版本。
- 当前主图支付页里的“确认当前版本结果 / 确认并继续 / 当前版本高清结果”语义全部移除，统一回到“解锁高清图”的付费语义。
- 详情流程改造成明确链路：
  `hd-result -> copywriting -> detail-confirm -> detail-payment -> detail-result`
- 新增独立前端路由 `/create/detail-payment`，新增 `DetailPaymentStep`，不再让详情链路复用主图支付语义。
- 详情步骤条从 3 步改为 4 步：
  `文案确认 -> 详情图确认 -> 支付确认 -> 生成详情图`
- `detail-confirm` 改为“带水印详情预览确认页”作为主视觉；当前基于 `detail_strategy_preview.panel_plan` 的规划卡片降级为辅助说明，不再作为主页面叙事中心。
- 详情付费页复用主图 paywall 骨架，但替换为详情语义的数据和权益，且详情支付状态与主图支付状态完全分离。
- `DetailResultStep` 重新定义为“详情已付费后的等待/结果页”，不再承担未付费直接进结果的角色。
- 等待态统一抽成一套共享策略，覆盖主图生成、高清生成、详情生成、分析等页面，不再每页各写一套“转圈 + 百分比”。
- 等待页默认采用混合模式：
  前 10 秒走“确定型等待 UI”，展示阶段感和弱进度，不展示裸百分比；
  超过 10 秒或后端进度不稳定时，切换为“情绪型等待 UI”，展示轮播文案、价值感文案、阶段切换提示和模糊小预览。
- `resolveGenerationStageText` 升级为结构化 waiting-state resolver，不再只返回一个短字符串。
- 全局禁用的等待表达包括：
  `排队中`、卡住的单一百分比、没有阶段解释的纯 loading 圈。
- 前端断点恢复顺序固定：
  已有结果版本则直达结果；有运行中 job 则进入等待态；只有详情规划则回详情确认；未支付则回对应 paywall，不能跳过付费页。
- 若要做到“完美复刻”详情确认页，前端默认需要详情预览接口能提供真实带水印预览图 URL；如果后端仍只给规划信息，则只能先做降级版，不算最终完成态。

## Important Interface Changes
- 新增前端路由：
  `/create/detail-payment`
- 新增前端状态键：
  `detail_payment_success`、`detail_preview_count`、`detail_preview_version`、`detail_unlocked_version`
- 主图继续保留现有状态键：
  `selected_asset_ids`、`selectedImgCount`、`hd_unlocked_version`
- `DetailStepIndicator` 改为 4 步版本，点击回跳规则同步调整。
- 等待页改为消费统一的 waiting-state 配置，而不是各页面自行定义标题、百分比和描述。
- 最小后端补充诉求：
  详情预览接口或现有详情预览返回里增加 `preview_version`、`panels[].preview_image_url`、`watermark_applied`

## Test Plan
- 主图支付页在移动端加载真实已选图片和版本号后，价格区、橙色优惠角标、权益列表、CTA、底部协议都与参考稿结构一致。
- 主图链路仍完整可用：
  结果页选图 -> 主图支付页 -> 高清结果页 -> 进入详情链路。
- 详情链路变为：
  文案确认 -> 水印预览确认 -> 独立详情支付页 -> 详情生成/结果页。
- 主图和详情付费严格独立：
  只付主图时详情仍需付费；只付详情不回写主图解锁状态。
- 所有等待页在 `queue/pending/wait` 等状态下不再展示“排队中”，且 10 秒以上可切到情绪型等待 UI。
- 刷新、返回、恢复已有任务、已有结果版本等路径都不会错误跳过付费页或跳错链路。
- 375px、390px、430px 三档移动端下，步骤条、价格区、底部固定栏、协议文案、图片列表不遮挡不抖动。

## Assumptions
- 默认采用“参考工程是视觉真源，当前项目是数据真源”的原则：UI 贴客户参考，数据继续走现有真实接口。
- 默认新增独立 `detail-payment`，而不是继续复用 `/create/hd-payment`。
- 默认将“详情确认页真预览”列为正式范围；若后端无法补预览图 URL，则只能先交一个临时降级版。
- 当前仍处于 Plan Mode，本轮不写入根目录文件；若切出 Plan Mode，默认将以上内容落盘到 `/home/wppjkw/SmartPhoto/UI_REPLICA_PLAN.md`。
