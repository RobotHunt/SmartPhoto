import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { getDefaultAIAdapter, getAIAdapterForFeature } from "./ai/factory";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  project: router({
    // 创建新项目
    create: protectedProcedure
      .input(
        z.object({
          originalImageUrl: z.string(),
          originalImageKey: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const projectId = await db.createProject({
          userId: ctx.user.id,
          originalImageUrl: input.originalImageUrl,
          originalImageKey: input.originalImageKey,
          platforms: "",
          imageType: "main",
          productName: "",
          status: "draft",
        });
        return { projectId };
      }),

    // 上传图片到S3
    uploadImage: publicProcedure
      .input(
        z.object({
          imageData: z.string(), // base64 encoded image
          filename: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 将base64转换为Buffer
        const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // 生成唯一的文件key
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const userId = ctx.user?.id || 'guest';
        const fileKey = `${userId}/uploads/${timestamp}-${randomSuffix}-${input.filename}`;

        // 上传到S3
        const contentType = input.imageData.match(/data:(image\/\w+);/)?.[1] || "image/jpeg";
        const { url } = await storagePut(fileKey, buffer, contentType);

        return { url, key: fileKey };
      }),

    // 更新项目信息
    update: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          platforms: z.string().optional(),
          imageType: z.enum(["main", "detail"]).optional(),
          productName: z.string().optional(),
          productParams: z.string().optional(),
          productSellingPoints: z.string().optional(),
          marketingCopy: z.string().optional(),
          processedImageUrl: z.string().optional(),
          processedImageKey: z.string().optional(),
          status: z.enum(["draft", "processing", "completed", "failed"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { projectId, ...updateData } = input;
        await db.updateProject(projectId, updateData);
        return { success: true };
      }),

    // 获取项目详情
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new Error("Project not found");
        }
        return project;
      }),

    // 获取用户的所有项目
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProjectsByUserId(ctx.user.id);
    }),

    // AI图片分析
    analyzeImage: publicProcedure
      .input(
        z.object({
          imageUrl: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const adapter = getAIAdapterForFeature('imageAnalysis');
        return await adapter.analyzeImage(input.imageUrl);
      }),

    // AI抠图功能
    removeBackground: publicProcedure
      .input(
        z.object({
          imageUrl: z.string(),
          backgroundColor: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const adapter = getAIAdapterForFeature('backgroundRemoval');
        return await adapter.removeBackground(input.imageUrl, {
          backgroundColor: input.backgroundColor || 'white',
        });
      }),

    // 生成详情页文案
    generateDetailCopy: publicProcedure
      .input(
        z.object({
          productType: z.string(),
          productName: z.string(),
          platform: z.string(),
          features: z.array(z.string()).optional(),
          analysisResult: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const featuresText = input.features && input.features.length > 0
          ? `产品特征：${input.features.join("、")}`
          : "";
        const analysisText = input.analysisResult
          ? `产品分析信息：${input.analysisResult}`
          : "";
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一个专业的阿里巴巴1688平台电商详情页文案撰写专家，深谙B2B买家决策心理，擅长撰写专业、可信、有说服力的产品详情页文案。`,
            },
            {
              role: "user",
              content: `请严格按照阿里巴巴1688详情图框架，为以下产品生成6个模块的详情页文案：
产品类型：${input.productType}
产品名称：${input.productName}
平台：${input.platform}
${featuresText}
${analysisText}

必须严格按照以下6个模块顺序生成，type字段使用英文key，title字段使用中文标题，content字段写文案内容：
1. type: "product_display" | title: "产品展示" | 【简洁】定制款式+核心参数，1-2句话
2. type: "core_selling_point" | title: "核心卖点" | 【简洁】3个核心卖点，每点一行，每点不超过20字
3. type: "function_description" | title: "功能说明" | 【简洁】3-4条功能说明，每条一行，简短有力
4. type: "product_details" | title: "产品细节" | 【简洁】2-3条细节亮点，每条一行
5. type: "usage_scenarios" | title: "使用场景" | 【简洁】2-3个典型场景，每个一行
6. type: "product_parameters" | title: "产品参数" | 【简洁】关键参数列表，每项一行，格式：参数名：数值
要求：所有模块文案务必简洁精炼，每个模块总字数不超过100字。`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "detail_copy",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", description: "模块类型，如：主图文案、卖点、功能、场景、评价" },
                        title: { type: "string", description: "模块标题" },
                        content: { type: "string", description: "模块内容" },
                      },
                      required: ["type", "title", "content"],
                      additionalProperties: false,
                    },
                    description: "详情页各模块文案",
                  },
                },
                required: ["sections"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        if (!content || typeof content !== "string") {
          throw new Error("详情文案生成返回空结果");
        }
        return JSON.parse(content) as { sections: { type: string; title: string; content: string }[] };
      }),
    // 生成营销文案
    generateCopy: publicProcedure
      .input(
        z.object({
          productType: z.string(),
          productName: z.string(),
          platform: z.string(),
          features: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const adapter = getAIAdapterForFeature('copyGeneration');
        return await adapter.generateCopy({
          productType: input.productType,
          productName: input.productName,
          platform: input.platform,
          features: input.features,
        });
      }),

    // 生成产品图片
    generateImages: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          processedImageUrl: z.string(),
          productName: z.string(),
          marketingCopy: z.string(),
          platforms: z.string(),
          imageType: z.enum(["main", "detail"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const platformNames = input.platforms.split(",").join("、");
        const imageTypeText = input.imageType === "main" ? "主图" : "详情页图";

        // 生成4张不同风格的图片
        const prompts = [
          `Create a professional e-commerce ${imageTypeText} for ${platformNames} platform. Product: ${input.productName}. Style: Clean and modern with white background. Include the product image prominently. ${input.marketingCopy}`,
          `Create a premium e-commerce ${imageTypeText} for ${platformNames} platform. Product: ${input.productName}. Style: Elegant with soft shadows and gradient background. Highlight product features. ${input.marketingCopy}`,
          `Create an eye-catching e-commerce ${imageTypeText} for ${platformNames} platform. Product: ${input.productName}. Style: Vibrant colors with promotional elements. ${input.marketingCopy}`,
          `Create a minimalist e-commerce ${imageTypeText} for ${platformNames} platform. Product: ${input.productName}. Style: Simple and clean design focusing on the product. ${input.marketingCopy}`,
        ];

        const generatedImages = [];

        for (let i = 0; i < prompts.length; i++) {
          const result = await generateImage({
            prompt: prompts[i],
            originalImages: [
              {
                url: input.processedImageUrl,
                mimeType: "image/jpeg",
              },
            ],
          });

          if (!result.url) {
            throw new Error("Image generation failed: no URL returned");
          }

          const imageId = await db.createGeneratedImage({
            projectId: input.projectId,
            imageUrl: result.url,
            imageKey: `generated-${input.projectId}-${i}`,
            prompt: prompts[i] || "",
            orderIndex: i,
          });

          generatedImages.push({
            id: imageId,
            url: result.url,
            prompt: prompts[i],
          });
        }

        // 更新项目状态为已完成
        await db.updateProject(input.projectId, { status: "completed" });

        return { images: generatedImages };
      }),

    // 重新生成单张图片
    regenerateImage: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          newPrompt: z.string(),
          processedImageUrl: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await generateImage({
          prompt: input.newPrompt,
          originalImages: [
            {
              url: input.processedImageUrl,
              mimeType: "image/jpeg",
            },
          ],
        });

        // 这里可以选择更新现有图片或创建新图片
        // 暂时返回新生成的URL
        return { url: result.url };
      }),

    // 获取项目的生成图片
    getImages: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getGeneratedImagesByProjectId(input.projectId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
