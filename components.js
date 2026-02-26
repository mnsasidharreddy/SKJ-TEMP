// At the TOP of components.js, AFTER the load guard, add these declarations:

// ── LOAD GUARD ──
if (window._skjComponentsLoaded) {
    throw new Error('components.js already loaded — skipping duplicate execution');
}
window._skjComponentsLoaded = true;
let originalLoginHTML = "";
// ────────────────────────────────────────────────────────────────────────────────

// Price cookie helpers
function setPriceCookie(prices) {
    const val = JSON.stringify(prices);
    document.cookie = `skj_prices=${val};max-age=86400;path=/;SameSite=Lax`;
}
function getPriceCookie() {
    const match = document.cookie.match(/(?:^|;\s*)skj_prices=([^;]*)/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch(e) { return null; }
}

// ===================== GLOBAL VARIABLES =====================
// Auth state tracking - SINGLE DECLARATION AT TOP LEVEL
let cachedPrices = getPriceCookie();
let firebasePricesInitialized = false;
let priceUnsubscribe = null;
let cart = {};
let wishlist = [];
let _currentUser = null;

// Auth stabilization variables - MUST be declared here, not inside functions
let _authListenerRegistered = false;
let stabilizationTimer = null;
let checkCount = 0;  // <-- THIS WAS MISSING
let lastUser = null; // <-- THIS WAS MISSING

// Window-level auth flags (for cross-page consistency)
if (typeof window._authStateStable === 'undefined') window._authStateStable = false;
if (typeof window._authCheckCount === 'undefined') window._authCheckCount = 0;
if (typeof window._maxAuthChecks === 'undefined') window._maxAuthChecks = 6;
if (typeof window._authCheckInterval === 'undefined') window._authCheckInterval = 500;
if (typeof window._intentionalLogout === 'undefined') window._intentionalLogout = false;
if (typeof window._loginProcessed === 'undefined') window._loginProcessed = false;
if (typeof window._logoutProcessed === 'undefined') window._logoutProcessed = false;
// ===================== HEADER COMPONENT (FROM RUNNING/ORIGINAL) =====================
const siteHeader = `
<header class="fixed top-0 w-full z-[1000] shadow-md bg-black">
    <nav class="px-8 py-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
            <a href="./index.html" class="logo-container">
                <div class="crown-icon"><img src="images/crown_gold.png" alt="crown"></div>
                <div class="skj-text-wrapper">
                    <span>S<span class="reveal-name">ai&nbsp;</span></span>
                    <span>K<span class="reveal-name">iran&nbsp;</span></span>
                    <span>J<span class="reveal-name">ewellers A/C</span></span>
                </div>
            </a>
            <div class="logo-tagline">
                <div><span class="tagline-separator">|</span></div>
                <div style="margin-top:5px" class="logo-tagline-text">Sai Kiran Jewelleries <br><span style="font-size: 0.75rem;">A/C Showroom</span></div>
            </div>
        </div>
        
        <ul class="hidden lg:flex space-x-12 font-bold list-none m-0 p-0">
            <li><a href="index.html" class="nav-link-custom text-white">Home</a></li>
            <li><a href="about.html" class="nav-link-custom text-white">About Us</a></li>
            <li><a href="Privacy Policy.html" class="nav-link-custom text-white">Legal</a></li>
            <li><a href="gold-prices.html" onclick="showPriceLogs()" class="nav-link-custom text-white">Gold Prices</a></li>
            <li><a href="contact.html" class="nav-link-custom text-white">Contact Us</a></li>
        </ul>

        <form id="searchForm" class="hidden items-center mr-6" onsubmit="handleSearch(event)">
            <input id="searchInput" type="search" placeholder="Search items or categories" class="px-4 py-2 rounded-l-xl border-none outline-none" />
            <button type="submit" class="bg-amber-400 text-white px-4 py-2 rounded-r-xl"><i class="fa-solid fa-magnifying-glass"></i></button>
        </form>
        
        <div class="flex items-center space-x-4 text-2xl nav-icons">
            <a href="wishlist.html" class="relative nav-icon-btn" style='text-decoration:none !important; color:inherit;' aria-label="Wishlist">
                <span id="wishlist-badge" class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold" style="display:none">0</span>
                <i class="fa-regular fa-heart text-white heart-icon"></i>
            </a>
            <div class="relative cursor-pointer nav-icon-btn" onclick="toggleCart()">
                <i class="fa-solid fa-bag-shopping text-white cart-icon"></i>
                <span id="cart-badge" class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] rounded-full h-5 w-5 items-center justify-center font-bold" style="display:none">0</span>
            </div>
            <div class="login-icon relative cursor-pointer nav-icon-btn" onclick="toggleLoginPanel()">
                <i class="fa-solid fa-user cart-icon" style="color:#D4AF37;"></i>
            </div>
            <!-- search icon goes to search.html -->
            <a href="search.html" class="nav-icon-btn text-white transition" aria-label="Search">
                <i class="fa-solid fa-magnifying-glass search-icon"></i>
            </a>
        </div>
    </nav>
    
    <!-- Price Marquee -->
    <div style="position:relative;background:#004d40;overflow:hidden;">
        <div class="gold-border-top"></div>
        <div class="marquee-container" id="live-marquee" style="color:white;padding:6px 0;">
            <!-- Filled by renderMarqueeContent() -->
        </div>
        <div class="gold-border-bottom"></div>
    </div>
</header>
`;

// ===================== CART SIDEBAR =====================
const cartSidebar = `
<div id="cart-overlay" onclick="toggleCart()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:8997;"></div>
<div id="cart-sidebar" data-open="false" style="position:fixed;top:0;right:0;width:100%;max-width:400px;height:100vh;background:white;box-shadow:-10px 0 30px rgba(0,0,0,0.2);transform:translateX(110%);visibility:hidden;transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);z-index:8998;display:flex;flex-direction:column;">
    <div style="background:#064e3b;color:white;padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
        <h3 style="margin:0;font-size:1.2rem;font-weight:700;">🛍️ Shopping Bag</h3>
        <button onclick="toggleCart()" style="background:none;border:none;color:white;font-size:2rem;line-height:1;cursor:pointer;padding:0;">&times;</button>
    </div>
    <div id="cart-items" style="flex:1;overflow-y:auto;padding:1rem;">
        <p style="text-align:center;color:#9ca3af;margin-top:2rem;font-style:italic;">Your bag is empty</p>
    </div>
    <div style="padding:1rem 1.5rem;border-top:2px solid #e5e7eb;flex-shrink:0;background:#f9fafb;">
        <div style="font-size:0.875rem;margin-bottom:0.75rem;">
            <div style="display:flex;justify-content:space-between;color:#6b7280;margin-bottom:0.4rem;">
                <span>Original Price:</span><span id="cart-original-price">₹0</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:#16a34a;font-weight:600;margin-bottom:0.4rem;">
                <span>You Save:</span><span id="cart-discount">₹0</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;color:#064e3b;border-top:1px solid #e5e7eb;padding-top:0.5rem;margin-top:0.5rem;">
                <span>Total (<span id="cart-total-qty">0</span> items):</span>
                <span id="cart-total">₹0</span>
            </div>
        </div>
        <button onclick="openOrderPopup()" style="width:100%;background:#064e3b;color:white;border:none;padding:0.875rem;border-radius:0.75rem;font-weight:700;font-size:1rem;cursor:pointer;text-transform:uppercase;">Order Now</button>
    </div>
</div>
`;

// ===================== LOGIN PANEL =====================
// ===================== LOGIN PANEL =====================
const loginPanel = `
<div id="login-panel-overlay" class="fixed inset-0 bg-black/50 z-[8999] hidden" onclick="toggleLoginPanel()"></div>
<div id="login-panel" class="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl z-[9000] transform translate-x-full transition-transform duration-300 flex flex-col">
    <!-- Login Panel Header -->
    <div class="bg-emerald-950 text-white p-6 flex justify-between items-center">
        <h3 class="text-xl font-bold" id="login-panel-title">Sign In</h3>
        <button onclick="toggleLoginPanel()" class="text-2xl hover:text-amber-400 transition">&times;</button>
    </div>
    
    <!-- Login Form -->
    <div id="login-panel-form" class="flex-1 overflow-y-auto p-6">
        <div class="mb-6">
            <p class="text-gray-600 mb-4">Welcome back! Please sign in to continue.</p>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input type="email" id="panel-email" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950 focus:ring-1 focus:ring-emerald-950" placeholder="Enter your email">
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div class="relative">
                    <input type="password" id="panel-password" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950 focus:ring-1 focus:ring-emerald-950" placeholder="Enter your password">
                    <button type="button" onclick="togglePanelPassword()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-eye" id="panel-eye-icon"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex items-center justify-between mb-6">
                <label class="flex items-center">
                    <input type="checkbox" id="panel-remember" class="mr-2">
                    <span class="text-sm text-gray-600">Remember me</span>
                </label>
                <a href="reset-password.html" class="text-sm text-emerald-700 hover:underline">Forgot password?</a>
            </div>
            
            <div id="login-panel-error" class="hidden mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm"></div>
            
            <button onclick="panelLogin()" class="w-full bg-emerald-950 text-white py-3 rounded-lg font-semibold hover:bg-emerald-800 transition flex items-center justify-center">
                <span>Sign In</span>
            </button>
        </div>
        
        <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">New Member?</span>
            </div>
        </div>
        
        <button onclick="loadRegisterInPanel()" class="w-full block text-center border border-emerald-950 text-emerald-950 py-3 rounded-lg font-semibold hover:bg-emerald-950 hover:text-white transition cursor-pointer">
            Create Account
        </button>
    </div>
    
    <!-- User Profile (shown when logged in) -->
    <div id="login-panel-user" class="hidden flex-1 overflow-y-auto p-6">
        <div class="text-center mb-6">
            <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-user text-3xl text-emerald-700"></i>
            </div>
            <h4 class="text-lg font-bold text-gray-800" id="panel-user-name">User</h4>
            <p class="text-sm text-gray-500" id="panel-user-email">user@email.com</p>
        </div>
        
        <div class="space-y-3">
            <button onclick="showUserDetails()" class="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-between group">
                <span class="flex items-center gap-3">
                    <i class="fas fa-id-card text-emerald-700"></i>
                    <span class="font-medium">View/Edit Details</span>
                </span>
                <i class="fas fa-chevron-right text-gray-400 group-hover:text-emerald-700"></i>
            </button>
            
            <button onclick="showUserOrders()" class="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-between group">
                <span class="flex items-center gap-3">
                    <i class="fas fa-shopping-bag text-emerald-700"></i>
                    <span class="font-medium">My Orders</span>
                </span>
                <i class="fas fa-chevron-right text-gray-400 group-hover:text-emerald-700"></i>
            </button>

            <button onclick="panelResetPassword()" class="w-full text-left p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center gap-3 text-blue-700">
                <i class="fas fa-key"></i>
                <span class="font-medium">Reset Password</span>
            </button>
            
            <button onclick="panelLogout()" class="w-full text-left p-4 bg-red-50 rounded-lg hover:bg-red-100 transition flex items-center gap-3 text-red-700">
                <i class="fas fa-sign-out-alt"></i>
                <span class="font-medium">Logout</span>
            </button>
        </div>
    </div>
</div>

<!-- User Details Edit Modal -->
<div id="user-details-modal" class="fixed inset-0 bg-black/50 z-[10000] hidden items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-emerald-950">Edit Your Details</h3>
            <button onclick="closeUserDetailsModal()" class="text-2xl text-gray-500 hover:text-gray-700">&times;</button>
        </div>
        
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" id="edit-user-name" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-950">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="edit-user-email" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-950" readonly>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" id="edit-user-phone" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-950">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea id="edit-user-address" rows="3" class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-950 resize-none"></textarea>
            </div>
        </div>
        
        <div class="flex gap-3 mt-6">
            <button onclick="closeUserDetailsModal()" class="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button onclick="saveUserDetails()" class="flex-1 py-3 bg-emerald-950 text-white rounded-lg font-medium hover:bg-emerald-800">Save Changes</button>
        </div>
    </div>
</div>

<!-- Confirmation Modal -->
<div id="confirm-modal" class="fixed inset-0 bg-black/50 z-[10001] hidden items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
        <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-question text-2xl text-amber-600"></i>
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">Are you sure?</h3>
        <p class="text-gray-600 mb-6">Do you want to save these changes to your profile?</p>
        <div class="flex gap-3">
            <button onclick="closeConfirmModal()" class="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">No, Cancel</button>
            <button onclick="confirmSaveDetails()" class="flex-1 py-3 bg-emerald-950 text-white rounded-lg font-medium hover:bg-emerald-800">Yes, Save</button>
        </div>
    </div>
</div>

<!-- Orders Modal -->
<div id="orders-modal" class="fixed inset-0 bg-black/50 z-[10000] hidden items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b">
            <h3 class="text-xl font-bold text-emerald-950">My Orders</h3>
            <button onclick="closeOrdersModal()" class="text-2xl text-gray-500 hover:text-gray-700">&times;</button>
        </div>
        <div id="user-orders-list" class="flex-1 overflow-y-auto p-6">
            <!-- Orders loaded here -->
        </div>
    </div>
</div>
`;

// ===================== LOGIN PANEL FUNCTIONS =====================
window.toggleLoginPanel = function() {
    const panel = document.getElementById('login-panel');
    const overlay = document.getElementById('login-panel-overlay');
    const formDiv = document.getElementById('login-panel-form');

if (formDiv && !originalLoginHTML) {
    originalLoginHTML = formDiv.innerHTML;
}
    
    if (!panel) {
        // If panel doesn't exist, redirect to login page
        window.location.href = 'login.html';
        return;
    }
    
    const isOpen = panel.classList.contains('translate-x-0');
    
    if (isOpen) {
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = '';
    } else {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
        if (overlay) overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
};

window.toggleLogin = function() {
    // Always open sidebar panel on all screen sizes
    toggleLoginPanel();
};

window.togglePanelPassword = function() {
    const password = document.getElementById('panel-password');
    const eyeIcon = document.getElementById('panel-eye-icon');
    if (password.type === 'password') {
        password.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        password.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
};


// Login function for panel

window.panelLogin = async function() {
    const email = document.getElementById('panel-email')?.value?.trim();
    const password = document.getElementById('panel-password')?.value;
    const rememberMe = document.getElementById('panel-remember')?.checked;
    const errEl = document.getElementById('login-panel-error');
    
    if (!email || !password) {
        if (errEl) {
            errEl.textContent = 'Please enter email and password.';
            errEl.classList.remove('hidden');
        }
        return;
    }
    
    const btn = document.querySelector('#login-panel-form button[onclick="panelLogin()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...'; }
    
    try {
        if (errEl) errEl.classList.add('hidden');
        
        // Use compat SDK ONLY — same instance used everywhere else
        if (typeof firebase === 'undefined' || !firebase.auth) {
            throw new Error('Firebase not ready. Please refresh and try again.');
        }
        
        // Always use LOCAL so login survives refreshes, new tabs, and browser restarts
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        
        // Sign in
        await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // Handle remember me
        if (rememberMe) {
            localStorage.setItem('skj_remembered_email', email);
        } else {
            localStorage.removeItem('skj_remembered_email');
        }
        // onAuthStateChanged will handle UI update + loading cart/wishlist
        
    } catch (err) {
        let errorMsg = 'Login failed. Please try again.';
        switch (err.code) {
            case 'auth/user-not-found': errorMsg = 'No account found with this email.'; break;
            case 'auth/wrong-password': errorMsg = 'Incorrect password.'; break;
            case 'auth/invalid-email': errorMsg = 'Please enter a valid email.'; break;
            case 'auth/invalid-credential': errorMsg = 'Incorrect email or password.'; break;
        }
        if (errEl) { errEl.textContent = errorMsg; errEl.classList.remove('hidden'); }
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Sign In</span>'; }
    }
};

window.loadRegisterInPanel = async function() {
    const formDiv = document.getElementById('login-panel-form');
    const titleEl = document.getElementById('login-panel-title');
    if (!formDiv) return;
    if (titleEl) titleEl.textContent = 'Create Account';
    
    formDiv.innerHTML = `
        <p class="text-gray-600 mb-4">Join our family of valued customers.</p>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input type="text" id="reg-name" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950" placeholder="Enter your full name">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input type="email" id="reg-email" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950" placeholder="Enter your email">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input type="tel" id="reg-phone" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950" placeholder="10-digit mobile number">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input type="password" id="reg-password" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950" placeholder="Create a password (min 6 chars)">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <input type="password" id="reg-confirm" class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-950" placeholder="Confirm your password">
        </div>
        <div id="reg-error" class="hidden mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm"></div>
        <div id="reg-success" class="hidden mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm"></div>
        <button onclick="panelRegister()" class="w-full bg-emerald-950 text-white py-3 rounded-lg font-semibold hover:bg-emerald-800 transition mb-4">
            <span>Create Account</span>
        </button>
        <button onclick="loadLoginInPanel()" class="w-full text-center text-sm text-emerald-700 hover:underline">Already have an account? Sign In</button>
    `;
};

window.loadLoginInPanel = function() {

    const formDiv = document.getElementById('login-panel-form');
    const panel = document.getElementById('login-panel');
    const overlay = document.getElementById('login-panel-overlay');

    // Restore original login UI
    if (formDiv && originalLoginHTML) {
        formDiv.innerHTML = originalLoginHTML;
    }

    // Open sidebar directly (no toggle close/open flicker)
    if (panel) {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }

    if (overlay) {
        overlay.classList.remove('hidden');
    }

    document.body.style.overflow = 'hidden';
};

window.panelRegister = async function() {
    const name = document.getElementById('reg-name')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const phone = document.getElementById('reg-phone')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirm = document.getElementById('reg-confirm')?.value;
    const errEl = document.getElementById('reg-error');
    const successEl = document.getElementById('reg-success');
    
    if (errEl) errEl.classList.add('hidden');
    
    if (!name || !email || !phone || !password) {
        if (errEl) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (password !== confirm) {
        if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (password.length < 6) {
        if (errEl) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (!/^\d{10}$/.test(phone)) {
        if (errEl) { errEl.textContent = 'Please enter a valid 10-digit phone number.'; errEl.classList.remove('hidden'); }
        return;
    }
    
    const btn = document.querySelector('#login-panel-form button[onclick="panelRegister()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
    
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await user.updateProfile({ displayName: name });
        await firebase.firestore().collection('users').doc(user.uid).set({
            uid: user.uid, email, displayName: name, phone,
            role: 'customer', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (successEl) { successEl.textContent = 'Account created! Signing you in...'; successEl.classList.remove('hidden'); }
        setTimeout(() => updateLoginPanelUI(user), 1500);
    } catch(e) {
        const msg = e.code === 'auth/email-already-in-use' ? 'An account with this email already exists.'
                  : e.code === 'auth/invalid-email' ? 'Invalid email address.'
                  : e.message;
        if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
        if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
};


window.panelResetPassword = async function() {
    const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
    if (!user || !user.email) { showToast('No user logged in.', 'error'); return; }
    try {
        const actionCodeSettings = {
            // After clicking the reset link the user lands back on your site
            url: window.location.origin + '/index.html',
            handleCodeInApp: false
        };
        await firebase.auth().sendPasswordResetEmail(user.email, actionCodeSettings);
        showToast('✅ Password reset email sent to ' + user.email + ' — check your inbox (and spam folder just in case)', 'success');
    } catch(e) {
        showToast('Error sending reset email: ' + e.message, 'error');
    }
};

// AFTER:
window.panelLogout = async function() {
    if (!confirm('Are you sure you want to log out?')) return;
    
    try {
        // CRITICAL: Set flag BEFORE signing out
        window._intentionalLogout = true;
        
        // Clear processed flags so next login/logout works
        window._loginProcessed = false;
        window._logoutProcessed = false;
        window._authStateStable = false;
        
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
        }
        
        localStorage.removeItem('skj_user_data');
        console.log('✅ Logout complete');
        
    } catch (e) {
        console.error('Logout error:', e);
        // Reset flag on error
        window._intentionalLogout = false;
    }
};

// updateLoginPanelUI is defined below — single definition only


// User data management
async function loadUserData(uid, email) {
    // Set basic data immediately so UI works
    const displayName = email?.split('@')[0] || 'User';
    
    window.currentUserData = { 
        uid, 
        email, 
        name: displayName,
        displayName: displayName, // Add this for consistency
        phone: '',
        address: ''
    };

    // Update UI immediately
    const nameEl = document.getElementById('panel-user-name');
    const emailEl = document.getElementById('panel-user-email');
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = email;

    // Try to fetch full data from Firestore
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const fullName = userData.displayName || userData.name || displayName;

            // Update with fetched data
            window.currentUserData = {
                uid,
                email,
                name: fullName,
                displayName: fullName,
                phone: userData.phone || userData.phoneNumber || '',
                address: userData.address || '',
                ...userData,
                uid,   // ensure these aren't overwritten
                email
            };

            // Update UI again with full data
            if (nameEl) nameEl.textContent = fullName;
        }
    } catch (e) {
        // Permission error or network issue - basic data is already set
        console.warn('Could not fetch full user doc:', e.message);
    }
}

window.showUserDetails = function() {
    if (!window.currentUserData) {
        // Try to load from firebase auth
        const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
        if (user) {
            loadUserData(user.uid, user.email).then(() => window.showUserDetails());
        }
        return;
    }
    
    const nameInput = document.getElementById('edit-user-name');
    const emailInput = document.getElementById('edit-user-email');
    const phoneInput = document.getElementById('edit-user-phone');
    const addressInput = document.getElementById('edit-user-address');
    
    if (nameInput) nameInput.value = window.currentUserData.name || window.currentUserData.displayName || '';
    if (emailInput) emailInput.value = window.currentUserData.email || '';
    if (phoneInput) phoneInput.value = window.currentUserData.phone || window.currentUserData.phoneNumber || '';
    if (addressInput) addressInput.value = window.currentUserData.address || '';
    
    // Store original values for cancel
    window._originalUserData = { ...window.currentUserData };
    
    const modal = document.getElementById('user-details-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};

window.closeUserDetailsModal = function() {
    document.getElementById('user-details-modal').classList.add('hidden');
    document.getElementById('user-details-modal').classList.remove('flex');
};

window.saveUserDetails = function() {
    // Show confirmation modal first
    document.getElementById('confirm-modal').classList.remove('hidden');
    document.getElementById('confirm-modal').classList.add('flex');
};

window.closeConfirmModal = function() {
    document.getElementById('confirm-modal').classList.add('hidden');
    document.getElementById('confirm-modal').classList.remove('flex');
    // Restore original values to inputs
    if (window._originalUserData) {
        const nameInput = document.getElementById('edit-user-name');
        const phoneInput = document.getElementById('edit-user-phone');
        const addressInput = document.getElementById('edit-user-address');
        if (nameInput) nameInput.value = window._originalUserData.name || '';
        if (phoneInput) phoneInput.value = window._originalUserData.phone || '';
        if (addressInput) addressInput.value = window._originalUserData.address || '';
    }
};

window.confirmSaveDetails = async function() {
    const name    = document.getElementById('edit-user-name').value.trim();
    const phone   = document.getElementById('edit-user-phone').value.trim();
    const address = document.getElementById('edit-user-address').value.trim();

    try {
        // Use compat SDK (already loaded globally) — NOT the modular import
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            showToast('Firebase not ready. Please try again.', 'error'); return;
        }
        const db  = firebase.firestore();
        const uid = window.currentUserData?.uid;
        if (!uid) { showToast('Session error. Please log in again.', 'error'); return; }

        await db.collection('users').doc(uid).set({
            name,
            phone,
            address,
            email:       window.currentUserData.email,
            displayName: name,
            updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update in-memory profile immediately
        window.currentUserData = { ...window.currentUserData, name, displayName: name, phone, address };

        const nameEl = document.getElementById('panel-user-name');
        if (nameEl) nameEl.textContent = name;

        closeConfirmModal();
        closeUserDetailsModal();
        showToast('Profile updated successfully! ✅', 'success');
    } catch (e) {
        console.error('Error saving user data:', e);
        showToast('Error saving: ' + e.message, 'error');
    }
};

// AFTER:
window.showUserOrders = async function() {
    const modal = document.getElementById('orders-modal');
    const list = document.getElementById('user-orders-list');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    list.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-emerald-700"></i><p class="mt-2 text-gray-600">Loading orders...</p></div>';

    try {
        const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
        if (!user) {
            list.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-exclamation-triangle text-xl text-red-500"></i><p class="mt-2">Something went wrong. Please refresh the page.</p></div>';
            return;
        }

       const db = firebase.firestore();

        // Ensure user profile is loaded so we have the phone number
        if (!window.currentUserData || window.currentUserData.uid !== user.uid) {
            await loadUserData(user.uid, user.email);
        }

        const email = user.email || '';
        const phone = (window.currentUserData && window.currentUserData.phone) || '';

        // Run ALL three queries in parallel — never early-exit.
        // Orders placed before login have no userId; orders placed after may lack email/phone.
        // We need all three to guarantee complete history.
        const _seen = new Set();
        const _push = (d) => { if (!_seen.has(d.id)) { _seen.add(d.id); allDocs.push(d); } };
        let allDocs = [];

        const queries = [
            db.collection('orders').where('userId', '==', user.uid).get()
                .then(s => s.forEach(_push)).catch(e => console.warn('userId query:', e.message)),
        ];
        if (email) {
            queries.push(
                db.collection('orders').where('customerEmail', '==', email).get()
                    .then(s => s.forEach(_push)).catch(e => console.warn('email query:', e.message))
            );
        }
        if (phone) {
            queries.push(
                db.collection('orders').where('customerPhone', '==', phone).get()
                    .then(s => s.forEach(_push)).catch(e => console.warn('phone query:', e.message))
            );
        }

        await Promise.all(queries);

        // Sort client-side by createdAt desc
        allDocs.sort((a, b) => {
            const aT = a.data().createdAt?.toMillis?.() || 0;
            const bT = b.data().createdAt?.toMillis?.() || 0;
            return bT - aT;
        });

        if (allDocs.length === 0) {
            list.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-shopping-bag text-3xl text-gray-400"></i>
                    </div>
                    <h4 class="text-lg font-medium text-gray-800 mb-2">No orders yet</h4>
                    <p class="text-gray-500 mb-4">Start shopping to see your orders here!</p>
                    <a href="index.html" class="inline-block px-6 py-2 bg-emerald-950 text-white rounded-lg hover:bg-emerald-800 transition">Start Shopping</a>
                </div>
            `;
            return;
        }

        let html = '<div class="space-y-4">';
        allDocs.forEach((doc) => {
            const order = doc.data();
            const date = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString('en-IN') : 'N/A';
            const total = order.total || 0;
            const status = order.status || 'pending';
            const statusColors = {
                pending: 'bg-yellow-100 text-yellow-800',
                contacted: 'bg-blue-100 text-blue-800',
                converted: 'bg-green-100 text-green-800',
                closed: 'bg-gray-100 text-gray-800',
                'delivery-in-progress': 'bg-purple-100 text-purple-800',
                delivered: 'bg-green-100 text-green-800'
            };

            html += `
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-bold text-emerald-950">Order #${order.orderId || doc.id}</p>
                            <p class="text-sm text-gray-500">${date}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'} capitalize">
                            ${status.replace(/-/g, ' ')}
                        </span>
                    </div>
                    <div class="text-sm text-gray-600 mb-2">
                        ${order.items ? order.items.length : 0} item(s) • Total: ₹${total.toLocaleString()}
                    </div>
                    <button onclick="viewOrderDetails('${doc.id}')" class="text-emerald-700 text-sm font-medium hover:underline">
                        View Details <i class="fas fa-arrow-right ml-1"></i>
                    </button>
                </div>
            `;
        });
        html += '</div>';
        list.innerHTML = html;

    } catch (e) {
        console.error('Error loading orders:', e);
        list.innerHTML = '<div class="text-center py-8 text-red-600">Error loading orders. Please try again.</div>';
    }
};
       

window.closeOrdersModal = function() {
    document.getElementById('orders-modal').classList.add('hidden');
    document.getElementById('orders-modal').classList.remove('flex');
};

window.viewOrderDetails = async function(docId) {
    try {
        const db = firebase.firestore();
        const snap = await db.collection('orders').doc(docId).get();
        if (!snap.exists) { showToast('Order not found.', 'error'); return; }
        const order = snap.data();

        const date = order.createdAt
            ? new Date(order.createdAt.toDate()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A';

        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            contacted: 'bg-blue-100 text-blue-800',
            converted: 'bg-green-100 text-green-800',
            closed: 'bg-gray-100 text-gray-800',
            'delivery-in-progress': 'bg-purple-100 text-purple-800',
            delivered: 'bg-green-100 text-green-800'
        };
        const status = order.status || 'pending';

        const itemsHtml = (order.items || []).map(item => `
            <div class="flex justify-between py-2 border-b border-gray-100 text-sm last:border-0">
                <div>
                    <p class="font-medium text-gray-800">${item.name}</p>
                    <p class="text-xs text-gray-400">₹${(item.price || 0).toLocaleString()} × ${item.qty}</p>
                </div>
                <span class="font-semibold text-gray-700 whitespace-nowrap ml-4">₹${(item.subtotal || ((item.price || 0) * (item.qty || 1))).toLocaleString()}</span>
            </div>`).join('') || '<p class="text-gray-400 text-sm italic">No items listed</p>';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 z-[11000] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl">
                <!-- Header -->
                <div class="sticky top-0 bg-white z-10 flex justify-between items-center p-5 border-b rounded-t-2xl">
                    <div>
                        <p class="font-bold text-emerald-950 text-base">Order #${order.orderId || docId}</p>
                        <p class="text-xs text-gray-400 mt-0.5">${date}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'} capitalize">${status.replace(/-/g, ' ')}</span>
                        <button onclick="this.closest('.fixed').remove()" class="text-2xl text-gray-400 hover:text-red-400 leading-none transition">&times;</button>
                    </div>
                </div>

                <div class="p-5 space-y-5">
                    <!-- Customer Info -->
                    <div>
                        <h4 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Customer Details</h4>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <div><p class="text-gray-400 text-xs mb-0.5">Name</p><p class="font-medium text-gray-800">${order.customerName || 'N/A'}</p></div>
                            <div><p class="text-gray-400 text-xs mb-0.5">Phone</p><p class="font-medium text-gray-800">${order.customerPhone || 'N/A'}</p></div>
                            <div><p class="text-gray-400 text-xs mb-0.5">Email</p><p class="font-medium text-gray-800">${order.customerEmail || 'N/A'}</p></div>
                            <div><p class="text-gray-400 text-xs mb-0.5">Order Type</p><p class="font-medium text-gray-800">${order.address ? 'Delivery' : 'In-Store Pickup'}</p></div>
                            ${order.address ? `<div class="col-span-2"><p class="text-gray-400 text-xs mb-0.5">Delivery Address</p><p class="font-medium text-gray-800">${order.address}</p></div>` : ''}
                        </div>
                    </div>

                    <!-- Items -->
                    <div>
                        <h4 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Items Ordered</h4>
                        <div class="bg-gray-50 rounded-xl p-3">${itemsHtml}</div>
                    </div>

                    <!-- Totals -->
                    <div class="bg-emerald-50 rounded-xl p-4 text-sm">
                        <div class="flex justify-between text-gray-500 mb-1">
                            <span>Original Price</span><span>₹${(order.originalTotal || order.total || 0).toLocaleString()}</span>
                        </div>
                        ${(order.discount > 0) ? `<div class="flex justify-between text-green-600 mb-1"><span>Discount</span><span>−₹${order.discount.toLocaleString()}</span></div>` : ''}
                        <div class="flex justify-between font-bold text-emerald-950 text-base border-t border-emerald-200 pt-2 mt-2">
                            <span>Total</span><span>₹${(order.total || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>`;

        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    } catch (e) {
        console.error('Error fetching order details:', e);
        showToast('Could not load order details. Please try again.', 'error');
    }
};

// Sync guest data to logged in user
async function syncGuestDataToUser(uid) {
    await loadUserCartAndWishlist(uid);
}

// Toast notification helper
function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-[99999] text-white font-medium animate-slide-up`;
    
    // Set background color based on type
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6b7280';
    toast.style.background = bgColor;
    
    toast.innerHTML = `
        <span class="flex items-center gap-2">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            ${message}
        </span>
    `;
    
    // Add animation styles if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            .animate-slide-up {
                animation: slideUp 0.3s ease forwards;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Listen for auth state changes
// Listen for auth state changes
// Listen for auth state changes
// initAuthListener is defined below near end of file — single definition only

// Load cart and wishlist from Firebase for logged-in user
async function loadUserCartAndWishlist(uid) {
    try {
        const db = firebase.firestore();
        let data = {};
        
        // Try to fetch user doc
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                data = userDoc.data();
            }
        } catch (e) {
            console.warn('Could not fetch user doc for cart/wishlist:', e.message);
        }

        // Process wishlist
        const storedWishlist = (data.wishlist && Array.isArray(data.wishlist)) ? data.wishlist : [];
        
        // Enrich with product data
        const enrichedWishlist = [];
        for (const item of storedWishlist) {
            try {
                const productDoc = await db.collection('products').doc(item.id).get();
                if (productDoc.exists) {
                    const productData = productDoc.data();
                    const livePrice = await calculateLivePrice(productData);
                    
                    enrichedWishlist.push({
                        ...item,
                        name: productData.name || item.name,
                        images: productData.images || item.images || [],
                        offerPrice: livePrice || item.offerPrice || 0,
                        originalPrice: productData.originalPrice || item.originalPrice || 0,
                        weight: productData.weight ? String(productData.weight) : (item.weight || '0'),
                        inStock: productData.inStock !== false,
                        category: productData.category || item.category || 'rings'
                    });
                } else {
                    enrichedWishlist.push(item);
                }
            } catch (e) {
                enrichedWishlist.push(item);
            }
        }
        
        wishlist = enrichedWishlist;
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
        updateWishlistUI();
        
        // Refresh wishlist page if on it
        if (window.location.pathname.includes('wishlist.html') && typeof renderWishlistPage === 'function') {
            renderWishlistPage();
        }

        // Process cart similarly...
        if (data.cart && typeof data.cart === 'object') {
            const enrichedCart = {};
            for (const [id, item] of Object.entries(data.cart)) {
                try {
                    const productDoc = await db.collection('products').doc(id).get();
                    if (productDoc.exists) {
                        const productData = productDoc.data();
                        const livePrice = await calculateLivePrice(productData);
                        
                        enrichedCart[id] = {
                            ...item,
                            n: productData.name || item.n || item.name,
                            name: productData.name || item.name,
                            p: livePrice || item.p || 0,
                            op: productData.originalPrice || item.op || 0
                        };
                    } else {
                        enrichedCart[id] = item;
                    }
                } catch (e) {
                    enrichedCart[id] = item;
                }
            }
            
            cart = enrichedCart;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
        } else {
            cart = {};
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
        }
        
    } catch (e) {
        console.warn('loadUserCartAndWishlist error:', e.message);
    }
}

// Helper: Calculate live price based on current metal rates
async function calculateLivePrice(product) {
    if (!product) return 0;
    
    // Get cached prices or fetch current
    const prices = cachedPrices || { gold: 6400, skjg: 6200, skjs: 75, silver: 750 };
    
    let price = product.offerPrice || product.price || 0;
    
    if (product.metalType === 'gold' && product.weight && product.dynamicPricing !== false) {
        const ratePerGram = product.carat === '24CT' ? prices.gold : (prices.skjg || 6200);
        const makingCharges = (product.makingCharges || 0) * parseFloat(product.weight);
        const basePrice = Math.round((parseFloat(product.weight) * ratePerGram) + makingCharges);
        let discountAmt = product.discountAmount || 0;
        if (!discountAmt && product.discountPercent > 0) {
            discountAmt = Math.round((basePrice * product.discountPercent) / 100);
        }
        price = basePrice - discountAmt;
    } else if (product.metalType === 'silver' && product.weight && product.dynamicPricing !== false) {
        const ratePerGram = (prices.skjs || prices.silver || 750) / 10;
        const makingCharges = (product.makingCharges || 0) * parseFloat(product.weight);
        const basePrice = Math.round((parseFloat(product.weight) * ratePerGram) + makingCharges);
        let discountAmt = product.discountAmount || 0;
        if (!discountAmt && product.discountPercent > 0) {
            discountAmt = Math.round((basePrice * product.discountPercent) / 100);
        }
        price = basePrice - discountAmt;
    }

    return price;
}

// Save cart/wishlist to Firebase for logged-in user
async function saveUserCartAndWishlist() {
    try {
        const user = firebase.auth ? firebase.auth().currentUser : null;
        if (!user) {
            console.log('No user logged in, skipping Firebase save');
            return;
        }
        
        const db = firebase.firestore();
        
        // Clean cart data - remove undefined values
        const cleanCart = {};
        Object.keys(cart).forEach(key => {
            const item = cart[key];
            cleanCart[key] = {
                qty: item.qty || 0,
                n: item.n || item.name || '',
                name: item.name || item.n || '',
                p: item.p || item.price || 0,
                op: item.op || item.originalPrice || item.p || 0
            };
        });
        
        // Clean wishlist data
        const cleanWishlist = wishlist.map(item => {
            const clean = { ...item };
            // Remove undefined values
            Object.keys(clean).forEach(k => {
                if (clean[k] === undefined) delete clean[k];
            });
            return clean;
        });
        
        await db.collection('users').doc(user.uid).set({
            cart: cleanCart,
            wishlist: cleanWishlist,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Cart/wishlist saved to Firebase');
    } catch(e) { 
        console.error('Failed to save to Firebase:', e);
        throw e; // Re-throw so caller can handle
    }
}

window.openOrderPopup = function() {
    // Check for out-of-stock items
    const outOfStockItems = Object.entries(cart).filter(([id, item]) => item.outOfStock);
    
    if (outOfStockItems.length > 0) {
        // Show centered popup
        const modal = document.createElement('div');
        modal.id = 'oos-order-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
        modal.innerHTML = `
            <div style="background:white;border-radius:1.5rem;max-width:440px;width:100%;padding:2rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="width:64px;height:64px;background:#fef3c7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size:1.8rem;color:#d97706;"></i>
                </div>
                <h3 style="font-weight:700;font-size:1.2rem;color:#1f2937;margin-bottom:0.75rem;">Out of Stock Items in Cart</h3>
                <p style="color:#6b7280;font-size:0.9rem;line-height:1.6;margin-bottom:1.5rem;">
                    Your cart has out-of-stock items. There may be a slight delay for your order.<br><br>
                    Do you wish to continue with your order?<br>
                    <span style="font-size:0.8rem;color:#9ca3af;">If no, out-of-stock items will be moved to your wishlist.</span>
                </p>
                <div style="display:flex;gap:0.75rem;">
                    <button id="oos-no-btn" style="flex:1;padding:0.875rem;border:2px solid #e5e7eb;border-radius:0.75rem;font-weight:600;cursor:pointer;background:white;color:#374151;">
                        No — Move to Wishlist
                    </button>
                    <button id="oos-yes-btn" style="flex:1;padding:0.875rem;background:#064e3b;color:white;border:none;border-radius:0.75rem;font-weight:600;cursor:pointer;">
                        Yes, Confirm Order
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('oos-yes-btn').onclick = () => {
            modal.remove();
            _openRealOrderPopup();
        };
        
        document.getElementById('oos-no-btn').onclick = async () => {
            // Move out-of-stock items to wishlist
            for (const [id, item] of outOfStockItems) {
                if (!wishlist.find(w => w.id === id)) {
                    wishlist.push({ id, name: item.n || item.name || 'Item' });
                }
                delete cart[id];
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
            updateCartUI();
            updateWishlistUI();
            saveUserCartAndWishlist();
            renderCartItems();
            modal.remove();
            
            // Continue order with remaining in-stock items
            if (Object.keys(cart).length > 0) {
                _openRealOrderPopup();
            } else {
                showToast('All items moved to wishlist. Cart is now empty.', 'info');
            }
        };
        
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        return;
    }
    
    _openRealOrderPopup();
};

function _openRealOrderPopup() {
    const popup = document.getElementById('order-popup');
    if (!popup) return;
    popup.classList.remove('hidden');
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Fill order summary
    const summary = document.getElementById('order-summary');
    if (summary) {
        let html = '';
        for (const id in cart) {
            const item = cart[id];
            html += `<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span>${item.n || item.name} x${item.qty}</span>
                <span>₹${((item.p||0)*item.qty).toLocaleString()}</span>
            </div>`;
        }
        summary.innerHTML = html;
    }
}

// Update initComponents to include login panel


/*function updateLoginPanelUI() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const user = firebase.auth().currentUser;
    const formDiv = document.getElementById('login-panel-form');
    const userDiv = document.getElementById('login-panel-user');
    if (user) {
        if (formDiv) formDiv.style.display = 'none';
        if (userDiv) userDiv.style.display = 'block';
        const nameEl = document.getElementById('panel-user-name');
        const emailEl = document.getElementById('panel-user-email');
        if (nameEl) nameEl.textContent = user.displayName || 'Customer';
        if (emailEl) emailEl.textContent = user.email || '';
    } else {
        if (formDiv) formDiv.style.display = 'block';
        if (userDiv) userDiv.style.display = 'none';
    }
}

window.panelLogin = async function() {
    const email = document.getElementById('panel-email')?.value?.trim();
    const password = document.getElementById('panel-password')?.value;
    const errEl = document.getElementById('login-panel-error');
    
    if (!email || !password) {
        if (errEl) { errEl.textContent = 'Please enter email and password.'; errEl.classList.remove('hidden'); }
        return;
    }
    
    const btn = document.querySelector('#login-panel-form button[onclick="panelLogin()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...'; }
    
    try {
        if (typeof firebase !== 'undefined') {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            if (errEl) errEl.classList.add('hidden');
            updateLoginPanelUI();
        }
    } catch(e) {
        const msg = e.code === 'auth/user-not-found' ? 'No account found with this email.' 
                  : e.code === 'auth/wrong-password' ? 'Incorrect password.' 
                  : e.code === 'auth/invalid-email' ? 'Invalid email address.'
                  : 'Login failed: ' + e.message;
        if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Sign In</span>'; }
    }
};

window.panelLogout = async function() {
    try {
        if (typeof firebase !== 'undefined') {
            await firebase.auth().signOut();
            updateLoginPanelUI();
        }
    } catch(e) { console.error(e); }
};

window.panelForgotPassword = async function() {
    const email = document.getElementById('panel-email')?.value || prompt('Enter your email to reset password:');
    if (!email) return;
    try {
        if (typeof firebase !== 'undefined') {
            await firebase.auth().sendPasswordResetEmail(email);
            alert('Password reset email sent to ' + email);
        }
    } catch(e) { alert('Error: ' + e.message); }
};*/

// ===================== ORDER POPUP =====================
const orderPopup = `
<div id="order-popup" class="order-popup">
    <div class="order-popup-content">
        <div class="order-popup-header">
            <h3 class="text-2xl font-bold text-emerald-950">Complete Your Order</h3>
            <button onclick="closeOrderPopup()" class="text-3xl text-gray-600 hover:text-emerald-950">×</button>
        </div>
        <form onsubmit="submitOrder(event)" class="order-popup-body">
            <div class="mb-4">
                <label class="block text-sm font-bold mb-2 text-gray-700">Name *</label>
                <input type="text" id="order-name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-950" placeholder="Enter your full name">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-bold mb-2 text-gray-700">Phone Number *</label>
                <input type="tel" id="order-phone" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-950" placeholder="Enter your phone number">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-bold mb-2 text-gray-700">Email <span class="text-gray-400 font-normal">(optional)</span></label>
                <input type="email" id="order-email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-950" placeholder="Enter your email address">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-bold mb-2 text-gray-700">Delivery Address *</label>
                <textarea id="order-address" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-950 resize-none" placeholder="Enter your full address"></textarea>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 class="font-bold text-emerald-950 mb-3 text-lg">Order Summary</h4>
                <div id="order-summary" class="text-sm"></div>
            </div>
            <button type="submit" class="w-full bg-emerald-950 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-800 transition uppercase">
                Send Order via WhatsApp
            </button>
        </form>
    </div>
</div>
`;

// ===================== FOOTER COMPONENT (FROM TESTING) =====================
const siteFooter = `
<footer id="footer" class="bg-emerald-950 text-white p-8 md:p-16 lg:p-20 pb-0 md:pb-0 lg:pb-0">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 lg:gap-20 pb-8 md:pb-16">
        <div>
            <h5 class="text-amber-500 font-bold text-base md:text-lg mb-4 md:mb-8 uppercase tracking-[0.15em] md:tracking-[0.2em]">Quick Access</h5>
            <ul class="space-y-3 md:space-y-4 opacity-70 list-none p-0">
                <li><a href="index.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Home</a></li>
                <li><a href="about.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">About Us</a></li>
                <li><a href="contact.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Contact Us</a></li>
            </ul>
        </div>
        <div>
            <h5 class="text-amber-500 font-bold text-base md:text-lg mb-4 md:mb-8 uppercase tracking-[0.15em] md:tracking-[0.2em]">Legal & Policy</h5>
            <ul class="space-y-3 md:space-y-4 opacity-70 list-none p-0">
                <li><a href="./Privacy Policy.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Privacy Policy</a></li>
                <li><a href="./Terms & Conditions.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Terms & Conditions</a></li>
                <li><a href="./Shipping Policy.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Shipping Policy</a></li>
                <li><a href="./Refund and Returns Policy.html" class="text-white no-underline hover:text-gold-900 transition-all duration-300 inline-block text-sm md:text-base">Refund and Returns Policy</a></li>
            </ul>
        </div>
        <div>
            <h5 class="text-amber-500 font-bold text-base md:text-lg mb-4 md:mb-8 uppercase tracking-[0.15em] md:tracking-[0.2em]">Address</h5>
            <p class="opacity-70 mb-2 font-bold text-sm md:text-base">Sai Kiran Jewelleries A/C Showroom</p>
            <p class="opacity-70 mb-6 md:mb-8 text-xs md:text-sm leading-relaxed">71-1-17, mg road, opp rr chicken, patamata, Vijayawada, Andhra Pradesh, 520010, India</p>
            <div class="flex space-x-4 md:space-x-6 text-2xl md:text-4xl">
                <a href="https://www.facebook.com/share/18LinN4tpZ/?mibextid=wwXIfr" class="social-icon text-gray-300 transition" title="Follow us on Facebook"><i class="fa-brands fa-facebook"></i></a>
                <a href="https://wa.me/919705373804" class="social-icon text-gray-300 transition" title="WhatsApp Us"><i class="fa-brands fa-whatsapp"></i></a>
                <a href="https://www.instagram.com/saikiranjewellery_?igsh=bTFqZ2Ria3d2NDFr" class="social-icon text-gray-300 transition" title="Follow us on Instagram"><i class="fa-brands fa-instagram"></i></a>
                <a href="https://maps.app.goo.gl/24hUeYF8f2mHk587A?g_st=iw" class="social-icon text-gray-300 transition" title="Find us on Google Maps"><i class="fa-solid fa-location-dot"></i></a>
                <a href="mailto:Saikiranjewellery1@gmail.com" class="social-icon text-gray-300 transition" title="Email Us"><i class="fa-solid fa-envelope"></i></a>
            </div>
        </div>
    </div>
    <div class="text-center pt-6 md:pt-12 pb-6 md:pb-12 border-t border-white/10 opacity-40 text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] uppercase">Sai Kiran Jewelleries A/C Showroom | All rights are reserved @ 2026</div>
</footer>
`;

// ===================== MOBILE NAVIGATION FOOTER (FROM RUNNING - visible < desktop) =====================
const mobileNavFooter = `
<div class="mobile-nav-footer">
    <a href="index.html">
        <i class="fa-solid fa-house"></i>
        <span>Home</span>
    </a>
    <a href="https://wa.me/919705373804?text=Hello%20Sai%20Kiran%20Jewelleries">
        <i class="fa-brands fa-whatsapp"></i>
        <span>Chat</span>
    </a>
    <a href="javascript:void(0)" id="mobile-login-btn" onclick="toggleLoginPanel()">
        <i class="fa-regular fa-user" id="mobile-login-icon"></i>
        <span id="mobile-login-label">Login</span>
    </a>
    <a href="tel:+919705373804">
        <i class="fa-solid fa-phone-volume"></i>
        <span>Call</span>
    </a>
</div>
`;

window.handleMobileLoginClick = function() {
    // Always open the sidebar panel — same behavior as desktop
    toggleLoginPanel();
};

// ===================== DESKTOP CTA BUTTONS =====================
const desktopCTA = `
<div class="desktop-cta">
    <a href="https://wa.me/919705373804?text=Hello%20Sai%20Kiran%20Jewelleries" class="btn-call-shine no-underline bg-green-500 text-white" title="Chat via WhatsApp">
        <i class="fa-brands fa-whatsapp"></i><span>Chat</span>
    </a>
    <a href="tel:+919705373804" class="btn-call-shine no-underline bg-emerald-950 text-white" title="Call Us">
        <i class="fa-solid fa-phone-volume"></i><span>Call Us</span>
    </a>
</div>
`;

// Add these CSS animations to the shared styles
const additionalStyles = `
<style>
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .card-image-section {
    width: 100%; height: 200px; overflow: hidden; flex-shrink: 0;}
</style>
`;

// ===================== STYLES COMPONENT =====================
const sharedStyles = `
<style>
    :root { --royal-green: #004d40; --gold: #D4AF37; }
    
    /* Logo Container - Supporting legacy structure */
    .logo-container {
        position: relative;
        display: flex;
        align-items: center;
        text-decoration: none !important;
        padding: 10px 0;
        color: inherit;
    }
    @media (min-width: 321px) and (max-width: 424px) {
        .logo-container { 
        width: 50px; 
        }
        .tagline-separator {
        display: inline-block;
        font-size: 50px !important;
        margin-left: -5px !important;
        }
        .logo-tagline-text {
        display:inline-block;
        font-size: 20px !important;}

        .crown-icon img {
            position: relative;
            top: -2px;
            }
        .nav-icons{
            margin-left:-15px;
            }
    }   
    .logo-tagline {
        display: flex;
        color: white;
        font-size: 0.75rem;
        font-weight: 700;
        line-height: 1.1;
        margin-left: 8px;
        font-family: 'Cinzel', serif;
    }
    
    .logo-tagline span {
        color: var(--gold);
        margin-right: 4px;
        font-size: 1.8rem;
    }
    
    @media (min-width: 1024px) {
        .logo-tagline {
            display: none;
        }
    }

    /* Crown icon - positioned in middle of K and J initially */
    .crown-icon {
        position: absolute;
        width: 60px;
        height: 30px;
        top: 0px;
        left: 38px;
        font-size: 1.25rem;
        color: #ffd700;
        transition: all 0.7s ease-in-out;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .crown-icon img {
        width: 65px;
        height: 28px;
        object-fit: contain;
        display: block;
    }

    .skj-text-wrapper {
        font-family: 'Cinzel', serif;
        font-weight: 700;
        font-size: 3.5rem;
        letter-spacing: -6px;
        -webkit-text-fill-color: #fff;
        transition: all 0.7s ease-in-out;
    }

    /* SKJ LETTERS POSITIONING - K and J slightly below S initially */
    .skj-text-wrapper span {
        display: inline-block;
        position: relative;
        transition: all 0.7s ease-in-out;
    }

    .skj-text-wrapper span:nth-child(1) { top: 0; }
    .skj-text-wrapper span:nth-child(2),
    .skj-text-wrapper span:nth-child(3) { top: 5px; }

    .reveal-name {
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        transition: all 0.7s ease-in-out;
        font-size: 1.5rem;
        letter-spacing: normal;
        background: linear-gradient(to bottom, #f9f295, #e0aa3e, #b8860b);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
    }

    /* --- HOVER ANIMATIONS - DESKTOP ONLY --- */
    @media (min-width: 1024px) {
        .logo-container:hover .reveal-name {
            max-width: 300px;
            opacity: 1;
            margin-left: 10px;
            margin-right: 12px;
        }
        .logo-container:hover .skj-text-wrapper span:nth-child(2),
        .logo-container:hover .skj-text-wrapper span:nth-child(3) { top: 0; }
        .logo-container:hover .crown-icon {
            top: -5px;
            left: 76px;
        }
    }

    /* Hide animations on mobile/tablet - Keep crown centered on K and J */
    @media (max-width: 1023px) {
        .skj-text-wrapper {
            font-size: 2rem;
            margin-left: 10px;
        }
        .reveal-name { display: none; }
        .crown-icon {
            position: static;
            width: auto;
            height: auto;
            margin-right: -58px;
            margin-bottom: 35px;
        }
        .crown-icon img {
            width: 32px;
            height: 20px;
        }
        .skj-text-wrapper span:nth-child(2),
        .skj-text-wrapper span:nth-child(3) { top: 4px; }
    }
    
    /* Navigation icons */
    .nav-icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        transition: all 0.3s ease;
        position: relative;
    }
    
    @media (min-width: 1024px) {
        .nav-icon-btn:hover { transform: scale(1.1); }
    }
    
    .heart-icon, .cart-icon, .search-icon {
        font-size: 1.5rem;
        transition: color 0.3s ease;
    }
    
    @media (min-width: 1024px) {
        .heart-icon:hover, .cart-icon:hover, .search-icon:hover { color: #D4AF37; }
    }
    
    /* Navigation */
    .nav-link-custom { position: relative; text-decoration: none !important; color: white; transition: 0.3s; }
    .nav-link-custom::after { content: ''; position: absolute; width: 0; height: 2.5px; bottom: -4px; left: 0; background-color: var(--gold); transition: width 0.3s ease-in-out; }
    
    @media (min-width: 1024px) {
        .nav-link-custom:hover::after { width: 100%; }
        .nav-link-custom:hover { color: var(--gold); }
    }
    
    /* Marquee - Seamless horizontal scroll */
    #live-marquee { overflow: hidden; }
    .marquee-track { display: flex; width: fit-content; will-change: transform; white-space: nowrap; animation: marquee 90s linear infinite; }
    @media (max-width: 767px)                          { .marquee-track { animation-duration: 60s; } }
    @media (min-width: 768px) and (max-width: 1023px)  { .marquee-track { animation-duration: 75s; } }
    @media (min-width: 1024px)                         { .marquee-track { animation-duration: 90s; } }
    @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

    /* Animated gold border lines — top L→R, bottom R→L */
    .gold-border-top {
        height: 2px; width: 100%; overflow: hidden;
        background: linear-gradient(90deg, #3d2e00 0%, #7a5c00 15%, #D4AF37 35%, #fff8dc 50%, #D4AF37 65%, #7a5c00 85%, #3d2e00 100%);
        background-size: 200% 100%;
        animation: goldShineL2R 6s linear infinite;
    }
    .gold-border-bottom {
        height: 2px; width: 100%; overflow: hidden;
        background: linear-gradient(90deg, #3d2e00 0%, #7a5c00 15%, #D4AF37 35%, #fff8dc 50%, #D4AF37 65%, #7a5c00 85%, #3d2e00 100%);
        background-size: 200% 100%;
        animation: goldShineR2L 6s linear infinite;
    }
    @keyframes goldShineL2R {
        0%   { background-position: 100% 0; }
        100% { background-position: -100% 0; }
    }
    @keyframes goldShineR2L {
        0%   { background-position: -100% 0; }
        100% { background-position: 100% 0; }
    }
    
    /* Heart Button - Red outline on hover (not filled) */
    .heart-btn { border: none !important; border-radius: 999px; padding: 4px; display: inline-flex; align-items: center; justify-content: center; color: white; background: transparent; cursor: pointer; transition: all 0.3s ease; }
    
    .heart-btn i { 
        color: #ffffff; 
        transition: color 0.2s, transform 0.2s; 
        font-size: 1.2rem;
    }
    
    @media (min-width: 1024px) {
        .heart-btn:hover i { 
            color: #ef4444;
            transform: scale(1.1); 
        }
    }
    
    .heart-active { color: #ef4444 !important; }
    .heart-active i { color: #ef4444 !important; }
    
    /* Desktop CTA */
    .desktop-cta { display: none; }
    @media (min-width: 1024px) { 
        .desktop-cta { display: flex; flex-direction: column; gap: 12px; position: fixed; right: 24px; bottom: 24px; z-index: 6000; }
        .desktop-cta a { min-width: 160px; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 18px; border-radius: 999px; font-weight: 700; font-size: 0.875rem; text-decoration: none; transition: all 0.3s; }
        .desktop-cta a:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
    }
    
    /* Mobile Navigation Footer - Shows on < 1024px */
    .mobile-nav-footer { display: none; }
    @media (max-width: 1023px) { 
        .mobile-nav-footer { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 4999; background: white; border-top: 2px solid var(--gold); padding: 0.75rem 0; justify-content: space-around; align-items: center; height: 70px; }
        .mobile-nav-footer a { display: flex; flex-direction: column; align-items: center; text-decoration: none; color: var(--royal-green); font-size: 1.25rem; transition: color 0.3s; padding: 0.25rem; }
        .mobile-nav-footer a:hover { color: var(--gold); }
        .mobile-nav-footer span { font-size: 0.65rem; font-weight: bold; color: var(--royal-green); margin-top: 2px; }
        main { padding-bottom: 70px !important; }
        body { padding-bottom: 0 !important; }
    }
    
    /* Main Content Spacing */
    .main-content { min-height: calc(100vh - 110px); margin-top: 110px; }
    @media (max-width: 1023px) { .main-content { margin-top: 100px; min-height: calc(100vh - 100px); } }
    
    /* Item Cards */
    .item-card { 
        border: 2px solid #e5e7eb;
        transition: all 0.3s ease; 
        border-radius: 2rem; 
        padding: 1rem; 
        background: white; 
    }
    @media (min-width: 1024px) {
        .item-card { border: 3px solid transparent; }
        .item-card:hover { border-color: var(--gold); box-shadow: 0 10px 25px rgba(212, 175, 55, 0.3); transform: translateY(-4px); }
    }
    
    /* Category Cards */
    .category-card { 
        aspect-ratio: 1; 
        border-radius: 1.5rem; 
        overflow: hidden; 
        border: 2px solid #e5e7eb;
        transition: all 0.4s ease; 
        background: white; 
    }
    @media (min-width: 1024px) {
        .category-card { border: 3px solid transparent; }
        .category-card:hover { border-color: var(--gold); transform: translateY(-8px); box-shadow: 0 20px 40px rgba(212, 175, 55, 0.2); }
        .category-card:hover img { transform: scale(1.1); }
    }
    .category-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
    .category-name { margin-top: 0.75rem; font-weight: 700; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; transition: color 0.3s; }
    @media (min-width: 1024px) {
        .category-wrapper:hover .category-name { color: var(--gold); }
    }
    .categories-grid { 
        display: grid;
        grid-template-columns: repeat(9, 1fr); 
        gap: 1.5rem; 
    }
    
    @media (max-width: 768px) and (min-width: 425px) { 
        .categories-grid { grid-template-columns: repeat(3, 1fr) !important;} 
    }
    @media (max-width: 424px) { 
        .categories-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; } 
    }

    /* ── Trending Cards ────────────────────────────────── */
    .trending-container {
        overflow: hidden;
        position: relative !important;
        padding: 1rem 0;
        min-height: 200px;
        isolation: isolate;
    }
    .trending-container.hidden { display: none !important; }

    /* viewport element — no transition, no animation directly on it */
    .trending-track {
        overflow: hidden;
        width: 100%;
    }

    /* cards */
    .trending-card {
        min-width: 220px;
        max-width: 220px;
        width: 220px;
        background: white;
        border-radius: 1.5rem;
        overflow: hidden;
        border: 3px solid #e5e7eb;
        transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
        display: flex;
        flex-direction: column;
        position: relative;
        padding-bottom: 0.5rem;
    }
    @media (min-width: 1024px) {
        .trending-card { min-width: 240px; max-width: 260px;  margin-top: 5%}
        .trending-card:hover { border-color: var(--gold); transform: translateY(-4px); box-shadow: 0 8px 20px rgba(212,175,55,0.2); }
    }

    /* nav buttons */
    .trending-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 45px; height: 45px;
        background: var(--gold);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 1.2rem;
        cursor: pointer;
        z-index: 100;
        transition: all 0.3s;
        display: none;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .trending-nav-btn.prev { left: 10px; }
    .trending-nav-btn.next { right: 10px; }
    @media (max-width: 1023px) {
        .trending-nav-btn:hover { background: #c9a227; transform: translateY(-50%) scale(1.05); }
    }
    @media (min-width: 1024px) { .trending-nav-btn { display: none !important; } }

    .card-heart { 
        position: absolute; 
        top: 0.3rem; 
        right: 0.3rem; 
        z-index: 20; 
        background: rgba(255,255,255,0.85); 
        border: 1px solid #e5e7eb;
        width: 28px; 
        height: 28px; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        transition: all 0.3s; 
    }
    @media (min-width: 1024px) {
        .card-heart { border: none; }
        .card-heart:hover { transform: scale(1.15); background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    }
    .card-heart.heart-active { background: white; }
    .card-heart.heart-active i { color: #ef4444; }
    .card-heart i { font-size: 0.7rem; }

    .card-add-btn { 
        width: 100%;
        margin-top: auto;
        color: white; 
        border: none; 
        padding: 0;
        font-size: 0.65rem; 
        font-weight: 700; 
        cursor: pointer; 
        transition: all 0.3s;
    }
    .card-add-btn button {
        width: 100%;
        padding: 0.6rem;
        background: #064e3b;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: bold;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background 0.3s;
    }
    .card-add-btn button:hover { background: #065f46; }
    .card-add-btn .quantity-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border: 2px solid #064e3b;
        border-radius: 0.5rem;
        overflow: hidden;
    }
    .card-add-btn .quantity-controls button {
        flex: 1;
        padding: 0.5rem;
        background: #064e3b;
        color: white;
        border: none;
        border-radius: 0;
        font-weight: bold;
        font-size: 1rem;
        cursor: pointer;
    }
    .card-add-btn .quantity-controls span {
        flex: 1;
        text-align: center;
        font-weight: bold;
        color: #064e3b;
        font-size: 0.9rem;
    }

    /* Service Cards */
    .service-card { 
        background: white; 
        border: 2px solid #e5e7eb;
        border-radius: 1.5rem; 
        padding: 2rem; 
        transition: all 0.4s ease; 
        text-align: center; 
    }
    @media (min-width: 1024px) {
        .service-card { border: 3px solid transparent; }
        .service-card:hover { border-color: var(--gold); transform: translateY(-8px); box-shadow: 0 20px 40px rgba(212, 175, 55, 0.15); }
    }
    
    /* Shine Effect */
    .btn-call-shine { position: relative; overflow: hidden; }
    .btn-call-shine::after { content: ''; position: absolute; top: -50%; left: -100%; width: 50%; height: 200%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); transform: rotate(45deg); transition: 0.6s; }
    
    @media (min-width: 1024px) {
        .btn-call-shine:hover::after { left: 150%; }
    }
    
    /* Social Icons */
    .social-icon { transition: all 0.3s ease; display: inline-flex; align-items: center; justify-content: center; }
    
    @media (max-width: 1023px) {
        .social-icon { color: #1877f2 !important; }
        .social-icon:nth-child(1) { color: #1877f2 !important; }
        .social-icon:nth-child(2) { color:  #25d366!important; }
        .social-icon:nth-child(3) { color: #e1306c !important; }
        .social-icon:nth-child(4) { color: #ff0000  !important; }
        .social-icon:nth-child(5) { color: #ea4335 !important; }
    }
    
    @media (min-width: 1024px) {
        .social-icon:hover { transform: scale(1.15); }
        .social-icon:nth-child(1):hover { color: #1877f2 !important; }
        .social-icon:nth-child(2):hover { color: #25d366 !important; }
        .social-icon:nth-child(3):hover { color: #e1306c!important; }
        .social-icon:nth-child(4):hover { color: #ff0000 !important; }
        .social-icon:nth-child(5):hover { color: #ea4335 !important; }
    }
    
    /* Footer overlay with thin gold lines and shining effect */
    #footer { position: relative; overflow: hidden; }
    #footer::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            radial-gradient(circle at 5% 10%, rgba(212,175,55,0.15), transparent 25%),
            radial-gradient(circle at 95% 15%, rgba(212,175,55,0.12), transparent 30%),
            radial-gradient(circle at 50% 100%, rgba(212,175,55,0.1), transparent 35%),
            radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.05), transparent 60%),
            linear-gradient(225deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(212,175,55,0.06) 100%);
        pointer-events: none;
        z-index: 1;
        animation: footerShine 4s ease-in-out infinite;
    }
    
    @keyframes footerShine {
        0%, 100% { opacity: 1; }
        50% { opacity: 1.3; }
    }
    
    #footer::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
            repeating-linear-gradient(90deg, transparent 0, transparent 50px, rgba(212,175,55,0.08) 50px, rgba(212,175,55,0.08) 51px),
            repeating-linear-gradient(0deg, transparent 0, transparent 60px, rgba(212,175,55,0.06) 60px, rgba(212,175,55,0.06) 61px),
            repeating-linear-gradient(45deg, transparent 0, transparent 70px, rgba(212,175,55,0.05) 70px, rgba(212,175,55,0.05) 72px),
            repeating-linear-gradient(-45deg, transparent 0, transparent 70px, rgba(255,255,255,0.04) 70px, rgba(255,255,255,0.04) 72px);
        pointer-events: none;
        z-index: 1;
    }
    
    #footer > * { position: relative; z-index: 2; }
    
    /* Footer link hover effects */
    footer a { transition: color 0.3s ease, transform 0.3s ease; }
    @media (min-width: 1024px) {
        footer a:hover { color: #D4AF37 !important; transform: translateX(4px); }
    }
    
    /* Testimonials */
    .testimonial-carousel { position: relative; }
    .testimonial-btn { background: white; border: 2px solid var(--gold); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; font-size: 1.5rem; color: var(--gold); flex-shrink: 0; box-shadow: 0 2px 8px rgba(212,175,55,0.2); }
    @media (min-width: 1024px) {
        .testimonial-btn:hover { background: var(--gold); color: white; }
    }
    .testimonial-btn.prev { left: 10px; }
    .testimonial-btn.next { right: 10px; }
    .testimonial-slide { text-align: center; padding: 1.5rem 2rem; opacity: 0; position: absolute; top: 0; left: 0; width: 100%; transition: opacity 0.5s ease-in-out; visibility: hidden; pointer-events: none; }
.testimonial-slide.active { opacity: 1; position: relative; visibility: visible; pointer-events: auto; }
    
    /* Responsive */
    @media (max-width: 1023px) {
        .skj-text-wrapper { font-size: 2rem; }
        .nav-link-custom { font-size: 0.75rem; }
    }

    /* Header embossed effect with gold lines */
    header {
        position: relative;
        overflow: hidden;
    }
    
    header::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            radial-gradient(circle at 5% 10%, rgba(212,175,55,0.15), transparent 25%),
            radial-gradient(circle at 95% 15%, rgba(212,175,55,0.12), transparent 30%),
            radial-gradient(circle at 50% 100%, rgba(212,175,55,0.1), transparent 35%),
            radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.05), transparent 60%),
            linear-gradient(225deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(212,175,55,0.06) 100%);
        pointer-events: none;
        z-index: 1;
        animation: headerShine 4s ease-in-out infinite;
    }
    
    @keyframes headerShine {
        0%, 100% { opacity: 1; }
        50% { opacity: 1.3; }
    }
    
    header::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
            repeating-linear-gradient(90deg, transparent 0, transparent 50px, rgba(212,175,55,0.08) 50px, rgba(212,175,55,0.08) 51px),
            repeating-linear-gradient(0deg, transparent 0, transparent 60px, rgba(212,175,55,0.06) 60px, rgba(212,175,55,0.06) 61px),
            repeating-linear-gradient(45deg, transparent 0, transparent 70px, rgba(212,175,55,0.05) 70px, rgba(212,175,55,0.05) 72px),
            repeating-linear-gradient(-45deg, transparent 0, transparent 70px, rgba(255,255,255,0.04) 70px, rgba(255,255,255,0.04) 72px);
        pointer-events: none;
        z-index: 1;
    }
    
    header > * { position: relative; z-index: 2; } 

    /* 320px screens */
    @media (max-width: 320px) {
        .logo-container { width: 40px !important; }
        .nav-icon-btn { padding-right: 1rem; }
        .tagline-separator {
            display: inline-block;
            font-size: 50px !important;
            margin-left: -5px !important;
        }
        .logo-tagline-text {
            display:inline-block;
            font-size: 10px !important;
        }
        .nav-icons { margin-left:-5px; }
    }

    @media (max-width:1023px){
        .login-icon {display:none;}
    }
</style>
`;



// ===================== CATEGORY PRODUCT RENDERING =====================
async function renderCategoryProducts(category) {
    const container = document.getElementById('products-grid') || document.querySelector('.products-grid');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-emerald-700"></i><p class="mt-4 text-gray-600">Loading products...</p></div>';
    
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            throw new Error('Firebase not ready');
        }
        
        const db = firebase.firestore();
        const snapshot = await db.collection('products')
            .where('category', '==', category)
            .where('inStock', '==', true)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">No products available in this category.</p>';
            return;
        }
        
        // Get current prices for dynamic pricing
        const prices = cachedPrices || { gold: 6400, skjg: 6200, silver: 750 };
        
        let html = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">';
        
        for (const doc of snapshot.docs) {
            const product = { id: doc.id, ...doc.data() };
            
            // Calculate live price
            let price = product.offerPrice || product.price || 0;
            let dynamicBasePrice = null;
            if (product.metalType === 'gold' && product.weight && product.dynamicPricing !== false) {
                const ratePerGram = product.carat === '24CT' ? prices.gold : (prices.skjg || 6200);
                const makingCharges = (product.makingCharges || 0) * parseFloat(product.weight);
                const basePrice = Math.round((parseFloat(product.weight) * ratePerGram) + makingCharges);
                let discountAmt = product.discountAmount || 0;
                if (!discountAmt && product.discountPercent > 0) {
                    discountAmt = Math.round((basePrice * product.discountPercent) / 100);
                }
                dynamicBasePrice = basePrice;
                price = basePrice - discountAmt;
            } else if (product.metalType === 'silver' && product.weight && product.dynamicPricing !== false) {
                const ratePerGram = (prices.silver || 750) / 10;
                const makingCharges = (product.makingCharges || 0) * parseFloat(product.weight);
                const basePrice = Math.round((parseFloat(product.weight) * ratePerGram) + makingCharges);
                let discountAmt = product.discountAmount || 0;
                if (!discountAmt && product.discountPercent > 0) {
                    discountAmt = Math.round((basePrice * product.discountPercent) / 100);
                }
                dynamicBasePrice = basePrice;
                price = basePrice - discountAmt;
            }

            const image = product.images?.[0] || './images/placeholder.jpg';
            const name = product.name || 'Product';
            const originalPrice = dynamicBasePrice || product.originalPrice || price;
            const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
            
            // Check if in wishlist
            const inWishlist = wishlist.some(w => w.id === product.id);
            const heartClass = inWishlist ? 'fa-solid fa-heart heart-active' : 'fa-regular fa-heart';
            const heartColor = inWishlist ? '#ef4444' : '#ffffff';
            
            html += `
                <div class="item-card cursor-pointer group/item" data-product-id="${product.id}">
                    <div class="relative overflow-hidden rounded-[1.5rem] h-48 md:h-56 mb-4">
                        ${discount > 0 ? `<div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">${discount}% OFF</div>` : ''}
                        <button onclick="event.stopPropagation(); toggleWishlist(event, '${product.id}', '${name.replace(/'/g, "\\'")}', this)"
                            class="absolute top-3 right-3 z-20 text-2xl drop-shadow-md hover:scale-125 transition heart-btn ${inWishlist ? 'heart-active' : ''}">
                            <i class="${heartClass}" style="color: ${heartColor};"></i>
                        </button>
                        <img src="${image}" onerror="this.src='./images/placeholder.jpg'"
                            class="w-full h-full object-cover transition duration-500 group-hover/item:scale-110">
                    </div>
                    <h5 class="font-bold text-gray-800 text-sm md:text-base mb-1">${name}</h5>
                    <div class="flex items-baseline space-x-2 mb-3">
                        ${originalPrice > price ? `<span class="text-gray-400 text-xs line-through">₹${originalPrice.toLocaleString()}</span>` : ''}
                        <span class="text-amber-600 font-bold text-base md:text-lg">₹${price.toLocaleString()}</span>
                    </div>
                    <button onclick="addToCart('${product.id}', '${name.replace(/'/g, "\\'")}', ${price})"
                        class="bg-emerald-950 text-white w-full py-2 md:py-3 rounded-2xl font-bold uppercase text-xs hover:bg-emerald-800 transition">
                        Add to Cart
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (e) {
        console.error('Error rendering category products:', e);
        container.innerHTML = '<p class="text-center text-red-500 py-8">Error loading products. Please refresh.</p>';
    }
}
window.renderCategoryProducts = renderCategoryProducts;

// ===================== FUNCTIONS =====================

function initComponents() {
// Insert styles
const stylePlaceholder = document.getElementById('styles-placeholder');
if (stylePlaceholder) {
stylePlaceholder.innerHTML = sharedStyles;
} else {
const styleEl = document.createElement('div');
styleEl.innerHTML = sharedStyles;
document.head.appendChild(styleEl.firstElementChild);
}
// Insert header
const headerPlaceholder = document.getElementById('header-placeholder');
if (headerPlaceholder) {
    headerPlaceholder.innerHTML = siteHeader;
}
// Insert footer
const footerPlaceholder = document.getElementById('footer-placeholder');
if (footerPlaceholder) {
    footerPlaceholder.innerHTML = siteFooter;
}
// Insert mobile nav
const mobileNavPlaceholder = document.getElementById('mobile-nav-placeholder');
if (mobileNavPlaceholder) {
    mobileNavPlaceholder.innerHTML = mobileNavFooter;
}
// Insert desktop CTA
const ctaPlaceholder = document.getElementById('cta-placeholder');
if (ctaPlaceholder) {
    ctaPlaceholder.innerHTML = desktopCTA;
}
// Insert login panel only if not already in DOM
if (!document.getElementById('login-panel')) {
    const loginPanelEl = document.createElement('div');
    loginPanelEl.innerHTML = loginPanel;
    document.body.appendChild(loginPanelEl);
}
// Insert cart sidebar only if not already in DOM
if (!document.getElementById('cart-sidebar')) {
    document.body.insertAdjacentHTML('beforeend', cartSidebar);
}




// Hide cart/wishlist badges initially until auth is confirmed
document.addEventListener('DOMContentLoaded', () => {
    // Add class to hide badges initially
    const cartBadge = document.getElementById('cart-badge');
    const wishlistBadge = document.getElementById('wishlist-badge');
    
    if (cartBadge) cartBadge.style.visibility = 'hidden';
    if (wishlistBadge) wishlistBadge.style.visibility = 'hidden';
    
    // Show badges only after auth is stable
    const checkAuthStable = setInterval(() => {
        if (window._authStateStable) {
            if (cartBadge) cartBadge.style.visibility = 'visible';
            if (wishlistBadge) wishlistBadge.style.visibility = 'visible';
            clearInterval(checkAuthStable);
        }
    }, 100);
    
    // Timeout after 5 seconds to show badges anyway
    setTimeout(() => {
        clearInterval(checkAuthStable);
        if (cartBadge) cartBadge.style.visibility = 'visible';
        if (wishlistBadge) wishlistBadge.style.visibility = 'visible';
    }, 5000);
});





// Render prices
renderPrices();
// Update UI
updateCartUI();
updateWishlistUI();
// Initialize Firebase price listener
setTimeout(() => {
    initializeFirebasePriceListener();
}, 200);
// Initialize gold 24CT display toggle listener
setTimeout(() => {
    initGoldDisplayListener();
}, 300);
}

// Price rendering - Uses cached prices for instant display, updates via onSnapshot
// Price rendering - Uses cached prices for instant display, updates via onSnapshot
// NEVER shows "Loading prices" - uses fallback delay instead
function renderPrices(prices) {
    if (prices) {
        cachedPrices = prices;
        setPriceCookie(prices);
    }
    renderMarqueeContent(cachedPrices);
    // Notify pages that prices changed (e.g. re-render trending)
    if (typeof window.onPricesUpdated === 'function') {
        window.onPricesUpdated(cachedPrices);
    }
}

// Helper function to render marquee content
// Helper function to render marquee content
// Helper function to render marquee content
// Tracks 24CT visibility from Firebase settings
let _show24CT = false;

function renderMarqueeContent(prices) {
    const marquee = document.getElementById('live-marquee');
    if (!marquee) return;

    if (!prices) {
        marquee.innerHTML = '';
        return;
    }

    const gold24 = prices.gold || 0;
    const gold22 = prices.skjg || 0;
    const silver = prices.silver || 0;

    // Build single-line segments
    const seg24  = (_show24CT && gold24) ? `SKJ 24CT GOLD/GM: ₹${gold24.toLocaleString('en-IN')} <span style="color:#fbbf24;margin:0 12px; font-weight:900;">|</span>` : '';
    const seg22  = gold22  ? `SKJ 22CT GOLD/GM: ₹${gold22.toLocaleString('en-IN')} <span style="color:#fbbf24;margin:0 12px; font-weight:900;">|</span>` : '';
    const segSilver = silver ? `SKJ SILVER/10GM: ₹${silver.toLocaleString('en-IN')} <span style="color:#fbbf24;margin:0 12px; font-weight:900;">|</span>` : '';
    

    const content = seg24 + seg22 + segSilver ;
    if (!content) return;

    // One unit = all segments in a single inline row
    const unit = `<span style="white-space:nowrap;padding:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">${content}</span>`;

    // Repeat 20 times for seamless infinite scroll — first 10 = visible, last 10 = the looping clone
    marquee.innerHTML = `<div class="marquee-track">${unit.repeat(20)}</div>`;
}

// Real-time Firebase listener for goldDisplayEnabled toggle from dashboard
function initGoldDisplayListener() {
    const tryListen = () => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return false;
        try {
            firebase.firestore().collection('settings').doc('dashboard').onSnapshot((docSnap) => {
                if (!docSnap.exists) return;
                const enabled = docSnap.data().goldDisplayEnabled === true;
                if (enabled !== _show24CT) {
                    _show24CT = enabled;
                    renderMarqueeContent(cachedPrices);
                }
            });
            return true;
        } catch(e) { return false; }
    };
    if (!tryListen()) {
        const retry = setInterval(() => { if (tryListen()) clearInterval(retry); }, 500);
        setTimeout(() => clearInterval(retry), 10000);
    }
}

// UPDATED: Firebase real-time price listener with 10s delay fallback

// Firebase real-time price listener using onSnapshot
function initializeFirebasePriceListener() {
    if (firebasePricesInitialized) return;

    // Show cookie-cached prices immediately while waiting for Firebase
    if (cachedPrices) renderMarqueeContent(cachedPrices);

    const tryListen = () => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return false;
        try {
            const db = firebase.firestore();
            priceUnsubscribe = db.collection('prices').doc('current').onSnapshot((docSnap) => {
                if (docSnap.exists) {
                    const data = docSnap.data();
                    const prices = {
                        gold: data.goldMarketPrice || 0,   // 24CT
                        skjg: data.goldSKJPrice || 0,      // 22CT
                        silver: data.silverMarketPrice || 0 // Silver
                    };
                    console.log('✅ Prices from Firebase:', prices);
                    if (prices.gold || prices.skjg || prices.silver) {
                        renderPrices(prices);
                    }
                }
            }, (err) => { console.error('Price listener error:', err); });
            firebasePricesInitialized = true;
            return true;
        } catch(e) { return false; }
    };

    if (!tryListen()) {
        const retry = setInterval(() => {
            if (tryListen()) clearInterval(retry);
        }, 300);
        setTimeout(() => clearInterval(retry), 8000);
    }
}

// Clean up listener when page unloads (optional but good practice)
window.addEventListener('beforeunload', () => {
    if (priceUnsubscribe) {
        priceUnsubscribe();
    }
});


function handleSearch(e) {
    if (e) e.preventDefault();
    const searchInput = document.getElementById('searchInput') || document.getElementById('mobileSearchInput');
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return;
    
    const categories = ['rings', 'chains', 'bracelets', 'harams', 'earrings', 'bangles'];
    for (const c of categories) {
        if (q === c || q.includes(c)) {
            const rest = q.replace(c, '').trim();
            const params = rest ? ('?q=' + encodeURIComponent(rest)) : '';
            window.location.href = c + '.html' + params;
            return;
        }
    }
    window.location.href = 'search.html?q=' + encodeURIComponent(q);
}

// Gold Safety check - reads from Firebase settings and shows confirmation popup
async function checkGoldSafetyBeforeAdd(id, name, callback, heartBtn = null) {
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            callback(true); return;
        }
        const db = firebase.firestore();
        const [settingsDoc, productDoc] = await Promise.all([
            db.collection('settings').doc('dashboard').get(),
            db.collection('products').doc(id).get()
        ]);
        const globalEnabled = settingsDoc.exists && settingsDoc.data().goldSafetyEnabled === true;
        const productSafetyEnabled = productDoc.exists && productDoc.data().safetyEnabled === true;
        if (globalEnabled && productSafetyEnabled) {
            const confirmed = await showSafetyConfirmation();
            if (confirmed) {
                const idx = wishlist.findIndex(w => w.id === id);
                if (idx < 0) {
                    wishlist.push({ id, name });
                    localStorage.setItem('wishlist', JSON.stringify(wishlist));
                    updateWishlistUI();
                    showSuccessMessage('Item added to wishlist!');
                }
                // Instantly activate heart button on the card
                if (heartBtn) {
                    const icon = heartBtn.querySelector('i');
                    if (icon) { icon.classList.remove('fa-regular'); icon.classList.add('fa-solid'); icon.style.color = '#ef4444'; }
                    heartBtn.classList.add('heart-active');
                } else {
                    // Find heart btn by product id on the card
                    const cardHeart = document.querySelector(`.card-heart[data-id="${id}"]`);
                    if (cardHeart) {
                        const icon = cardHeart.querySelector('i');
                        if (icon) { icon.classList.remove('fa-regular'); icon.classList.add('fa-solid'); icon.style.color = '#ef4444'; }
                        cardHeart.classList.add('heart-active');
                    }
                }
            }
            callback(false);
        } else {
            callback(true);
        }
    } catch (err) {
        console.warn('Safety check error:', err);
        callback(true);
    }
}


function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.getAttribute('data-open') === 'true';
    if (isOpen) {
        sidebar.style.transform = 'translateX(110%)';
        sidebar.style.visibility = 'hidden';
        sidebar.setAttribute('data-open', 'false');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    } else {
        sidebar.style.visibility = 'visible';
        sidebar.style.transform = 'translateX(0%)';
        sidebar.setAttribute('data-open', 'true');
        if (overlay) overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
        renderCartItems();
    }
}
window.toggleCart = toggleCart;

function renderCartItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    const keys = Object.keys(cart);
    if (keys.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#9ca3af;margin-top:2rem;font-style:italic;">Your bag is empty</p>';
        document.getElementById('cart-total-qty') && (document.getElementById('cart-total-qty').textContent = '0');
        document.getElementById('cart-total') && (document.getElementById('cart-total').textContent = '₹0');
        document.getElementById('cart-original-price') && (document.getElementById('cart-original-price').textContent = '₹0');
        document.getElementById('cart-discount') && (document.getElementById('cart-discount').textContent = '₹0');
        return;
    }
    let totalQty = 0, totalPrice = 0, totalOriginal = 0;
    container.innerHTML = keys.map(id => {
        const item = cart[id];
        totalQty += item.qty || 1;
        totalPrice += (item.p || 0) * (item.qty || 0);
        totalOriginal += (item.op || item.originalPrice || item.p || 0) * (item.qty || 1);
        return `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid #e5e7eb;${item.outOfStock ? 'opacity:0.6;' : ''}">
            <div style="flex:1;">
                <p style="font-weight:600;font-size:0.875rem;margin:0 0 0.25rem;">${item.name || item.n || 'Item'}</p>
                ${item.outOfStock ? '<span style="font-size:0.7rem;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;font-weight:600;">OUT OF STOCK</span>' : ''}
                <p style="color:#064e3b;font-weight:700;margin:0;">₹${((item.p||0)*(item.qty||1)).toLocaleString('en-IN')}</p>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <button onclick="changeCartQty('${id}',-1)" style="width:28px;height:28px;border-radius:50%;border:2px solid #064e3b;background:white;color:#064e3b;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
                <span style="font-weight:700;min-width:20px;text-align:center;">${item.qty||0}</span>
                <button onclick="changeCartQty('${id}',1)" style="width:28px;height:28px;border-radius:50%;border:2px solid #064e3b;background:#064e3b;color:white;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
            </div>
        </div>`;
    }).join('');
    const discount = totalOriginal - totalPrice;
    document.getElementById('cart-total-qty') && (document.getElementById('cart-total-qty').textContent = totalQty);
    document.getElementById('cart-total') && (document.getElementById('cart-total').textContent = '₹' + totalPrice.toLocaleString('en-IN'));
    document.getElementById('cart-original-price') && (document.getElementById('cart-original-price').textContent = '₹' + totalOriginal.toLocaleString('en-IN'));
    document.getElementById('cart-discount') && (document.getElementById('cart-discount').textContent = discount > 0 ? '₹' + discount.toLocaleString('en-IN') : '₹0');
}
window.renderCartItems = renderCartItems;

