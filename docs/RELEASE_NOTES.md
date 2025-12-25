# Release Notes

## Version 2.1.0 (December 25, 2025)

### Major Features

- **Official SDK Integration**: All provider calls now use official SDKs (OpenAI, Anthropic, Google, Azure) instead of raw fetch for improved reliability, retry logic, and error handling.
- **Streaming Response Support**: New async generator-based streaming for real-time responses via `routeStreamingRequest()`.
- **Response Caching System**: Two-tier caching with in-memory LRU cache and Redis distributed cache for cost optimization.
- **Rate Limiting**: Sliding window rate limiting with per-user, per-provider, and tier-based limits.

### Improvements

- **Reliability**: SDKs provide automatic retry logic and better error handling
- **Cost Savings**: Response caching reduces redundant API calls
- **Scalability**: Redis caching enables horizontal scaling
- **Test Coverage**: 124 tests passing with comprehensive coverage

### Security

- Fixed CVE in esbuild CORS handling (GHSA-67mh-4wv8-2f99)
- Upgraded vitest from v2.1.9 to v4.0.16

### Technical Changes

- Added `@google/generative-ai` for Google Gemini support
- Added `ioredis` for Redis caching
- New files: `cache-manager.ts`, `redis-cache.ts`, `rate-limiter.ts`
- New tests: `cache-manager.test.ts`, `rate-limiter.test.ts`

---

## Version 2.0.0 (May 27, 2025)

### Major Features

- **Inter-Agent Collaboration Protocol (IACP)**: Complete implementation of the collaboration system
- **Enhanced Routing Engine**: Improved performance and cost optimization algorithms
- **Comprehensive Compliance Framework**: Full GDPR and CCPA compliance
- **Enterprise Security Features**: Advanced authentication and authorization

### Improvements

- **Performance**: 40% faster response times compared to v1.x
- **Cost Optimization**: Up to 35% reduction in API costs through intelligent routing
- **Reliability**: Improved failover mechanisms with 99.99% uptime guarantee
- **Scalability**: Support for handling 10x more concurrent requests

### Technical Changes

- **API**: New endpoints for agent collaboration
- **SDK**: Simplified developer experience with improved TypeScript support
- **Documentation**: Comprehensive guides and API reference
- **Deployment**: Containerized deployment options with Kubernetes support

### Bug Fixes

- Fixed token counting for certain model providers
- Resolved authentication issues with OAuth 2.0 providers
- Fixed race conditions in concurrent request handling
- Improved error handling and reporting

## Version 1.2.0 (February 15, 2025)

### Features

- Added support for additional model providers
- Implemented basic collaboration capabilities
- Enhanced policy management

### Improvements

- Improved routing performance
- Better error handling
- Updated documentation

## Version 1.1.0 (November 10, 2024)

### Features

- Added policy enforcement system
- Implemented cost optimization features
- Enhanced monitoring and telemetry

### Bug Fixes

- Fixed authentication token expiration handling
- Resolved concurrency issues
- Improved error reporting

## Version 1.0.0 (August 5, 2024)

### Initial Release

- Core routing system
- Provider integration framework
- Basic authentication and authorization
- Monitoring and metrics
- Developer SDK
