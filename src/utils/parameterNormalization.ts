/**
 * Parameter Normalization Utilities
 *
 * Handles normalization of function parameters from legacy format (direct values)
 * to new format (type/value objects with 'literal' or 'reference' types)
 */

export type ParameterValue = {
  type: 'literal' | 'reference';
  value: unknown;
};

/**
 * Normalize parameter values to ParameterValue format
 * Handles both legacy format (direct values) and new format (type/value)
 *
 * @param params - Raw parameters object
 * @returns Normalized parameters with type/value structure
 */
export function normalizeParameters(
  params: Record<string, unknown>
): Record<string, ParameterValue> {
  const normalized: Record<string, ParameterValue> = {};

  for (const [key, value] of Object.entries(params)) {
    // If already in correct format, use as-is
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      if ('type' in v && 'value' in v) {
        normalized[key] = v as ParameterValue;
        continue;
      }
    }

    // Check if value is a reference (starts with "step.")
    const strValue = String(value);
    if (strValue.startsWith('step.')) {
      normalized[key] = { type: 'reference', value: strValue };
    } else {
      normalized[key] = { type: 'literal', value: value };
    }
  }

  return normalized;
}

/**
 * Check if parameters need normalization
 * Returns true if any parameter is not in the correct type/value format
 *
 * @param params - Parameters object to check
 * @returns True if normalization is needed
 */
export function parametersNeedNormalization(
  params: Record<string, unknown>
): boolean {
  return Object.values(params).some(
    (value) =>
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      !('type' in value && 'value' in value)
  );
}
