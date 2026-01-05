#!/usr/bin/env node
import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { executeCommand } from './commands/execute.js';
import { listCommand } from './commands/list.js';
import { refineCommand } from './commands/refine.js';
import { ConfigManager } from '../config/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// 读取 package.json 获取版本号
// 使用 process.cwd() 确保无论从哪个目录运行都能正确找到项目根目录的 package.json
const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
);

async function startWebMode(port: number): Promise<void> {
  console.log('Starting web mode...');
  try {
    // Use dynamic import with absolute path resolution
    const webServerPath = new URL('../web/server.js', import.meta.url).href;
    const { startWebServer } = await import(webServerPath);
    await startWebServer(port);
    console.log('Web server started. Open http://localhost:3001 in your browser.');
  } catch (error) {
    console.error('Failed to start web server:', error);
    process.exit(1);
  }
}

const program = new Command();

program
  .name('fn-orchestrator')
  .description('基于 LLM 的函数编排系统')
  .version(packageJson.version, '-v, --version', '显示版本号');

// Global options
program.option('--web', '以 Web 模式启动（提供 Web UI）');
program.option('--web-port <port>', 'Web 服务器端口', '3001');

// Check for web mode BEFORE parsing commands
// This allows --web to be used without a subcommand
const webIndex = process.argv.indexOf('--web');
const webPortIndex = process.argv.findIndex((arg, i) => arg === '--web-port' && i < process.argv.length - 1);

if (webIndex !== -1) {
  // Web mode - start web server and exit
  const port = webPortIndex !== -1 ? parseInt(process.argv[webPortIndex + 1], 10) : 3001;
  await startWebMode(port);
  // Don't call process.exit() - let the server run
  // The server will handle graceful shutdown with SIGTERM/SIGINT
}

// Global hook: Initialize ConfigManager before any command runs
// This centralizes configuration from CLI args, env vars, and config files
program.hook('preAction', (thisCommand, actionCommand) => {
  // Avoid double initialization (though shouldn't happen in practice)
  if (!ConfigManager.isInitialized()) {
    // Use actionCommand.opts() to get subcommand options (e.g., plan command's options)
    const opts = actionCommand.opts();

    // Initialize with CLI options (if present)
    // Commands without these options will have undefined values,
    // causing ConfigManager to fall back to env vars or defaults
    ConfigManager.initialize({
      autoComplete: opts.autoComplete,
      maxRetries: opts.maxRetries,
    });
  }
});

// plan 命令
program
  .command('plan <request>')
  .description('根据自然语言需求生成执行计划')
  .option('-f, --functions <path>', '函数定义文件路径', './dist/functions/index.js')
  .option('--auto-complete', '自动生成缺失的函数')
  .option('--no-auto-complete', '禁用自动函数补全')
  .option('--max-retries <number>', '函数补全的最大重试次数', (val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(`--max-retries 必须是正整数，当前值: ${val}`);
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

// Only parse and run commands if not in web mode
const inWebMode = process.argv.includes('--web');
if (!inWebMode) {
  program.parse();
}
