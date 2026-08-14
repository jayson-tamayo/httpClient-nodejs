/**
 * Reusable HTTP Client using native fetch
 * Replaces npm request-promise with native fetch API
 *
 * @class HttpClient
 * @example
 * const client = new HttpClient({ timeout: 30000, maxRetries: 3 });
 * const data = await client.get('https://api.example.com/users', { qs: { id: 123 } });
 */
class HttpClient {
  /**
   * Initialize HTTP client with configuration
   * @param {Object} config - Configuration options
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {number} [config.maxRetries=0] - Maximum number of retry attempts
   * @param {number} [config.retryDelay=1000] - Initial retry delay in milliseconds
   * @param {Function} [config.onRequest] - Hook for request logging
   * @param {Function} [config.onResponse] - Hook for response logging
   */
  constructor(config = {}) {
    const {
      timeout = 30000,
      maxRetries = 0,
      retryDelay = 1000,
      onRequest = null,
      onResponse = null,
    } = config;

    // Configuration constants
    this.DEFAULT_TIMEOUT = 30000;
    this.MAX_RETRIES = 0;
    this.RETRY_DELAY = 1000;
    this.MAX_BACKOFF_DELAY = 30000;
    this.EXPONENTIAL_BACKOFF_BASE = 2;
    this.RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

    // Instance configuration
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.onRequest = onRequest;
    this.onResponse = onResponse;
  }

