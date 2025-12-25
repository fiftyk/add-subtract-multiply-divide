import type { FunctionDefinition } from '../registry/types.js';
import type { ExecutionPlan } from '../planner/types.js';
import { isFunctionCallStep } from '../planner/type-guards.js';
import { ParameterValidationError, PlanValidationError } from './errors.js';

/**
 * Type validator
 */
export class TypeValidator {
  /**
   * Validate parameter type
   */
  static validateParameter(
    name: string,
    value: unknown,
    expectedType: string
  ): void {
    const actualType = typeof value;

    switch (expectedType.toLowerCase()) {
      case 'string':
        if (actualType !== 'string') {
          throw new ParameterValidationError(name, 'string', value);
        }
        break;

      case 'number':
        if (actualType !== 'number' || isNaN(value as number)) {
          throw new ParameterValidationError(name, 'number', value);
        }
        break;

      case 'boolean':
        if (actualType !== 'boolean') {
          throw new ParameterValidationError(name, 'boolean', value);
        }
        break;

      case 'object':
        if (actualType !== 'object' || value === null) {
          throw new ParameterValidationError(name, 'object', value);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw new ParameterValidationError(name, 'array', value);
        }
        break;

      case 'any':
        // Any type is always valid
        break;

      default:
        // Unknown type - skip validation
        break;
    }
  }

  /**
   * Validate all function parameters
   */
  static validateFunctionParameters(
    fn: FunctionDefinition,
    params: Record<string, unknown>
  ): void {
    // Check all required parameters are provided
    for (const param of fn.parameters) {
      if (!(param.name in params)) {
        throw new ParameterValidationError(
          param.name,
          param.type,
          undefined
        );
      }

      // Validate parameter type
      this.validateParameter(param.name, params[param.name], param.type);
    }
  }
}

/**
 * Plan validator
 */
export class PlanValidator {
  /**
   * Validate execution plan structure
   */
  static validatePlan(plan: ExecutionPlan): void {
    // Validate plan ID
    if (!plan.id || typeof plan.id !== 'string' || plan.id.trim() === '') {
      throw new PlanValidationError('Plan ID is required', { id: plan.id });
    }

    // Validate user request
    if (!plan.userRequest || typeof plan.userRequest !== 'string') {
      throw new PlanValidationError('User request is required', {
        userRequest: plan.userRequest,
      });
    }

    // Validate steps
    if (!Array.isArray(plan.steps)) {
      throw new PlanValidationError('Steps must be an array', {
        steps: plan.steps,
      });
    }

    if (plan.steps.length === 0) {
      throw new PlanValidationError('Plan must have at least one step');
    }

    // Validate each step
    for (const step of plan.steps) {
      this.validateStep(step, plan.steps);
    }

    // Validate status
    if (!['pending', 'executable', 'incomplete'].includes(plan.status)) {
      throw new PlanValidationError('Invalid plan status', {
        status: plan.status,
      });
    }
  }

  /**
   * Validate a single step
   */
  private static validateStep(
    step: ExecutionPlan['steps'][0],
    allSteps: ExecutionPlan['steps']
  ): void {
    // Validate step ID
    if (typeof step.stepId !== 'number' || step.stepId < 1) {
      throw new PlanValidationError('Step ID must be a positive number', {
        stepId: step.stepId,
      });
    }

    // 只对函数调用步骤进行函数名和参数验证
    if (isFunctionCallStep(step)) {
      // Validate function name
      if (!step.functionName || typeof step.functionName !== 'string') {
        throw new PlanValidationError('Step must have a function name', {
          stepId: step.stepId,
          functionName: step.functionName,
        });
      }

      // Validate parameters
      if (!step.parameters || typeof step.parameters !== 'object') {
        throw new PlanValidationError('Step must have parameters object', {
          stepId: step.stepId,
          parameters: step.parameters,
        });
      }

      // Validate parameter references
      for (const [paramName, paramValue] of Object.entries(step.parameters)) {
        if (paramValue.type === 'reference') {
          this.validateReference(paramValue.value as string, step.stepId, allSteps);
        }
      }
    }
    // 用户输入步骤验证在运行时由 UserInputProvider 完成
  }

  /**
   * Validate parameter reference
   */
  private static validateReference(
    reference: string,
    currentStepId: number,
    allSteps: ExecutionPlan['steps']
  ): void {
    // Parse reference format: "step.{stepId}.result" or "step.{stepId}.{fieldName}"
    const match = reference.match(/^step\.(\d+)\.(.+)$/);
    if (!match) {
      throw new PlanValidationError('Invalid reference format', {
        reference,
        expectedFormat: 'step.{stepId}.result or step.{stepId}.{fieldName}',
      });
    }

    const referencedStepId = parseInt(match[1], 10);

    // Check referenced step exists and comes before current step
    if (referencedStepId >= currentStepId) {
      throw new PlanValidationError(
        'Step can only reference previous steps',
        {
          currentStepId,
          referencedStepId,
          reference,
        }
      );
    }

    // Check referenced step exists
    const referencedStep = allSteps.find((s) => s.stepId === referencedStepId);
    if (!referencedStep) {
      throw new PlanValidationError('Referenced step does not exist', {
        currentStepId,
        referencedStepId,
        reference,
      });
    }
  }
}
