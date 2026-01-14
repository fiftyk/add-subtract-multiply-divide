import { defineFunction } from '@fn-orchestrator/core/registry';

/**
 * 生成模拟用户数据列表
 * 用途: 测试 Table 组件（数组 → 表格）
 */
export const getUserList = defineFunction({
  name: 'getUserList',
  description: '获取用户列表数据',
  scenario: '当需要展示用户列表时使用，返回包含多个用户对象的数组',
  parameters: [],
  returns: {
    type: 'array',
    description: '用户对象数组，每个用户包含 id、name、email、status、role'
  },
  implementation: () => {
    return [
      { id: 1, name: '张三', email: 'zhangsan@example.com', status: 'active', role: 'admin' },
      { id: 2, name: '李四', email: 'lisi@example.com', status: 'active', role: 'user' },
      { id: 3, name: '王五', email: 'wangwu@example.com', status: 'inactive', role: 'user' },
      { id: 4, name: '赵六', email: 'zhaoliu@example.com', status: 'active', role: 'moderator' },
      { id: 5, name: '钱七', email: 'qianqi@example.com', status: 'pending', role: 'user' },
    ];
  },
});

/**
 * 获取订单统计信息
 * 用途: 测试 Card 组件（对象 → 卡片）
 */
export const getOrderStats = defineFunction({
  name: 'getOrderStats',
  description: '获取订单统计数据',
  scenario: '当需要展示单个统计摘要时使用，返回包含多个统计字段的对象',
  parameters: [],
  returns: {
    type: 'object',
    description: '订单统计对象，包含 totalOrders、completedOrders、pendingOrders、totalRevenue'
  },
  implementation: () => {
    return {
      totalOrders: 1250,
      completedOrders: 980,
      pendingOrders: 245,
      totalRevenue: 156780.50,
      avgOrderValue: 125.42,
      refundRate: 0.02,
    };
  },
});

/**
 * 获取项目进度
 * 用途: 测试 Progress 组件
 */
export const getProjectProgress = defineFunction({
  name: 'getProjectProgress',
  description: '获取项目当前进度',
  scenario: '当需要展示项目完成百分比时使用',
  parameters: [],
  returns: {
    type: 'object',
    description: '进度信息对象，包含 percentage、phase、milestones'
  },
  implementation: () => {
    return {
      percentage: 68,
      phase: '开发阶段',
      totalTasks: 50,
      completedTasks: 34,
      startDate: '2024-01-15',
      endDate: '2024-06-30',
      milestones: [
        { name: '需求分析', status: 'completed', date: '2024-01-30' },
        { name: '原型设计', status: 'completed', date: '2024-02-15' },
        { name: '开发实现', status: 'in_progress', date: '2024-04-30' },
        { name: '测试验收', status: 'pending', date: '2024-05-31' },
        { name: '上线发布', status: 'pending', date: '2024-06-30' },
      ],
    };
  },
});

/**
 * 获取系统状态
 * 用途: 测试 Badge 组件
 */
export const getSystemStatus = defineFunction({
  name: 'getSystemStatus',
  description: '获取系统各项服务状态',
  scenario: '当需要展示多个服务的运行状态时使用',
  parameters: [],
  returns: {
    type: 'array',
    description: '服务状态数组，每个服务包含 name、status、uptime、message'
  },
  implementation: () => {
    return [
      { name: '数据库', status: 'healthy', uptime: '99.9%', message: '运行正常' },
      { name: '缓存服务', status: 'healthy', uptime: '99.8%', message: '运行正常' },
      { name: '搜索引擎', status: 'warning', uptime: '98.5%', message: '响应稍慢' },
      { name: '消息队列', status: 'healthy', uptime: '99.7%', message: '运行正常' },
      { name: '文件存储', status: 'error', uptime: '95.2%', message: '磁盘空间不足' },
      { name: 'CDN', status: 'healthy', uptime: '100%', message: '运行正常' },
    ];
  },
});

/**
 * 获取产品目录
 * 用途: 测试 List 组件
 */
export const getProductCatalog = defineFunction({
  name: 'getProductCatalog',
  description: '获取产品目录列表',
  scenario: '当需要展示产品列表（带分类）时使用',
  parameters: [],
  returns: {
    type: 'array',
    description: '产品分类数组'
  },
  implementation: () => {
    return [
      {
        category: '电子产品',
        products: ['智能手机', '平板电脑', '智能手表', '耳机']
      },
      {
        category: '家用电器',
        products: ['冰箱', '洗衣机', '空调', '微波炉']
      },
      {
        category: '办公用品',
        products: ['打印机', '扫描仪', '投影仪', '碎纸机']
      },
    ];
  },
});

/**
 * 生成分步报告
 * 用途: 测试多种组件组合（Card + Divider + Table + Badge）
 */
export const generateReport = defineFunction({
  name: 'generateReport',
  description: '生成分步报告数据',
  scenario: '当需要生成分步骤的报告展示时使用',
  parameters: [],
  returns: {
    type: 'object',
    description: '报告数据对象'
  },
  implementation: () => {
    return {
      title: '2024年Q1季度报告',
      summary: '本季度各项指标均达到预期目标，整体表现良好',
      sections: [
        {
          title: '销售数据',
          data: [
            { metric: '总销售额', value: '¥1,250,000' },
            { metric: '订单数量', value: '3,450' },
            { metric: '客单价', value: '¥362' },
          ]
        },
        {
          title: '用户增长',
          data: [
            { metric: '新增用户', value: '12,500' },
            { metric: '活跃用户', value: '45,000' },
            { metric: '留存率', value: '78.5%' },
          ]
        },
      ],
      status: 'completed',
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * 获取待办事项
 * 用途: 测试 Row/Column 布局 + CheckBox
 */
export const getTodoList = defineFunction({
  name: 'getTodoList',
  description: '获取待办事项列表',
  scenario: '当需要展示待办任务列表时使用',
  parameters: [],
  returns: {
    type: 'array',
    description: '待办事项数组'
  },
  implementation: () => {
    return [
      { id: 1, title: '完成需求文档', priority: 'high', completed: true, dueDate: '2024-03-15' },
      { id: 2, title: '设计系统架构', priority: 'high', completed: true, dueDate: '2024-03-20' },
      { id: 3, title: '开发用户模块', priority: 'medium', completed: false, dueDate: '2024-04-10' },
      { id: 4, title: '编写测试用例', priority: 'medium', completed: false, dueDate: '2024-04-20' },
      { id: 5, title: '部署到测试环境', priority: 'low', completed: false, dueDate: '2024-04-25' },
    ];
  },
});

/**
 * 获取设置选项
 * 用途: 测试 Slider 组件
 */
export const getSettingsOptions = defineFunction({
  name: 'getSettingsOptions',
  description: '获取可调节的设置选项',
  scenario: '当需要展示可调节的数值参数时使用',
  parameters: [],
  returns: {
    type: 'object',
    description: '设置选项对象'
  },
  implementation: () => {
    return {
      volume: { value: 75, min: 0, max: 100, label: '音量' },
      brightness: { value: 80, min: 0, max: 100, label: '亮度' },
      contrast: { value: 50, min: 0, max: 100, label: '对比度' },
      fontSize: { value: 14, min: 12, max: 24, label: '字体大小' },
      opacity: { value: 90, min: 10, max: 100, label: '透明度' },
    };
  },
});
