/**
 * 消息分发器
 * 根据配置将各类别新闻抓取、格式化，并推送到对应的 webhook 渠道
 */

import type { AppConfig, CategoryConfig, RssSourceConfig, GithubTrendingSourceConfig } from './config/types.js';
import type { WebhookAdapter } from './webhooks/types.js';
import { fetchSingleRssSource } from './sources/rss-source.js';
import { fetchGithubTrending } from './sources/github-trending.js';
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
 * 推送指定类别的新闻
 * @param config 完整配置
 * @param categoryIds 要推送的类别 ID 列表
 */
export async function dispatch(
  config: AppConfig,
  categoryIds: string[],
): Promise<void> {
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
      const items = await fetchGithubTrending(ghConfig, category.count);

      if (items.length === 0) {
        console.warn(`[Dispatcher] ${category.name}: 未抓取到任何数据，跳过推送。`);
        continue;
      }

      console.log(`   抓取到 ${items.length} 条。`);
      const translatedItems = shouldTranslate ? await translateTitles(items, true) : items;
      messages = [formatGithubMarkdown(category.name, translatedItems)];
    } else {
      // RSS 类别：逐源抓取，每个源独立列出 Top N
      const rssSources = category.sources.filter(
        (s) => s.type === 'rss',
      ) as RssSourceConfig[];

      const groups: SourceGroup[] = [];

      for (const source of rssSources) {
        const items = await fetchSingleRssSource(source, category.count);
        if (items.length === 0) continue;

        console.log(`   ${source.name}: ${items.length} 条`);
        const translatedItems = shouldTranslate ? await translateTitles(items, false) : items;
        groups.push({ name: source.name, items: translatedItems });
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
