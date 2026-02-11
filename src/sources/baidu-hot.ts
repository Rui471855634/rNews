/**
 * 百度热搜抓取器
 * 通过百度热搜 API 获取实时热搜榜
 * API: https://top.baidu.com/api/board?platform=wise&tab=realtime
 */

import type { NewsItem } from './types.js';

const BAIDU_HOT_API = 'https://top.baidu.com/api/board?platform=wise&tab=realtime';

interface BaiduHotItem {
  word: string;
  url: string;
  desc?: string;
  hotTag?: string;
  isTop?: boolean;
}

/**
 * 抓取百度热搜榜
 * @param count 返回条数
 */
export async function fetchBaiduHot(count: number): Promise<NewsItem[]> {
  try {
    const response = await fetch(BAIDU_HOT_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { cards?: { content?: { content?: BaiduHotItem[] }[] }[] };
    };

    // API 结构: data.cards[0].content[0].content[] (多一层嵌套)
    const items = data?.data?.cards?.[0]?.content?.[0]?.content ?? [];

    return items.slice(0, count).map((item) => ({
      title: item.word,
      link: item.url,
      source: '百度热搜',
      extra: item.desc ? { description: item.desc } : undefined,
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[百度热搜] 抓取失败: ${msg}`);
    return [];
  }
}
