import { defineFunction } from '@fn-orchestrator/core/registry';

/**
 * 处理用户注册信息
 * 用途: 测试多种输入字段组合（text, date, select）
 */
export const processUserRegistration = defineFunction({
  name: 'processUserRegistration',
  description: '处理用户注册信息',
  scenario: '当需要收集用户基本信息时使用',
  parameters: [
    { name: 'username', type: 'string', description: '用户名（3-20个字符）' },
    { name: 'email', type: 'string', description: '电子邮箱地址' },
    { name: 'birthDate', type: 'string', description: '出生日期' },
    { name: 'country', type: 'string', description: '所在国家' },
  ],
  returns: {
    type: 'object',
    description: '注册处理结果'
  },
  implementation: (username: string, email: string, birthDate: string, country: string) => {
    return {
      success: true,
      message: `用户 ${username} 注册成功`,
      userId: Math.floor(Math.random() * 10000),
      profile: {
        username,
        email,
        birthDate,
        country,
        age: new Date().getFullYear() - new Date(birthDate).getFullYear(),
      },
    };
  },
});

/**
 * 处理订单查询
 * 用途: 测试表单输入验证（number range）
 */
export const processOrderQuery = defineFunction({
  name: 'processOrderQuery',
  description: '处理订单查询请求',
  scenario: '当需要按日期范围查询订单时使用',
  parameters: [
    { name: 'orderId', type: 'string', description: '订单编号（可选）' },
    { name: 'startDate', type: 'string', description: '开始日期' },
    { name: 'endDate', type: 'string', description: '结束日期' },
    { name: 'minAmount', type: 'number', description: '最小金额' },
    { name: 'maxAmount', type: 'number', description: '最大金额' },
    { name: 'status', type: 'string', description: '订单状态' },
  ],
  returns: {
    type: 'object',
    description: '查询结果'
  },
  implementation: (orderId: string, startDate: string, endDate: string, minAmount: number, maxAmount: number, status: string) => {
    return {
      queryParams: { orderId, startDate, endDate, minAmount, maxAmount, status },
      totalCount: Math.floor(Math.random() * 100),
      orders: [
        { id: 'ORD-001', amount: 299.99, status: 'completed', date: '2024-03-01' },
        { id: 'ORD-002', amount: 599.00, status: 'shipped', date: '2024-03-05' },
        { id: 'ORD-003', amount: 149.50, status: 'processing', date: '2024-03-10' },
      ],
    };
  },
});

/**
 * 创建调查问卷回答
 * 用途: 测试多选字段（multi_select）和布尔值（checkbox）
 */
export const processSurveyResponse = defineFunction({
  name: 'processSurveyResponse',
  description: '处理调查问卷回答',
  scenario: '当需要收集用户调查反馈时使用',
  parameters: [
    { name: 'name', type: 'string', description: '受访者姓名（可选）' },
    { name: 'age', type: 'number', description: '年龄' },
    { name: 'interests', type: 'array', description: '感兴趣的领域（可多选）' },
    { name: 'experienceLevel', type: 'string', description: '经验水平' },
    { name: 'newsletter', type: 'boolean', description: '是否订阅资讯' },
    { name: 'comments', type: 'string', description: '其他建议（可选）' },
  ],
  returns: {
    type: 'object',
    description: '问卷处理结果'
  },
  implementation: (name: string, age: number, interests: string[], experienceLevel: string, newsletter: boolean, comments: string) => {
    return {
      success: true,
      responseId: `SR-${Date.now()}`,
      answers: {
        name: name || '匿名',
        age,
        interests,
        experienceLevel,
        newsletter,
        comments: comments || '无',
      },
      summary: `感谢您的反馈！您对 ${interests.length} 个领域感兴趣。`,
    };
  },
});

/**
 * 配置产品选项
 * 用途: 测试布尔值和单选组合
 */
