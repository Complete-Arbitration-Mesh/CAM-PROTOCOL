# CAM Architecture Overview

## 1. Overview

The Cognitive Arbitration Mesh (CAM) is a platform that provides intelligent, policy-governed routing and failover between AI models. It serves as an infrastructure layer between applications and AI providers, enabling reliability, cost control, performance optimization, and compliance enforcement.

CAM follows a federated governance model and consists of core components (Apache 2.0 licensed) and enterprise components (Commons Clause licensed). The system is built using modern web technologies and follows a client-server architecture.

## 2. System Architecture

CAM follows a multi-tier architecture:

1. **Frontend**: React-based UI with Radix UI components and Tailwind CSS for styling
2. **Backend**: Node.js/Express.js server handling API requests and business logic
3. **Database**: PostgreSQL database accessed via Drizzle ORM
4. **Policy Enforcement**: Open Policy Agent (OPA) integration for policy decisions
5. **Performance Acceleration**: Optional eBPF acceleration for Enterprise Edition

The architecture is designed to be modular, with clear separation between the UI, business logic, and data access layers. The system can be deployed in various configurations, from single-instance development setups to multi-tenant enterprise deployments with namespace isolation.

## 3. Key Components

### 3.1. Frontend (Client)

- **Framework**: React with TypeScript
- **UI Components**: Radix UI primitives with a custom design system
- **Styling**: Tailwind CSS with a custom configuration
- **State Management**: React Query for server state, React hooks for local state
- **Build Tool**: Vite for fast HMR and build optimization
- **Developer Tools**:
  - Interactive Workflow Visualization Tool for workflow diagrams and simulation
  - Cost Calculator Widget for usage and pricing estimates
  - Code Snippet Generator for integration assistance
  - Debugging Dashboard with tier-based diagnostic capabilities

The frontend provides dashboards for monitoring system usage, configuration for model arbitration policies, administrative tools, and developer-friendly features for easier integration and troubleshooting.

### 3.2. Backend (Server)

- **Framework**: Express.js running on Node.js
- **API Style**: RESTful endpoints with JSON payloads
- **Authentication**: JWT-based authentication with Ed25519 signatures
- **Rate Limiting**: Express-based rate limiting for API protection

The server implements the core arbitration logic, policy enforcement, user management, and integration with AI providers. It exposes APIs for the frontend to consume.

### 3.3. Database

- **Type**: PostgreSQL (via NeonDB serverless connector)
- **ORM**: Drizzle ORM for type-safe database access
- **Schema**: User accounts, licenses, clusters, audit logs, and telemetry data

### 3.4. Core Components

- **Arbitration Service**: For determining optimal providers
- **Policy Engine**: For enforcing governance rules
- **Provider Connectors**: For integrating with AI services
- **Caching Layer**: For optimizing performance
- **Observability Stack**: For monitoring and diagnostics

## 4. Deployment Models

CAM supports multiple deployment models:

1. **Standalone**: Single-instance deployment for development and testing
2. **Kubernetes**: Clustered deployment for high availability and scalability
3. **Hybrid**: Core components on-premises with provider connectors in the cloud
4. **SaaS**: Fully managed deployment offered as a service

## 5. Security Model

CAM implements a defense-in-depth security model:

- **Authentication**: Multi-factor authentication with JWT tokens
- **Authorization**: Role-based access control with fine-grained permissions
- **Encryption**: TLS for all communications with optional end-to-end encryption
- **Auditing**: Comprehensive audit logging of all operations
- **Compliance**: Features to support GDPR, HIPAA, and other regulations

## 6. Extensibility

CAM is designed to be extensible through:

- **Plugin System**: For adding custom functionality
- **API Gateway**: For integrating with external services
- **Custom Policies**: For implementing organization-specific requirements
- **Provider Adapters**: For connecting to any AI service