function changeCartQty(id, delta) {
    if (!cart[id]) return;
    cart[id].qty = (cart[id].qty || 1) + delta;
    if (cart[id].qty <= 0) delete cart[id];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    renderCartItems();
    saveUserCartAndWishlist(); // sync to Firebase
}
window.changeCartQty = changeCartQty;

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    
    let count = 0;
    for (let id in cart) {
        count += cart[id].qty || 0;
    }
    
    if (count > 0) {
        badge.style.display = 'flex';
        badge.innerText = count > 99 ? '99+' : count;
    } else {
        badge.style.display = 'none';
    }
}

function updateWishlistUI() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) return;
    
    const count = wishlist.length;
    if (count > 0) {
        badge.style.display = 'flex';
        badge.innerText = count > 99 ? '99+' : count;
    } else {
        badge.style.display = 'none';
    }
}

// ===================== LOGIN PANEL FUNCTIONS =====================
function toggleLoginPanel() {
    const panel = document.getElementById('login-panel');
    const overlay = document.getElementById('login-panel-overlay');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        panel.classList.add('translate-x-full');
        if (overlay) overlay.style.display = 'none';
    } else {
        panel.classList.add('open');
        panel.classList.remove('translate-x-full');
        if (overlay) overlay.style.display = 'block';
    }
}

