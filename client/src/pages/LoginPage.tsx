import { FeatureRemovedPage } from "@/components/FeatureRemovedPage";

export default function LoginPage() {
  return (
    <FeatureRemovedPage
      title="登录与注册能力已下线"
      description="当前前后端联调已经切到纯图片 SaaS 模式。本地创作、生成和下载继续围绕当前 session 完成，不再通过登录、注册或认领流程绑定账户。"
      badge="登录入口占位"
    />
  );
}
