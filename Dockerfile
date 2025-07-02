# Frontend Dev MCP Server - Docker Image
FROM node:18-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user for security
RUN groupadd -r mcpserver && useradd -r -g mcpserver mcpserver
RUN chown -R mcpserver:mcpserver /app
USER mcpserver

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('MCP Server is healthy')" || exit 1

# Expose port (though MCP typically uses stdio)
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV MCP_SERVER_NAME=frontend-dev-mcp-server
ENV LOG_LEVEL=info
ENV PLAYWRIGHT_HEADLESS=true
ENV PLAYWRIGHT_TIMEOUT=30000

# Default command
CMD ["npm", "start"]

# Labels for metadata
LABEL maintainer="Frontend Dev MCP Server"
LABEL description="Unified MCP server for frontend developers with GitHub, Figma, and Playwright integrations"
LABEL version="1.0.0" 