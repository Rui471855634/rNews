/**
 * 新闻条目和数据源接口定义
 */

/** GitHub 项目扩展信息 */
export interface GithubExtra {
  stars?: number;
  todayStars?: number;
  description?: string;
  language?: string;
}

/** 统一的新闻条目 */
export interface NewsItem {
  /** 标题 */
  title: string;
  /** 原文链接 */
  link: string;
  /** 来源名称 */
  source: string;
  /** 发布时间 */
  pubDate?: Date;
  /** GitHub 专用扩展字段 */
  extra?: GithubExtra;
}

/** 数据源抓取器接口 */
export interface Source {
  /** 抓取新闻列表 */
  fetch(): Promise<NewsItem[]>;
}
