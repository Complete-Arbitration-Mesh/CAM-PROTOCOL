# Governance Model

This document outlines the governance model for the Cognitive Arbitration Mesh (CAM) Protocol.

## Project Structure

The CAM Protocol is organized into three tiers:

1. **Core** (Apache 2.0 license)
2. **Professional** (Commons Clause license)
3. **Enterprise** (Commons Clause license)

## Decision Making Process

### Technical Steering Committee (TSC)

The Technical Steering Committee is responsible for:

- Approving architectural changes
- Managing project roadmap
- Reviewing and merging pull requests
- Making decisions about project direction
- Resolving technical disagreements

The TSC consists of core maintainers and is led by the Technical Lead.

### Community Contributors

- Can submit pull requests to Core components
- Can report issues across all components
- Can participate in discussions and provide feedback
- Can propose new features via GitHub Issues

### Voting Process

For significant changes:

1. A proposal is submitted as a GitHub Issue
2. The TSC reviews the proposal
3. A consensus is sought among TSC members
4. If consensus cannot be reached, a formal vote is held
   - Requires 2/3 majority of TSC members
   - Voting period: 7 days

## Releases and Versioning

The CAM Protocol follows [Semantic Versioning](https://semver.org/):

- **Major versions (X.y.z)**: Incompatible API changes
- **Minor versions (x.Y.z)**: New functionality in a backward-compatible manner
- **Patch versions (x.y.Z)**: Backward-compatible bug fixes

Release process:
1. Release candidates are created for testing
2. Final releases are tagged and published after validation
3. Release notes document all changes

## Project Roles

### Technical Lead

- Final decision authority on technical matters
- Manages the technical roadmap
- Coordinates TSC activities

### Core Maintainers

- Have merge rights to the repository
- Review and approve pull requests
- Help maintain project quality and standards

### Contributors

- Submit pull requests
- Report issues
- Contribute to documentation
- Participate in discussions

### Users

- Use the CAM Protocol
- Provide feedback
- Report bugs
- Request features

## Becoming a Maintainer

To become a Core Maintainer:

1. Demonstrate consistent, high-quality contributions over time
2. Show deep understanding of the project architecture
3. Be nominated by an existing maintainer
4. Receive approval from the TSC

## Communication Channels

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general questions and community discussion
- **Official Slack**: For real-time communication
- **Monthly Community Calls**: For broader discussions and updates

## Changes to Governance

This governance model may evolve over time. Changes to this document require:

1. A proposal submitted as a GitHub Issue
2. Discussion period of at least 14 days
3. Approval by 2/3 of the TSC
