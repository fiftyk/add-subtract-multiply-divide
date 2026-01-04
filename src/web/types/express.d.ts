/**
 * Express type extensions
 *
 * Extend Express Request interface to include our services
 */

import type { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';
import type { InteractiveSessionService } from '../../core/services/InteractiveSessionService.js';

declare global {
  namespace Express {
    interface Request {
      orchestrationService?: OrchestrationService;
      sessionService?: InteractiveSessionService;
    }
  }
}
