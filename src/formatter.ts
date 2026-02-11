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
 * 策略：按源逐个累加，当加入下一个源会导致超限时，切为新消息。
 * 第一条带 "## 类别名"，后续带 "## 类别名（续）"。
 *
 * @param categoryName 类别显示名
 * @param groups 按源分组的新闻数据
 * @param maxLength 单条消息最大字符数（默认 4500，留 buffer）
 * @returns 拆分后的多条 Markdown 消息
 */
export function formatNewsMessages(
  categoryName: string,
  groups: SourceGroup[],
  maxLength = 4500,
): string[] {
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  if (nonEmpty.length === 0) {
    return [`## ${categoryName}\n\n暂无新闻数据。`];
  }

  const footer = `\n\n> 更新时间：${formatTime()}`;
  const messages: string[] = [];
  let currentParts: string[] = [];
  let currentHeader = `## ${categoryName}`;
  let currentLength = currentHeader.length + footer.length;

  for (const group of nonEmpty) {
    const section = formatSourceSection(group);
    const sectionLength = section.length + 2; // +2 for \n\n separator

    if (currentParts.length > 0 && currentLength + sectionLength > maxLength) {
      // 当前批次已满，保存并开始新批次
      messages.push(currentHeader + '\n' + currentParts.join('\n\n') + footer);
      currentHeader = `## ${categoryName}（续）`;
      currentParts = [];
      currentLength = currentHeader.length + footer.length;
    }

    currentParts.push(section);
    currentLength += sectionLength;
  }

  // 最后一批
  if (currentParts.length > 0) {
    messages.push(currentHeader + '\n' + currentParts.join('\n\n') + footer);
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
