# fn-orchestrator Web UI

A modern web interface for the fn-orchestrator system, built with Vue 3, TypeScript, and Tailwind CSS.

## Features

- View and manage execution plans
- Execute plans with real-time progress tracking
- Interactive user input forms with A2UI schema support
- Server-Sent Events (SSE) for live updates
- Responsive design with Tailwind CSS

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **EventSource** - SSE client for real-time updates

## Prerequisites

- Node.js 18+ and npm
- Backend server running on `http://localhost:3000`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

Edit `.env` if your backend API is running on a different URL:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
web-ui/
├── src/
│   ├── assets/          # Static assets and global styles
│   ├── services/        # API and SSE service modules
│   │   ├── api.ts       # REST API client
│   │   └── sse.ts       # Server-Sent Events client
│   ├── stores/          # Pinia state management
│   │   ├── plans.ts     # Plans store
│   │   └── session.ts   # Session execution store
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # Shared types
│   ├── views/           # Page components
│   │   ├── PlanListView.vue      # Plans list page
│   │   ├── PlanDetailView.vue    # Plan details page
│   │   └── ExecutionView.vue     # Execution progress page
│   ├── router/          # Vue Router configuration
│   │   └── index.ts
│   ├── App.vue          # Root component
│   └── main.ts          # Application entry point
├── .env                 # Environment variables (not in git)
├── .env.example         # Environment variables template
└── package.json
```

## Key Components

### Views

- **PlanListView**: Displays all available execution plans with status badges
- **PlanDetailView**: Shows detailed plan information and execution steps
- **ExecutionView**: Real-time execution monitoring with:
  - Live progress tracking
  - Step-by-step results
  - Interactive user input forms
  - Final execution results

### Services

- **api.ts**: REST API client for plans and sessions
- **sse.ts**: SSE client with automatic reconnection

### Stores

- **plans**: Manages plan data and loading states
- **session**: Handles execution sessions, SSE connections, and user input

## API Integration

The web UI connects to the backend API at the URL specified in `VITE_API_BASE_URL`.

### REST Endpoints

- `GET /api/plans` - List all plans
- `GET /api/plans/:id` - Get plan details
- `POST /api/sessions/execute` - Start plan execution
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/resume` - Submit user input

### SSE Stream

- `GET /api/sessions/:id/stream` - Real-time execution events

## A2UI Schema Support

The ExecutionView automatically renders input forms based on A2UI JSON Schema:

- String fields with validation
- Number/integer inputs
- Boolean checkboxes
- Enum dropdowns
- Required field indicators
- Field descriptions and help text

## Development Notes

- The SSE connection automatically reconnects on failure (max 5 attempts)
- Session state persists across view navigation
- All API requests include error handling and loading states
- TypeScript strict mode is enabled for type safety

## License

MIT