async function panelLogin() {
    const email = document.getElementById('panel-email')?.value?.trim();
    const password = document.getElementById('panel-password')?.value;
    const errEl = document.getElementById('login-panel-error');
    if (!email || !password) {
        if (errEl) { errEl.textContent = 'Please enter email and password.'; errEl.classList.remove('hidden'); }
        return;
    }
    try {
        if (errEl) errEl.classList.add('hidden');
        // Use Firebase auth compat (available from index.html script tag)
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            updateLoginPanelUI(user);
        } else {
            // Try module auth
            const { getAuth, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            const auth = getAuth();
            await signInWithEmailAndPassword(auth, email, password);
        }
        // onAuthStateChanged will update UI
    } catch (err) {
        if (errEl) { errEl.textContent = err.message || 'Login failed.'; errEl.classList.remove('hidden'); }
    }
}

async function panelLogout() {
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
        } else {
            const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            await signOut(getAuth());
        }
    } catch (err) { console.error('Logout error:', err); }
}

function updateLoginPanelUI(user) {
    const formDiv = document.getElementById('login-panel-form');
    const userDiv = document.getElementById('login-panel-user');
    const titleEl = document.getElementById('login-panel-title');
    const mobileLabel = document.getElementById('mobile-login-label');
    const mobileIcon = document.getElementById('mobile-login-icon');
    const mobileBtn = document.getElementById('mobile-login-btn');
    
    // Find ALL login icons
    const navIcons = document.querySelectorAll('.login-icon i, #mobile-login-btn i');

    if (user) {
        // LOGGED IN
        window._currentUser = user;

        // CHECK FOR ADMIN ROLE - REDIRECT TO DASHBOARD
    firebase.firestore().collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const userData = doc.data();
            if (userData.role === 'admin') {
                console.log('✅ Admin detected - redirecting to dashboard');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                return;
            }
        }
    }).catch(e => console.warn('Could not check user role:', e));
        
        if (formDiv) formDiv.classList.add('hidden');
        if (userDiv) userDiv.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'My Account';
        
        // Get display name
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        
        const nameEl = document.getElementById('panel-user-name');
        const emailEl = document.getElementById('panel-user-email');
        if (nameEl) nameEl.textContent = displayName; // Show name, not email
        if (emailEl) emailEl.textContent = user.email || ''; // Show email separately
        
        if (mobileLabel) mobileLabel.textContent = 'Account';
        
        // GOLD icons for logged in
        navIcons.forEach(icon => {
            icon.classList.remove('fa-regular', 'fa-user');
            icon.classList.add('fa-solid', 'fa-user-check');
            icon.style.color = '#D4AF37';
        });
        
        if (mobileIcon) {
            mobileIcon.classList.remove('fa-regular', 'fa-user');
            mobileIcon.classList.add('fa-solid', 'fa-user-check');
            mobileIcon.style.color = '#D4AF37';
        }
        
        if (mobileBtn) {
            mobileBtn.onclick = (e) => { e.preventDefault(); toggleLoginPanel(); };
        }

    } else {
        // LOGGED OUT
        window._currentUser = null;
        
        if (formDiv) formDiv.classList.remove('hidden');
        if (userDiv) userDiv.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Sign In';
        if (mobileLabel) mobileLabel.textContent = 'Login';
        
        // WHITE icons for logged out
        navIcons.forEach(icon => {
            icon.classList.remove('fa-solid', 'fa-user-check');
            icon.classList.add('fa-regular', 'fa-user');
            icon.style.color = '#ffffff';
        });
        
        if (mobileIcon) {
            mobileIcon.classList.remove('fa-solid', 'fa-user-check');
            mobileIcon.classList.add('fa-regular', 'fa-user');
            mobileIcon.style.color = '';
        }
        
        if (mobileBtn) {
            mobileBtn.onclick = (e) => { e.preventDefault(); toggleLoginPanel(); };
        }

        // Load remembered email
        const rememberedEmail = localStorage.getItem('skj_remembered_email');
        const emailInput = document.getElementById('panel-email');
        if (rememberedEmail && emailInput) {
            emailInput.value = rememberedEmail;
            const rememberCheck = document.getElementById('panel-remember');
            if (rememberCheck) rememberCheck.checked = true;
        }
    }
}

