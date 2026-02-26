// firebase-config.js - COMPAT SDK (no ES6 exports, just global firebase)

// Only load if not already present
if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    console.log('Firebase already initialized, skipping');
    window.dispatchEvent(new Event('firebase-ready'));
} else {
    // Load Firebase scripts...
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js';
    script.onload = function() {
        const firebaseConfig = {
            apiKey: "AIzaSyATmseHSU3qimkm6pSCJ_xA1EL3_KiHtXs",
            authDomain: "skj-jewelry-store.firebaseapp.com",
            projectId: "skj-jewelry-store",
            storageBucket: "skj-jewelry-store.firebasestorage.app",
            messagingSenderId: "531463279637",
            appId: "1:531463279637:web:2ab8aaaa80211045252a1c",
            measurementId: "G-0S99YE5NR1"
        };

        // Initialize only if not already done
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Load Firestore compat
        const firestoreScript = document.createElement('script');
        firestoreScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js';
        firestoreScript.onload = function() {
            // Enable persistence
            firebase.firestore().enablePersistence({ synchronizeTabs: true })
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Persistence failed: Multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Persistence not available in this browser');
                    }
                });
            
            console.log('✅ Firebase compat initialized');
            
            // Dispatch event to notify that firebase is ready
            window.dispatchEvent(new Event('firebase-ready'));
        };
        document.head.appendChild(firestoreScript);
    };
    document.head.appendChild(script);

    // Also load auth compat
    const authScript = document.createElement('script');
    authScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js';
    document.head.appendChild(authScript);
}