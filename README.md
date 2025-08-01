# 🐙 GitHub Clone

A full-stack GitHub clone built with vanilla HTML, CSS, JavaScript, and Node.js featuring GitHub OAuth authentication, repository management, and project showcase generation.

![GitHub Clone Preview](https://via.placeholder.com/800x400/0969da/ffffff?text=GitHub+Clone+Dashboard)

## ✨ Features

### 🔐 Authentication
- **GitHub OAuth Integration** - Secure login with your GitHub account
- **Session Management** - Persistent login sessions with secure token handling
- **Auto-redirect** - Seamless navigation between login and dashboard

### 📊 Dashboard
- **GitHub-style UI** - Pixel-perfect recreation of GitHub's interface
- **User Profile** - Display avatar, bio, followers, and statistics
- **Real-time Stats** - Total stars, forks, and top programming languages
- **Recent Activity** - Latest repository updates and contributions

### 📁 Repository Management
- **Complete Repository List** - All your public and private repositories
- **Advanced Search** - Find repositories by name, description, or language
- **Smart Sorting** - Sort by update date, creation date, stars, or name
- **Repository Details** - Stars, forks, language, and last updated information

### 🎨 Project Generator
- **Showcase Cards** - Generate beautiful project cards from your repositories
- **HTML Export** - Copy-ready HTML snippets for your portfolio
- **Responsive Design** - Cards look great on all devices
- **Customizable** - Easy to modify styling and layout

### 🌟 Extra Features
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Keyboard Shortcuts** - Alt+1/2/3 for quick tab switching
- **Loading States** - Smooth loading indicators throughout the app
- **Error Handling** - Graceful error handling with user feedback
- **Accessibility** - Full keyboard navigation and screen reader support

## 🏗️ Project Structure

```
github-clone/
├── backend/
│   ├── server.js              # Express server with OAuth & API routes
│   ├── package.json           # Backend dependencies
│   └── .env                   # Environment variables (create this)
│
├── frontend/
│   ├── index.html            # Login page
│   ├── dashboard.html        # Main dashboard
│   ├── style.css             # GitHub-style CSS
│   └── script.js             # Frontend JavaScript
│
├── web_infra_lab/
│   ├── compose.yml           # Docker Compose configuration
│   ├── lb/
│   │   └── Dockerfile        # Load balancer Dockerfile
│   └── web/
│       └── Dockerfile        # Web server Dockerfile
│
└── README.md                 # This file
```

## 🐳 Docker & Infrastructure Setup

This project includes a complete Docker infrastructure with load balancing for production deployment.

### 🏗️ Infrastructure Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Server 1  │    │   Web Server 2  │
│   (HAProxy)     │◄──►│   (web-01)      │    │   (web-02)      │
│   Port: 8082    │    │   Port: 8080    │    │   Port: 8081    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🐳 Docker Image Creation

#### 1. Create Dockerfile for the Application

First, create a `Dockerfile` in the root directory:

```dockerfile
# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY backend/ ./
COPY frontend/ ./public/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server.js"]
```

#### 2. Build and Push Docker Image

```bash
# Build the image
docker build -t regnante12/github-clone:v2.0 .

# Push to Docker Hub
docker push regnante12/github-clone:v2.0
```

### 🐳 Docker Compose Infrastructure

#### 1. Load Balancer Setup

Create `web_infra_lab/lb/Dockerfile`:

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        haproxy openssh-server sudo iputils-ping ca-certificates && \
    mkdir /run/sshd && \
    if ! id -u ubuntu >/dev/null 2>&1; then \
        useradd --create-home --uid 1000 --shell /bin/bash ubuntu; \
    fi && \
    echo 'ubuntu:pass123' | chpasswd && \
    usermod -aG sudo ubuntu && \
    sed -ri 's/#?PermitRootLogin.*/PermitRootLogin no/'  /etc/ssh/sshd_config && \
    sed -ri 's/#?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN ssh-keygen -A
CMD ["/usr/sbin/sshd","-D"]
```

#### 2. Docker Compose Configuration

Create `web_infra_lab/compose.yml`:

```yaml
networks:
  lablan:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24

services:
  web-01:
    image: regnante12/github-clone:v2.0
    container_name: web-01
    hostname: web-01
    networks:
      lablan:
        ipv4_address: 172.20.0.11
    ports:
      - "2211:22"
      - "8080:3000"
    env_file:
      - ../backend/.env

  web-02:
    image: regnante12/github-clone:v2.0
    container_name: web-02
    hostname: web-02
    networks:
      lablan:
        ipv4_address: 172.20.0.12
    ports:
      - "2212:22"
      - "8081:3000"
    env_file:
      - ../backend/.env

  lb-01:
    build: ./lb
    container_name: lb-01
    hostname: lb-01
    networks:
      lablan:
        ipv4_address: 172.20.0.10
    ports:
      - "2210:22"
      - "8082:3000"
```

### 🚀 Deploying the Infrastructure

#### 1. Start the Infrastructure

```bash
cd web_infra_lab
docker-compose up -d
```

#### 2. Configure HAProxy Load Balancer

SSH into the load balancer container:

```bash
docker exec -it lb-01 bash
```

Create the HAProxy configuration:

```bash
cat > /etc/haproxy/haproxy.cfg << 'EOF'
global
        log /dev/log    local0
        log /dev/log    local1 notice
        chroot /var/lib/haproxy
        stats timeout 30s
        user haproxy
        group haproxy
        daemon

defaults
        log     global
        mode    http
        option  httplog
        option  dontlognull
        timeout connect 5000
        timeout client  50000
        timeout server  50000

frontend http-in
    bind *:3000
    default_backend servers

backend servers
    balance roundrobin
    server web01 172.20.0.11:3000 check
    server web02 172.20.0.12:3000 check
    http-response set-header X-Served-By %[srv_name]
EOF

# Restart HAProxy
service haproxy restart
```

#### 3. Verify the Setup

```bash
# Check container status
docker ps

# Test individual web servers
curl http://localhost:8080  # web-01
curl http://localhost:8081  # web-02

# Test load balancer
curl http://localhost:8082  # lb-01 (should distribute requests)
```

### 🔧 Load Balancer Configuration Details

#### HAProxy Configuration Breakdown

- **Frontend**: Listens on port 3000 for incoming requests
- **Backend**: Routes requests to web-01 and web-02 using round-robin algorithm
- **Health Checks**: Automatically checks if servers are responding
- **Response Headers**: Adds `X-Served-By` header to identify which server handled the request

#### Network Architecture

- **Subnet**: `172.20.0.0/24`
- **Load Balancer**: `172.20.0.10`
- **Web Server 1**: `172.20.0.11`
- **Web Server 2**: `172.20.0.12`

#### Port Mapping

- **Load Balancer**: `localhost:8082` → `lb-01:3000`
- **Web Server 1**: `localhost:8080` → `web-01:3000`
- **Web Server 2**: `localhost:8081` → `web-02:3000`
- **SSH Access**: `localhost:2210-2212` → `containers:22`

### 🛠️ Troubleshooting Docker Infrastructure

#### Common Issues and Solutions

**1. "503 Service Unavailable" from Load Balancer**
```bash
# Check if web containers are running
docker ps

# Check HAProxy logs
docker exec lb-01 tail -f /var/log/haproxy.log

# Verify HAProxy configuration
docker exec lb-01 haproxy -c -f /etc/haproxy/haproxy.cfg
```

**2. Containers Not Starting**
```bash
# Check Docker Compose logs
docker-compose logs

# Check specific service logs
docker-compose logs web-01
docker-compose logs lb-01
```

**3. Network Connectivity Issues**
```bash
# Test network connectivity between containers
docker exec lb-01 ping 172.20.0.11
docker exec lb-01 ping 172.20.0.12

# Check network configuration
docker network ls
docker network inspect web_infra_lab_lablan
```

**4. HAProxy Configuration Issues**
```bash
# Validate HAProxy config
docker exec lb-01 haproxy -c -f /etc/haproxy/haproxy.cfg

# Restart HAProxy with verbose logging
docker exec lb-01 service haproxy stop
docker exec lb-01 haproxy -f /etc/haproxy/haproxy.cfg -d
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Docker and Docker Compose
- A GitHub account
- A GitHub OAuth App (instructions below)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd github-clone
```

### 2. Set Up GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: `GitHub Clone`
   - **Homepage URL**: `http://localhost:3000`
   - **Application description**: `A GitHub clone for portfolio showcase`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Click "Register application"
5. Copy your **Client ID** and **Client Secret**

### 3. Configure Environment Variables

Based on `backend/.env.esample` and create a `.env` file in the `backend/` directory:

```env
# GitHub OAuth App Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Session Configuration  
SESSION_SECRET=your_super_secret_session_key_make_it_long_and_random

# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:8080
```

### 4. Development Setup

#### Option A: Local Development
```bash
cd backend
npm install
npm run dev
```

#### Option B: Docker Development
```bash
# Build and run with Docker
docker build -t github-clone:v1.0 .
docker run -p 3000:3000 --env-file backend/.env github-clone:v1.0
```

#### Option C: Full Infrastructure
```bash
# Deploy complete infrastructure
cd web_infra_lab
docker-compose up -d --build

# Configure load balancer (see Docker & Infrastructure section above)
```

### 5. Access the Application

- **Development**: `http://localhost:3000`
- **Docker**: `http://localhost:3000`
- **Infrastructure**: `http://localhost:8082` (load balanced)

## 🔧 API Endpoints

### Authentication Routes
- `GET /auth/github` - Redirect to GitHub OAuth
- `GET /auth/github/callback` - Handle OAuth callback  
- `POST /auth/logout` - Logout user
- `GET /api/auth/status` - Check authentication status

### Data Routes
- `GET /api/user` - Get authenticated user's profile
- `GET /api/repos` - Get user's repositories
- `GET /api/stats` - Get user's GitHub statistics

## 🎨 Customization

### Styling
The CSS uses CSS custom properties (variables) for easy theming. Key variables are defined in `:root`:

```css
:root {
    --color-accent-fg: #0969da;        /* GitHub blue */
    --color-btn-primary-bg: #2da44e;   /* GitHub green */
    --color-header-bg: #24292f;        /* Dark header */
    /* ... more variables */
}
```
<!-- 
### Adding Features
- **Dark Mode**: Toggle CSS variables for dark theme
- **More Statistics**: Add charts using Chart.js or D3
- **Repository Details**: Fetch individual repo data
- **Collaboration**: Add team/organization support

## 📱 Responsive Design

The application is fully responsive and works great on:
- **Desktop** (1024px+) - Full sidebar and grid layouts
- **Tablet** (768px-1024px) - Collapsed sidebar, adapted grids  
- **Mobile** (480px-768px) - Stacked layouts, mobile-friendly navigation
- **Small Mobile** (<480px) - Optimized for small screens -->

## 🔒 Security Features

- **Secure Token Handling** - OAuth tokens never exposed to frontend
- **Session Management** - Secure HTTP-only sessions
- **CORS Protection** - Proper cross-origin request handling
- **Input Validation** - Sanitized user inputs and API responses
- **Environment Variables** - Sensitive data stored securely

## 🐛 Troubleshooting

### Common Issues

**1. "Authentication failed" error**
- Check your GitHub OAuth app credentials in `.env`
- Ensure callback URL matches exactly: `http://localhost:3000/auth/github/callback`
- Verify your GitHub app is not suspended

**2. "CORS error" when calling API**
- Make sure you're serving the frontend (not opening `index.html` directly)
- Check that `FRONTEND_URL` in `.env` matches your frontend server URL
- Ensure both servers are running on correct ports

**3. "Cannot GET /" error**
- Make sure the backend server is running (`npm run dev` in backend folder)
- Check that you're accessing the correct frontend URL (usually `http://localhost:8080`)

**4. Repositories not loading**
- Check browser developer console for API errors
- Verify your GitHub token has appropriate scopes (`user:email`, `public_repo`)
- Ensure you have repositories in your GitHub account

**5. Styling looks broken**
- Clear your browser cache
- Check that `style.css` is loading correctly
- Verify you're using a modern browser (Chrome, Firefox, Safari, Edge)

**6. Docker Infrastructure Issues**
- Check container status: `docker ps`
- Verify network connectivity: `docker network inspect web_infra_lab_lablan`
- Check HAProxy configuration: `docker exec lb-01 haproxy -c -f /etc/haproxy/haproxy.cfg`

### Debug Mode
Add this to your `.env` for more detailed logging:
```env
NODE_ENV=development
DEBUG=true
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or run into issues:

1. Check the [Troubleshooting](https://www.google.com/search?q=github+troubleshooting&oq=github+troubl&gs_lcrp=EgZjaHJvbWUqBwgBEAAYgAQyBggAEEUYOTIHCAEQABiABDIHCAIQABiABDIICAMQABgWGB4yCAgEEAAYFhgeMggIBRAAGBYYHjIICAYQABgWGB4yCAgHEAAYFhgeMggICBAAGBYYHjIICAkQABgWGB7SAQg3NDkwajBqNKgCALACAA&sourceid=chrome&ie=UTF-8) section above
2. Look through existing [GitHub Issues](https://github.com/features/issues)
3. Create a new issue with detailed information about your problem

---

<div align="center">

**⭐ Star this repository if you found it helpful!**

Built with ❤️ by Christian Regnante.

[🌐 Live Demo](your-demo-url) • [📚 Documentation](https://docs.github.com/en/get-started) • [🐛 Report Bug](https://docs.github.com/en/communities/maintaining-your-safety-on-github/reporting-abuse-or-spam) • [✨ Request Feature](https://github.com/orgs/community/discussions/categories/code-search-and-navigation)

</div>