// GitHub Clone Dashboard JavaScript
// Dynamic backend URL - works for both development and Docker deployment
const BACKEND_URL = window.location.port === '8080' 
  ? 'http://localhost:3000'  // Development: separate frontend/backend servers
  : window.location.origin;   // Docker: same origin for both frontend and backend

// Global state
let currentUser = null;
let allRepositories = [];
let filteredRepositories = [];
let userStats = null;

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuthenticationStatus();
    await loadDashboardData();
    initializeEventListeners();
});

// Authentication check
async function checkAuthenticationStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/status`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated) {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
            return;
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        window.location.href = 'index.html';
    }
}

// Load all dashboard data
async function loadDashboardData() {
    showLoading(true);
    
    try {
        // Load user data, repositories, and stats in parallel
        const [userResponse, reposResponse, statsResponse] = await Promise.all([
            fetch(`${BACKEND_URL}/api/user`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/repos`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/stats`, { credentials: 'include' })
        ]);

        if (userResponse.ok) {
            currentUser = await userResponse.json();
            updateUserInterface();
        }

        if (reposResponse.ok) {
            allRepositories = await reposResponse.json();
            filteredRepositories = [...allRepositories];
            updateRepositoriesInterface();
            updateRepoCounter();
        }

        if (statsResponse.ok) {
            userStats = await statsResponse.json();
            updateStatsInterface();
        }

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load dashboard data');
    } finally {
        showLoading(false);
    }
}

// Update user interface elements
function updateUserInterface() {
    if (!currentUser) return;

    // Header user info
    const userAvatarImg = document.getElementById('user-avatar-img');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownHandle = document.getElementById('dropdown-handle');

    if (currentUser.avatar_url) {
        userAvatarImg.src = currentUser.avatar_url;
        userAvatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    }

    if (dropdownUsername) dropdownUsername.textContent = currentUser.name || currentUser.login;
    if (dropdownHandle) dropdownHandle.textContent = `@${currentUser.login}`;

    // Profile card
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-bio');
    const profileRepos = document.getElementById('profile-repos');
    const profileFollowers = document.getElementById('profile-followers');
    const profileFollowing = document.getElementById('profile-following');

    if (profileAvatar && currentUser.avatar_url) {
        profileAvatar.src = currentUser.avatar_url;
    }
    if (profileName) profileName.textContent = currentUser.name || currentUser.login;
    if (profileUsername) profileUsername.textContent = `@${currentUser.login}`;
    if (profileBio) {
        profileBio.textContent = currentUser.bio || 'No bio available';
        profileBio.style.display = currentUser.bio ? 'block' : 'none';
    }
    if (profileRepos) profileRepos.textContent = currentUser.public_repos || 0;
    if (profileFollowers) profileFollowers.textContent = currentUser.followers || 0;
    if (profileFollowing) profileFollowing.textContent = currentUser.following || 0;
}

// Update statistics interface
function updateStatsInterface() {
    if (!userStats) return;

    const totalStars = document.getElementById('total-stars');
    const totalForks = document.getElementById('total-forks');
    const languagesList = document.getElementById('languages-list');

    if (totalStars) totalStars.textContent = userStats.total_stars || 0;
    if (totalForks) totalForks.textContent = userStats.total_forks || 0;

    // Update languages
    if (languagesList && userStats.languages) {
        if (userStats.languages.length === 0) {
            languagesList.innerHTML = '<div class="no-data">No language data available</div>';
        } else {
            languagesList.innerHTML = userStats.languages.map(lang => `
                <div class="language-item">
                    <span class="language-name">${lang.language}</span>
                    <span class="language-count">${lang.count} repo${lang.count !== 1 ? 's' : ''}</span>
                </div>
            `).join('');
        }
    }

    // Update recent repositories
    updateRecentRepositories();
}

// Update recent repositories
function updateRecentRepositories() {
    const recentRepos = document.getElementById('recent-repos');
    if (!recentRepos || !allRepositories.length) return;

    const recent = allRepositories
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);

    recentRepos.innerHTML = recent.map(repo => `
        <div class="recent-repo-item">
            <div class="repo-info">
                <a href="${repo.html_url}" target="_blank" class="repo-name">${repo.name}</a>
                <p class="repo-description">${repo.description || 'No description'}</p>
            </div>
            <div class="repo-meta">
                ${repo.language ? `<span class="repo-language">${repo.language}</span>` : ''}
                <span class="repo-updated">${formatDate(repo.updated_at)}</span>
            </div>
        </div>
    `).join('');
}

// Update repositories interface
function updateRepositoriesInterface() {
    const repositoriesList = document.getElementById('repositories-list');
    if (!repositoriesList) return;

    if (filteredRepositories.length === 0) {
        repositoriesList.innerHTML = '<div class="no-repos">No repositories found</div>';
        return;
    }

    repositoriesList.innerHTML = filteredRepositories.map(repo => `
        <div class="repository-item">
            <div class="repo-header">
                <h3 class="repo-title">
                    <a href="${repo.html_url}" target="_blank">${repo.name}</a>
                    ${repo.private ? '<span class="repo-visibility">Private</span>' : '<span class="repo-visibility public">Public</span>'}
                </h3>
                <div class="repo-actions">
                    <button class="btn btn-sm" onclick="generateProjectCard('${repo.id}')">Generate Card</button>
                </div>
            </div>
            <p class="repo-description">${repo.description || 'No description provided'}</p>
            <div class="repo-stats">
                ${repo.language ? `<span class="repo-language"><span class="language-dot" style="background-color: ${getLanguageColor(repo.language)}"></span>${repo.language}</span>` : ''}
                <span class="repo-stat">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z"></path>
                    </svg>
                    ${repo.stargazers_count}
                </span>
                <span class="repo-stat">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
                    </svg>
                    ${repo.forks_count}
                </span>
                <span class="repo-updated">Updated ${formatDate(repo.updated_at)}</span>
            </div>
        </div>
    `).join('');
}

// Initialize event listeners
function initializeEventListeners() {
    // Tab navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // User menu toggle
    const userMenuButton = document.getElementById('user-menu-button');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuButton && userDropdown) {
        userMenuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            userDropdown.style.display = 'none';
        });
    }

    // Repository search
    const repoSearch = document.getElementById('repo-search');
    if (repoSearch) {
        repoSearch.addEventListener('input', function() {
            filterRepositories(this.value);
        });
    }

    // Repository sort
    const repoSort = document.getElementById('repo-sort');
    if (repoSort) {
        repoSort.addEventListener('change', function() {
            sortRepositories(this.value);
        });
    }

    // Global search
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performGlobalSearch(this.value);
            }
        });
    }
}

// Tab switching
function switchTab(tabName) {
    // Update active nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-tab') === tabName) {
            link.classList.add('active');
        }
    });

    // Show/hide tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Load tab-specific data
    if (tabName === 'projects') {
        loadProjectCards();
    }
}

// Filter repositories
function filterRepositories(searchTerm) {
    if (!searchTerm.trim()) {
        filteredRepositories = [...allRepositories];
    } else {
        const term = searchTerm.toLowerCase();
        filteredRepositories = allRepositories.filter(repo => 
            repo.name.toLowerCase().includes(term) ||
            (repo.description && repo.description.toLowerCase().includes(term)) ||
            (repo.language && repo.language.toLowerCase().includes(term))
        );
    }
    updateRepositoriesInterface();
}

// Sort repositories
function sortRepositories(sortBy) {
    const sortFunctions = {
        updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
        created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
        pushed: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
        name: (a, b) => a.name.localeCompare(b.name),
        stars: (a, b) => b.stargazers_count - a.stargazers_count
    };

    if (sortFunctions[sortBy]) {
        filteredRepositories.sort(sortFunctions[sortBy]);
        updateRepositoriesInterface();
    }
}

// Load project cards
function loadProjectCards() {
    const projectCardsGrid = document.getElementById('project-cards-grid');
    if (!projectCardsGrid || !allRepositories.length) return;

    // Show top repositories for project cards
    const topRepos = allRepositories
        .filter(repo => !repo.fork) // Exclude forks
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 12); // Show top 12

    projectCardsGrid.innerHTML = topRepos.map(repo => `
        <div class="project-card" data-repo-id="${repo.id}">
            <div class="project-card-header">
                <h3 class="project-title">${repo.name}</h3>
                <div class="project-actions">
                    <button class="btn btn-sm btn-outline" onclick="exportProjectCard('${repo.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd" d="M.5 9.9a.5.5 0 01.5-.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"></path>
                            <path fill-rule="evenodd" d="M7.646 1.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 2.707V11.5a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708l3-3z"></path>
                        </svg>
                        Export
                    </button>
                </div>
            </div>
            <p class="project-description">${repo.description || 'No description available'}</p>
            <div class="project-stats">
                <div class="project-stat">
                    <span class="stat-icon">⭐</span>
                    <span class="stat-value">${repo.stargazers_count}</span>
                </div>
                <div class="project-stat">
                    <span class="stat-icon">🍴</span>
                    <span class="stat-value">${repo.forks_count}</span>
                </div>
                ${repo.language ? `<div class="project-language">
                    <span class="language-dot" style="background-color: ${getLanguageColor(repo.language)}"></span>
                    ${repo.language}
                </div>` : ''}
            </div>
            <div class="project-links">
                <a href="${repo.html_url}" target="_blank" class="project-link">View on GitHub</a>
            </div>
        </div>
    `).join('');
}

// Export project card
function exportProjectCard(repoId) {
    const repo = allRepositories.find(r => r.id.toString() === repoId);
    if (!repo) return;

    const htmlCode = generateProjectCardHTML(repo);
    
    const exportModal = document.getElementById('export-modal');
    const exportPreview = document.getElementById('export-preview');
    const exportCodeTextarea = document.getElementById('export-code-textarea');

    exportPreview.innerHTML = htmlCode;
    exportCodeTextarea.value = htmlCode;
    exportModal.style.display = 'flex';
}

// Generate project card HTML
function generateProjectCardHTML(repo) {
    return `<div class="github-project-card" style="
        border: 1px solid #d1d5da;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
        <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #0366d6;">
            <a href="${repo.html_url}" target="_blank" style="text-decoration: none; color: inherit;">
                ${repo.name}
            </a>
        </h3>
        <p style="margin: 0 0 12px 0; color: #586069; font-size: 14px;">
            ${repo.description || 'No description available'}
        </p>
        <div style="display: flex; align-items: center; gap: 16px; font-size: 14px; color: #586069;">
            ${repo.language ? `<span style="display: flex; align-items: center; gap: 4px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${getLanguageColor(repo.language)};"></span>
                ${repo.language}
            </span>` : ''}
            <span style="display: flex; align-items: center; gap: 4px;">
                ⭐ ${repo.stargazers_count}
            </span>
            <span style="display: flex; align-items: center; gap: 4px;">
                🍴 ${repo.forks_count}
            </span>
        </div>
    </div>`;
}

// Copy export code
function copyExportCode() {
    const textarea = document.getElementById('export-code-textarea');
    textarea.select();
    document.execCommand('copy');
    
    // Show feedback
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

// Close export modal
function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

// Refresh project cards
function refreshProjectCards() {
    loadProjectCards();
}

// Generate project card for specific repo
function generateProjectCard(repoId) {
    switchTab('projects');
    setTimeout(() => {
        exportProjectCard(repoId);
    }, 300);
}

// Update repo counter
function updateRepoCounter() {
    const reposCounter = document.getElementById('repos-counter');
    if (reposCounter) {
        reposCounter.textContent = allRepositories.length;
    }
}

// Utility functions
function showLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    console.error(message);
    // You could implement a toast notification here
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
}

function getLanguageColor(language) {
    const colors = {
        JavaScript: '#f1e05a',
        TypeScript: '#2b7489',
        Python: '#3572A5',
        Java: '#b07219',
        HTML: '#e34c26',
        CSS: '#563d7c',
        PHP: '#4F5D95',
        Ruby: '#701516',
        Go: '#00ADD8',
        Rust: '#dea584',
        Swift: '#ffac45',
        Kotlin: '#F18E33',
        C: '#555555',
        'C++': '#f34b7d',
        'C#': '#239120',
        Shell: '#89e051',
        Vue: '#2c3e50',
        React: '#61dafb'
    };
    return colors[language] || '#586069';
}

function performGlobalSearch(query) {
    if (!query.trim()) return;
    
    // Switch to repositories tab and filter
    switchTab('repositories');
    const repoSearch = document.getElementById('repo-search');
    if (repoSearch) {
        repoSearch.value = query;
        filterRepositories(query);
    }
}

// User menu functions
function viewProfile() {
    switchTab('overview');
}

function viewRepositories() {
    switchTab('repositories');
}

async function logout() {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Alt + number for tab switching
    if (e.altKey) {
        switch(e.key) {
            case '1':
                e.preventDefault();
                switchTab('overview');
                break;
            case '2':
                e.preventDefault();
                switchTab('repositories');
                break;
            case '3':
                e.preventDefault();
                switchTab('projects');
                break;
        }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
        closeExportModal();
    }
});