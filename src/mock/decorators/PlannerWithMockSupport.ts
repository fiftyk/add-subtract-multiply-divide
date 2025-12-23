import type { Planner } from '../../planner/planner.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { PlanResult } from '../../planner/types.js';

/**
 * Decorator for Planner that adds automatic mock generation support
 * Follows Decorator Pattern: Extends behavior without modifying the original class
 * Follows OCP: Open for extension (via decoration), closed for modification
 */
export class PlannerWithMockSupport {
  constructor(
    private basePlanner: Planner,
    private mockOrchestrator: IMockOrchestrator,
    private registry: FunctionRegistry
  ) {}

  /**
   * Plan with automatic mock generation for missing functions
   */
  async plan(userRequest: string): Promise<PlanResult> {
    // 1. Try original planning
    let result = await this.basePlanner.plan(userRequest);

    // 2. If planning failed, return immediately
    if (!result.success) {
      return result;
    }

    // 3. If plan is incomplete and has missing functions, generate mocks
    if (
      result.plan?.status === 'incomplete' &&
      result.plan.missingFunctions &&
      result.plan.missingFunctions.length > 0
    ) {
      console.log('🔧 Generating mock implementations...');

      const mockResult = await this.mockOrchestrator.generateAndRegisterMocks(
        result.plan.missingFunctions
      );

      if (mockResult.success && mockResult.generatedFunctions.length > 0) {
        console.log(
          `✅ Generated ${mockResult.generatedFunctions.length} mock function(s)`
        );

        // 4. Re-plan now that functions are available
        result = await this.basePlanner.plan(userRequest);

        // 5. Add metadata to indicate mock usage
        if (result.success && result.plan) {
          result.plan.metadata = {
            usesMocks: true,
            mockFunctions: mockResult.generatedFunctions.map(
              (m) => m.functionName
            ),
          };
        }
      } else if (mockResult.errors && mockResult.errors.length > 0) {
        console.log(
          `⚠️ Failed to generate ${mockResult.errors.length} mock function(s)`
        );
        // Return the incomplete plan with error info
        return result;
      }
    }

    return result;
  }
}
