/**
 * Markdown 消息格式化器
 * 将 NewsItem[] 转为各平台支持的 Markdown 文本
 */

import type { NewsItem } from './sources/types.js';
import { formatStars } from './sources/github-trending.js';

/**
 * 格式化当前时间为 "YYYY-MM-DD HH:mm" 格式（北京时间）
 */
function formatTime(): string {
  const now = new Date();
  // 使用 Intl 获取北京时间
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** 按源分组的新闻数据 */
export interface SourceGroup {
  name: string;
  items: NewsItem[];
}

/**
 * 格式化单个源的新闻为 Markdown 片段（不含类别标题）
 */
export function formatSourceSection(group: SourceGroup): string {
  const lines: string[] = [];
  lines.push(`### ${group.name}`);
  lines.push('');
  group.items.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.title}](${item.link})`);
  });
  return lines.join('\n');
}

/**
 * 将多个源分组拆分为多条消息，避免单条消息超长被截断
 *
 * 策略：每 sourcesPerMessage 个源为一批。
 * 第一条带 "## 类别名"，后续带 "## 类别名（续）"。
 *
 * @param categoryName 类别显示名
 * @param groups 按源分组的新闻数据
 * @param sourcesPerMessage 每条消息包含的源数量（默认 3）
 * @returns 拆分后的多条 Markdown 消息
 */
export function formatNewsMessages(
  categoryName: string,
  groups: SourceGroup[],
  sourcesPerMessage = 3,
): string[] {
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  if (nonEmpty.length === 0) {
    return [`## ${categoryName}\n\n暂无新闻数据。`];
  }

  const footer = `\n\n> 更新时间：${formatTime()}`;
  const messages: string[] = [];

  for (let i = 0; i < nonEmpty.length; i += sourcesPerMessage) {
    const batch = nonEmpty.slice(i, i + sourcesPerMessage);
    const header = i === 0 ? `## ${categoryName}` : `## ${categoryName}（续）`;
    const sections = batch.map((g) => formatSourceSection(g)).join('\n\n');
    messages.push(header + '\n' + sections + footer);
  }

  return messages;
}

/**
 * 格式化 GitHub 热门项目（含 star 数和描述）
 */
export function formatGithubMarkdown(
  categoryName: string,
  items: NewsItem[],
): string {
  if (items.length === 0) {
    return `## ${categoryName}\n\n暂无 Trending 数据。`;
  }

  const lines: string[] = [];
  lines.push(`## ${categoryName}`);
  lines.push('');

  items.forEach((item, index) => {
    const extra = item.extra;
    const parts: string[] = [];

    if (extra?.description) {
      parts.push(extra.description);
    }

    const meta: string[] = [];
    if (extra?.language) {
      meta.push(extra.language);
    }
    if (extra?.stars) {
      meta.push(`${formatStars(extra.stars)} stars`);
    }
    if (extra?.todayStars) {
      meta.push(`+${extra.todayStars} today`);
    }

    const desc = parts.length > 0 ? ` - ${parts.join(' ')}` : '';
    const metaStr = meta.length > 0 ? ` (*${meta.join(', ')}*)` : '';

    lines.push(`${index + 1}. [${item.title}](${item.link})${desc}${metaStr}`);
  });

  lines.push('');
  lines.push(`> 来源：GitHub Trending`);
  lines.push(`> 更新时间：${formatTime()}`);

  return lines.join('\n');
}
