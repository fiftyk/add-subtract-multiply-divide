#!/usr/bin/env node
import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { executeCommand } from './commands/execute.js';
import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('fn-orchestrator')
  .description('基于 LLM 的函数编排系统')
  .version('1.0.0');

// plan 命令
program
  .command('plan <request>')
  .description('根据自然语言需求生成执行计划')
  .option('-f, --functions <path>', '函数定义文件路径', './dist/functions/index.js')
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

program.parse();