// Listen for auth state changes

window.toggleLoginPanel = toggleLoginPanel;
window.panelLogin = panelLogin;
window.panelLogout = panelLogout;
/**
 * Scrolls the trending items section left or right
 */
// NEW: Initialize trending section visibility and behavior
function initTrendingSection() {
    const trendingContainer = document.getElementById('trending-container');
    const trendingTrack = document.querySelector('.trending-track');
    const trendingItems = document.querySelectorAll('.trending-card');
    const prevBtn = document.querySelector('.trending-nav-btn.prev');
    const nextBtn = document.querySelector('.trending-nav-btn.next');
    
    if (!trendingContainer || !trendingTrack) return;
    
    // Hide section if no trending items
    if (trendingItems.length === 0) {
        trendingContainer.classList.add('hidden');
        return;
    }
    
    // Show section if items exist
    trendingContainer.classList.remove('hidden');
    
    // Check layout and apply appropriate behavior
    function checkTrendingLayout() {
        const containerWidth = trendingContainer.offsetWidth;
        const contentWidth = trendingTrack.scrollWidth;
        const isDesktop = window.innerWidth >= 1024;
        
        // Reset classes
        trendingTrack.classList.remove('auto-scroll', 'manual-scroll');
        trendingContainer.classList.remove('manual-mode');
        
        if (contentWidth > containerWidth) {
            // Overflow detected
            if (isDesktop) {
                // Desktop: Auto-scroll
                trendingTrack.classList.add('auto-scroll');
            } else {
                // Mobile: Manual scroll with arrows
                trendingTrack.classList.add('manual-scroll');
                trendingContainer.classList.add('manual-mode');
            }
        }
        // If no overflow, items stay centered (default CSS)
    }
    
    // Initial check
    checkTrendingLayout();
    
    // Re-check on resize
    window.addEventListener('resize', checkTrendingLayout);
    
    // Manual scroll arrows (mobile only)
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            trendingTrack.scrollBy({ left: -300, behavior: 'smooth' });
        });
        nextBtn.addEventListener('click', () => {
            trendingTrack.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }
}

