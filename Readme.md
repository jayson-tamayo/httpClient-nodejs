# Reusable HTTP Client using Native Fetch

A lightweight, reusable HTTP client for Node.js built on top of the native Fetch API.

This library standardizes HTTP communications across applications by providing:

- Native Fetch API support
- Automatic JSON serialization/deserialization
- Request timeout management
- Retry mechanism with exponential backoff
- Query string builder
- Centralized error handling
- Request/response hooks for logging
- URL validation

---

## Why This Library?

Many applications implement API calls differently, leading to:

- Duplicate HTTP logic
- Inconsistent error handling
- Missing timeout controls
- No retry strategy
- Increased technical debt
- Reliance on third-party libraries

This client provides a single, reusable standard for HTTP communication.

---

## Features

### ✅ Native Fetch API

No external HTTP libraries required.

### ✅ Automatic Retry

Retries transient failures automatically.

Retryable status codes:

- 408 Request Timeout
- 429 Too Many Requests
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout

### ✅ Exponential Backoff

Example retry pattern:

```text
Attempt 1 → 1 second
Attempt 2 → 2 seconds
Attempt 3 → 4 seconds
Attempt 4 → 8 seconds
```

### ✅ Timeout Management

Automatically aborts long-running requests.

```javascript
timeout: 30000
```

### ✅ Query Parameter Support

```javascript
client.get(url, {
  qs: {
    page: 1,
    limit: 10
  }
});
```

### ✅ Automatic JSON Support

Request bodies are automatically serialized and JSON responses are automatically parsed.

### ✅ Request & Response Hooks

```javascript
new HttpClient({
  onRequest: request => console.log(request),
  onResponse: response => console.log(response)
});
```

---

# Requirements

- Node.js 18+
- Native Fetch API enabled

---

# Installation

```text
src/
└── utils/
    └── httpClient.js
```

```javascript
const client = require('./httpClient');
```

---

# Quick Start

## GET

```javascript
const users = await client.get(
  'https://api.example.com/users',
  {
    qs: {
      active: true
    }
  }
);
```

## POST

```javascript
await client.post(
  'https://api.example.com/users',
  {
    firstName: 'John',
    lastName: 'Doe'
  }
);
```

## PUT

```javascript
await client.put(
  'https://api.example.com/users/123',
  {
    firstName: 'Jane'
  }
);
```

## PATCH

```javascript
await client.patch(
  'https://api.example.com/users/123',
  {
    status: 'ACTIVE'
  }
);
```

## DELETE

```javascript
await client.delete(
  'https://api.example.com/users/123'
);
```

---

# Error Handling

```javascript
try {
  const data = await client.get(url);
} catch (error) {
  console.error(error.message);
  console.error(error.statusCode);
}
```

---

# Authentication Example

```javascript
await client.get(url, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

---

# Best Practices

- Reuse HttpClient instances
- Configure sensible timeout values
- Enable request/response logging
- Handle errors using try/catch
- Use retries only for transient failures

---

# Summary

The **Reusable HTTP Client using Native Fetch** provides a standardized, dependency-light approach for handling HTTP communication in Node.js applications. It centralizes retries, timeouts, validation, logging, and error handling while leveraging Node.js native Fetch for maintainability and security.
