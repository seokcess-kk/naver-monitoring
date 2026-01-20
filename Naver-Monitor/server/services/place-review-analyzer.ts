import OpenAI from "openai";

interface AspectSentiment {
  aspect: string;
  sentiment: "Positive" | "Negative" | "Neutral";
}

interface AnalysisResult {
  sentiment: "Positive" | "Negative" | "Neutral";
  aspects: AspectSentiment[];
  keywords: string[];
  summary: string;
}

const FEW_SHOT_EXAMPLES = `
[예시 1 - 긍정]
리뷰: "직원분이 정말 친절하시고 음식도 너무 맛있었어요. 다음에 또 올게요!"
분석:
{
    "sentiment": "Positive",
    "aspects": [
        {"aspect": "서비스", "sentiment": "Positive"},
        {"aspect": "음식", "sentiment": "Positive"}
    ],
    "keywords": ["친절", "맛있다", "재방문"],
    "summary": "친절한 서비스와 맛있는 음식에 만족하여 재방문 의사를 밝힘"
}

[예시 2 - 부정]
리뷰: "주차가 너무 불편하고 가격도 비싸요. 음식은 그냥 평범했습니다."
분석:
{
    "sentiment": "Negative",
    "aspects": [
        {"aspect": "주차", "sentiment": "Negative"},
        {"aspect": "가격", "sentiment": "Negative"},
        {"aspect": "음식", "sentiment": "Neutral"}
    ],
    "keywords": ["주차", "비싸다", "평범"],
    "summary": "주차 불편과 비싼 가격에 불만족, 음식은 평범한 수준"
}

[예시 3 - 중립]
리뷰: "음식은 맛있었는데 배달이 늦어서 식어서 왔어요."
분석:
{
    "sentiment": "Neutral",
    "aspects": [
        {"aspect": "음식", "sentiment": "Positive"},
        {"aspect": "배달", "sentiment": "Negative"}
    ],
    "keywords": ["맛있다", "배달 늦음", "식음"],
    "summary": "음식 맛은 좋았으나 배달 지연으로 식어서 도착"
}
`;

const SYSTEM_PROMPT = `당신은 전문적인 한국어 리뷰 감정 분석가입니다.

[분석 가이드라인]
1. 감정 판단 기준:
   - Positive: 명시적인 칭찬, 만족, 추천, 재방문 의사 표현
   - Negative: 불만, 비추천, 비판, 부정적 경험 표현
   - Neutral: 장단점이 섞여있거나, 단순 사실 나열, 판단이 어려운 경우

2. Aspect(속성) 추출:
   - 리뷰에서 언급된 구체적인 속성(음식, 서비스, 가격, 분위기, 청결, 배달, 주차 등)을 식별
   - 각 속성에 대한 개별 감정을 판단
   - 언급되지 않은 속성은 포함하지 않음

3. 키워드 추출:
   - 리뷰의 핵심을 나타내는 2-4개 키워드
   - 형용사, 명사 위주로 추출

4. 요약:
   - 리뷰 핵심 내용을 한 문장으로 요약
   - 객관적이고 간결하게 작성

반드시 JSON 형식으로만 응답하세요.`;

const POSITIVE_WORDS = [
  "좋", "맛있", "친절", "깔끔", "추천", "최고", "훌륭", "만족", "감사",
  "완벽", "예쁘", "괜찮", "대박", "짱", "사랑", "행복", "편", "빠르",
];

const NEGATIVE_WORDS = [
  "별로", "나쁘", "불친절", "더럽", "비싸", "느리", "실망", "후회",
  "최악", "불편", "싫", "안좋", "짜증", "화", "불만", "아쉬",
];

const ASPECT_KEYWORDS: Record<string, string[]> = {
  "음식": ["음식", "맛", "메뉴", "요리", "반찬", "식사"],
  "서비스": ["서비스", "직원", "응대", "친절", "불친절"],
  "가격": ["가격", "비싸", "저렴", "가성비", "원"],
  "분위기": ["분위기", "인테리어", "깔끔", "청결", "깨끗"],
  "배달": ["배달", "포장", "빠르", "늦"],
  "주차": ["주차", "파킹"],
};

function fallbackAnalysis(review: string): AnalysisResult {
  const positiveCount = POSITIVE_WORDS.filter((word) => review.includes(word)).length;
  const negativeCount = NEGATIVE_WORDS.filter((word) => review.includes(word)).length;

  let sentiment: "Positive" | "Negative" | "Neutral" = "Neutral";
  if (positiveCount > negativeCount) {
    sentiment = "Positive";
  } else if (negativeCount > positiveCount) {
    sentiment = "Negative";
  }

  const aspects: AspectSentiment[] = [];
  for (const [aspectName, keywords] of Object.entries(ASPECT_KEYWORDS)) {
    if (keywords.some((kw) => review.includes(kw))) {
      const aspPositive = POSITIVE_WORDS.filter((w) => review.includes(w)).length;
      const aspNegative = NEGATIVE_WORDS.filter((w) => review.includes(w)).length;
      let aspSentiment: "Positive" | "Negative" | "Neutral" = "Neutral";
      if (aspPositive > aspNegative) aspSentiment = "Positive";
      else if (aspNegative > aspPositive) aspSentiment = "Negative";
      aspects.push({ aspect: aspectName, sentiment: aspSentiment });
    }
  }

  const words = review.replace(/[,.\n]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
  const keywords = words.slice(0, 3);

  const summary = review.length > 50 ? review.slice(0, 50) + "..." : review;

  return { sentiment, aspects, keywords, summary };
}

export async function analyzeReview(review: string): Promise<AnalysisResult> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log("[PlaceReviewAnalyzer] No OpenAI API key, using fallback analysis");
    return fallbackAnalysis(review);
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const userPrompt = `${FEW_SHOT_EXAMPLES}

이제 아래 리뷰를 분석해주세요.

리뷰: "${review}"

위 예시와 동일한 JSON 형식으로 분석 결과를 출력하세요:
{
    "sentiment": "Positive" 또는 "Negative" 또는 "Neutral",
    "aspects": [{"aspect": "속성명", "sentiment": "Positive/Negative/Neutral"}, ...],
    "keywords": ["키워드1", "키워드2", ...],
    "summary": "한 문장 요약"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content);

    const sentimentMap: Record<string, "Positive" | "Negative" | "Neutral"> = {
      positive: "Positive",
      negative: "Negative",
      neutral: "Neutral",
    };

    const sentiment = sentimentMap[data.sentiment?.toLowerCase()] || data.sentiment || "Neutral";
    const aspects = (data.aspects || []).map((a: any) => ({
      aspect: a.aspect,
      sentiment: sentimentMap[a.sentiment?.toLowerCase()] || a.sentiment || "Neutral",
    }));
    const keywords = data.keywords || [];
    const summary = data.summary || "";

    return { sentiment, aspects, keywords, summary };
  } catch (error) {
    console.error("[PlaceReviewAnalyzer] OpenAI analysis failed, using fallback:", error);
    return fallbackAnalysis(review);
  }
}