// UPDATED: Original scroll function
// Scroll trending items (mobile manual scroll)
function scrollTrendingItems(direction) {
    const track = document.querySelector('.trending-track');
    if (!track) return;
    const firstCard = track.querySelector('.trending-card');
    const cardWidth = firstCard ? (firstCard.offsetWidth + 16) : 240;
    track.scrollBy({ left: direction * cardWidth, behavior: 'smooth' });
}
window.scrollTrendingItems = scrollTrendingItems;
window.initTrendingSection = initTrendingSection;
function openLoginSidebar(message) {
    const panel = document.getElementById('login-panel');
    if (panel) {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
        const overlay = document.getElementById('login-panel-overlay');
        if (overlay) overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (message) showToast(message, 'info');
    }
}
window.openLoginSidebar = openLoginSidebar;


function isUserLoggedIn() {
    return !!_currentUser;
}

window.toggleWishlist = async function(event, id, name, btnElement = null) {
    if (event) event.stopPropagation();
    
    // Check login state
    if (!isUserLoggedIn()) {
        openLoginSidebar('Please login to add items to wishlist ❤️');
        return;
    }
    
    const idx = wishlist.findIndex(w => w.id === id);
    
    if (idx >= 0) {
        // REMOVE from wishlist
        wishlist.splice(idx, 1);
        
        // Update UI
        updateAllHeartButtons(id, false);
        showToast('Removed from wishlist', 'info');
        
        // If on wishlist page, animate removal
        if (window.location.pathname.includes('wishlist.html')) {
            const card = document.querySelector(`[data-wishlist-id="${id}"]`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => renderWishlistPage(), 300);
            } else {
                renderWishlistPage();
            }
        }
        
    } else {
        // ADD to wishlist - fetch full product data
        let productData = { 
            id: id, 
            name: name,
            addedAt: new Date().toISOString()
        };
        
        try {
            const db = firebase.firestore();
            const productDoc = await db.collection('products').doc(id).get();
            if (productDoc.exists) {
                const data = productDoc.data();
                const livePrice = await calculateLivePrice(data);
                
                // Build clean object with NO undefined values
                productData = {
                    id: id,
                    name: data.name || name,
                    images: data.images || [],
                    offerPrice: livePrice || data.offerPrice || data.price || 0,
                    originalPrice: data.originalPrice || 0,
                    weight: data.weight ? String(data.weight) : '0',
                    discountPercent: data.discountPercent || 0,
                    inStock: data.inStock !== false,
                    category: data.category || 'rings',
                    metalType: data.metalType || null,
                    carat: data.carat || null,
                    dynamicPricing: data.dynamicPricing === true,
                    makingCharges: data.makingCharges || 0,
                    addedAt: new Date().toISOString()
                };
                
                // Remove null values to prevent Firebase errors
                Object.keys(productData).forEach(key => {
                    if (productData[key] === undefined) {
                        delete productData[key];
                    }
                });
            }
        } catch(e) {
            console.warn('Could not fetch product data for wishlist:', e);
        }
        
        wishlist.push(productData);
        updateAllHeartButtons(id, true);
        showToast('Added to wishlist ❤️', 'success');
    }
    
    // Save to localStorage and Firebase
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
    
    try {
        await saveUserCartAndWishlist();
    } catch(e) {
        console.error('Failed to save wishlist:', e);
        showToast('Failed to sync wishlist', 'error');
    }
}

