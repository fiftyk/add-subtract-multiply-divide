#!/usr/bin/env node
import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { executeCommand } from './commands/execute.js';
import { listCommand } from './commands/list.js';
import { refineCommand } from './commands/refine.js';
import { ConfigManager } from '../config/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 读取 package.json 获取版本号
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('fn-orchestrator')
  .description('基于 LLM 的函数编排系统')
  .version(packageJson.version, '-v, --version', '显示版本号');

// Global hook: Initialize ConfigManager before any command runs
// This centralizes configuration from CLI args, env vars, and config files
program.hook('preAction', (thisCommand) => {
  // Avoid double initialization (though shouldn't happen in practice)
  if (!ConfigManager.isInitialized()) {
    const opts = thisCommand.opts();

    // Initialize with CLI options (if present)
    // Commands without these options will have undefined values,
    // causing ConfigManager to fall back to env vars or defaults
    ConfigManager.initialize({
      autoMock: opts.autoMock,
      mockMaxIterations: opts.mockMaxIterations,
    });
  }
});

// plan 命令
program
  .command('plan <request>')
  .description('根据自然语言需求生成执行计划')
  .option('-f, --functions <path>', '函数定义文件路径', './dist/functions/index.js')
  .option('--auto-mock', '自动生成缺失的函数 (mock 实现)')
  .option('--no-auto-mock', '禁用自动 mock 生成')
  .option('--mock-max-iterations <number>', 'Mock 生成的最大迭代次数', (val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(`--mock-max-iterations 必须是正整数，当前值: ${val}`);
    }
    return parsed;
  })
  .option('-i, --interactive', '交互模式：创建后提供执行/改进选项')
  .action(planCommand);

// execute 命令
program
  .command('execute <planId>')
  .description('执行指定的计划')
  .option('-f, --functions <path>', '函数定义文件路径', './dist/functions/index.js')
  .option('-y, --yes', '跳过确认直接执行', false)
  .action(executeCommand);

// list 命令
program
  .command('list')
  .description('列出信息')
  .addCommand(
    new Command('functions')
      .description('列出已注册的函数')
      .option('-f, --functions <path>', '函数定义文件路径', './dist/functions/index.js')
      .action(listCommand.functions)
  )
  .addCommand(
    new Command('plans').description('列出所有执行计划').action(listCommand.plans)
  );

// show-plan 命令
program
  .command('show-plan <planId>')
  .description('显示计划详情')
  .action(listCommand.showPlan);

// refine 命令
program
  .command('refine <planId>')
  .description('交互式改进执行计划')
  .option('-p, --prompt <text>', '单次改进指令')
  .option('-s, --session <sessionId>', '继续现有会话')
  .action(refineCommand);

program.parse();
