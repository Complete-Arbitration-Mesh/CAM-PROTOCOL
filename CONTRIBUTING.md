# Contributing to CAM Protocol

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE-CORE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Code of Conduct](https://img.shields.io/badge/Code%20of%20Conduct-v1.0-ff69b4.svg)](CODE_OF_CONDUCT.md)

Thank you for your interest in contributing to the Cognitive Arbitration Mesh (CAM) Protocol! This document provides guidelines for contributing to the project.

## Repository Structure

The repository is organized by feature tiers:

- **Core**: Foundation components (Apache 2.0 license)
- **Professional**: Enhanced capabilities (Commons Clause license)
- **Enterprise**: Advanced features (Commons Clause license)

## Open Source Components

The following components are open source under Apache 2.0 and welcome community contributions:

- **Core Routing Engine**: Basic arbitration logic (`core/src/routing/`)
- **Provider Integrations**: Base connectors for AI providers (`core/src/providers/`)
- **Basic Caching**: Simple caching mechanisms (`core/src/caching/`)
- **Observability Tools**: Metrics and logging (`core/src/observability/`)
- **Authentication**: Basic authentication systems (`core/src/authentication/`)
- **Configuration**: Configuration management (`core/src/config/`)
- **Community Documentation**: Guides, examples, and API references
- **Public APIs**: Core API specifications

## Proprietary Components

The following components are proprietary under Commons Clause license and have limited contribution options:

### Professional Tier

- **Advanced Routing**: Advanced routing capabilities
- **Semantic Caching**: Smart caching using embeddings
- **Policy Builder**: Visual policy creation tools
- **Request Transformation**: Advanced request manipulation
- **Monitoring**: Enhanced monitoring capabilities
- **Hybrid Deployment**: Tools for hybrid cloud deployments

### Enterprise Tier

- **Cognitive Fingerprinting**: Advanced content analysis
- **Arbitration**: Enterprise-grade arbitration systems
- **Policy Evolution**: Self-improving policy systems
- **Governance**: Enterprise governance tools
- **Security**: Advanced security features
- **Integration**: Enterprise integration components
- **eBPF Acceleration**: Performance optimizations
- **FIPS Compliance**: Modules for regulatory compliance
- **Billing and Licensing**: Enterprise licensing systems

## How to Contribute

### Getting Started

1. **Fork the repository**: Create your own fork of the CAM Protocol
2. **Clone your fork**: `git clone https://github.com/your-username/cam-protocol.git`
3. **Add upstream remote**: `git remote add upstream https://github.com/organization/cam-protocol.git`
4. **Create a branch**: `git checkout -b feature/your-feature-name`

### Development Process

1. **Ensure you're up-to-date**: 
   ```
   git fetch upstream
   git rebase upstream/main
   ```

2. **Install dependencies**:
   ```
   npm install  # For JavaScript/TypeScript
   pip install -r requirements.txt  # For Python
   ```

3. **Follow coding standards**:
   - JavaScript/TypeScript: ESLint and Prettier
   - Python: PEP 8 with Black formatter
   - Add appropriate tests for your changes

4. **Run tests**:
   ```
   npm test  # For JavaScript/TypeScript
   python -m pytest  # For Python
   ```

5. **Commit changes**: 
   ```
   git add .
   git commit -m "feat: add new feature"
   ```
   
   We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Pull Request Process

1. **Push your branch**: `git push origin feature/your-feature-name`
2. **Create a pull request**: Use the GitHub interface to create a PR against the `main` branch
3. **Fill in the PR template**: Provide a clear description of your changes
4. **Wait for reviews**: Maintainers will review your PR and provide feedback
5. **Address feedback**: Make necessary changes and push updates
6. **PR approval**: Once approved, maintainers will merge your PR

### Code Review Criteria

All contributions are reviewed against these criteria:

- **Functionality**: Does it work as expected?
- **Architecture**: Does it fit the overall design?
- **Performance**: Does it maintain or improve performance?
- **Tests**: Is it properly tested?
- **Documentation**: Is it well-documented?
- **Code style**: Does it follow our coding standards?

## Licensing

- By contributing to Core components, you agree to license your code under Apache 2.0
- Contributions to Professional or Enterprise tiers require a Contributor License Agreement

## Communication

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and general topics
- **Security**: For security concerns, please email security@cam-protocol.org

## Code of Conduct

We expect all contributors to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and considerate in all interactions.

## Development Process

1. Fork the repository
2. Create a feature branch
3. Make changes to open source components only
4. Submit a pull request

See [GOVERNANCE.md](./GOVERNANCE.md) for more details.