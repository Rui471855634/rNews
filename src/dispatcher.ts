/**
 * 消息分发器
 * 根据配置将各类别新闻抓取、格式化，并推送到对应的 webhook 渠道
 */

import type { AppConfig, CategoryConfig, RssSourceConfig, GithubTrendingSourceConfig, LocalFilter } from './config/types.js';
import type { WebhookAdapter } from './webhooks/types.js';
import type { NewsItem } from './sources/types.js';
import { loadLocalFilter } from './config/loader.js';
import { fetchSingleRssSource } from './sources/rss-source.js';
import { fetchGithubTrending } from './sources/github-trending.js';
import { fetchBaiduHot } from './sources/baidu-hot.js';
import { fetchToutiaoHot } from './sources/toutiao-hot.js';
import { fetchBilibiliHot } from './sources/bilibili-hot.js';
import { formatNewsMessages, formatGithubMarkdown } from './formatter.js';
import type { SourceGroup } from './formatter.js';
import { WpsTeamsWebhook } from './webhooks/wps-teams.js';
import { WecomWebhook } from './webhooks/wecom.js';
import { translateTitles } from './translator.js';

/**
 * 根据配置创建 Webhook 适配器实例
 */
function createWebhookAdapter(name: string, config: { type: string; url: string }): WebhookAdapter {
  switch (config.type) {
    case 'wps-teams':
      return new WpsTeamsWebhook(name, config.url);
    case 'wecom':
      return new WecomWebhook(name, config.url);
    default:
      throw new Error(`不支持的 webhook 类型: ${config.type}`);
  }
}

/**
 * 判断是否为 GitHub Trending 类别
 */
function isGithubCategory(category: CategoryConfig): boolean {
  return category.sources.some((s) => s.type === 'github-trending');
}

/**
 * 标题去重器
 * 通过提取标题中的关键字符计算 Jaccard 相似度，过滤跨源重复新闻。
 */
class TitleDeduplicator {
  private seen: { chars: Set<string>; link: string }[] = [];

  /** 提取标题中的有意义字符（中文字 + 小写英文单词） */
  private extractTokens(title: string): Set<string> {
    const tokens = new Set<string>();
    // 提取中文字符
    const cjk = title.match(/[\u4e00-\u9fff]/g);
    if (cjk) cjk.forEach((c) => tokens.add(c));
    // 提取英文单词（小写，长度 >= 3）
    const words = title.toLowerCase().match(/[a-z]{3,}/g);
    if (words) words.forEach((w) => tokens.add(w));
    return tokens;
  }

  /** Jaccard 相似度 */
  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const t of a) {
      if (b.has(t)) intersection++;
    }
    return intersection / (a.size + b.size - intersection);
  }

  /**
   * 过滤掉与已知标题高度相似的条目
   * @param items 待过滤条目
   * @param threshold 相似度阈值（默认 0.5）
   * @returns 去重后的条目
   */
  filter(items: NewsItem[], threshold = 0.5): NewsItem[] {
    const result: NewsItem[] = [];
    for (const item of items) {
      // URL 去重
      if (this.seen.some((s) => s.link === item.link)) continue;

      // 标题相似度去重
      const tokens = this.extractTokens(item.title);
      const isDup = this.seen.some((s) => this.jaccard(s.chars, tokens) >= threshold);
      if (isDup) continue;

      this.seen.push({ chars: tokens, link: item.link });
      result.push(item);
    }
    return result;
  }
}

/**
 * 推送指定类别的新闻
 * @param config 完整配置
 * @param categoryIds 要推送的类别 ID 列表
 */
/**
 * 根据关键字过滤新闻条目
 */
function applyKeywordFilter(items: NewsItem[], filter: LocalFilter): NewsItem[] {
  if (filter.blockedKeywords.length === 0) return items;

  return items.filter((item) => {
    const text = `${item.title} ${item.extra?.description ?? ''}`;
    return !filter.blockedKeywords.some((kw) => text.includes(kw));
  });
}

