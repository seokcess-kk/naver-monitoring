import OpenAI from "openai";
import { logApiUsage } from "./api-usage-logger";

interface ReviewData {
  reviewText: string;
  sentiment: string | null;
  keywords: string[];
  summary: string | null;
  reviewDate: Date | null;
}

interface ExecutiveSummary {
  overallSummary: string;
  positivePoints: string[];
  negativePoints: string[];
  recommendations: string[];
}

interface SentimentKeywords {
  positive: Array<{ keyword: string; count: number }>;
  negative: Array<{ keyword: string; count: number }>;
  all: Array<{ keyword: string; count: number }>;
}

interface MonthlyTrend {
  period: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export interface ReportData {
  executiveSummary: ExecutiveSummary;
  sentimentRatio: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  };
  sentimentKeywords: SentimentKeywords;
  monthlyTrend: MonthlyTrend[];
}

const REPORT_SYSTEM_PROMPT = `당신은 고객 리뷰 분석 전문가입니다. 주어진 리뷰 데이터를 분석하여 비즈니스에 유용한 인사이트를 제공합니다.

분석 결과는 반드시 아래 JSON 형식으로 반환하세요:
{
  "overallSummary": "전체 리뷰에 대한 2-3문장 요약. 주요 트렌드와 고객 만족도를 설명.",
  "positivePoints": ["긍정적인 포인트 1", "긍정적인 포인트 2", "긍정적인 포인트 3"],
  "negativePoints": ["개선이 필요한 포인트 1", "개선이 필요한 포인트 2", "개선이 필요한 포인트 3"],
  "recommendations": ["비즈니스 개선 제안 1", "비즈니스 개선 제안 2"]
}

각 포인트는 구체적이고 실행 가능해야 합니다. 리뷰에서 언급된 내용을 기반으로 작성하세요.`;

export async function generateExecutiveSummary(
  reviews: ReviewData[],
  placeName: string
): Promise<ExecutiveSummary> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  const defaultSummary: ExecutiveSummary = {
    overallSummary: `${placeName}에 대한 ${reviews.length}개의 리뷰를 분석했습니다.`,
    positivePoints: [],
    negativePoints: [],
    recommendations: [],
  };

  if (!apiKey || reviews.length === 0) {
    return generateFallbackSummary(reviews, placeName);
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const positiveReviews = reviews.filter((r) => r.sentiment === "Positive");
    const negativeReviews = reviews.filter((r) => r.sentiment === "Negative");
    const neutralReviews = reviews.filter((r) => r.sentiment === "Neutral");

    const sampleSize = 30;
    const sampleReviews = [
      ...positiveReviews.slice(0, Math.ceil(sampleSize * 0.4)),
      ...negativeReviews.slice(0, Math.ceil(sampleSize * 0.4)),
      ...neutralReviews.slice(0, Math.ceil(sampleSize * 0.2)),
    ];

    const reviewSummaries = sampleReviews
      .map((r) => `[${r.sentiment}] ${r.summary || r.reviewText.slice(0, 100)}`)
      .join("\n");

    const userPrompt = `장소명: ${placeName}
총 리뷰 수: ${reviews.length}개
긍정: ${positiveReviews.length}개 (${Math.round((positiveReviews.length / reviews.length) * 100)}%)
부정: ${negativeReviews.length}개 (${Math.round((negativeReviews.length / reviews.length) * 100)}%)
중립: ${neutralReviews.length}개 (${Math.round((neutralReviews.length / reviews.length) * 100)}%)

주요 리뷰 샘플:
${reviewSummaries}

위 데이터를 기반으로 Executive Summary를 JSON 형식으로 작성해주세요.`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const responseTimeMs = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;

    logApiUsage({
      userId: null,
      apiType: "openai",
      endpoint: "chat.completions/executive-summary",
      success: true,
      tokensUsed,
      responseTimeMs,
      metadata: { model: "gpt-4o-mini", reviewCount: reviews.length },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content);

    return {
      overallSummary: data.overallSummary || defaultSummary.overallSummary,
      positivePoints: data.positivePoints || [],
      negativePoints: data.negativePoints || [],
      recommendations: data.recommendations || [],
    };
  } catch (error) {
    logApiUsage({
      userId: null,
      apiType: "openai",
      endpoint: "chat.completions/executive-summary",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error("[ReportGenerator] OpenAI failed, using fallback:", error);
    return generateFallbackSummary(reviews, placeName);
  }
}

function generateFallbackSummary(reviews: ReviewData[], placeName: string): ExecutiveSummary {
  const positiveCount = reviews.filter((r) => r.sentiment === "Positive").length;
  const negativeCount = reviews.filter((r) => r.sentiment === "Negative").length;
  const total = reviews.length;

  const positiveRatio = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
  const negativeRatio = total > 0 ? Math.round((negativeCount / total) * 100) : 0;

  const allKeywords = reviews.flatMap((r) => r.keywords || []);
  const keywordCounts: Record<string, number> = {};
  for (const kw of allKeywords) {
    keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
  }
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);

  return {
    overallSummary: `${placeName}의 ${total}개 리뷰 중 긍정 ${positiveRatio}%, 부정 ${negativeRatio}%입니다. 주요 키워드: ${topKeywords.join(", ")}`,
    positivePoints: topKeywords.slice(0, 3).map((kw) => `${kw} 관련 긍정적 평가`),
    negativePoints: [],
    recommendations: ["더 많은 리뷰 데이터가 필요합니다."],
  };
}

export function calculateSentimentKeywords(
  reviews: Array<{ sentiment: string | null; keywords: string[] }>
): SentimentKeywords {
  const positiveKeywords: Record<string, number> = {};
  const negativeKeywords: Record<string, number> = {};
  const allKeywords: Record<string, number> = {};

  for (const review of reviews) {
    const keywords = review.keywords || [];
    for (const kw of keywords) {
      allKeywords[kw] = (allKeywords[kw] || 0) + 1;

      if (review.sentiment === "Positive") {
        positiveKeywords[kw] = (positiveKeywords[kw] || 0) + 1;
      } else if (review.sentiment === "Negative") {
        negativeKeywords[kw] = (negativeKeywords[kw] || 0) + 1;
      }
    }
  }

  const toSortedArray = (obj: Record<string, number>, limit: number = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));

  return {
    positive: toSortedArray(positiveKeywords),
    negative: toSortedArray(negativeKeywords),
    all: toSortedArray(allKeywords, 15),
  };
}

export function calculateMonthlyTrend(
  reviews: Array<{ sentiment: string | null; reviewDate: Date | null }>
): MonthlyTrend[] {
  const monthlyData: Record<string, { positive: number; negative: number; neutral: number }> = {};

  for (const review of reviews) {
    if (!review.reviewDate) continue;

    const date = new Date(review.reviewDate);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[period]) {
      monthlyData[period] = { positive: 0, negative: 0, neutral: 0 };
    }

    if (review.sentiment === "Positive") {
      monthlyData[period].positive++;
    } else if (review.sentiment === "Negative") {
      monthlyData[period].negative++;
    } else {
      monthlyData[period].neutral++;
    }
  }

  return Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, data]) => ({
      period,
      ...data,
      total: data.positive + data.negative + data.neutral,
    }));
}
