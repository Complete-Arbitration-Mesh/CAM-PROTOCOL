# CAM Platform: Quick Start Guide

This guide will help you set up and run the CAM Platform in under 10 minutes.

## Prerequisites

- Docker and Docker Compose (for containerized setup)
- Node.js 18+ and npm (for development setup)
- PostgreSQL database (or use the included Docker container)

## Option 1: Docker Setup (Recommended for Quick Start)

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/your-organization/cam-protocol.git
   cd cam-protocol
   ```

2. **Create environment file:**
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Edit the `.env` file** to add your credentials (at minimum, set the SESSION_SECRET)

4. **Start the platform:**
   ```powershell
   docker-compose up -d
   ```

5. **Access the platform:**
   Open your browser and navigate to http://localhost:5000

   Default login credentials:
   - Email: admin@cam.io
   - Password: password123

## Option 2: Development Setup

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/your-organization/cam-protocol.git
   cd cam-protocol
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Create environment file:**
   ```powershell
   Copy-Item .env.example .env
   ```

4. **Set up your database:**
   - Option A: Use Docker for the database
     ```powershell
     docker-compose up -d db
     ```
   - Option B: Use your own PostgreSQL instance and update `.env` accordingly

5. **Run the database migrations:**
   ```powershell
   npm run db:push
   ```

6. **Start the development server:**
   ```powershell
   npm run dev
   ```

7. **Access the platform:**
   Open your browser and navigate to http://localhost:3000

## Using the CAM CLI

The CAM Command Line Interface (CLI) provides tools for managing your CAM deployment:

```powershell
# Install the CLI globally
npm install -g @cam/cli

# Get help
cam --help

# Initialize a new CAM configuration
cam init

# Check status of your CAM deployment
cam status

# Rotate access keys
cam keys rotate
```

## Next Steps

- [Explore the API documentation](/documentation/api-reference)
- [Learn about the architecture](/documentation/architecture)
- [Set up monitoring and observability](/documentation/guides/monitoring)
- [Configure policies for routing](/documentation/guides/policies)

## Getting Help

- [Join our community forum](https://community.cam-protocol.org)
- [File an issue on GitHub](https://github.com/your-organization/cam-protocol/issues)
- [Read the FAQ](/documentation/guides/faq)
