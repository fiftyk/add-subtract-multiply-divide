/**
 * 产品配置测试相关的 Mock 函数
 * 用于测试多步骤用户输入场景
 */

import { defineFunction } from '@fn-orchestrator/core/registry';

/**
 * 计算基础价格
 */
export const calculateBasePrice = defineFunction({
  name: 'calculateBasePrice',
  description: '根据产品类别和数量计算基础价格',
  scenario: '在用户选择产品类别和数量后，计算总价和折扣',
  parameters: [
    {
      name: 'category',
      type: 'string',
      description: '产品类别（电子产品、服装、家具、食品）'
    },
    {
      name: 'quantity',
      type: 'number',
      description: '购买数量'
    }
  ],
  returns: {
    type: 'object',
    description: '价格信息，包含基础价格、单价和折扣'
  },
  implementation: (category: string, quantity: number) => {
    // 不同类别的基础单价
    const priceMap: Record<string, number> = {
      '电子产品': 500,
      '服装': 200,
      '家具': 800,
      '食品': 50
    };

    const pricePerUnit = priceMap[category] || 300;
    const subtotal = pricePerUnit * quantity;

    // 数量折扣
    let discount = 0;
    if (quantity >= 10) {
      discount = 0.15; // 15% 折扣
    } else if (quantity >= 5) {
      discount = 0.1; // 10% 折扣
    }

    const basePrice = Math.round(subtotal * (1 - discount));

    return {
      basePrice,
      pricePerUnit,
      discount,
      subtotal,
      discountAmount: Math.round(subtotal * discount)
    };
  }
});

/**
 * 验证规格组合
 */
export const validateSpecCombination = defineFunction({
  name: 'validateSpecCombination',
  description: '验证用户选择的产品规格组合是否有效',
  scenario: '检查颜色、尺寸、材质的组合是否支持，以及是否有库存',
  parameters: [
    {
      name: 'category',
      type: 'string',
      description: '产品类别'
    },
    {
      name: 'specs',
      type: 'object',
      description: '规格信息，包含 color、size、material'
    }
  ],
  returns: {
    type: 'object',
    description: '验证结果，包含是否有效、消息和库存状态'
  },
  implementation: (category: string, specs: any) => {
    const { color, size, material } = specs;

    // 模拟一些不兼容的组合
    const incompatibleCombinations = [
      { category: '电子产品', material: '布料' },
      { category: '服装', material: '金属' },
      { category: '家具', size: 'S' },
      { category: '食品', color: '黑色' }
    ];

    const isIncompatible = incompatibleCombinations.some(combo =>
      combo.category === category &&
      (combo.material === material || combo.size === size || combo.color === color)
    );

    if (isIncompatible) {
      return {
        valid: false,
        message: `${category}不支持该规格组合`,
        stockAvailable: false,
        reason: `${material || size || color} 与 ${category} 不兼容`
      };
    }

    // 模拟库存检查
    const stockAvailable = Math.random() > 0.1; // 90% 有库存

    return {
      valid: true,
      message: '规格组合有效',
      stockAvailable,
      estimatedStock: stockAvailable ? Math.floor(Math.random() * 100) + 20 : 0
    };
  }
});

/**
 * 计算最终价格
 */
export const calculateFinalPrice = defineFunction({
  name: 'calculateFinalPrice',
  description: '根据所有选项计算最终价格',
  scenario: '在用户完成所有配置后，计算包含延保、礼品包装、紧急加急等附加费用的最终价格',
  parameters: [
    {
      name: 'basePrice',
      type: 'number',
      description: '基础价格'
    },
    {
      name: 'warranty',
      type: 'boolean',
      description: '是否购买延保'
    },
    {
      name: 'giftWrap',
      type: 'boolean',
      description: '是否需要礼品包装'
    },
    {
      name: 'urgency',
      type: 'string',
      description: '紧急程度（normal, urgent, very_urgent）'
    }
  ],
  returns: {
    type: 'object',
    description: '最终价格信息，包含明细和节省金额'
  },
  implementation: (basePrice: number, warranty: boolean, giftWrap: boolean, urgency: string) => {
    let finalPrice = basePrice;
    const breakdown: Record<string, number> = {
      basePrice
    };

    // 延保费用
    if (warranty) {
      const warrantyFee = Math.round(basePrice * 0.08); // 8% 延保费
      breakdown.warranty = warrantyFee;
      finalPrice += warrantyFee;
    }

    // 礼品包装费用
    if (giftWrap) {
      const giftWrapFee = 20;
      breakdown.giftWrap = giftWrapFee;
      finalPrice += giftWrapFee;
    }

    // 加急费用
    const urgencyFees: Record<string, number> = {
      normal: 0,
      urgent: 50,
      very_urgent: 100
    };
    const urgencyFee = urgencyFees[urgency] || 0;
    if (urgencyFee > 0) {
      breakdown.urgency = urgencyFee;
      finalPrice += urgencyFee;
    }

    // 计算节省金额（基于原价的折扣）
    const savings = 0; // 可以根据需要添加促销逻辑

    return {
      finalPrice: Math.round(finalPrice),
      breakdown,
      savings,
      totalBeforeDiscount: Math.round(finalPrice + savings)
    };
  }
});

