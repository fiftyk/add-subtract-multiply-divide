/**
 * 绑定值类型定义
 *
 * 支持字面量和路径引用两种形式
 */

/**
 * 绑定值类型
 * 支持字面量值或数据模型路径引用
 */
export type BoundValue<T = unknown> =
  | LiteralString
  | LiteralNumber
  | LiteralBoolean
  | PathReference
  | PathWithDefault;

/**
 * 字面量字符串
 */
export interface LiteralString {
  literalString: string;
}

/**
 * 字面量数字
 */
export interface LiteralNumber {
  literalNumber: number;
}

/**
 * 字面量布尔值
 */
export interface LiteralBoolean {
  literalBoolean: boolean;
}

/**
 * 路径引用
 */
export interface PathReference {
  path: string;
}

/**
 * 带默认值的路径引用
 */
export interface PathWithDefault {
  path: string;
  literalString?: string;
  literalNumber?: number;
  literalBoolean?: boolean;
}

/**
 * 检查是否为字面量字符串
 */
export function isLiteralString(value: unknown): value is LiteralString {
  return (
    typeof value === 'object' &&
    value !== null &&
    'literalString' in value &&
    typeof (value as LiteralString).literalString === 'string'
  );
}

/**
 * 检查是否为字面量数字
 */
export function isLiteralNumber(value: unknown): value is LiteralNumber {
  return (
    typeof value === 'object' &&
    value !== null &&
    'literalNumber' in value &&
    typeof (value as LiteralNumber).literalNumber === 'number'
  );
}

/**
 * 检查是否为字面量布尔值
 */
export function isLiteralBoolean(value: unknown): value is LiteralBoolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'literalBoolean' in value &&
    typeof (value as LiteralBoolean).literalBoolean === 'boolean'
  );
}

/**
 * 检查是否为路径引用
 */
export function isPathReference(value: unknown): value is PathReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof (value as PathReference).path === 'string' &&
    !('literalString' in value || 'literalNumber' in value || 'literalBoolean' in value)
  );
}

/**
 * 检查是否为带默认值的路径引用
 */
export function isPathWithDefault(value: unknown): value is PathWithDefault {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof (value as PathWithDefault).path === 'string' &&
    ('literalString' in value || 'literalNumber' in value || 'literalBoolean' in value)
  );
}

/**
 * 获取 BoundValue 的实际值
 * @param boundValue 绑定值
 * @param dataModel 数据模型
 * @returns 解析后的值
 */
export function resolveBoundValue<T>(
  boundValue: BoundValue<T>,
  dataModel: Record<string, unknown>
): T {
  // 字面量字符串
  if ('literalString' in boundValue && typeof boundValue.literalString === 'string') {
    return boundValue.literalString as T;
  }
  // 字面量数字
  if ('literalNumber' in boundValue && typeof boundValue.literalNumber === 'number') {
    return boundValue.literalNumber as T;
  }
  // 字面量布尔值
  if ('literalBoolean' in boundValue && typeof boundValue.literalBoolean === 'boolean') {
    return boundValue.literalBoolean as T;
  }
  // 路径引用（无默认值）
  if ('path' in boundValue && typeof boundValue.path === 'string' && !('literalString' in boundValue)) {
    return getValueByPath(dataModel, boundValue.path) as T;
  }
  // 带默认值的路径引用
  if ('path' in boundValue && typeof boundValue.path === 'string') {
    const pathValue = getValueByPath(dataModel, boundValue.path);
    if (pathValue !== undefined) {
      return pathValue as T;
    }
    // 返回默认值
    const withDefault = boundValue as PathWithDefault;
    if (withDefault.literalString !== undefined) {
      return withDefault.literalString as T;
    }
    if (withDefault.literalNumber !== undefined) {
      return withDefault.literalNumber as T;
    }
    if (withDefault.literalBoolean !== undefined) {
      return withDefault.literalBoolean as T;
    }
  }
  return undefined as T;
}

/**
 * 根据路径获取数据模型中的值
 * 支持 JSON 指针格式，如 "/user/address/city"
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('/').filter(Boolean);
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}
