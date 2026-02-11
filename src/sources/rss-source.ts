/**
 * RSS 通用抓取器
 * 支持从多个 RSS feed 拉取新闻，去重、按时间排序、截取指定数量
 */

import RssParser from 'rss-parser';
import type { NewsItem } from './types.js';
import type { RssSourceConfig } from '../config/types.js';

const parser = new RssParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

/**
 * 从单个 RSS feed 抓取新闻
 */
async function fetchSingleFeed(source: RssSourceConfig): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: NewsItem[] = (feed.items ?? []).map((item) => ({
      title: (item.title ?? '').trim(),
      link: item.link ?? '',
      source: source.name,
      pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
    }));

    // 过滤掉没有标题或链接的条目
    return items.filter((item) => item.title && item.link);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[RSS] 抓取失败: ${source.name} (${source.url}) - ${msg}`);
    return [];
  }
}

/**
 * 从单个 RSS 源抓取新闻，按时间排序并截取指定数量
 * @param source RSS 数据源配置
 * @param count 最终返回的条目数
 */
export async function fetchSingleRssSource(
  source: RssSourceConfig,
  count: number,
): Promise<NewsItem[]> {
  const items = await fetchSingleFeed(source);

  // 按链接去重
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  // 按发布时间降序排序（最新的在前）
  unique.sort((a, b) => {
    const timeA = a.pubDate?.getTime() ?? 0;
    const timeB = b.pubDate?.getTime() ?? 0;
    return timeB - timeA;
  });

  return unique.slice(0, count);
}