/**
 * 验证配送地址
 */
export const validateDeliveryAddress = defineFunction({
  name: 'validateDeliveryAddress',
  description: '验证配送地址并计算配送费用和预计送达时间',
  scenario: '检查地址格式、可达性，并返回配送费用和预计天数',
  parameters: [
    {
      name: 'address',
      type: 'string',
      description: '详细地址'
    },
    {
      name: 'phone',
      type: 'string',
      description: '联系电话'
    }
  ],
  returns: {
    type: 'object',
    description: '验证结果，包含有效性、配送费用和预计送达天数'
  },
  implementation: (address: string, phone: string) => {
    // 模拟电话号码验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    const isPhoneValid = phoneRegex.test(phone);

    if (!isPhoneValid) {
      return {
        valid: false,
        message: '电话号码格式不正确',
        estimatedDays: 0,
        shippingFee: 0
      };
    }

    // 模拟地址验证（检查是否包含省市区）
    const addressKeywords = ['省', '市', '区', '县', '街道', '路'];
    const hasLocationInfo = addressKeywords.some(keyword => address.includes(keyword));

    if (!hasLocationInfo) {
      return {
        valid: false,
        message: '地址信息不完整，请填写省市区详细信息',
        estimatedDays: 0,
        shippingFee: 0
      };
    }

    // 模拟配送费用计算（根据地址关键字）
    let shippingFee = 20; // 基础运费
    if (address.includes('新疆') || address.includes('西藏') || address.includes('内蒙古')) {
      shippingFee = 50; // 偏远地区
    }

    // 模拟预计送达时间
    let estimatedDays = 3;
    if (address.includes('北京') || address.includes('上海') || address.includes('广州') || address.includes('深圳')) {
      estimatedDays = 2; // 一线城市更快
    } else if (address.includes('新疆') || address.includes('西藏')) {
      estimatedDays = 7; // 偏远地区更慢
    }

    return {
      valid: true,
      message: '地址验证通过',
      estimatedDays,
      shippingFee,
      courierService: '顺丰速运'
    };
  }
});

/**
 * 生成订单
 */
export const generateOrder = defineFunction({
  name: 'generateOrder',
  description: '根据所有配置信息生成订单',
  scenario: '在用户确认所有信息后，生成唯一的订单号并创建订单记录',
  parameters: [
    {
      name: 'productInfo',
      type: 'object',
      description: '产品信息，包含类别、数量、规格'
    },
    {
      name: 'customization',
      type: 'object',
      description: '个性化定制信息'
    },
    {
      name: 'delivery',
      type: 'object',
      description: '配送信息'
    },
    {
      name: 'payment',
      type: 'object',
      description: '支付信息，包含最终价格、运费、支付方式'
    }
  ],
  returns: {
    type: 'object',
    description: '订单信息，包含订单号、状态和总金额'
  },
  implementation: (productInfo: any, customization: any, delivery: any, payment: any) => {
    // 生成订单号
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderId = `ORD-${timestamp}-${randomSuffix}`;

    // 计算总金额
    const totalAmount = payment.finalPrice + payment.shippingFee;

    // 生成订单摘要
    const orderSummary = {
      orderId,
      status: 'confirmed',
      totalAmount,
      productSummary: `${productInfo.category} x ${productInfo.quantity}`,
      recipientName: delivery.recipientName,
      paymentMethod: payment.method,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    };

    return orderSummary;
  }
});