  /**
   * Validate URL format
   * @private
   * @param {string} url - URL to validate
   * @throws {Error} If URL is invalid
   */
  validateUrl(url) {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw new Error('Invalid URL: must be a non-empty string');
    }
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Build query string from object
   * @private
   * @param {Object} params - Query parameters
   * @returns {string} - URL encoded query string
   */
  buildQueryString(params) {
    if (!params || typeof params !== 'object' || Object.keys(params).length === 0) {
      return '';
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      // Skip null/undefined, but allow falsy values like 0, false, ''
      if (value !== null && value !== undefined) {
        searchParams.append(String(key), String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Build full URL with query parameters
   * @private
   * @param {string} baseUrl - Base URL
   * @param {Object} [params] - Query parameters
   * @returns {string} - Full URL with query string
   * @throws {Error} If URL is invalid
   */
  buildUrl(baseUrl, params) {
    this.validateUrl(baseUrl);
    const queryString = this.buildQueryString(params);
    return `${baseUrl}${queryString}`;
  }

  /**
   * Calculate backoff delay with exponential increase and cap
   * @private
   * @param {number} attempt - Current retry attempt (0-indexed)
   * @returns {number} - Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    const exponentialDelay = this.retryDelay * Math.pow(this.EXPONENTIAL_BACKOFF_BASE, attempt);
    // Cap the backoff delay to prevent excessive waits
    return Math.min(exponentialDelay, this.MAX_BACKOFF_DELAY);
  }

  /**
   * Determine if an error should be retried
   * @private
   * @param {Error} error - The error to evaluate
   * @param {number} statusCode - HTTP status code (if applicable)
   * @returns {boolean} - Whether the request should be retried
   */
  shouldRetry(error, statusCode = null) {
    // Network errors and timeouts should be retried
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return true;
    }
    // Retry only specific HTTP status codes
    return statusCode !== null && this.RETRYABLE_STATUS_CODES.has(statusCode);
  }

  /**
   * Parse response based on content type
   * @private
   * @param {Response} response - Fetch response object
   * @param {boolean} [json=true] - Whether to parse as JSON
   * @returns {Promise<Object|string>} - Parsed response
   * @throws {Error} If response parsing fails
   */
  async parseResponse(response, json = true) {
    const contentType = response.headers.get('content-type') || '';
    const isJsonContent = contentType.includes('application/json');

    if (json && isJsonContent) {
      try {
        return await response.json();
      } catch (error) {
        // Log parsing error for debugging
        console.warn(`Failed to parse JSON response from ${response.url}:`, error.message);
        // Fall back to text only if explicitly requested JSON parsing
        throw new Error(`Invalid JSON response: ${error.message}`);
      }
    }

    return await response.text();
  }

  /**
   * Sleep utility for retry delays
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with timeout, retry, and error handling
   * @param {string} url - Request URL
   * @param {Object} [options] - Request options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.headers] - Custom headers
   * @param {Object|null} [options.body] - Request body (will be JSON stringified)
   * @param {Object} [options.qs] - Query string parameters
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {boolean} [options.json=true] - Parse response as JSON
   * @param {number} [options.retry] - Number of retries for this request
   * @param {number} [options.retryDelay] - Retry delay for this request
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails after all retries
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      qs = null,
      timeout = this.timeout,
      json = true,
      retry = this.maxRetries,
      retryDelay = this.retryDelay,
    } = options;

    // Validate inputs
    this.validateUrl(url);
    if (body !== null && typeof body !== 'object') {
      throw new TypeError('Request body must be an object or null');
    }

    const fullUrl = this.buildUrl(url, qs);
    let lastError;

    // Retry loop
    for (let attempt = 0; attempt <= retry; attempt++) {
      // Create a fresh AbortController for each attempt
      const controller = new AbortController();
      let timeoutId;

      try {
        // Set up timeout
        timeoutId = setTimeout(() => controller.abort(), timeout);

        // Prepare request
        const requestInit = {
          method,
          headers: this.mergeHeaders(headers, body !== null),
          signal: controller.signal,
        };

        if (body !== null) {
          try {
            requestInit.body = JSON.stringify(body);
          } catch (error) {
            throw new TypeError(`Request body is not JSON serializable: ${error.message}`);
          }
        }

        // Call request hook for logging
        if (this.onRequest) {
          this.onRequest({ url: fullUrl, method, headers: requestInit.headers });
        }

        // Execute request
        const response = await fetch(fullUrl, requestInit);

        // Clear timeout on successful response
        clearTimeout(timeoutId);

        // Call response hook for logging
        if (this.onResponse) {
          this.onResponse({
            url: fullUrl,
            status: response.status,
            statusText: response.statusText,
          });
        }

        // Handle non-2xx responses
        if (!response.ok) {
          const errorBody = await this.parseResponse(response, json);
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.statusCode = response.status;
          error.body = errorBody;
          error.url = fullUrl;
          error.method = method;

          // Check if this error should be retried
          if (this.shouldRetry(error, response.status) && attempt < retry) {
            lastError = error;
            const delay = this.calculateBackoffDelay(attempt);
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        // Parse and return successful response
        return await this.parseResponse(response, json);
      } catch (error) {
        lastError = error;

        // Always clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle timeout errors
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`Request timeout after ${timeout}ms`);
          timeoutError.url = fullUrl;
          timeoutError.method = method;
          timeoutError.originalError = error;

          if (attempt < retry && this.shouldRetry(timeoutError)) {
            const delay = this.calculateBackoffDelay(attempt);
            await this.sleep(delay);
            continue;
          }

          throw timeoutError;
        }

        // Retry on network errors
        if (attempt < retry && this.shouldRetry(error)) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Merge headers intelligently
   * @private
   * @param {Object} customHeaders - User-provided headers
   * @param {boolean} hasBody - Whether request has a body
   * @returns {Object} - Merged headers
   */
  mergeHeaders(customHeaders = {}, hasBody = false) {
    const headers = { ...customHeaders };

    // Only set Content-Type if body exists and not already set
    if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * GET request
   * @param {string} url - Request URL
   * @param {Object} [options] - Request options
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails
   */
  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   * @param {string} url - Request URL
   * @param {Object|null} [body] - Request body
   * @param {Object} [options] - Request options
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails
   */
  post(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   * @param {string} url - Request URL
   * @param {Object|null} [body] - Request body
   * @param {Object} [options] - Request options
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails
   */
  put(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   * @param {string} url - Request URL
   * @param {Object|null} [body] - Request body
   * @param {Object} [options] - Request options
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails
   */
  patch(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   * @param {string} url - Request URL
   * @param {Object} [options] - Request options
   * @returns {Promise<Object|string>} - Response data
   * @throws {Error} If request fails
   */
  delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance with production configuration
module.exports = new HttpClient({
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
});

module.exports.HttpClient = HttpClient;