export const configureProductOptions = defineFunction({
  name: 'configureProductOptions',
  description: '配置产品的定制选项',
  scenario: '当需要用户配置产品选项时使用',
  parameters: [
    { name: 'color', type: 'string', description: '选择颜色' },
    { name: 'size', type: 'string', description: '选择尺寸' },
    { name: 'quantity', type: 'number', description: '购买数量（1-10）' },
    { name: 'giftWrap', type: 'boolean', description: '是否需要礼品包装' },
    { name: 'expressShipping', type: 'boolean', description: '是否选择加急配送' },
    { name: 'engraving', type: 'string', description: '刻字内容（可选）' },
  ],
  returns: {
    type: 'object',
    description: '配置结果'
  },
  implementation: (color: string, size: string, quantity: number, giftWrap: boolean, expressShipping: boolean, engraving: string) => {
    const basePrice = 99.99;
    const total = basePrice * quantity * (expressShipping ? 1.5 : 1) + (giftWrap ? 5 : 0);
    return {
      configuration: {
        product: 'Premium Widget',
        color,
        size,
        quantity,
        giftWrap,
        expressShipping,
        engraving: engraving || '无',
      },
      pricing: {
        unitPrice: basePrice,
        quantity,
        giftWrapFee: giftWrap ? 5 : 0,
        shippingFee: expressShipping ? basePrice * quantity * 0.5 : 0,
        total,
      },
    };
  },
});

/**
 * 搜索并筛选数据
 * 用途: 测试日期范围和数字范围输入
 */
export const searchAndFilter = defineFunction({
  name: 'searchAndFilter',
  description: '搜索并筛选数据',
  scenario: '当需要多条件搜索时使用',
  parameters: [
    { name: 'keyword', type: 'string', description: '搜索关键词' },
    { name: 'category', type: 'string', description: '分类' },
    { name: 'minPrice', type: 'number', description: '最低价格' },
    { name: 'maxPrice', type: 'number', description: '最高价格' },
    { name: 'inStock', type: 'boolean', description: '仅显示有货商品' },
    { name: 'sortBy', type: 'string', description: '排序方式' },
  ],
  returns: {
    type: 'object',
    description: '搜索结果'
  },
  implementation: (keyword: string, category: string, minPrice: number, maxPrice: number, inStock: boolean, sortBy: string) => {
    return {
      searchCriteria: { keyword, category, minPrice, maxPrice, inStock, sortBy },
      totalResults: 15,
      products: [
        { id: 'P001', name: `${keyword} 产品A`, category, price: 199.99, inStock: true },
        { id: 'P002', name: `${keyword} 产品B`, category, price: 299.99, inStock: true },
        { id: 'P003', name: `${keyword} 产品C`, category, price: 149.99, inStock: false },
      ],
    };
  },
});

/**
 * 预订会议
 * 用途: 测试日期时间输入
 */
export const bookMeeting = defineFunction({
  name: 'bookMeeting',
  description: '预订会议',
  scenario: '当需要安排会议时使用',
  parameters: [
    { name: 'title', type: 'string', description: '会议标题' },
    { name: 'date', type: 'string', description: '会议日期' },
    { name: 'startTime', type: 'string', description: '开始时间' },
    { name: 'duration', type: 'number', description: '会议时长（分钟）' },
    { name: 'room', type: 'string', description: '会议室' },
    { name: 'attendees', type: 'array', description: '参会人员邮箱' },
  ],
  returns: {
    type: 'object',
    description: '预订结果'
  },
  implementation: (title: string, date: string, startTime: string, duration: number, room: string, attendees: string[]) => {
    const endTime = new Date(`${date}T${startTime}`).getTime() + duration * 60000;
    return {
      bookingId: `MTG-${Date.now()}`,
      meeting: {
        title,
        date,
        startTime,
        endTime: new Date(endTime).toTimeString().slice(0, 5),
        duration,
        room,
        attendees: attendees.length,
      },
      calendarLink: `https://calendar.example.com/book/${Date.now()}`,
    };
  },
});

/**
 * 提交反馈
 * 用途: 测试多行文本输入
 */
export const submitFeedback = defineFunction({
  name: 'submitFeedback',
  description: '提交产品反馈',
  scenario: '当需要收集用户详细反馈时使用',
  parameters: [
    { name: 'feedbackType', type: 'string', description: '反馈类型' },
    { name: 'rating', type: 'number', description: '评分（1-5）' },
    { name: 'message', type: 'string', description: '详细反馈内容' },
    { name: 'screenshot', type: 'string', description: '截图URL（可选）' },
  ],
  returns: {
    type: 'object',
    description: '提交结果'
  },
  implementation: (feedbackType: string, rating: number, message: string, screenshot: string) => {
    return {
      feedbackId: `FB-${Date.now()}`,
      status: 'submitted',
      summary: {
        type: feedbackType,
        rating,
        hasScreenshot: !!screenshot,
        preview: message.slice(0, 100) + '...',
      },
      thankYouMessage: '感谢您的反馈！我们会认真考虑您的建议。',
    };
  },
});
