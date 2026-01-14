import { defineFunction } from '@fn-orchestrator/core/registry';

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
 * 查询专利信息
 *
 * 根据公司名称和时间范围查询专利信息
 */
export const queryPatents = defineFunction({
  name: 'queryPatents',
  description: '查询指定公司在特定时间范围内的专利信息',
  scenario: '当需要查询某公司在特定时间范围内的专利时使用，例如"查询华为2024年的专利"',
  parameters: [
    {
      name: 'companyName',
      type: 'string',
      description: '要查询的公司名称',
    },
    {
      name: 'startDate',
      type: 'string',
      description: '查询的起始日期 (YYYY-MM-DD)',
    },
    {
      name: 'endDate',
      type: 'string',
      description: '查询的截止日期 (YYYY-MM-DD)',
    },
  ],
  returns: {
    type: 'array',
    description: '专利信息数组，包含专利标题、专利号、发明人和公开日期',
  },
  implementation: (companyName: string, startDate: string, endDate: string) => {
    console.log(`[queryPatents] 查询公司: ${companyName}, 时间范围: ${startDate} ~ ${endDate}`);

    // 解析日期进行比较
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 过滤专利（基于 pubDate）
    const filteredPatents = MOCK_PATENTS.filter((patent) => {
      const pubDate = new Date(patent.pubDate);
      return pubDate >= start && pubDate <= end;
    });

    console.log(`[queryPatents] 找到 ${filteredPatents.length} 条专利`);

    return filteredPatents;
  },
});
