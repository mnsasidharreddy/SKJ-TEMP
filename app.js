import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyATmseHSU3qimkm6pSCJ_xA1EL3_KiHtXs",
  authDomain: "skj-jewelry-store.firebaseapp.com",
  projectId: "skj-jewelry-store",
  storageBucket: "skj-jewelry-store.firebasestorage.app",
  messagingSenderId: "531463279637",
  appId: "1:531463279637:web:2ab8aaaa80211045252a1c",
  measurementId: "G-0S99YE5NR1"
};

// 2. Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Fetches and displays records based on the selected metal type
 * @param {string} selectedType - "Gold" or "Silver"
 */
async function fetchPrices(selectedType = "Gold") {
    const tableBody = document.getElementById('price-table-body');
    
    // Show a loading state while fetching
    tableBody.innerHTML = "<tr><td colspan='5'>Updating list...</td></tr>";
    
    try {
        const priceRef = collection(db, "priceHistory");

        // QUERY: Filter by type, sort by newest, limit to 20
        const q = query(
            priceRef, 
            where("type", "==", selectedType), 
            orderBy("updatedAt", "desc"), 
            limit(20)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan='5'>No records found for ${selectedType}.</td></tr>`;
            return;
        }

        let rows = "";

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Format 1: Date without time
            const dateOnly = data.updatedAt ? data.updatedAt.toDate().toLocaleDateString() : "N/A";

            // Format 2: User Name Mapping
            let displayName = "Admin"; 
            if (data.updatedBy === "KO168yn8BphlmpThXL41pP3bdIr1") {
                displayName = "Siva Anand";
            }

            rows += `
                <tr>
                    <td><strong>${data.type}</strong></td>
                    <td>${data.marketPrice}</td>
                    <td>${data.skjPrice}</td>
                    <td>${dateOnly}</td>
                    <td>${displayName}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = rows;

    } catch (error) {
        console.error("Firestore Error:", error);
        // If you see a 'FAILED_PRECONDITION' error here, click the index link in the console
        tableBody.innerHTML = `<tr><td colspan='5' style='color:red;'>Error: ${error.message}</td></tr>`;
    }
}

// --- Event Listeners ---

// Listen for Dropdown Changes (Gold/Silver)
document.getElementById('metalType').addEventListener('change', (e) => {
    fetchPrices(e.target.value);
});

// Listen for Refresh Button Click
document.getElementById('refreshBtn').addEventListener('click', () => {
    const currentSelection = document.getElementById('metalType').value;
    fetchPrices(currentSelection);
});

// Initial load when the page first opens
fetchPrices("Gold");