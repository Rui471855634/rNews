/**
 * 企业微信 (WeCom) Webhook 适配器
 *
 * API 文档: https://developer.work.weixin.qq.com/document/path/91770
 *
 * 消息格式:
 * {
 *   "msgtype": "markdown",
 *   "markdown": {
 *     "content": "Markdown 内容"
 *   }
 * }
 *
 * 支持的 Markdown 语法（非常有限）:
 *   **bold**  [text](url)  `code`  > quote
 *   <font color="info|comment|warning">text</font>
 *
 * 不支持: # 标题、有序/无序列表、图片、表格
 *
 * 限制:
 * - 每分钟不超过 20 条
 * - 每条消息不超过 4096 个字节
 */

import type { WebhookAdapter } from './types.js';

/** 企业微信 Markdown 消息最大字节数 */
const MAX_CONTENT_BYTES = 4096;

/**
 * 将通用 Markdown 转换为企业微信支持的格式
 *
 * - ## Title       → **Title**
 * - ### Subtitle   → **Subtitle**
 * - 1. [text](url) → [text](url)
 * - > quote        → <font color="comment">quote</font>
 */
function convertToWecomMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // ## Header → bold
      if (line.startsWith('## ')) {
        return `**${line.slice(3).trim()}**`;
      }
      // ### Sub-header → bold
      if (line.startsWith('### ')) {
        return `**${line.slice(4).trim()}**`;
      }
      // Numbered list: keep as-is (WeCom renders plain text numbers fine)
      // > quote → gray color (more visible in WeCom)
      if (line.startsWith('> ')) {
        return `<font color="comment">${line.slice(2)}</font>`;
      }
      return line;
    })
    .join('\n');
}

export class WecomWebhook implements WebhookAdapter {
  private readonly url: string;
  private readonly name: string;

  constructor(name: string, url: string) {
    this.name = name;
    this.url = url;
  }

  async sendMarkdown(text: string): Promise<void> {
    // 转换为企业微信支持的 Markdown 格式
    let content = convertToWecomMarkdown(text);

    // 检查字节长度（企业微信限制是字节而非字符）
    const encoder = new TextEncoder();
    if (encoder.encode(content).length > MAX_CONTENT_BYTES) {
      // 逐步截断直到满足字节限制
      while (encoder.encode(content).length > MAX_CONTENT_BYTES - 60) {
        content = content.slice(0, -10);
      }
      content += '\n\n<font color="warning">内容过长，已截断</font>';
      console.warn(`[WeCom] ${this.name}: 消息内容超过 ${MAX_CONTENT_BYTES} 字节，已截断。`);
    }

    const body = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content, // 注意：企业微信用 content 而非 text
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

      if (result.errcode && result.errcode !== 0) {
        throw new Error(`WeCom API 错误: ${JSON.stringify(result)}`);
      }

      console.log(`[WeCom] ${this.name}: 消息发送成功。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[WeCom] ${this.name}: 消息发送失败 - ${msg}`);
      throw error;
    }
  }
}
