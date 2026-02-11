/**
 * GitHub Trending 抓取器
 * 通过解析 GitHub Trending 页面获取热门仓库信息
 */

import * as cheerio from 'cheerio';
import type { NewsItem } from './types.js';
import type { GithubTrendingSourceConfig } from '../config/types.js';

const GITHUB_TRENDING_URL = 'https://github.com/trending';

/**
 * 构建 GitHub Trending 的 URL
 */
function buildTrendingUrl(config: GithubTrendingSourceConfig): string {
  const params = new URLSearchParams();
  if (config.since) {
    params.set('since', config.since);
  }
  const lang = config.language ? `/${encodeURIComponent(config.language)}` : '';
  const query = params.toString();
  return `${GITHUB_TRENDING_URL}${lang}${query ? '?' + query : ''}`;
}

/**
 * 格式化 star 数（如 12345 -> "12.3k"）
 */
function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  }
  return String(stars);
}

/**
 * 解析 star 数字符串（如 "12,345" -> 12345）
 */
function parseStarCount(text: string): number {
  return parseInt(text.replace(/,/g, '').trim(), 10) || 0;
}

/**
 * 从 GitHub Trending 页面抓取热门仓库
 * @param config GitHub Trending 配置
 * @param count 返回数量
 */
export async function fetchGithubTrending(
  config: GithubTrendingSourceConfig,
  count: number,
): Promise<NewsItem[]> {
  const url = buildTrendingUrl(config);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'rNews/1.0 (https://github.com/user/rnews)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $('article.Box-row').each((_index, element) => {
      if (items.length >= count) return false; // 够了就停

      const $el = $(element);

      // 仓库名称和链接
      const repoLink = $el.find('h2 a').attr('href')?.trim();
      if (!repoLink) return;

      const repoName = repoLink.replace(/^\//, ''); // 去掉开头的 /
      const repoUrl = `https://github.com${repoLink}`;

      // 描述
      const description = $el.find('p.col-9').text().trim() || '';

      // 编程语言
      const language = $el.find('[itemprop="programmingLanguage"]').text().trim() || '';

      // 总 star 数
      const starText = $el.find('a[href$="/stargazers"]').text().trim();
      const stars = parseStarCount(starText);

      // 今日新增 star 数
      const todayStarText = $el.find('span.d-inline-block.float-sm-right').text().trim();
      const todayMatch = todayStarText.match(/([\d,]+)\s+stars?\s+today/i);
      const todayStars = todayMatch ? parseStarCount(todayMatch[1]) : 0;

      items.push({
        title: repoName,
        link: repoUrl,
        source: 'GitHub Trending',
        extra: {
          stars,
          todayStars,
          description,
          language,
        },
      });
    });

    if (items.length === 0) {
      console.warn('[GitHub] Trending 页面未解析到任何仓库，页面结构可能已变化。');
    }

    return items;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[GitHub] Trending 抓取失败: ${msg}`);
    return [];
  }
}

export { formatStars };
