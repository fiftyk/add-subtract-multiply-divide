/**
 * Express type extensions
 *
 * Extend Express Request interface to include our services
 */

import type { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';
import type { InteractiveSessionService } from '../../core/services/InteractiveSessionService.js';
import type { A2UISessionFactory } from '../../a2ui/interfaces/index.js';

declare global {
  namespace Express {
    interface Request {
      orchestrationService?: OrchestrationService;
      sessionService?: InteractiveSessionService;
      a2uiSessionFactory?: A2UISessionFactory;
    }
  }
}
