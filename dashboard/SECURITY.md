# Security Documentation

This document outlines the security measures implemented in the Content Workflow Dashboard and provides a checklist for ongoing security maintenance.

## Current Security Measures

### Security Headers

The following security headers are applied to all HTTP responses:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'` | Prevents XSS attacks by controlling which resources can be loaded |
| X-Content-Type-Options | `nosniff` | Prevents MIME type sniffing attacks |
| X-Frame-Options | `DENY` | Prevents clickjacking attacks by disallowing iframe embedding |
| X-XSS-Protection | `1; mode=block` | Legacy XSS filter for older browsers (deprecated; modern browsers use CSP) |
| Referrer-Policy | `strict-origin-when-cross-origin` | Controls how much referrer information is shared |

### Rate Limiting

API endpoints (`/api/*`) are protected by in-memory rate limiting:

- **Window**: 60 seconds
- **Max Requests**: 100 requests per window per IP
- **Response Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when the window resets
- **Rate Limit Exceeded**: Returns HTTP 429 with retry information

### Dependency Security

- Run `npm run audit` to check for known vulnerabilities in dependencies
- Run `npm run audit:fix` to automatically fix vulnerabilities when possible
- For CI/CD, consider: `npm audit --audit-level=high` to fail only on high/critical issues
- Note: Not all vulnerabilities may have fixes available; assess risk vs. compatibility
- Regular dependency updates are recommended

## Security Checklist

### Before Each Release

- [ ] Run `npm run audit` and address any critical/high vulnerabilities
- [ ] Review any new dependencies for security concerns
- [ ] Ensure no sensitive data (API keys, credentials) is committed
- [ ] Test rate limiting is functioning correctly
- [ ] Verify security headers are present in responses

### Periodic Review (Monthly)

- [ ] Update dependencies to latest stable versions
- [ ] Review access logs for suspicious patterns
- [ ] Check for new security advisories affecting used packages
- [ ] Review and update CSP policy if new resources are added

## Current Limitations (Local Development)

The current implementation is designed for **local development use**. The following are acknowledged limitations:

1. **No Authentication**: The dashboard is open to anyone who can access the server
2. **HTTP Only**: No HTTPS/TLS encryption (acceptable for localhost)
3. **In-Memory Rate Limiting**: Rate limit data is lost on server restart
4. **No Input Sanitization**: File paths from API are trusted

## Future Security Enhancements

When preparing for production/shared deployment, consider:

### Authentication & Authorization

- [ ] Add user authentication (OAuth, JWT, session-based)
- [ ] Implement role-based access control
- [ ] Add API key authentication for programmatic access

### Transport Security

- [ ] Enable HTTPS with valid TLS certificates
- [ ] Add HSTS (Strict-Transport-Security) header
- [ ] Configure secure cookies

### Infrastructure

- [ ] Move rate limiting to Redis for distributed/persistent storage
- [ ] Add request logging and monitoring
- [ ] Implement IP allowlisting if needed
- [ ] Set up a Web Application Firewall (WAF)

### Rate Limiting in Production

- [ ] Configure `trust proxy` setting when behind reverse proxy/load balancer
- [ ] Validate X-Forwarded-For header appropriately
- [ ] Consider rate limiting by API key or user ID instead of just IP
- [ ] Use a distributed rate limiter (Redis-based) for multi-instance deployments

### Content Security Policy Hardening

When refactoring frontend code:
- [ ] Remove inline scripts and use external files or nonces
- [ ] Remove inline styles or use CSS files
- [ ] Update CSP to remove 'unsafe-inline' directives
- [ ] Consider using CSP nonces for dynamic content

### Input Validation

- [ ] Add comprehensive input validation on all API endpoints
- [ ] Sanitize file paths and prevent directory traversal
- [ ] Validate and sanitize YAML content before parsing

### Additional Headers

When using HTTPS, add:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Reporting Security Issues

If you discover a security vulnerability, please:

1. Do not open a public issue
2. Contact the maintainers directly
3. Provide detailed information about the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Resources

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
