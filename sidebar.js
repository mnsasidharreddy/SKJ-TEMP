// js/sidebar.js
// Shared Sidebar Component - Load on all admin pages

// Get current page name for active nav highlighting
function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';
}

// Sidebar HTML Template
const sidebarHTML = `
    <aside class="sidebar bg-royal-green text-white border-r border-gray-700">
        <div class="p-6 border-b border-gray-600">
            <h1 class="text-2xl font-bold text-gold">SKJ</h1>
            <p class="text-sm opacity-80">Admin Panel</p>
        </div>
        
        <nav class="mt-6 flex-grow">
            <a href="dashboard.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="dashboard.html">
                <i class="fas fa-tachometer-alt w-6"></i>
                <span>Dashboard</span>
            </a>
            <a href="cover.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="cover.html">
                <i class="fas fa-image w-6"></i>
                <span>Cover Management</span>
            </a>
            <a href="set-gold-silver.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="set-gold-silver.html">
                <i class="fas fa-coins w-6"></i>
                <span>Set Gold & Silver</span>
            </a>
            <a href="price-history.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="price-history.html">
                <i class="fas fa-history w-6"></i>
                <span>Price History</span>
            </a>
            <a href="orders.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="orders.html">
                <i class="fas fa-shopping-bag w-6"></i>
                <span>Orders & Enquiries</span>
            </a>
            <a href="inventory.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="inventory.html">
                <i class="fas fa-box w-6"></i>
                <span>Inventory Management</span>
            </a>
            <a href="analytics.html" class="flex items-center px-6 py-3 hover:bg-white hover:bg-opacity-10 transition" data-page="analytics.html">
                <i class="fas fa-chart-line w-6"></i>
                <span>Analytics</span>
            </a>
        </nav>

        <div class="text-center py-4 bg-black bg-opacity-20">
            <h6 class="text-xs italic text-gold">~developed by</h6>
            <a href="#" class="inline-block bg-black px-3 py-1 rounded text-sm mt-1">
                <span class="font-bold text-white">SPARK</span><span class="text-blue-500 font-bold">.</span>
            </a>
        </div>

        <div class="p-6 border-t border-gray-600">
            <button onclick="logout()" class="flex items-center text-red-400 hover:text-red-300 w-full">
                <i class="fas fa-sign-out-alt w-6"></i>
                <span>Logout</span>
            </button>
        </div>
    </aside>
`;

// Inject sidebar into page
function loadSidebar() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = sidebarHTML;
        
        // Set active navigation based on current page
        const currentPage = getCurrentPage();
        const navLinks = sidebarContainer.querySelectorAll('nav a');
        navLinks.forEach(link => {
            if (link.dataset.page === currentPage) {
                link.classList.add('active-nav');
            }
        });
    }
}

// Logout function
window.logout = async function() {
    try {
        // Import Firebase auth dynamically if not already loaded
        if (typeof window.firebaseAuth !== 'undefined') {
            const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");
            await signOut(window.firebaseAuth);
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Fallback: just clear storage and redirect
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
};

// Load sidebar when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSidebar);
} else {
    loadSidebar();
}