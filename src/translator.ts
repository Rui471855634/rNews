/**
 * 标题翻译器
 * 检测英文标题，通过免费翻译 API 翻译为中文
 * 翻译后格式：Original Title（中文翻译）
 *
 * 使用国内可访问的免费翻译接口，双 API 互为备份：
 *   - 主：api.qvqa.cn（简心翻译）
 *   - 备：api.52vmy.cn
 * 连续失败超过阈值时自动跳过剩余翻译，避免阻塞推送。
 */

import type { NewsItem } from './sources/types.js';

/** 单次请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 5_000;

/** 翻译之间的间隔（毫秒），避免触发频率限制 */
const THROTTLE_MS = 300;

/** 连续失败多少次后放弃剩余翻译 */
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * 判断文本是否主要为非中文内容（需要翻译）
 * 规则：去除空格和标点后，如果中文字符占比低于 30%，认为需要翻译
 */
function needsTranslation(text: string): boolean {
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
  const cjkMatches = text.match(cjkPattern);
  const cjkCount = cjkMatches?.length ?? 0;

  const meaningfulChars = text.replace(/[\s\d\p{P}\p{S}]/gu, '').length;
  if (meaningfulChars === 0) return false;

  return cjkCount / meaningfulChars < 0.3;
}

/**
 * 主翻译接口：简心翻译 (api.qvqa.cn)
 */
async function translatePrimary(text: string): Promise<string | null> {
  const params = new URLSearchParams({
    text,
    source: 'en',
    target: 'zh',
  });

  const response = await fetch(`https://api.qvqa.cn/api/fanyi?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    data?: { targetText?: string };
  };

  return data?.data?.targetText || null;
}

/**
 * 备用翻译接口 (api.52vmy.cn)
 */
async function translateFallback(text: string): Promise<string | null> {
  const params = new URLSearchParams({ msg: text });

  const response = await fetch(`https://api.52vmy.cn/api/query/fanyi?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    code?: number;
    data?: { target?: string };
  };

  if (data?.code !== 200) return null;
  return data?.data?.target || null;
}

/**
 * 调用翻译 API（主 + 备用自动切换）
 * @returns 翻译结果，失败返回 null
 */
async function translateText(text: string): Promise<string | null> {
  try {
    // 尝试主接口
    const primary = await translatePrimary(text);
    if (primary) return primary;
  } catch {
    // 主接口失败，尝试备用
  }

  try {
    const fallback = await translateFallback(text);
    if (fallback) return fallback;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[翻译] 翻译失败: "${text.slice(0, 40)}..." - ${msg}`);
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 为新闻列表中的英文标题添加中文翻译
 *
 * - RSS 新闻：翻译 title，格式 "Original Title（中文翻译）"
 * - GitHub Trending：翻译 extra.description，格式同上
 *
 * 翻译失败时静默跳过，不影响原始内容。
 * 连续失败超过阈值时放弃剩余翻译，避免阻塞推送。
 *
 * @param items 新闻条目列表
 * @param isGithub 是否为 GitHub Trending 类别
 */
export async function translateTitles(
  items: NewsItem[],
  isGithub = false,
): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  let translatedCount = 0;
  let consecutiveFailures = 0;
  let aborted = false;

  for (const item of items) {
    if (aborted) {
      results.push(item);
      continue;
    }

    try {
      if (isGithub) {
        const desc = item.extra?.description;
        if (desc && needsTranslation(desc)) {
          if (translatedCount > 0) await sleep(THROTTLE_MS);
          const translated = await translateText(desc);
          if (translated && translated !== desc) {
            results.push({
              ...item,
              extra: { ...item.extra, description: `${desc}（${translated}）` },
            });
            translatedCount++;
            consecutiveFailures = 0;
            continue;
          } else if (translated === null) {
            consecutiveFailures++;
          }
        }
        results.push(item);
      } else {
        if (needsTranslation(item.title)) {
          if (translatedCount > 0) await sleep(THROTTLE_MS);
          const translated = await translateText(item.title);
          if (translated && translated !== item.title) {
            results.push({
              ...item,
              title: `${item.title}（${translated}）`,
            });
            translatedCount++;
            consecutiveFailures = 0;
            continue;
          } else if (translated === null) {
            consecutiveFailures++;
          }
        }
        results.push(item);
      }
    } catch {
      results.push(item);
      consecutiveFailures++;
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[翻译] 连续 ${consecutiveFailures} 次失败，跳过剩余翻译直接推送。`);
      aborted = true;
    }
  }

  if (translatedCount > 0) {
    console.log(`   翻译了 ${translatedCount} 条英文标题。`);
  }

  return results;
}
