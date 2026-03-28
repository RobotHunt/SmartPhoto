import { FeatureRemovedPage } from "@/components/FeatureRemovedPage";

export default function History() {
  return (
    <FeatureRemovedPage
      title="历史资产列表已下线"
      description="当前后端不再提供 `/api/v2/account/assets` 这类账户历史接口。联调时如果需要继续查看结果，请回到当前 session 对应的主图页或详情图页继续操作。"
      badge="历史入口占位"
    />
  );
}