export async function dispatch(
  config: AppConfig,
  categoryIds: string[],
): Promise<void> {
  // 加载本地关键字过滤
  const localFilter = loadLocalFilter();

  // 创建所有需要的 webhook 适配器（缓存避免重复创建）
  const webhookAdapters = new Map<string, WebhookAdapter>();

  for (const [name, webhookConfig] of Object.entries(config.webhooks)) {
    webhookAdapters.set(name, createWebhookAdapter(name, webhookConfig));
  }

  // 逐类别处理
  for (const categoryId of categoryIds) {
    const category = config.categories[categoryId];
    if (!category) {
      console.warn(`[Dispatcher] 未知的类别: ${categoryId}，跳过。`);
      continue;
    }

    console.log(`\n📰 正在抓取: ${category.name} ...`);

    const shouldTranslate = config.settings?.translate !== false;
    let messages: string[];

    if (isGithubCategory(category)) {
      // GitHub Trending：单一源，保持原有逻辑
      const ghConfig = category.sources.find(
        (s) => s.type === 'github-trending',
      ) as GithubTrendingSourceConfig;
      let items = await fetchGithubTrending(ghConfig, category.count);
      items = applyKeywordFilter(items, localFilter);

      if (items.length === 0) {
        console.warn(`[Dispatcher] ${category.name}: 未抓取到任何数据，跳过推送。`);
        continue;
      }

      console.log(`   抓取到 ${items.length} 条。`);
      const translatedItems = shouldTranslate ? await translateTitles(items, true) : items;
      messages = [formatGithubMarkdown(category.name, translatedItems)];
    } else {
      // 通用类别：逐源抓取，每个源独立列出 Top N，跨源去重
      const groups: SourceGroup[] = [];
      const dedup = new TitleDeduplicator();

      for (const source of category.sources) {
        let items: NewsItem[] = [];
        let sourceName = '';

        if (source.type === 'rss') {
          const rssSource = source as RssSourceConfig;
          sourceName = rssSource.name;
          items = await fetchSingleRssSource(rssSource, category.count);
        } else if (source.type === 'baidu-hot') {
          sourceName = source.name ?? '百度热搜';
          items = await fetchBaiduHot(category.count);
        } else if (source.type === 'toutiao-hot') {
          sourceName = source.name ?? '今日头条';
          items = await fetchToutiaoHot(category.count);
        } else if (source.type === 'bilibili-hot') {
          sourceName = source.name ?? 'B站热搜';
          items = await fetchBilibiliHot(category.count);
        }

        if (items.length === 0) continue;

        // 关键字过滤：移除用户不想看到的内容
        items = applyKeywordFilter(items, localFilter);
        if (items.length === 0) continue;

        // 跨源去重：过滤与前面源高度相似的标题
        const unique = dedup.filter(items);
        const removed = items.length - unique.length;
        if (removed > 0) {
          console.log(`   ${sourceName}: ${items.length} 条，去重 ${removed} 条`);
        } else {
          console.log(`   ${sourceName}: ${items.length} 条`);
        }

        if (unique.length === 0) continue;

        const isTranslatable = source.type === 'rss';
        const translatedItems = shouldTranslate && isTranslatable
          ? await translateTitles(unique, false)
          : unique;
        groups.push({ name: sourceName, items: translatedItems });
      }

      if (groups.length === 0) {
        console.warn(`[Dispatcher] ${category.name}: 未抓取到任何新闻，跳过推送。`);
        continue;
      }

      // 自动拆分为多条消息，避免超长截断
      messages = formatNewsMessages(category.name, groups);
    }

    if (messages.length > 1) {
      console.log(`   消息拆分为 ${messages.length} 条发送。`);
    }

    // 推送到该类别配置的所有 webhook
    for (const webhookId of category.webhooks) {
      const adapter = webhookAdapters.get(webhookId);
      if (!adapter) {
        console.warn(`[Dispatcher] webhook "${webhookId}" 未找到，跳过。`);
        continue;
      }

      for (const msg of messages) {
        try {
          await adapter.sendMarkdown(msg);
        } catch {
          // 错误已在适配器内部打印，这里继续推送到其他消息/webhook
        }

        // 简单的速率控制：每次推送间隔 1 秒，避免触发频率限制
        await sleep(1000);
      }
    }
  }

  console.log('\n✅ 所有类别推送完成。');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
