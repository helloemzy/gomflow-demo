# GOMFLOW Analytics Service

## Overview

The GOMFLOW Analytics Service provides comprehensive analytics and reporting capabilities for the GOMFLOW platform. It tracks user behavior, order performance, submission metrics, and provides real-time insights through advanced analytics features.

## Features

### Core Analytics
- **Event Tracking**: Capture and process analytics events from all platforms
- **Real-time Metrics**: Live dashboard with current system performance
- **Time Series Analytics**: Historical data analysis with customizable time ranges
- **Custom Reports**: Generate detailed reports with filtering and export options

### Advanced Analytics
- **Cohort Analysis**: Track user retention and behavior over time
- **Funnel Analysis**: Conversion tracking through user journeys
- **Segment Analysis**: User segmentation and behavioral insights
- **Predictive Analytics**: Forecast trends and identify patterns

### Data Pipeline
- **Real-time Processing**: Stream processing of analytics events
- **Data Aggregation**: Pre-calculated metrics for fast querying
- **Automated Cleanup**: Configurable data retention policies
- **Batch Processing**: Scheduled data processing and metric calculation

### Reporting & Alerts
- **Interactive Dashboards**: Customizable analytics dashboards
- **Automated Reports**: Scheduled report generation and delivery
- **Real-time Alerts**: Threshold-based alerting system
- **Data Export**: Multiple export formats (CSV, JSON, Excel, PDF)

## Architecture

### Services
- **Analytics Service**: Core analytics functionality and API
- **Data Pipeline Service**: Event processing and aggregation
- **Reporting Service**: Dashboard and report generation

### Data Storage
- **Event Storage**: Raw analytics events in Supabase
- **Aggregated Data**: Pre-calculated metrics for performance
- **Report Storage**: Generated reports and export files
- **Cache Layer**: Redis for real-time metrics and session data

### Message Queue
- **Event Processing**: Bull queue for reliable event handling
- **Batch Jobs**: Scheduled aggregation and cleanup tasks
- **Export Jobs**: Asynchronous data export processing

## API Documentation

### Authentication
All API endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### Track Analytics Event
```http
POST /api/analytics/events
Content-Type: application/json

{
  "type": "order_created",
  "userId": "user-123",
  "orderId": "order-456",
  "platform": "discord",
  "country": "PH",
  "currency": "PHP",
  "data": {
    "orderValue": 1500,
    "productType": "album"
  }
}
```

#### Get Analytics Metrics
```http
GET /api/analytics/metrics?startDate=2025-01-01&endDate=2025-01-31&country=PH
```

#### Get Time Series Data
```http
GET /api/analytics/timeseries?metric=order_count&startDate=2025-01-01&endDate=2025-01-31
```

#### Get Real-time Metrics
```http
GET /api/analytics/realtime
```

#### Get Cohort Analysis
```http
GET /api/analytics/cohort?period=monthly&metric=retention
```

#### Get Funnel Analysis
```http
POST /api/analytics/funnel
Content-Type: application/json

{
  "eventTypes": [
    "user_registered",
    "order_created",
    "submission_created",
    "submission_payment_verified"
  ]
}
```

#### Create Alert
```http
POST /api/analytics/alerts
Content-Type: application/json

{
  "name": "High Error Rate Alert",
  "metric": "error_rate",
  "condition": "above",
  "threshold": 5.0,
  "timeWindow": 15,
  "recipients": ["admin@gomflow.com"],
  "channels": ["email", "slack"]
}
```

#### Export Data
```http
POST /api/analytics/export
Content-Type: application/json

{
  "format": "csv",
  "reportType": "orders",
  "filters": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "country": "PH"
  }
}
```

## Event Types

### Order Events
- `order_created` - New order initiated
- `order_updated` - Order details modified
- `order_deadline_reached` - Order deadline reached
- `order_goal_reached` - Order goal/quota reached
- `order_completed` - Order successfully completed
- `order_cancelled` - Order cancelled

### Submission Events
- `submission_created` - New submission created
- `submission_updated` - Submission modified
- `submission_payment_uploaded` - Payment proof uploaded
- `submission_payment_verified` - Payment verified
- `submission_payment_rejected` - Payment rejected

### User Events
- `user_registered` - New user registration
- `user_login` - User login
- `user_profile_updated` - Profile updated

### Platform Events
- `platform_message_sent` - Message sent via platform
- `platform_message_received` - Message received
- `platform_notification_sent` - Notification sent

### Error Events
- `error_occurred` - General error
- `api_error` - API-specific error
- `payment_error` - Payment-related error

## Installation

### Prerequisites
- Node.js 18+
- Redis server
- Supabase database
- Access to GOMFLOW shared module

### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3007
HOST=0.0.0.0

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Core API Configuration
CORE_API_URL=http://localhost:3000
CORE_API_SECRET=your_core_api_secret

# Analytics Configuration
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_AGGREGATION_INTERVAL=*/5 * * * *
ANALYTICS_CLEANUP_INTERVAL=0 0 * * *

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# External Services
NOTIFICATION_SERVICE_URL=http://localhost:3005
NOTIFICATION_SERVICE_SECRET=your_notification_secret
```

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run database migrations:
   ```bash
   # Apply the analytics schema to your Supabase database
   psql -h your_db_host -U your_db_user -d your_db_name -f migrations/analytics_schema.sql
   ```

4. Start the service:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## Development

### Project Structure
```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── app.ts           # Express application setup
└── server.ts        # Server initialization
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Database Schema

The analytics service uses the following main tables:

- `analytics_events` - Raw event data
- `analytics_aggregations` - Pre-calculated metrics
- `analytics_reports` - Generated reports
- `analytics_alerts` - Alert configurations
- `analytics_export_jobs` - Export job tracking
- `analytics_dashboards` - Dashboard configurations
- `analytics_user_sessions` - User session tracking
- `analytics_funnels` - Funnel configurations
- `analytics_cohorts` - Cohort analysis results
- `analytics_segments` - User segment definitions
- `analytics_ab_tests` - A/B test configurations

## Performance Considerations

### Data Aggregation
- Events are aggregated into time buckets (minute, hour, day, week, month)
- Pre-calculated metrics reduce query time for dashboards
- Configurable data retention policies manage storage costs

### Caching Strategy
- Real-time metrics cached in Redis for 1 minute
- Aggregated data cached for 5 minutes
- Report results cached for 15 minutes

### Query Optimization
- Proper indexing on frequently queried columns
- Partitioning of large tables by date
- Use of materialized views for complex queries

## Monitoring

### Health Checks
- `/health` endpoint for service health
- Service initialization status
- Database connectivity
- Redis connectivity

### Logging
- Structured logging with request IDs
- Separate log files for errors and general logs
- Analytics-specific log methods

### Metrics
- Processing time for events
- Queue lengths and processing rates
- Database query performance
- Error rates and types

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3007
CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  analytics:
    build: .
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=production
      - PORT=3007
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting

## License

This project is part of the GOMFLOW platform. All rights reserved.