# Backend Guidelines

## Project Structure

The backend follows a layered architecture with clear separation of concerns:

```
src/
├── config/             # Application configuration
├── controllers/        # Request handlers
├── middlewares/        # Express middleware functions
├── routes/             # API route definitions
├── services/           # Business logic
├── types/              # TypeScript type definitions
└── index.ts            # Application entry point
```

## Architecture Overview

This backend is built using Node.js with Express and TypeScript, following a service-oriented architecture:

1. **Routes Layer** (`routes/`): Defines API endpoints and maps them to controllers.
2. **Controller Layer** (`controllers/`): Handles HTTP requests/responses, validates inputs, and calls appropriate services.
3. **Service Layer** (`services/`): Contains business logic, data processing, and external API interactions.
4. **Data Layer**: Interfaces with databases and external APIs (e.g., Facebook Graph API).

## Code Organization

### Routes

- Routes are organized by resource (e.g., `adRoutes.ts`, `authRoutes.ts`).
- All routes are centralized through `routes/index.ts`.
- Each route file should export a router instance.

### Controllers

- Controllers handle HTTP concerns (request parsing, validation, response formatting).
- Each controller corresponds to a specific resource.
- Controllers should be thin and delegate business logic to services.

### Services

- Services encapsulate business logic and data manipulation.
- Services handle external API calls, caching, and data processing.
- Our services implement caching strategies to optimize performance.

### Middlewares

- Middlewares handle cross-cutting concerns like authentication, logging, etc.
- Custom middlewares are defined in the `middlewares/` directory.

### Types

- TypeScript interfaces and types are defined in the `types/` directory.
- Type definitions are organized by domain (e.g., `graphApiTypes.ts`, `authTypes.ts`).

## Coding Standards

### Naming Conventions

- **Files**: Use camelCase for filenames (e.g., `adService.ts`).
- **Classes**: Use PascalCase (e.g., `CacheService`).
- **Functions/Methods**: Use camelCase (e.g., `getAdsByAccount`).
- **Interfaces/Types**: Use PascalCase prefixed with `I` for interfaces (e.g., `IUser`).
- **Constants**: Use UPPER_SNAKE_CASE for constants.

### Error Handling

- Always use try/catch blocks for async operations.
- Log errors with appropriate context.
- Return consistent error responses from API endpoints.
- Use custom error classes for specific error scenarios.

### Async/Await Pattern

- Use async/await pattern instead of promise chains.
- Properly handle promise rejections with try/catch.

## API Design Guidelines

### Request Structure

- Use resource-based routes (e.g., `/api/ads`, `/api/campaigns`).
- Implement RESTful principles for CRUD operations.
- Use query parameters for filtering, sorting, and pagination.

### Response Format

- Maintain consistent response structures:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Optional message"
  }
  ```
- For errors:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable message"
    }
  }
  ```

## Performance Considerations

### Caching

- Implement caching for frequently accessed or expensive operations.
- Use the `CacheService` for in-memory caching.
- Set appropriate TTL (Time-To-Live) values based on data volatility.

### Rate Limiting

- All API endpoints have rate limiting configured.
- Rate limits are defined in the application entry point.

## Security Practices

### Authentication & Authorization

- JWT-based authentication is handled by the `authMiddleware`.
- User authentication is managed by the `authService`.
- Protected routes should use the auth middleware.

### Environment Variables

- Store sensitive configuration in environment variables.
- Never commit `.env` files; use `.env.example` as a template.
- Access environment variables through the config module.

## External Service Integration

### Facebook Graph API

- All Graph API interactions are abstracted through `graphApiService.ts`.
- Use typed responses and requests with interfaces from `graphApiTypes.ts`.
- Implement proper error handling for API failures.

## Testing Strategy

- Write unit tests for service functions.
- Write integration tests for API endpoints.
- Use a testing framework like Jest.
- Implement test fixtures and mocks for external dependencies.

## Documentation

- Document all public functions, classes, and interfaces.
- Follow JSDoc standards for inline documentation.
- Keep this document updated with architectural changes.

## Contribution Workflow

1. Create a feature branch from `main`
2. Implement changes following these guidelines
3. Write or update tests
4. Submit a pull request
5. Address code review feedback

## Deployment

- The application is deployed using [deployment platform].
- Environment-specific configurations are managed through environment variables. 