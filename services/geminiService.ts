import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // Injected via environment or replace for testing

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const generateOKRAdvice = async (context: string, currentInput: string): Promise<string> => {
  if (!ai) return "API Key 缺失，请配置环境变量。";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你是一位专业的 OKR（目标与关键结果）教练。请用中文回答。
      
      当前公司/部门目标背景：
      ${context}

      用户的草稿输入：
      "${currentInput}"

      任务：
      1. 评估用户的输入。它是否具体、可衡量、可实现、相关且有时限 (SMART)？
      2. 建议 2 个更好的替代方案（包含一个目标和对应的关键结果）。
      3. 简要解释为什么这些修改更好。
      4. 保持简洁（150字以内）。`,
    });

    return response.text || "无法生成建议。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "连接 AI 教练时出错。";
  }
};

export const analyzeAlignment = async (companyObj: string, personalObj: string): Promise<string> => {
    if (!ai) return "API Key 缺失。";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `请分析公司目标与个人目标的一致性。请用中文回答。
            
            公司目标： "${companyObj}"
            个人目标： "${personalObj}"
            
            请将一致性评级为：高、中、或低，并用一句话解释原因。`
        });
        return response.text || "分析失败。";
    } catch (e) {
        return "分析对齐度时出错。";
    }
}