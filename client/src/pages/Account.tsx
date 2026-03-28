import { FeatureRemovedPage } from "@/components/FeatureRemovedPage";

export default function Account() {
  return (
    <FeatureRemovedPage
      title="账户中心已收口为占位页"
      description="后端已经移除账户总览、钱包额度、通知、购买记录和个人资料接口。当前联调请直接回到创作链路，围绕当前 session 查看主图、详情图和下载结果。"
      badge="账户入口占位"
    />
  );
}
