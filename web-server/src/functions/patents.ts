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
 * Analyze a specific patent and generate a detailed report
 */
export const analyzePatent: FunctionDefinition = {
  name: 'analyzePatent',
  description: 'Analyze a specific patent and generate a detailed analysis report',
  scenario: 'When needing to get detailed analysis of a specific patent',
  parameters: [
    {
      name: 'patentNumber',
      type: 'string',
      description: 'Patent number (e.g., CN202410010101.0)',
    },
  ],
  returns: {
    type: 'object',
    description: 'Patent analysis report including details and insights',
  },
  implementation: (patentNumber: string) => {
    console.log(`[analyzePatent] Analyzing patent: ${patentNumber}`);

    const patent = MOCK_PATENTS.find(p => p.pn === patentNumber);

    if (!patent) {
      return {
        error: 'Patent not found',
        patentNumber,
      };
    }

    // Generate a detailed analysis report
    const analysis = {
      basicInfo: {
        title: patent.title,
        patentNumber: patent.pn,
        inventor: patent.inventor,
        pubDate: patent.pubDate,
      },
      technicalFields: [
        'Artificial Intelligence',
        'Machine Learning',
        'Data Processing',
      ],
      analysis: {
        innovationLevel: 'High',
        applicationProspects: 'Broad',
        technicalComplexity: 'Medium',
      },
      summary: `专利 "${patent.title}" 由发明人 ${patent.inventor} 于 ${patent.pubDate} 申请。该专利涉及多个技术领域，具有较高的创新水平和广阔的应用前景。`,
      recommendations: [
        '建议关注该专利的技术实现方案',
        '可考虑与技术团队进行深入讨论',
        '评估专利的商业化价值',
      ],
    };

    console.log(`[analyzePatent] Analysis completed for: ${patentNumber}`);
    return analysis;
  },
};

/**
 * Register patent query functions
 */
export function registerPatentFunctions(
  registerFn: (fn: FunctionDefinition) => void
): void {
  registerFn(queryPatents);
  registerFn(analyzePatent);
  console.log('[WebServer] Registered queryPatents and analyzePatent functions');
}
