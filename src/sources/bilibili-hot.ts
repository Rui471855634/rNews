/**
 * B站热搜抓取器
 * 通过 Bilibili 热搜 API 获取实时热搜榜
 * API: https://app.bilibili.com/x/v2/search/trending/ranking
 */

import type { NewsItem } from './types.js';

const BILIBILI_HOT_API = 'https://app.bilibili.com/x/v2/search/trending/ranking';

interface BilibiliHotItem {
  keyword: string;
  show_name?: string;
}

/**
 * 抓取 B 站热搜榜
 * @param count 返回条数
 */
export async function fetchBilibiliHot(count: number): Promise<NewsItem[]> {
  try {
    const response = await fetch(BILIBILI_HOT_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { list?: BilibiliHotItem[] };
    };

    const items = data?.data?.list ?? [];

    return items.slice(0, count).map((item) => ({
      title: item.show_name || item.keyword,
      link: `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword)}`,
      source: 'B站热搜',
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[B站热搜] 抓取失败: ${msg}`);
    return [];
  }
}
