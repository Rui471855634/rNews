/**
 * Webhook 适配器接口定义
 */

/** Webhook 适配器统一接口 */
export interface WebhookAdapter {
  /** 发送 Markdown 消息 */
  sendMarkdown(text: string): Promise<void>;
}
