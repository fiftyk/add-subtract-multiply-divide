import type { FastifyInstance } from 'fastify';
import type { ListPlansResponse, GetPlanResponse } from '../types/sse.js';

/**
 * Plans API Routes
 * Handles plan listing and retrieval
 */
export default async function plansRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plans
   * List all available plans
   */
  fastify.get('/', async (request, reply) => {
    try {
      // TODO: Integrate with StorageImpl
      // const storage = container.get<Storage>(TYPES.Storage);
      // const plans = await storage.listPlans();

      // Mock response with sample plans
      return {
        plans: [
          {
            id: 'plan-patent-query',
            userRequest: '查询指定公司在特定时间范围内的专利信息',
            status: 'executable',
            createdAt: new Date('2026-01-08').toISOString()
          },
          {
            id: 'plan-calculate',
            userRequest: '计算 (3 + 5) * 2 的结果',
            status: 'executable',
            createdAt: new Date('2026-01-09').toISOString()
          }
        ]
      };
    } catch (error) {
      console.error('Error listing plans:', error);
      return reply.status(500).send({
        error: 'Failed to list plans',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/plans/:id
   * Get a specific plan by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id: planId } = request.params;

      try {
        // TODO: Integrate with StorageImpl
        // const storage = container.get<Storage>(TYPES.Storage);
        // const plan = await storage.loadPlan(planId);

        // Mock response
        if (planId === 'plan-patent-query') {
          return {
            plan: {
              id: 'plan-patent-query',
              userRequest: '查询指定公司在特定时间范围内的专利信息',
              steps: [
                {
                  stepId: 1,
                  type: 'user_input',
                  description: '收集用户输入',
                  schema: {
                    version: '1.0',
                    fields: [
                      {
                        id: 'companyName',
                        type: 'text',
                        label: '公司名称',
                        required: true,
                        config: { placeholder: '例如：华为技术有限公司' }
                      },
                      {
                        id: 'startDate',
                        type: 'date',
                        label: '开始日期',
                        required: true
                      },
                      {
                        id: 'endDate',
                        type: 'date',
                        label: '截止日期',
                        required: true
                      }
                    ]
                  },
                  outputName: 'userInputData'
                },
                {
                  stepId: 2,
                  type: 'function_call',
                  functionName: 'queryPatents',
                  parameters: {
                    companyName: {
                      type: 'reference',
                      value: 'step.1.result.companyName'
                    },
                    startDate: {
                      type: 'reference',
                      value: 'step.1.result.startDate'
                    },
                    endDate: {
                      type: 'reference',
                      value: 'step.1.result.endDate'
                    }
                  }
                }
              ],
              status: 'executable',
              createdAt: new Date('2026-01-08').toISOString()
            }
          };
        } else if (planId === 'plan-calculate') {
          return {
            plan: {
              id: 'plan-calculate',
              userRequest: '计算 (3 + 5) * 2 的结果',
              steps: [
                {
                  stepId: 1,
                  type: 'function_call',
                  functionName: 'add',
                  parameters: {
                    a: { type: 'literal', value: 3 },
                    b: { type: 'literal', value: 5 }
                  }
                },
                {
                  stepId: 2,
                  type: 'function_call',
                  functionName: 'multiply',
                  parameters: {
                    a: { type: 'reference', value: 'step.1.result' },
                    b: { type: 'literal', value: 2 }
                  }
                }
              ],
              status: 'executable',
              createdAt: new Date('2026-01-09').toISOString()
            }
          };
        }

        return reply.status(404).send({
          error: 'Plan not found',
          message: `No plan found with id: ${planId}`
        });
      } catch (error) {
        console.error('Error loading plan:', error);
        return reply.status(500).send({
          error: 'Failed to load plan',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
