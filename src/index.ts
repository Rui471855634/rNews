#!/usr/bin/env node

/**
 * rNews CLI 入口
 * 支持 push 和 list 命令
 */

import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { dispatch } from './dispatcher.js';
import { startScheduler } from './scheduler.js';

const program = new Command();

program
  .name('rnews')
  .description('个人新闻聚合推送工具 - 从 RSS/API 抓取新闻，通过 Webhook 推送')
  .version('1.0.0');

/**
 * push 命令 - 抓取并推送新闻
 */
program
  .command('push')
  .description('抓取新闻并推送到 Webhook')
  .option('-c, --category <categories>', '要推送的类别，逗号分隔（如: ai,politics）或 "all"', 'all')
  .option('--config <path>', '配置文件路径', 'config.yaml')
  .action(async (options: { category: string; config: string }) => {
    try {
      const config = loadConfig(options.config);

      // 解析类别
      let categoryIds: string[];
      if (options.category === 'all') {
        categoryIds = Object.keys(config.categories);
      } else {
        categoryIds = options.category.split(',').map((c) => c.trim());
      }

      console.log(`🚀 rNews 开始推送`);
      console.log(`   类别: ${categoryIds.join(', ')}`);
      console.log(`   Webhook 数量: ${Object.keys(config.webhooks).length}`);

      await dispatch(config, categoryIds);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ 错误: ${msg}`);
      process.exit(1);
    }
  });

/**
 * list 命令 - 列出所有配置的类别和 Webhook
 */
program
  .command('list')
  .description('列出所有配置的类别和 Webhook')
  .option('--config <path>', '配置文件路径', 'config.yaml')
  .action((options: { config: string }) => {
    try {
      const config = loadConfig(options.config);

      console.log('\n📋 Webhook 列表:');
      console.log('─'.repeat(50));
      for (const [name, webhook] of Object.entries(config.webhooks)) {
        const maskedUrl = webhook.url.replace(/key=([^&]{6})[^&]*/, 'key=$1...');
        console.log(`  ${name}`);
        console.log(`    类型: ${webhook.type}`);
        console.log(`    地址: ${maskedUrl}`);
      }

      console.log('\n📰 新闻类别:');
      console.log('─'.repeat(50));
      for (const [id, category] of Object.entries(config.categories)) {
        console.log(`  ${id}: ${category.name}`);
        console.log(`    数量: ${category.count} 条`);
        console.log(`    推送到: ${category.webhooks.join(', ')}`);
        console.log(`    数据源: ${category.sources.length} 个`);
        for (const source of category.sources) {
          if (source.type === 'rss') {
            console.log(`      - [RSS] ${source.name}`);
          } else if (source.type === 'github-trending') {
            const lang = source.language || '所有语言';
            const since = source.since || 'daily';
            console.log(`      - [GitHub Trending] ${lang} / ${since}`);
          } else if (source.type === 'baidu-hot') {
            console.log(`      - [百度热搜] ${source.name || '实时热搜'}`);
          } else if (source.type === 'toutiao-hot') {
            console.log(`      - [今日头条] ${source.name || '热榜'}`);
          }
        }
      }

      if (config.schedule) {
        console.log('\n⏰ 定时规则:');
        console.log('─'.repeat(50));
        for (const rule of config.schedule) {
          console.log(`  ${rule.cron} → ${rule.categories.join(', ')}`);
        }
      }

      console.log('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ 错误: ${msg}`);
      process.exit(1);
    }
  });

/**
 * start 命令 - 启动定时调度器
 * Start the cron-based scheduler daemon
 */
program
  .command('start')
  .description('Start the scheduler daemon (runs cron jobs defined in config)')
  .option('--config <path>', '配置文件路径', 'config.yaml')
  .action((options: { config: string }) => {
    try {
      startScheduler(options.config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ 错误: ${msg}`);
      process.exit(1);
    }
  });

program.parse();
