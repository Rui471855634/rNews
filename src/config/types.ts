/**
 * rNews 配置文件类型定义
 */

/** Webhook 平台类型 */
export type WebhookType = 'wps-teams' | 'wecom';

/** 数据源类型 */
export type SourceType = 'rss' | 'github-trending' | 'baidu-hot' | 'toutiao-hot' | 'bilibili-hot';

/** Webhook 配置 */
export interface WebhookConfig {
  type: WebhookType;
  url: string;
}

/** RSS 数据源配置 */
export interface RssSourceConfig {
  name: string;
  type: 'rss';
  url: string;
}

/** GitHub Trending 数据源配置 */
export interface GithubTrendingSourceConfig {
  type: 'github-trending';
  name?: string;
  language?: string;
  since?: 'daily' | 'weekly' | 'monthly';
}

/** 百度热搜数据源配置 */
export interface BaiduHotSourceConfig {
  type: 'baidu-hot';
  name?: string;
}

/** 今日头条热榜数据源配置 */
export interface ToutiaoHotSourceConfig {
  type: 'toutiao-hot';
  name?: string;
}

/** B站热搜数据源配置 */
export interface BilibiliHotSourceConfig {
  type: 'bilibili-hot';
  name?: string;
}

/** 数据源配置（联合类型） */
export type SourceConfig = RssSourceConfig | GithubTrendingSourceConfig | BaiduHotSourceConfig | ToutiaoHotSourceConfig | BilibiliHotSourceConfig;

/** 新闻类别配置 */
export interface CategoryConfig {
  name: string;
  count: number;
  webhooks: string[];
  sources: SourceConfig[];
}

/** 定时规则 */
export interface ScheduleConfig {
  cron: string;
  categories: string[];
}

/** 全局设置 */
export interface SettingsConfig {
  /** 是否将英文标题翻译为中文（默认 true） */
  translate?: boolean;
  /** Timezone for schedule (IANA format, default: Asia/Shanghai) */
  timezone?: string;
}

/** 完整配置 */
export interface AppConfig {
  webhooks: Record<string, WebhookConfig>;
  categories: Record<string, CategoryConfig>;
  schedule?: ScheduleConfig[];
  settings?: SettingsConfig;
}

/** 本地关键字过滤配置 (filter.local.yaml) */
export interface LocalFilter {
  blockedKeywords: string[];
}
