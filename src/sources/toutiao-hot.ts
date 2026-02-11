/**
 * 今日头条热榜抓取器
 * 通过头条热榜 API 获取实时热搜
 * API: https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc
 */

import type { NewsItem } from './types.js';

const TOUTIAO_HOT_API = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc';

interface ToutiaoHotItem {
  Title: string;
  Url: string;
  HotValue?: number;
}

/**
 * 抓取今日头条热榜
 * @param count 返回条数
 */
export async function fetchToutiaoHot(count: number): Promise<NewsItem[]> {
  try {
    const response = await fetch(TOUTIAO_HOT_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: ToutiaoHotItem[];
    };

    const items = data?.data ?? [];

    return items.slice(0, count).map((item) => ({
      title: item.Title,
      link: item.Url,
      source: '今日头条',
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[今日头条] 抓取失败: ${msg}`);
    return [];
  }
}
