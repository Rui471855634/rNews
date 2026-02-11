/**
 * YAML 配置加载器
 * 支持 ${ENV_VAR} 语法引用环境变量（从 .env 文件或系统环境变量）
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import yaml from 'js-yaml';
import type { AppConfig } from './types.js';

const DEFAULT_CONFIG_PATH = 'config.yaml';

/**
 * 加载 .env 文件中的环境变量
 * 简易实现，不依赖第三方库
 */
function loadEnvFile(configDir: string): void {
  // 优先在配置文件同目录查找 .env，其次在 cwd
  const candidates = [
    resolve(configDir, '.env'),
    resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // 去除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // 不覆盖已有的环境变量（系统环境变量优先）
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return; // 只加载第一个找到的 .env
    }
  }
}

/**
 * 替换字符串中的 ${ENV_VAR} 为环境变量的值
 * 跳过 YAML 注释行（以 # 开头的行）
 */
function resolveEnvVars(text: string): string {
  return text.split('\n').map((line) => {
    // 跳过注释行
    if (line.trimStart().startsWith('#')) return line;

    return line.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const value = process.env[varName.trim()];
      if (value === undefined) {
        throw new Error(
          `环境变量 "${varName}" 未定义。\n` +
          '请在 .env 文件中设置，或通过系统环境变量传入。\n' +
          '参考 .env.example 了解需要哪些变量。'
        );
      }
      return value;
    });
  }).join('\n');
}

/**
 * 加载并解析 YAML 配置文件
 * @param configPath 配置文件路径（相对或绝对）
 */
export function loadConfig(configPath?: string): AppConfig {
  const resolvedPath = resolve(configPath ?? DEFAULT_CONFIG_PATH);

  if (!existsSync(resolvedPath)) {
    throw new Error(
      `配置文件不存在: ${resolvedPath}\n` +
      '请复制 config.example.yaml 为 config.yaml 并配置 .env 文件。'
    );
  }

  // 先加载 .env 文件
  loadEnvFile(dirname(resolvedPath));

  // 读取 YAML 并替换环境变量
  const raw = readFileSync(resolvedPath, 'utf-8');
  const resolved = resolveEnvVars(raw);
  const config = yaml.load(resolved) as AppConfig;

  validateConfig(config);

  return config;
}

/**
 * 校验配置合法性
 */
function validateConfig(config: AppConfig): void {
  if (!config.webhooks || Object.keys(config.webhooks).length === 0) {
    throw new Error('配置错误: 至少需要配置一个 webhook。');
  }

  if (!config.categories || Object.keys(config.categories).length === 0) {
    throw new Error('配置错误: 至少需要配置一个新闻类别。');
  }

  // 校验类别中引用的 webhook 是否存在
  for (const [categoryId, category] of Object.entries(config.categories)) {
    for (const webhookId of category.webhooks) {
      if (!config.webhooks[webhookId]) {
        throw new Error(
          `配置错误: 类别 "${categoryId}" 引用了不存在的 webhook "${webhookId}"。\n` +
          `可用的 webhook: ${Object.keys(config.webhooks).join(', ')}`
        );
      }
    }

    if (!category.sources || category.sources.length === 0) {
      throw new Error(`配置错误: 类别 "${categoryId}" 没有配置任何数据源。`);
    }

    if (!category.count || category.count < 1) {
      throw new Error(`配置错误: 类别 "${categoryId}" 的 count 必须大于 0。`);
    }
  }
}
