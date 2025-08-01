# GitHub Clone - Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S github-clone -u 1001

# Copy backend files
COPY backend/ ./backend/

# Copy frontend static files
COPY frontend/ ./frontend/

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./backend/node_modules

# Change ownership to non-root user
RUN chown -R github-clone:nodejs /app

# Switch to non-root user
USER github-clone

# Expose port
EXPOSE 3000

# Set working directory to backend
WORKDIR /app/backend

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/auth/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]