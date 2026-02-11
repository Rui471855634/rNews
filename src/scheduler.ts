/**
 * Scheduler - reads cron rules from config.yaml and runs dispatch at scheduled times.
 * Uses node-cron for cross-platform cron scheduling with timezone support.
 */

import cron from 'node-cron';
import { loadConfig } from './config/loader.js';
import { dispatch } from './dispatcher.js';

/**
 * Start the scheduler daemon.
 * Reads schedule rules from config.yaml and creates cron jobs.
 * The config is reloaded on each trigger to pick up changes without restart.
 */
export function startScheduler(configPath?: string): void {
  const config = loadConfig(configPath);
  const timezone = config.settings?.timezone ?? 'Asia/Shanghai';

  if (!config.schedule || config.schedule.length === 0) {
    console.error('❌ No schedule rules found in config. Add a "schedule" section to config.yaml.');
    process.exit(1);
  }

  console.log('🕐 rNews Scheduler started');
  console.log(`   Timezone: ${timezone}`);
  console.log(`   Schedule rules: ${config.schedule.length}`);
  console.log('');

  for (const rule of config.schedule) {
    if (!cron.validate(rule.cron)) {
      console.error(`❌ Invalid cron expression: "${rule.cron}", skipping.`);
      continue;
    }

    console.log(`   ⏰ ${rule.cron} → ${rule.categories.join(', ')}`);

    cron.schedule(
      rule.cron,
      async () => {
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: timezone });
        console.log(`\n🔔 [${timestamp}] Triggered: ${rule.categories.join(', ')}`);

        try {
          // Reload config each time to pick up changes without restart
          const freshConfig = loadConfig(configPath);
          await dispatch(freshConfig, rule.categories);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Scheduler error: ${msg}`);
        }
      },
      { timezone },
    );
  }

  console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n👋 Scheduler stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
