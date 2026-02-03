import OpenAI from "openai";
import { logApiUsage } from "./api-usage-logger";

interface ReviewSummaryInput {
  period: string;
  totalReviews: number;
  sentimentSummary: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topNegativeKeywords: Array<{ keyword: string; negativeRatio: number }>;
  topPositiveKeywords: string[];
}

interface ReviewSummaryResult {
  summary: string;
  suggestions: string[];
}

const SYSTEM_PROMPT = `당신은 리뷰 데이터를 분석하여
운영자가 바로 의사결정에 사용할 수 있는
리뷰 분석 리포트를 작성하는 전문가입니다.

아래 데이터를 기반으로
1) 전체 리뷰 요약 문단 (3~4줄)
2) 개선 제안 3가지를 작성하세요.

작성 규칙:
- 전문적이되 이해하기 쉬운 문장 사용
- 과장하거나 추측하지 말 것
- 반드시 제공된 데이터만 활용
- 출력은 아래 JSON 형식을 정확히 따를 것
- summary는 가독성이 좋은 문단 형태로 작성할 것

{
  "summary": "3~4줄 요약 문단",
  "suggestions": [
    "구체적이고 실행 가능한 제안",
    "키워드 기반 제안", 
    "운영 또는 커뮤니케이션 관련 제안"
  ]
}`;

function buildUserPrompt(input: ReviewSummaryInput): string {
  const negativeKeywordsStr =
    input.topNegativeKeywords.length > 0
      ? input.topNegativeKeywords
          .map((k) => `${k.keyword}(부정 ${k.negativeRatio}%)`)
          .join(", ")
      : "없음";

  const positiveKeywordsStr =
    input.topPositiveKeywords.length > 0
      ? input.topPositiveKeywords.join(", ")
      : "없음";

  return `[입력 데이터]
- 분석 기간: ${input.period}
- 총 리뷰 수: ${input.totalReviews}건
- 감정 요약: 긍정 ${input.sentimentSummary.positive}%, 중립 ${input.sentimentSummary.neutral}%, 부정 ${input.sentimentSummary.negative}%
- 주요 불만 키워드: ${negativeKeywordsStr}
- 주요 긍정 키워드: ${positiveKeywordsStr}

위 데이터를 기반으로 리뷰 분석 리포트를 JSON 형식으로 작성해주세요.`;
}

function generateFallbackSummary(
  input: ReviewSummaryInput,
): ReviewSummaryResult {
  const {
    sentimentSummary,
    topNegativeKeywords,
    topPositiveKeywords,
    totalReviews,
  } = input;

  let summary = `총 ${totalReviews}건의 리뷰 중 긍정 ${sentimentSummary.positive}%, 부정 ${sentimentSummary.negative}%로 분석되었습니다.`;

  if (topPositiveKeywords.length > 0) {
    summary += ` 주요 강점은 "${topPositiveKeywords.join('", "')}"입니다.`;
  }

  if (topNegativeKeywords.length > 0) {
    summary += ` 개선이 필요한 부분은 "${topNegativeKeywords.map((k) => k.keyword).join('", "')}"로 파악됩니다.`;
  }

  const suggestions: string[] = [];

  if (topNegativeKeywords.length > 0) {
    suggestions.push(
      `"${topNegativeKeywords[0].keyword}" 관련 불만 개선 - 우선순위 높음`,
    );
  }

  if (sentimentSummary.negative >= 20) {
    suggestions.push(
      `부정 리뷰 비율 ${sentimentSummary.negative}% - 고객 불만 요인 집중 분석 필요`,
    );
  }

  if (topPositiveKeywords.length > 0) {
    suggestions.push(
      `"${topPositiveKeywords[0]}" 강점 유지 - 마케팅 메시지에 활용 권장`,
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("현재 리뷰 데이터 기반 특별한 이슈 없음");
  }

  return { summary, suggestions: suggestions.slice(0, 3) };
}

export async function generateReviewSummary(
  input: ReviewSummaryInput,
): Promise<ReviewSummaryResult> {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log("[ReviewSummaryGenerator] No OpenAI API key, using fallback");
    return generateFallbackSummary(input);
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const userPrompt = buildUserPrompt(input);

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
      endpoint: "chat.completions/review-summary",
      success: true,
      tokensUsed,
      responseTimeMs,
      metadata: { model: "gpt-4o-mini", totalReviews: input.totalReviews },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content);

    return {
      summary: data.summary || "",
      suggestions: Array.isArray(data.suggestions)
        ? data.suggestions.slice(0, 3)
        : [],
    };
  } catch (error) {
    logApiUsage({
      userId: null,
      apiType: "openai",
      endpoint: "chat.completions/review-summary",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error(
      "[ReviewSummaryGenerator] OpenAI failed, using fallback:",
      error,
    );
    return generateFallbackSummary(input);
  }
}
