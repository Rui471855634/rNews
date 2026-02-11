/**
 * WPS Teams (WPS 协作) Webhook 适配器
 *
 * API 文档: https://open.wps.cn/documents/app-integration-dev/guide/robot/webhook.html
 *
 * 消息格式:
 * {
 *   "msgtype": "markdown",
 *   "markdown": {
 *     "text": "Markdown 内容"
 *   }
 * }
 *
 * 限制:
 * - 每分钟不超过 20 条
 * - 每条消息不超过 5000 个字符
 */

import type { WebhookAdapter } from './types.js';

/** WPS Teams Markdown 消息最大字符数 */
const MAX_CONTENT_LENGTH = 5000;

export class WpsTeamsWebhook implements WebhookAdapter {
  private readonly url: string;
  private readonly name: string;

  constructor(name: string, url: string) {
    this.name = name;
    this.url = url;
  }

  async sendMarkdown(text: string): Promise<void> {
    // 如果内容超长，截断并添加提示
    let content = text;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH - 30) + '\n\n> ⚠ 内容过长，已截断';
      console.warn(`[WPS Teams] ${this.name}: 消息内容超过 ${MAX_CONTENT_LENGTH} 字符，已截断。`);
    }

    const body = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        text: content,
      },
    });

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const result = await response.json() as Record<string, unknown>;

      // WPS Teams webhook 返回的错误码检查
      if (result.errcode && result.errcode !== 0) {
        throw new Error(`WPS Teams API 错误: ${JSON.stringify(result)}`);
      }

      console.log(`[WPS Teams] ${this.name}: 消息发送成功。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[WPS Teams] ${this.name}: 消息发送失败 - ${msg}`);
      throw error;
    }
  }
}
