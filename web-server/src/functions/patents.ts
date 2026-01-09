/**
 * Patent Query Functions for web server
 */

// @ts-ignore - Importing from parent project's dist folder
import type { FunctionDefinition } from '../../../dist/src/registry/types.js';

/**
 * Mock patent data for testing
 */
const MOCK_PATENTS = [
  {
    title: '一种基于深度学习的图像识别方法',
    pn: 'CN202410010101.0',
    inventor: '张三',
    pubDate: '2024-03-15',
  },
  {
    title: '新型高效能电池管理系统',
    pn: 'CN202410020202.0',
    inventor: '李四',
    pubDate: '2024-04-20',
  },
  {
    title: '智能物联网设备连接优化方案',
    pn: 'CN202410030303.0',
    inventor: '王五',
    pubDate: '2024-05-10',
  },
  {
    title: '多模态数据融合处理技术',
    pn: 'CN202410040404.0',
    inventor: '赵六',
    pubDate: '2024-06-01',
  },
  {
    title: '基于区块链的数据安全传输方法',
    pn: 'CN202410050505.0',
    inventor: '钱七',
    pubDate: '2024-07-08',
  },
];

/**
 * Query patents
 */
export const queryPatents: FunctionDefinition = {
  name: 'queryPatents',
  description: 'Query patent information for a company within a date range',
  scenario: 'When needing to query patents for a company in a specific time range',
  parameters: [
    {
      name: 'companyName',
      type: 'string',
      description: 'Company name to query',
    },
    {
      name: 'startDate',
      type: 'string',
      description: 'Start date (YYYY-MM-DD)',
    },
    {
      name: 'endDate',
      type: 'string',
      description: 'End date (YYYY-MM-DD)',
    },
  ],
  returns: {
    type: 'array',
    description: 'Array of patent information',
  },
  implementation: (companyName: string, startDate: string, endDate: string) => {
    console.log(`[queryPatents] Query: ${companyName}, range: ${startDate} ~ ${endDate}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredPatents = MOCK_PATENTS.filter((patent) => {
      const pubDate = new Date(patent.pubDate);
      return pubDate >= start && pubDate <= end;
    });

    console.log(`[queryPatents] Found ${filteredPatents.length} patents`);
    return filteredPatents;
  },
};

/**
 * Register patent query functions
 */
export function registerPatentFunctions(
  registerFn: (fn: FunctionDefinition) => void
): void {
  registerFn(queryPatents);
  console.log('[WebServer] Registered queryPatents function');
}
