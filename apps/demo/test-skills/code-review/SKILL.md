---
name: code-review
description: Review code for quality, security, and performance issues
---
When asked to review code, follow these steps:

1. **Security**: Check for injection vulnerabilities, exposed secrets, and auth bypasses
2. **Performance**: Look for N+1 queries, unnecessary re-renders, and memory leaks
3. **Maintainability**: Verify naming conventions, single responsibility, and test coverage

Always provide a severity rating: LOW, MEDIUM, HIGH, or CRITICAL.
