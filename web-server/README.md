# fn-orchestrator Web Server

Web API server for fn-orchestrator with A2UI protocol support and Server-Sent Events (SSE) for real-time execution updates.

## Features

- ✅ RESTful API for session and plan management
- ✅ Server-Sent Events (SSE) for real-time updates
- ✅ A2UI protocol support for dynamic form rendering
- ✅ CORS enabled for frontend integration
- ✅ TypeScript with full type safety
- ✅ Fast and lightweight (Fastify framework)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and adjust settings:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
DATA_PATH=../.data
LOG_LEVEL=info
```

### 3. Run Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "uptime": 123.456
}
```

### Plans API

#### List Plans

```bash
GET /api/plans
```

**Response:**
```json
{
  "plans": [
    {
      "id": "plan-patent-query",
      "userRequest": "查询指定公司在特定时间范围内的专利信息",
      "status": "executable",
      "createdAt": "2026-01-08T00:00:00.000Z"
    }
  ]
}
```

#### Get Plan Details

```bash
GET /api/plans/:id
```

### Sessions API

#### Execute Session

```bash
POST /api/sessions/execute
Content-Type: application/json

{
  "planId": "plan-patent-query",
  "platform": "web"
}
```

**Response:**
```json
{
  "sessionId": "session-1234567890",
  "status": "pending"
}
```

#### Get Session Details

```bash
GET /api/sessions/:id
```

#### SSE Event Stream

```bash
GET /api/sessions/:id/stream
```

Establishes an SSE connection for real-time updates. Event types:

- `executionStart` - Execution began
- `stepStart` - Step started
- `stepComplete` - Step completed
- `inputRequested` - User input required (A2UI form)
- `inputReceived` - User input received
- `executionComplete` - Execution finished
- `executionError` - Error occurred

#### Resume Session (Submit Input)

```bash
POST /api/sessions/:id/resume
Content-Type: application/json

{
  "inputData": {
    "companyName": "华为技术有限公司",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }
}
```

## Testing with curl

### 1. Execute a Plan

```bash
curl -X POST http://localhost:3000/api/sessions/execute \
  -H "Content-Type: application/json" \
  -d '{"planId":"plan-patent-query"}'
```

### 2. Connect to SSE Stream

```bash
curl -N http://localhost:3000/api/sessions/session-1234567890/stream
```

### 3. Submit User Input

```bash
curl -X POST http://localhost:3000/api/sessions/session-1234567890/resume \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "companyName": "华为技术有限公司",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }'
```

## Project Structure

```
web-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── routes/
│   │   ├── sessions.ts       # Session API routes
│   │   └── plans.ts          # Plan API routes
│   ├── services/
│   │   └── SSEManager.ts     # SSE connection management
│   ├── types/
│   │   └── sse.ts            # TypeScript type definitions
│   └── middleware/           # Custom middleware (future)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Development Workflow

### Watch Mode

```bash
npm run dev
```

Uses `tsx watch` for hot reload during development.

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` folder.

### Production

```bash
npm start
```

Runs the compiled JavaScript from `dist/`.

## Integration with fn-orchestrator Core

The server is designed to integrate with the existing fn-orchestrator core:

```typescript
// TODO: Uncomment when integrating
import { container } from '../src/container/index.js';
import { TYPES } from '../src/container/types.js';
import type { ExecutionSessionManager } from '../src/executor/session/managers/ExecutionSessionManagerImpl.js';

const sessionManager = container.get<ExecutionSessionManager>(TYPES.ExecutionSessionManager);
```

## Next Steps

1. **Integrate Core Services**
   - Connect to `ExecutionSessionManager`
   - Connect to `ExecutionSessionStorage`
   - Connect to `StorageImpl` for plans

2. **Add Event Emission**
   - Modify `ExecutionSessionManagerImpl` to emit SSE events
   - Hook into step lifecycle events

3. **Frontend Integration**
   - Build Vue 3 frontend
   - Implement A2UI renderer
   - Connect to SSE stream

4. **Testing**
   - Add unit tests with Vitest
   - Add E2E tests with Playwright

## Troubleshooting

### CORS Issues

Ensure `FRONTEND_URL` in `.env` matches your frontend URL:

```env
FRONTEND_URL=http://localhost:5173
```

### SSE Connection Drops

- Check firewall settings
- Verify heartbeat interval (30s default)
- Check browser console for connection errors

### Port Already in Use

Change port in `.env`:

```env
PORT=3001
```

## License

MIT