// Helper to update all heart buttons for a product
function updateAllHeartButtons(id, isWishlisted) {
    document.querySelectorAll(`[data-product-id="${id}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (!icon) return;
        
        if (isWishlisted) {
            btn.classList.add('active', 'heart-active');
            icon.classList.remove('fa-regular', 'fa-user');
            icon.classList.add('fa-solid', 'fa-heart');
            icon.style.color = '#ef4444';
        } else {
            btn.classList.remove('active', 'heart-active');
            icon.classList.remove('fa-solid', 'fa-heart');
            icon.classList.add('fa-regular', 'fa-heart');
            icon.style.color = '#ffffff';
        }
    });
}
window.saveUserCartAndWishlist = saveUserCartAndWishlist;


// AFTER:
async function renderWishlistPage() {
    const container = document.getElementById('wishlist-container');
    const empty = document.getElementById('empty-wishlist');

    if (!container) return;

    if (wishlist.length === 0) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';

    // Fetch real product data from Firebase
    let productMap = {};
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const ids = wishlist.map(w => w.id);
            // Firestore 'in' query supports up to 30 items at once
            for (let i = 0; i < ids.length; i += 10) {
                const chunk = ids.slice(i, i + 10);
                const snap = await db.collection('products').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                snap.forEach(doc => { productMap[doc.id] = { id: doc.id, ...doc.data() }; });
            }
        }
    } catch(e) { console.warn('Could not fetch wishlist products:', e); }

    // Get current prices
    const latestPrices = (typeof cachedPrices !== 'undefined' && cachedPrices)
        ? cachedPrices
        : { gold: 6400, skjg: 6200, skjs: 750, silver: 750 };

    container.innerHTML = wishlist.map(item => {
        const product = productMap[item.id] || null;

        // Calculate real prices
        let offerPrice, originalPrice, discount, mainImage;
        if (product) {
            offerPrice = product.offerPrice || product.price || 0;
            originalPrice = product.originalPrice || offerPrice;

            if (product.metalType === 'gold' && product.weight && product.dynamicPricing !== false) {
                const ratePerGram = product.carat === '24CT' ? latestPrices.gold : (latestPrices.skjg || 6200);
                const makingCharges = (product.makingCharges || 0) * product.weight;
                const basePrice = Math.round((product.weight * ratePerGram) + makingCharges);
                let discountAmt = product.discountAmount || 0;
                if (!discountAmt && product.discountPercent > 0) {
                    discountAmt = Math.round((basePrice * product.discountPercent) / 100);
                }
                originalPrice = basePrice;
                offerPrice = basePrice - discountAmt;
            } else if (product.metalType === 'silver' && product.weight && product.dynamicPricing !== false) {
                const ratePerGram = (latestPrices.skjs || latestPrices.silver || 750) / 10;
                const makingCharges = (product.makingCharges || 0) * product.weight;
                const basePrice = Math.round((product.weight * ratePerGram) + makingCharges);
                let discountAmt = product.discountAmount || 0;
                if (!discountAmt && product.discountPercent > 0) {
                    discountAmt = Math.round((basePrice * product.discountPercent) / 100);
                }
                originalPrice = basePrice;
                offerPrice = basePrice - discountAmt;
            }

            discount = originalPrice > offerPrice ? Math.round(((originalPrice - offerPrice) / originalPrice) * 100) : 0;
            mainImage = product.images && product.images.length > 0
                ? product.images[product.mainImageIndex || 0]
                : 'https://via.placeholder.com/500x400?text=No+Image';
        } else {
            // Fallback if product not found in Firebase
            offerPrice = 0;
            originalPrice = 0;
            discount = 0;
            mainImage = 'https://via.placeholder.com/500x400?text=No+Image';
        }

        const qty = (typeof cart !== 'undefined' && cart[item.id]) ? cart[item.id].qty : 0;
        const safeName = (item.name || '').replace(/'/g, "\\'");

        const cartBtnHtml = qty > 0
            ? `<div class="flex items-center justify-between border-2 border-emerald-950 rounded-2xl overflow-hidden w-full h-12 wishlist-cart-ctrl" data-item-id="${item.id}">
                <button onclick="event.stopPropagation(); wishlistUpdateQty('${item.id}', -1, ${offerPrice}, ${originalPrice}, '${safeName}')" class="flex-1 h-full bg-emerald-950 text-white font-bold text-xl">−</button>
                <span class="flex-1 text-center font-bold text-emerald-950 text-lg">${qty}</span>
                <button onclick="event.stopPropagation(); wishlistUpdateQty('${item.id}', 1, ${offerPrice}, ${originalPrice}, '${safeName}')" class="flex-1 h-full bg-emerald-950 text-white font-bold text-xl">+</button>
               </div>`
            : `<button onclick="event.stopPropagation(); wishlistUpdateQty('${item.id}', 1, ${offerPrice}, ${originalPrice}, '${safeName}')"
                class="bg-emerald-950 text-white w-full py-3 md:py-4 rounded-2xl font-bold uppercase text-xs hover:bg-emerald-800 transition wishlist-cart-ctrl" data-item-id="${item.id}">
                Add to Cart
               </button>`;

        return `
            <div class="item-card cursor-pointer group/item" data-wishlist-id="${item.id}">
                <div class="relative overflow-hidden rounded-[1.5rem] h-56 md:h-64 mb-4">
                    ${discount > 0 ? `<div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">${discount}% OFF</div>` : ''}
                    <button onclick="event.stopPropagation(); toggleWishlist(event, '${item.id}', '${safeName}', this)"
                        class="absolute top-3 right-3 z-20 text-2xl drop-shadow-md hover:scale-125 transition heart-active heart-btn">
                        <i class="fa-solid fa-heart" style="color: #ef4444;"></i>
                    </button>
                    <img src="${mainImage}"
                        onerror="this.src='https://via.placeholder.com/500x400?text=No+Image'"
                        class="w-full h-full object-cover transition duration-500 group-hover/item:scale-110">
                </div>
                <h5 class="font-bold text-gray-800 text-base md:text-lg mb-1">${item.name}</h5>
                <div class="flex items-baseline space-x-2 md:space-x-3 mb-3">
                    ${originalPrice > offerPrice ? `<span class="text-gray-400 text-xs md:text-sm line-through">₹${originalPrice.toLocaleString()}</span>` : ''}
                    <span class="text-amber-600 font-bold text-lg md:text-xl">₹${offerPrice.toLocaleString()}</span>
                </div>
                ${cartBtnHtml}
            </div>
        `;
    }).join('');
}

// Helper used by wishlist page to update cart qty and refresh the button in-place
window.wishlistUpdateQty = function(id, delta, price, originalPrice, name) {
    if (!isUserLoggedIn()) {
        openLoginSidebar('Please login to add items to cart 🛍️');
        return;
    }
    const currentQty = (cart[id]?.qty || 0);
    const newQty = currentQty + delta;
    if (newQty <= 0) {
        delete cart[id];
    } else {
        cart[id] = { qty: newQty, n: name, name, p: price, op: originalPrice };
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    saveUserCartAndWishlist();
    updateCartUI();
    if (typeof updateCartItemsList === 'function') updateCartItemsList();

    // Update just this item's button in the wishlist page without full re-render
    const card = document.querySelector(`.item-card[data-wishlist-id="${id}"]`);
    if (card) {
        const ctrlArea = card.querySelector('.wishlist-cart-ctrl, [data-item-id]');
        const safeName = name.replace(/'/g, "\\'");
        if (newQty > 0) {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between border-2 border-emerald-950 rounded-2xl overflow-hidden w-full h-12 wishlist-cart-ctrl';
            div.setAttribute('data-item-id', id);
            div.innerHTML = `
                <button onclick="event.stopPropagation(); wishlistUpdateQty('${id}', -1, ${price}, ${originalPrice}, '${safeName}')" class="flex-1 h-full bg-emerald-950 text-white font-bold text-xl">−</button>
                <span class="flex-1 text-center font-bold text-emerald-950 text-lg">${newQty}</span>
                <button onclick="event.stopPropagation(); wishlistUpdateQty('${id}', 1, ${price}, ${originalPrice}, '${safeName}')" class="flex-1 h-full bg-emerald-950 text-white font-bold text-xl">+</button>
            `;
            if (ctrlArea) ctrlArea.replaceWith(div);
        } else {
            const btn = document.createElement('button');
            btn.className = 'bg-emerald-950 text-white w-full py-3 md:py-4 rounded-2xl font-bold uppercase text-xs hover:bg-emerald-800 transition wishlist-cart-ctrl';
            btn.setAttribute('data-item-id', id);
            btn.setAttribute('onclick', `event.stopPropagation(); wishlistUpdateQty('${id}', 1, ${price}, ${originalPrice}, '${safeName}')`);
            btn.textContent = 'Add to Cart';
            if (ctrlArea) ctrlArea.replaceWith(btn);
        }
    }
};

async function addToCart(id, name, price, safetyEnabled = false) {
    if (safetyEnabled && window.db) {
        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const settingsRef = doc(window.db, 'settings', 'dashboard');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists() && settingsSnap.data().goldSafetyEnabled) {
                const confirmed = await showSafetyConfirmation();
                if (confirmed) {
                    toggleWishlist(id, name, null);
                    showSuccessMessage('Item added to wishlist!');
                    return;
                } else {
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking safety settings:', error);
        }
    }
    
    const op = arguments[3]; // accept optional originalPrice param
    cart[id] = { qty: (cart[id]?.qty || 0) + 1, n: name, name, p: price, op };
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    
    const btn = event?.target;
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = 'Added!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('bg-green-600');
        }, 1500);
    }
}

function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] flex items-center gap-2';
    toast.style.animation = 'slideInRight 0.3s ease';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showSafetyConfirmation() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4';
        modal.style.animation = 'fadeIn 0.3s ease';
        
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full mx-4 text-center shadow-2xl" style="animation: scaleIn 0.3s ease;">
                <div class="mb-4">
                    <div class="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-exclamation-triangle text-4xl text-amber-500"></i>
                    </div>
                </div>
                <!--<h3 class="text-xl md:text-2xl font-bold mb-3 text-gray-800">Safety Mode Active</h3>-->
                <p class="text-sm md:text-base text-gray-600 mb-6 leading-relaxed">
                    Sorry, this item is not purchasable at this moment of time.
                    <br><br>
                    <strong class="text-gray-800">Do You Want To Add This Item To Wishlist?</strong>
                </p>
                <div class="flex flex-col sm:flex-row gap-3">
                    <button id="safety-cancel-btn" 
                            class="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm md:text-base">
                        No, Cancel
                    </button>
                    <button id="safety-confirm-btn" 
                            class="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition text-sm md:text-base">
                        Yes, Add to Wishlist
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('safety-cancel-btn').addEventListener('click', () => {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
                resolve(false);
            }, 300);
        });
        
        document.getElementById('safety-confirm-btn').addEventListener('click', () => {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
                resolve(true);
            }, 300);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    modal.remove();
                    resolve(false);
                }, 300);
            }
        });
    });
}

// Sync across tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'wishlist') {
        wishlist = JSON.parse(e.newValue) || [];
        updateWishlistUI();
        if (window.location.pathname.includes('wishlist.html')) {
            renderWishlistPage();
        }
    }
    if (e.key === 'cart') {
        cart = JSON.parse(e.newValue) || {};
        updateCartUI();
    }
    if (e.key === 'skj_prices') {
        renderPrices();
    }
});

// Initialize on DOM ready
// AFTER:

// Auth state tracking - SINGLE DECLARATION ONLY
if (typeof window._authStateStable === 'undefined') window._authStateStable = false;
if (typeof window._authCheckCount === 'undefined') window._authCheckCount = 0;
if (typeof window._maxAuthChecks === 'undefined') window._maxAuthChecks = 6;
if (typeof window._authCheckInterval === 'undefined') window._authCheckInterval = 500;
if (typeof window._intentionalLogout === 'undefined') window._intentionalLogout = false;
if (typeof window._loginProcessed === 'undefined') window._loginProcessed = false;
if (typeof window._logoutProcessed === 'undefined') window._logoutProcessed = false;


function initAuthListener() {
    const tryInit = () => {
        if (typeof firebase === 'undefined' || !firebase.auth) return false;
        if (_authListenerRegistered) return true;
        
        try {
            _authListenerRegistered = true;
            
            firebase.auth().onAuthStateChanged(async (user) => {
                const currentCheck = ++checkCount;
                console.log(`🔥 Auth check #${currentCheck}:`, user ? user.email : 'null');
                
                // Clear pending stabilization
                if (stabilizationTimer) {
                    clearTimeout(stabilizationTimer);
                    stabilizationTimer = null;
                }
                
                if (user) {
                    // User detected - wait for stabilization
                    lastUser = user;
                    
                    stabilizationTimer = setTimeout(async () => {
                        const stillUser = firebase.auth().currentUser;
                        
                        if (stillUser && stillUser.uid === lastUser.uid) {
                            console.log('✅ Auth STABLE - logged in:', stillUser.email);
                            window._authStateStable = true;
                            _currentUser = stillUser;
                            await processConfirmedLogin(stillUser);
                        } else {
                            console.log('⚠️ User changed during stabilization');
                        }
                    }, window._authCheckInterval);
                    
                } else {
                    // No user - handle logout or flicker
                    
                    if (window._intentionalLogout) {
                        console.log('✅ Intentional logout confirmed');
                        window._intentionalLogout = false;
                        window._authStateStable = true;
                        _currentUser = null;
                        await processConfirmedLogout();
                        return;
                    }
                    
                    // Possible flicker if we had a user before
                    if (lastUser && currentCheck < window._maxAuthChecks) {
                        console.log(`⏳ Possible flicker (${currentCheck}/${window._maxAuthChecks})`);
                        
                        stabilizationTimer = setTimeout(async () => {
                            const restoredUser = firebase.auth().currentUser;
                            
                            if (restoredUser) {
                                console.log('✅ Auth restored:', restoredUser.email);
                                window._authStateStable = true;
                                _currentUser = restoredUser;
                                await processConfirmedLogin(restoredUser);
                            } else if (checkCount >= window._maxAuthChecks) {
                                console.log('✅ Confirmed logout after max checks');
                                window._authStateStable = true;
                                _currentUser = null;
                                await processConfirmedLogout();
                            }
                        }, window._authCheckInterval);
                        
                    } else if (currentCheck >= window._maxAuthChecks || !lastUser) {
                        // Confirmed no user
                        console.log('✅ Confirmed no user');
                        window._authStateStable = true;
                        _currentUser = null;
                        await processConfirmedLogout();
                    }
                }
            });

            // Set persistence
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => console.log('✅ Auth persistence: LOCAL'))
                .catch(e => console.warn('Persistence error:', e));

            return true;
            
        } catch(e) { 
            _authListenerRegistered = false; 
            console.error('Auth init error:', e);
            return false; 
        }
    };

    if (!tryInit()) {
        const retry = setInterval(() => { 
            if (tryInit()) clearInterval(retry); 
        }, 300);
        setTimeout(() => clearInterval(retry), 10000);
    }
}

