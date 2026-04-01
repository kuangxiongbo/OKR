import axios from 'axios';
import pdfParse from 'pdf-parse';
import JSZip from 'jszip';
import { query } from '../config/database';
import { AIConfig } from '../types';

interface ImportPayload {
  textContent?: string;
  fileName?: string;
  mimeType?: string;
  imageBase64?: string;
  imageList?: Array<{ base64: string; mimeType?: string }>;
  fileBase64?: string;
}

export interface ParsedOKR {
  title: string;
  period: string;
  objectives: Array<{
    content: string;
    weight: number;
    keyResults: Array<{ content: string; weight: number }>;
  }>;
}

const DEFAULT_PROMPT = `你是 OKR 提取助手。请从给定截图或文本中提取 OKR 内容，严格输出 JSON 格式。
JSON 结构如下:
{
  "title": "OKR 标题 (例如: 提升技术部交付效能)",
  "period": "OKR 周期 (例如: 2026 全年, 2026 Q1, 2026 上半年)",
  "objectives": [
    {
      "content": "目标内容",
      "weight": 0-100 数字,
      "keyResults": [
        { "content": "关键结果内容", "weight": 0-100 数字 }
      ]
    }
  ]
}
规则:
1) 若原文无明确周期，请识别当前年份，并根据上下文推断。如果完全无法推断，此字段返回空字符串。
2) 若原文无权重，目标均分 100，KR 在各目标内均分 100。
3) objectives 至少 1 个，每个 objective 至少 1 个 KR。
4) 内容必须使用中文，表达精简准确。`;

const safeJsonParse = (text: string): any => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 输出不是有效 JSON');
    return JSON.parse(match[0]);
  }
};

const normalizeWeights = (okr: ParsedOKR): ParsedOKR => {
  const objectives = (okr.objectives || []).filter(o => o?.content);
  if (objectives.length === 0) {
    throw new Error('未识别到有效目标');
  }
  const objAvg = Math.floor(100 / objectives.length);
  const objRem = 100 % objectives.length;
  objectives.forEach((o, i) => {
    if (!Number.isFinite(o.weight)) o.weight = objAvg + (i < objRem ? 1 : 0);
    const krs = (o.keyResults || []).filter(k => k?.content);
    if (krs.length === 0) krs.push({ content: '补充关键结果', weight: 100 });
    const krAvg = Math.floor(100 / krs.length);
    const krRem = 100 % krs.length;
    krs.forEach((k, idx) => {
      if (!Number.isFinite(k.weight)) k.weight = krAvg + (idx < krRem ? 1 : 0);
    });
    o.keyResults = krs;
  });
  return {
    title: okr.title || 'AI 导入目标',
    period: okr.period || '',
    objectives
  };
};

export const getAIConfig = async (): Promise<AIConfig | null> => {
  const result = await query('SELECT value FROM configs WHERE key = $1', ['ai']);
  if (result.rows.length === 0) return null;
  return result.rows[0].value as AIConfig;
};

const extractTextFromPdf = async (fileBase64: string): Promise<string> => {
  const buffer = Buffer.from(fileBase64, 'base64');
  // pdf-parse 在不同打包/类型声明下可能被识别为不可调用的模块类型，这里用 any 保证构建稳定
  const data = await (pdfParse as any)(buffer);
  return (data.text || '').trim();
};

const stripXmlText = (xml: string): string => {
  return xml
    .replace(/<a:br\/>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
  const buffer = Buffer.from(fileBase64, 'base64');
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const chunks: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string');
    const text = stripXmlText(xml);
    if (text) chunks.push(text);
  }
  return chunks.join('\n');
};

export const parseOKRByAI = async (payload: ImportPayload): Promise<ParsedOKR> => {
  const cfg = await getAIConfig();
  if (!cfg?.enabled) throw new Error('AI 功能未启用，请先在配置页启用');

  const isQwen = cfg.provider === 'QWEN';
  const baseUrl = isQwen ? (cfg.qwen?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1') : (cfg.local?.baseUrl || '');
  const apiKey = isQwen ? cfg.qwen?.apiKey : cfg.local?.apiKey;
  const model = isQwen ? (cfg.qwen?.model || 'qwen-vl-plus') : (cfg.local?.model || '');
  if (!baseUrl || !model) throw new Error('AI 配置不完整：缺少 baseUrl 或 model');

  let extractedText = payload.textContent || '';
  const lowerName = (payload.fileName || '').toLowerCase();
  const mimeType = (payload.mimeType || '').toLowerCase();
  const isPdf = mimeType.includes('pdf') || lowerName.endsWith('.pdf');
  const isPptx = mimeType.includes('presentation') || lowerName.endsWith('.pptx');
  const isPpt = lowerName.endsWith('.ppt');

  if (!extractedText && payload.fileBase64) {
    if (isPdf) {
      extractedText = await extractTextFromPdf(payload.fileBase64);
    } else if (isPptx) {
      extractedText = await extractTextFromPptx(payload.fileBase64);
    } else if (isPpt) {
      throw new Error('暂不支持 .ppt 二进制格式，请转换为 .pptx 后导入');
    }
  }

  const content: any[] = [{ type: 'text', text: `${DEFAULT_PROMPT}\n文件名: ${payload.fileName || ''}\n文本内容:\n${extractedText}` }];
  if (payload.imageList && payload.imageList.length > 0) {
    payload.imageList.forEach((img) => {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType || 'image/png'};base64,${img.base64}` } });
    });
  } else if (payload.imageBase64) {
    content.push({ type: 'image_url', image_url: { url: `data:${payload.mimeType || 'image/png'};base64,${payload.imageBase64}` } });
  }

  const resp = await axios.post(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      timeout: 45000
    }
  );

  const aiText = resp.data?.choices?.[0]?.message?.content || '';
  const parsed = safeJsonParse(String(aiText));
  return normalizeWeights(parsed as ParsedOKR);
};
