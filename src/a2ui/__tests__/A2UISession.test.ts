/**
 * A2UI 会话测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  A2UISession,
  SurfaceManager,
  MessageSender,
  A2UISessionFactory,
} from '../interfaces/index.js';
import { A2UISessionImpl } from '../implementations/A2UISession.js';
import { SurfaceManagerImpl } from '../implementations/SurfaceManager.js';
import { MessageSenderImpl } from '../implementations/MessageSender.js';
import { A2UISessionFactoryImpl } from '../factory/A2UISessionFactory.js';

describe('A2UISession', () => {
  let session: A2UISession;
  let messageSender: MessageSenderImpl;
  let surfaceManager: SurfaceManager;

  beforeEach(() => {
    surfaceManager = new SurfaceManagerImpl();
    messageSender = new MessageSenderImpl();
    session = new A2UISessionImpl(surfaceManager, messageSender);
  });

  describe('sessionId', () => {
    it('should generate unique session id', () => {
      const session2 = new A2UISessionImpl(surfaceManager, messageSender);
      expect(session.sessionId).toBeDefined();
      expect(session2.sessionId).not.toBe(session.sessionId);
    });
  });

  describe('createSurface', () => {
    it('should create a new surface', () => {
      session.createSurface('main');

      expect(surfaceManager.hasSurface('main')).toBe(true);
      expect(surfaceManager.getSurface('main')).toBeDefined();
    });
  });

  describe('sendSurfaceUpdate', () => {
    it('should send surface update message', () => {
      session.createSurface('main');

      const messages: string[] = [];
      messageSender.registerSession(session.sessionId, 'main', (msg) => {
        messages.push(msg);
      });

      session.sendSurfaceUpdate('main', [
        { id: 'text1', component: { Text: { text: { literalString: 'Hello' } } } }
      ]);

      expect(messages.length).toBe(1);
      const message = JSON.parse(messages[0]);
      expect(message.surfaceUpdate).toBeDefined();
      expect(message.surfaceUpdate.surfaceId).toBe('main');
      expect(message.surfaceUpdate.components).toHaveLength(1);
    });
  });

  describe('sendDataModelUpdate', () => {
    it('should send data model update message', () => {
      session.createSurface('main');

      const messages: string[] = [];
      messageSender.registerSession(session.sessionId, 'main', (msg) => {
        messages.push(msg);
      });

      session.sendDataModelUpdate('main', { name: 'John', age: 30 });

      expect(messages.length).toBe(1);
      const message = JSON.parse(messages[0]);
      expect(message.dataModelUpdate).toBeDefined();
      expect(message.dataModelUpdate.surfaceId).toBe('main');
      expect(message.dataModelUpdate.contents).toHaveLength(2);
    });

    it('should handle nested path', () => {
      session.createSurface('main');

      const messages: string[] = [];
      messageSender.registerSession(session.sessionId, 'main', (msg) => {
        messages.push(msg);
      });

      session.sendDataModelUpdate('main', { city: 'Beijing' }, '/user/address');

      const message = JSON.parse(messages[0]);
      expect(message.dataModelUpdate.path).toBe('/user/address');
    });
  });

  describe('beginRendering', () => {
    it('should send begin rendering message', () => {
      session.createSurface('main');

      const messages: string[] = [];
      messageSender.registerSession(session.sessionId, 'main', (msg) => {
        messages.push(msg);
      });

      session.beginRendering('main', 'standard', 'root');

      expect(messages.length).toBe(1);
      const message = JSON.parse(messages[0]);
      expect(message.beginRendering).toBeDefined();
      expect(message.beginRendering.surfaceId).toBe('main');
      expect(message.beginRendering.catalogId).toBe('standard');
      expect(message.beginRendering.root).toBe('root');
    });
  });

  describe('deleteSurface', () => {
    it('should send delete surface message and remove surface', () => {
      session.createSurface('main');

      const messages: string[] = [];
      messageSender.registerSession(session.sessionId, 'main', (msg) => {
        messages.push(msg);
      });

      session.deleteSurface('main');

      expect(messages.length).toBe(1);
      expect(surfaceManager.hasSurface('main')).toBe(false);
    });
  });

  describe('handleUserAction', () => {
    it('should call registered action handler', () => {
      let receivedAction: any = null;

      session.onAction('submit', (action) => {
        receivedAction = action;
      });

      const action = {
        userAction: {
          name: 'submit',
          surfaceId: 'main',
          sourceComponentId: 'btn1',
          timestamp: new Date().toISOString(),
          context: { value: 'test' },
        },
      };

      session.handleUserAction(action);

      expect(receivedAction).not.toBeNull();
      expect(receivedAction.userAction.name).toBe('submit');
    });
  });
});

describe('A2UISessionFactory', () => {
  it('should create sessions', () => {
    const surfaceManager = new SurfaceManagerImpl();
    const messageSender = new MessageSenderImpl();
    const factory = new A2UISessionFactoryImpl(surfaceManager, messageSender);
    const session = factory.create();

    expect(session).toBeDefined();
    expect(session.sessionId).toBeDefined();
  });
});