async function processConfirmedLogin(user) {
    if (window._loginProcessed) {
        console.log('Login already processed');
        return;
    }
    window._loginProcessed = true;
    window._logoutProcessed = false;
    
    console.log('Processing login:', user.email);
    
    updateLoginPanelUI(user);
    
    try {
        await Promise.all([
            loadUserData(user.uid, user.email).catch(e => console.warn('loadUserData:', e)),
            loadUserCartAndWishlist(user.uid).catch(e => console.warn('loadUserCartAndWishlist:', e))
        ]);
    } catch(e) {
        console.warn('Error loading user data:', e);
    }
}

async function processConfirmedLogout() {
    if (window._logoutProcessed) {
        console.log('Logout already processed');
        return;
    }
    window._logoutProcessed = true;
    window._loginProcessed = false;
    
    console.log('Processing logout');
    
    window.currentUserData = null;
    cart = {};
    wishlist = [];
    localStorage.removeItem('cart');
    localStorage.removeItem('wishlist');
    
    updateLoginPanelUI(null);
    updateCartUI();
    updateWishlistUI();
    
    if (typeof renderCartItems === 'function') renderCartItems();
    if (typeof renderWishlistPage === 'function') renderWishlistPage();
}
window.initAuthListener = initAuthListener;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initComponents(); initGoldDisplayListener(); initAuthListener(); });
} else {
    initComponents();
    initAuthListener();
}

window.addEventListener('beforeunload', () => {
    if (typeof trendingUnsubscribe === 'function') trendingUnsubscribe();
    if (priceUnsubscribe) priceUnsubscribe();

});

