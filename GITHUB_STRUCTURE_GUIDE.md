# GitHub Repository Structure Guide for CAM Protocol

This guide provides instructions for organizing the CAM Protocol codebase according to the standardized GitHub repository structure.

## Repository Overview

The CAM Protocol repository is organized by feature tiers with a clear separation of concerns:

```
cam-protocol/
├── core/                        # Core components (Apache 2.0 license)
├── professional/                # Professional tier (Commons Clause license)
├── enterprise/                  # Enterprise tier (Commons Clause license)
├── shared/                      # Shared utilities and components
├── patents/                     # Patent documentation (private)
├── sdk/                         # Client SDKs for multiple languages
├── examples/                    # Example implementations and use cases
├── documentation/               # Comprehensive documentation
├── community/                   # Community resources and extensions
├── deployment/                  # Deployment configurations
└── .github/                     # GitHub-specific files
```

## Adding Files to the Repository

Follow these guidelines when adding files to the repository:

### 1. Core Components (Apache 2.0)

All Core tier components should be placed in the `core/` directory:

- **Routing Engine**: Place in `core/src/routing/`
- **Provider Integrations**: Place in `core/src/providers/`
- **Basic Caching**: Place in `core/src/caching/`
- **Observability**: Place in `core/src/observability/`
- **Authentication**: Place in `core/src/authentication/`
- **Configuration**: Place in `core/src/config/`

Example:
```bash
# Adding a new provider integration
mkdir -p core/src/providers/new-provider
touch core/src/providers/new-provider/index.ts
```

### 2. Professional Tier (Commons Clause)

Professional tier features should be placed in the `professional/` directory:

- **Advanced Routing**: Place in `professional/src/advanced-routing/`
- **Semantic Caching**: Place in `professional/src/semantic-caching/`
- **Policy Builder**: Place in `professional/src/policy-builder/`
- **Request Transformation**: Place in `professional/src/request-transformation/`
- **Monitoring**: Place in `professional/src/monitoring/`
- **Hybrid Deployment**: Place in `professional/src/hybrid/`

Example:
```bash
# Adding new semantic caching features
mkdir -p professional/src/semantic-caching/strategies
touch professional/src/semantic-caching/strategies/vector-similarity.ts
```

### 3. Enterprise Tier (Commons Clause)

Enterprise tier features should be placed in the `enterprise/` directory:

- **Governance**: Place in `enterprise/src/governance/`
- **Arbitration**: Place in `enterprise/src/arbitration/`
- **Cognitive Fingerprinting**: Place in `enterprise/src/cognitive-fingerprinting/`
- **Policy Evolution**: Place in `enterprise/src/policy-evolution/`
- **Security**: Place in `enterprise/src/security/`
- **Integration**: Place in `enterprise/src/integration/`

Example:
```bash
# Adding new policy evolution capabilities
mkdir -p enterprise/src/policy-evolution/mutation-strategies
touch enterprise/src/policy-evolution/mutation-strategies/adaptive-mutation.ts
```

### 4. Patent Documentation (Private)

Patent-related documentation should be placed in the `patents/` directory, organized by innovation:

- **Cognitive Fingerprinting**: Place in `patents/cognitive-fingerprinting/`
- **Predictive Arbitration**: Place in `patents/predictive-arbitration/`
- **Context Compression**: Place in `patents/context-compression/`
- **Semantic Cache Coherence**: Place in `patents/semantic-cache-coherence/`
- **Policy Evolution**: Place in `patents/policy-evolution/`

Example:
```bash
# Adding new patent documentation
touch patents/cognitive-fingerprinting/implementation-details.md
```

### 5. Documentation

Documentation files should be placed in the `documentation/` directory, organized by category:

- **Protocol Spec**: Place in `documentation/protocol/`
- **Architecture**: Place in `documentation/architecture/`
- **Guides**: Place in `documentation/guides/`
- **API Reference**: Place in `documentation/api-reference/`
- **Features**: Place in `documentation/features/`
- **Research**: Place in `documentation/research/`

Example:
```bash
# Adding a new guide
mkdir -p documentation/guides/advanced-topics
touch documentation/guides/advanced-topics/multi-provider-routing.md
```

### 6. SDK Implementation

SDK files should be placed in the `sdk/` directory, organized by language:

- **JavaScript**: Place in `sdk/javascript/`
- **Python**: Place in `sdk/python/`
- **Go**: Place in `sdk/go/`
- **Java**: Place in `sdk/java/`
- **Ruby**: Place in `sdk/ruby/`
- **C#**: Place in `sdk/csharp/`

Example:
```bash
# Adding JavaScript SDK features
mkdir -p sdk/javascript/src/features
touch sdk/javascript/src/features/policy-builder.ts
```

### 7. Deployment Configurations

Deployment files should be placed in the `deployment/` directory:

- **Kubernetes**: Place in `deployment/kubernetes/`
- **Docker**: Place in `deployment/docker/`
- **Terraform**: Place in `deployment/terraform/`
- **Serverless**: Place in `deployment/serverless/`

Example:
```bash
# Adding Kubernetes configurations for Enterprise tier
mkdir -p deployment/kubernetes/enterprise/templates
touch deployment/kubernetes/enterprise/templates/deployment.yaml
```

## Branch Strategy

Follow this branching strategy when contributing to the repository:

### Main Branches

- **main**: Stable release branch
- **develop**: Integration branch for upcoming releases
- **nightly**: Nightly builds for testing

### Feature Branches

Create feature branches with the following naming convention:
```
feature/tier-[community|professional|enterprise]/feature-name
```

Example:
```bash
# Creating a new feature branch for the professional tier
git checkout develop
git checkout -b feature/tier-professional/semantic-caching-improvements
```

### Release Branches

Create release branches with the following naming convention:
```
release/v1.0.0
```

Example:
```bash
# Creating a release branch
git checkout develop
git checkout -b release/v1.0.0
```

### Hotfix Branches

Create hotfix branches with the following naming convention:
```
hotfix/v1.0.1
```

Example:
```bash
# Creating a hotfix branch
git checkout main
git checkout -b hotfix/v1.0.1
```

## Access Control and Visibility

The repository implements access control to manage what different users can see and modify:

### Public Access (Read-only)

The following directories will be publicly visible:
- `core/`
- `documentation/`
- `examples/`
- `community/`
- `sdk/`

### Licensed Customer Access (Read-only)

- Professional & Enterprise customers: `professional/`
- Enterprise customers only: `enterprise/`

### Private Components

The following directories will not be publicly visible:
- `patents/`
- Internal development notes and unreleased features

## Additional Guidelines

### Code Quality

- Add appropriate unit tests for all new code
- Ensure all code passes linting checks before committing
- Include clear documentation for all public APIs

### Documentation

- Update relevant documentation when making changes to code
- Keep README files up to date in each directory
- Follow the documentation style guidelines

### Commit Messages

Format commit messages as follows:
```
[tier/component] Short summary of changes

More detailed explanation if needed
```

Example:
```
[professional/semantic-caching] Improve similarity detection algorithm

- Updated vector comparison method to use cosine similarity
- Added configurable threshold for similarity matching
- Improved performance by 25% through optimized index lookups
```

## Conclusion

Following this structured approach ensures that the CAM Protocol repository remains organized, maintainable, and aligned with its licensing and access control requirements. For any questions about repository structure or organization, contact the repository maintainers.