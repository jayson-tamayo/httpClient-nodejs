# HTTP Client - Developer Guide

A lightweight, reusable HTTP client for Node.js built on native Fetch API.

## Quick Start

### Installation

```
const client = require('./httpClient');
```


#### BASIC USAGE
```
// GET
const users = await client.get({
  uri: 'https://api.example.com/users',
  qs: { page: 1, limit: 10 }
});

// POST
const newUser = await client.post({
  uri: 'https://api.example.com/users',
  body: { name: 'John Doe', email: 'john@example.com' }
});

// PUT
const updated = await client.put({
  uri: 'https://api.example.com/users/123',
  body: { name: 'Jane Doe' }
});

// PATCH
const patched = await client.patch({
  uri: 'https://api.example.com/users/123',
  body: { status: 'ACTIVE' }
});

// DELETE
await client.delete({
  uri: 'https://api.example.com/users/123'
});
```


### CONFIGURATION


#### DEFAULT SINGLETON
```
const client = require('./httpClient');
// timeout: 30000ms, maxRetries: 3, retryDelay: 1000ms
```


#### CUSTOM INSTANCE
```
const { HttpClient } = require('./httpClient');

const client = new HttpClient({
  timeout: 60000,
  maxRetries: 5,
  retryDelay: 2000,
  onRequest: (req) => console.log(`→ ${req.method} ${req.uri}`),
  onResponse: (res) => console.log(`← ${res.status}`)
});
```


### API REFERENCE


#### OPTIONS OBJECT
```
{
  uri: string,              // Required: Request URI
  method: string,           // Optional: HTTP method (default: 'GET')
  body: Object,             // Optional: Request body
  headers: Object,          // Optional: Custom headers
  qs: Object,               // Optional: Query string parameters
  timeout: number,          // Optional: Timeout in ms
  retry: number,            // Optional: Max retry attempts
  retryDelay: number,       // Optional: Initial retry delay in ms
  json: boolean             // Optional: Parse response as JSON (default: true)
}
```


#### METHODS

Method Description
get(options) GET request
post(options) POST request
put(options) PUT request
patch(options) PATCH request
delete(options) DELETE request
request(options) Custom HTTP request

### COMMON EXAMPLES


#### WITH QUERY PARAMETERS
```
await client.get({
  uri: 'https://api.example.com/users',
  qs: { active: true, page: 1 }
});
```


#### WITH CUSTOM HEADERS
```
await client.post({
  uri: 'https://api.example.com/users',
  body: { name: 'John' },
  headers: { 'X-Api-Key': 'secret', 'Authorization': 'Bearer token' }
});
```


#### WITH AUTHENTICATION
```
// Bearer Token
await client.get({
  uri: 'https://api.example.com/users',
  headers: { 'Authorization': `Bearer ${token}` }
});

// API Key
await client.get({
  uri: 'https://api.example.com/users',
  headers: { 'X-Api-Key': apiKey }
});
```


#### PER-REQUEST OVERRIDES
```
await client.get({
  uri: 'https://api.example.com/slow-endpoint',
  timeout: 120000,    // Override default timeout
  retry: 5,           // Override default retries
  retryDelay: 3000    // Override default delay
});
```


#### DIRECT REQUEST METHOD
```
const response = await client.request({
  uri: 'https://api.example.com/data',
  method: 'POST',
  body: { key: 'value' },
  headers: { 'X-Custom': 'header' },
  qs: { debug: true },
  timeout: 45000,
  retry: 3,
  json: true
});
```


### ERROR HANDLING


#### BASIC
```
try {
  const data = await client.get({ uri: 'https://api.example.com/users' });
} catch (error) {
  console.error(error.message);
  console.error(error.statusCode);
}
```


#### DETAILED
```
try {
  await client.post({
    uri: 'https://api.example.com/users',
    body: { name: 'John' }
  });
} catch (error) {
  if (error.statusCode === 400) {
    console.error('Validation error:', error.body);
  } else if (error.statusCode >= 500) {
    console.error('Server error:', error.statusCode);
  } else if (error.message.includes('timeout')) {
    console.error('Request timed out');
  }
  
  // Full context available
  console.error({
    uri: error.uri,
    method: error.method,
    statusCode: error.statusCode,
    body: error.body
  });
}
```


### RETRY LOGIC


#### SMART RETRIES

Only retries on:

 * Network errors
 * Timeouts
 * Status codes: 408, 429, 500, 502, 503, 504

Does NOT retry:

 * 4xx Client errors (except 408, 429)
 * Invalid request body


#### EXPONENTIAL BACKOFF

Attempt 1 → 1 second
Attempt 2 → 2 seconds
Attempt 3 → 4 seconds
Attempt 4 → 8 seconds
Attempt 5+ → 30 seconds (capped)



## FEATURES

✅ Native Fetch API (no external dependencies)
✅ Unified options-based API with uri property
✅ Smart retry logic with exponential backoff
✅ Automatic timeout management
✅ Automatic JSON serialization/deserialization
✅ Query parameter builder
✅ Request/response logging hooks
✅ URI validation
✅ Rich error context


## REQUIREMENTS

 * Node.js 18+
 * Native Fetch API enabled


## RETRYABLE STATUS CODES

 * 408 Request Timeout
 * 429 Too Many Requests
 * 500 Internal Server Error
 * 502 Bad Gateway
 * 503 Service Unavailable
 * 504 Gateway Timeout


## TROUBLESHOOTING


#### MISSING URI ERROR
```
// ❌ Wrong
await client.get({ qs: { id: 123 } });

// ✅ Correct
await client.get({ uri: 'https://api.example.com/users', qs: { id: 123 } });
```


#### INVALID URI FORMAT
```
// ❌ Wrong
await client.get({ uri: 'not a url' });

// ✅ Correct
await client.get({ uri: 'https://api.example.com/users' });
```


#### REQUEST TIMEOUT
```
// Increase timeout for slow endpoints
await client.get({
  uri: 'https://api.example.com/slow',
  timeout: 120000  // 2 minutes
});
```


#### JSON PARSE ERROR
```
// Disable JSON parsing for non-JSON responses
await client.get({
  uri: 'https://api.example.com/data.xml',
  json: false
});
```


#### BEST PRACTICES

✅ Reuse HttpClient instances
✅ Configure appropriate timeout values
✅ Enable logging for debugging
✅ Handle errors with try/catch
✅ Use idempotency keys for critical operations
✅ Validate input before sending
✅ Use environment variables for URLs
✅ Override retries when needed

❌ Don't create new HttpClient per request
❌ Don't ignore error details
❌ Don't set extremely long timeouts
❌ Don't retry non-idempotent operations
❌ Don't log sensitive data
❌ Don't hardcode URLs


#### SUPPORT


This developer-focused guide is:

✅ **Concise** - Straight to the point
✅ **Practical** - Real code examples
✅ **Complete** - All essential information included
✅ **Easy to scan** - Clear sections and formatting
✅ **Git-friendly** - Perfect for README.md
✅ **Developer-centric** - Focuses on what matters for coding
✅ **No version history** - Removed as requested

Perfect for developers who need quick reference without fluff! 🚀
