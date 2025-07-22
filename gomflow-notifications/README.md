# GOMFLOW Notifications Service

Real-time notification service with WebSocket, Push Notifications, and Email support for the GOMFLOW platform.

## Features

- **Real-time WebSocket communication** with Socket.io
- **Push notifications** via Firebase Cloud Messaging (FCM)
- **Email notifications** via Resend API
- **User notification preferences** management
- **Multi-channel delivery** with automatic failover
- **Room-based notifications** for group orders
- **Notification templates** with variable substitution
- **Delivery tracking** and analytics
- **Rate limiting** and security features
- **Comprehensive testing** suite

## Architecture

```
gomflow-notifications/
├── src/
│   ├── services/          # Core business logic
│   │   ├── websocketService.ts
│   │   ├── notificationService.ts
│   │   ├── pushNotificationService.ts
│   │   └── emailService.ts
│   ├── routes/            # API endpoints
│   │   ├── notifications.ts
│   │   ├── webhooks.ts
│   │   └── health.ts
│   ├── types/             # TypeScript definitions
│   ├── config/            # Configuration
│   ├── utils/             # Utilities and helpers
│   └── client/            # Frontend WebSocket client
├── tests/                 # Test suites
├── migrations/            # Database migrations
└── docs/                  # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- Redis (for Socket.io adapter)
- Supabase database
- Firebase project (for push notifications)
- Resend account (for email)

### Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3005
HOST=localhost
CORS_ORIGIN=http://localhost:3000

# Authentication
JWT_SECRET=your-jwt-secret

# Database
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key

# Email (Resend)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@gomflow.com

# Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Service Authentication
CORE_API_SECRET=your-core-api-secret
```

### Installation

```bash
# Install dependencies
npm install

# Set up database migrations
# Run the SQL in migrations/notifications_schema.sql in your Supabase database

# Start development server
npm run dev

# Or build and start production
npm run build
npm start
```

## API Documentation

### WebSocket Events

#### Client → Server

- `join-room` - Join a notification room
- `leave-room` - Leave a notification room
- `test-notification` - Send test notification (dev only)

#### Server → Client

- `notification` - Real-time notification delivery
- `system-message` - System announcements
- `room-joined` - Confirmation of room join
- `room-left` - Confirmation of room leave
- `room-error` - Room operation error

### REST Endpoints

#### Health Check
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed service status

#### Notifications
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/user/:userId` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `GET /api/notifications/unread/count` - Get unread count

#### Preferences
- `GET /api/notifications/preferences` - Get user preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/fcm/register` - Register FCM token
- `DELETE /api/notifications/fcm/token/:token` - Remove FCM token

#### Webhooks
- `POST /api/webhooks/core-api` - Core API events
- `POST /api/webhooks/smart-agent` - Smart Agent events

## Frontend Integration

### WebSocket Client

```typescript
import { createWebSocketClient } from '@gomflow/notifications/client';

const client = createWebSocketClient({
  url: 'ws://localhost:3005',
  token: 'your-jwt-token'
});

// Connect
client.connect();

// Listen for notifications
client.onNotification((notification) => {
  console.log('New notification:', notification);
});

// Join order-specific room
client.joinRoom('order-123');
```

### React Hook

```typescript
import { useWebSocket } from '@gomflow/notifications/client';

function NotificationComponent() {
  const { isConnected, notifications, client } = useWebSocket({
    url: process.env.REACT_APP_WS_URL,
    token: authToken
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {notifications.map(notif => (
        <div key={notif.id}>{notif.title}: {notif.message}</div>
      ))}
    </div>
  );
}
```

## Testing

```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY migrations/ ./migrations/

EXPOSE 3005
CMD ["npm", "start"]
```

### Railway

The service is configured for Railway deployment with `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false
  }
}
```

## Monitoring

### Health Checks

- `/health` - Basic liveness probe
- `/health/detailed` - Comprehensive status
- `/health/ready` - Readiness probe
- `/health/live` - Kubernetes liveness

### Metrics

- WebSocket connection count
- Notification delivery rates
- Channel success/failure rates
- Response times

## Security

- JWT authentication for WebSocket connections
- Rate limiting per IP
- CORS configuration
- Helmet security headers
- Row Level Security (RLS) on database
- Input validation with Zod
- Webhook signature verification

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check JWT token validity
   - Verify CORS origin configuration
   - Ensure Redis is running for clustering

2. **Push notifications not working**
   - Verify Firebase configuration
   - Check FCM token registration
   - Validate service account key

3. **Email notifications failing**
   - Confirm Resend API key
   - Check from email domain verification
   - Review rate limits

### Debug Mode

```bash
# Enable debug logging
DEBUG=socket.io:* npm run dev

# Or set log level
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## License

MIT License - see LICENSE file for details.