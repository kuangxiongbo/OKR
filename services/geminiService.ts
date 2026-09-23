import { AIConfig } from '../types';

const DEFAULT_TEMPERATURE = 0.2;
const QWEN_DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

function normalizeAIConfig(aiConfig: AIConfig | null | undefined) {
  if (!aiConfig?.enabled) return null;
  const isQwen = aiConfig.provider === 'QWEN';

  const baseUrl = isQwen
    ? (aiConfig.qwen?.baseUrl || QWEN_DEFAULT_BASE_URL)
    : (aiConfig.local?.baseUrl || '');
  const apiKey = isQwen ? aiConfig.qwen?.apiKey : aiConfig.local?.apiKey;
  const model = isQwen ? (aiConfig.qwen?.model || 'qwen-vl-plus') : (aiConfig.local?.model || '');

  if (!baseUrl || !model) return null;
  return { baseUrl, apiKey, model };
}

function resolveChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  const versionedBaseUrl = /\/v\d+$/i.test(normalized) ? normalized : `${normalized}/v1`;
  return `${versionedBaseUrl}/chat/completions`;
}

async function chatCompletions(
  normalized: { baseUrl: string; apiKey?: string; model: string },
  userContent: string,
  temperature: number = DEFAULT_TEMPERATURE
) {
  const url = resolveChatCompletionsUrl(normalized.baseUrl);
  const effectiveTemperature = normalized.model.toLowerCase().startsWith('qwen') ? 1 : temperature;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (normalized.apiKey) {
    headers.Authorization = `Bearer ${normalized.apiKey}`;
  }

  const request = (requestedTemperature: number) => fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: normalized.model,
      temperature: requestedTemperature,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  let resp = await request(effectiveTemperature);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const temperatureIsRestricted = resp.status === 400
      && /temperature[\s\S]*only\s*1\s*is\s*allowed|only\s*1\s*is\s*allowed[\s\S]*temperature/i.test(text);
    if (temperatureIsRestricted && effectiveTemperature !== 1) {
      resp = await request(1);
    } else {
      throw new Error(`AI 请求失败: HTTP ${resp.status} ${text}`.trim());
    }
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`AI 请求失败: HTTP ${resp.status} ${text}`.trim());
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

export const generateOKRAdvice = async (
  context: string,
  currentInput: string,
  aiConfig?: AIConfig | null
): Promise<string> => {
  const normalized = normalizeAIConfig(aiConfig);
  if (!normalized) return 'AI 功能未启用，请先在配置页启用（或配置不完整）。';

  try {
    const userContent = `你是一位专业的 OKR（目标与关键结果）教练。请用中文回答。

当前公司/部门目标背景：
${context}

用户的草稿输入：
"${currentInput}"

任务：
1. 评估用户的输入。它是否具体、可衡量、可实现、相关且有时限 (SMART)？
2. 建议 2 个更好的替代方案（每个方案包含一个目标与对应的关键结果）。
3. 简要解释为什么这些修改更好。
4. 保持简洁（150字以内）。`;

    const text = await chatCompletions(normalized, userContent, DEFAULT_TEMPERATURE);
    return text || '无法生成建议。';
  } catch (error) {
    console.error('AI Coach Error:', error);
    return '连接 AI 教练时出错。';
  }
};

export const analyzeAlignment = async (
  companyObj: string,
  personalObj: string,
  aiConfig?: AIConfig | null
): Promise<string> => {
  const normalized = normalizeAIConfig(aiConfig);
  if (!normalized) return 'AI 功能未启用，请先在配置页启用（或配置不完整）。';

  try {
    const userContent = `请分析公司目标与个人目标的一致性。请用中文回答。

公司目标： "${companyObj}"
个人目标： "${personalObj}"

请将一致性评级为：高、中、或低，并用一句话解释原因。`;

    const text = await chatCompletions(normalized, userContent, DEFAULT_TEMPERATURE);
    return text || '分析失败。';
  } catch (error) {
    console.error('AI Alignment Error:', error);
    return '分析对齐度时出错。';
  }
};
