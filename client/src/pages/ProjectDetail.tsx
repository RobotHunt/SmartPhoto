import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Link, useParams } from "wouter";
// [2026-03-16 静态化改造] 注释掉 tRPC import，静态模式下用 mock 数据
// import { trpc } from "@/lib/trpc";

export default function ProjectDetail() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const projectId = params.id ? parseInt(params.id) : 0;

  // --- 原始代码：通过 tRPC 查询项目数据和图片（已注释） ---
  // [2026-03-16 静态化改造] 目标：不调后端，返回 mock 项目数据
  /*
  const { data: project, isLoading: projectLoading } = trpc.project.get.useQuery(
    { projectId },
    { enabled: !!user && projectId > 0 }
  );

  const { data: images, isLoading: imagesLoading } = trpc.project.getImages.useQuery(
    { projectId },
    { enabled: !!user && projectId > 0 }
  );
  */

  // --- 新代码：Mock 项目数据 ---
  const projectLoading = false;
  const imagesLoading = false;
  const project = {
    id: projectId,
    productName: "空气净化器",
    imageType: "main",
    platforms: "alibaba,douyin",
    originalImageUrl: "/examples/air-purifier-white.jpg",
    processedImageUrl: "/examples/air-purifier.jpg",
    productParams: "CADR: 220m³/h\n功率: 45W\n噪音: 22dB",
    productSellingPoints: "宠物毛发专用吸附\n四重过滤\n静音设计",
    marketingCopy: "为宠物家庭专研的空气净化机，吸毛/除臭/净化",
  };
  const images = [
    { id: 1, imageUrl: "/examples/air-purifier.jpg" },
    { id: 2, imageUrl: "/examples/air-purifier-white.jpg" },
    { id: 3, imageUrl: "/examples/2.jpg" },
    { id: 4, imageUrl: "/examples/3.jpg" },
  ];

  if (authLoading || projectLoading || imagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  if (!user || !project) {
    return null;
  }

  const getPlatformNames = (platforms: string) => {
    const platformMap: Record<string, string> = {
      alibaba: "阿里巴巴",
      "alibaba-intl": "阿里国际",
      douyin: "抖音",
      tmall: "天猫",
      jd: "京东",
      pdd: "拼多多",
      amazon: "亚马逊",
    };
    
    return platforms
      .split(",")
      .map((p) => platformMap[p] || p)
      .join("、");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/history">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{project.productName}</h1>
              <p className="text-sm text-muted-foreground">
                {project.imageType === "main" ? "主图" : "内页图"} · {getPlatformNames(project.platforms)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* 产品信息 */}
          <Card>
            <CardHeader>
              <CardTitle>产品信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">原始图片</h3>
                  <img
                    src={project.originalImageUrl}
                    alt="Original"
                    className="w-full rounded-lg border border-border"
                  />
                </div>
                {project.processedImageUrl && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">处理后图片</h3>
                    <img
                      src={project.processedImageUrl}
                      alt="Processed"
                      className="w-full rounded-lg border border-border bg-white"
                    />
                  </div>
                )}
              </div>

              {project.productParams && (
                <div>
                  <h3 className="text-sm font-medium mb-2">产品参数</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {project.productParams}
                  </p>
                </div>
              )}

              {project.productSellingPoints && (
                <div>
                  <h3 className="text-sm font-medium mb-2">产品卖点</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {project.productSellingPoints}
                  </p>
                </div>
              )}

              {project.marketingCopy && (
                <div>
                  <h3 className="text-sm font-medium mb-2">营销文案</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {project.marketingCopy}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 生成的图片 */}
          {images && images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>生成的图片（{images.length}张）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {images.map((image, index) => (
                    <div key={image.id} className="space-y-2">
                      <div className="relative group">
                        <img
                          src={image.imageUrl}
                          alt={`Generated ${index + 1}`}
                          className="w-full rounded-lg border border-border"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
                        <a
                          href={image.imageUrl}
                          download={`${project.productName}-${index + 1}.jpg`}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Button size="sm" variant="secondary">
                            <Download className="w-4 h-4 mr-1" />
                            下载
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
