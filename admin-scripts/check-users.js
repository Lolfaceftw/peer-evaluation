const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
try {
    // Look for service account file in the serviceAccount directory
    const serviceAccountPath = path.join(__dirname, 'serviceAccount', 'serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log('Firebase admin initialized successfully');
    } else {
        console.error('Service account file not found at:', serviceAccountPath);
        process.exit(1);
    }
} catch (error) {
    console.error('Error initializing Firebase admin:', error);
    process.exit(1);
}

// Reference to Firestore
const db = admin.firestore();

// Function to list all users
async function listAllUsers() {
    try {
        console.log('\n----- LISTING ALL USERS IN DATABASE -----\n');
        
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log('No users found in the database');
            return;
        }
        
        console.log(`Found ${usersSnapshot.size} users in the database:`);
        console.log('\nUser Details:');
        console.log('------------');
        
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`Name: ${userData.name || 'N/A'}`);
            console.log(`Code: ${userData.code || 'N/A'}`);
            console.log('Other fields:', Object.keys(userData).filter(k => k !== 'name' && k !== 'code').join(', '));
            console.log('------------');
        });
        
        // Test a query similar to the one in fetchPeersForEvaluation
        // Simulate filtering peers for a specific user
        console.log('\n----- TESTING PEER FILTERING LOGIC -----\n');
        
        // Get Alice's document by code (assuming code ALICE2025)
        const aliceQuery = await db.collection('users').where('code', '==', 'ALICE2025').get();
        
        if (aliceQuery.empty) {
            console.log('Could not find Alice (code: ALICE2025) in the database');
        } else {
            const aliceDoc = aliceQuery.docs[0];
            const aliceId = aliceDoc.id;
            console.log(`Alice found with ID: ${aliceId}`);
            
            // Simulate the peer filtering logic
            console.log('\nPeers that should be available to Alice:');
            let peerCount = 0;
            
            usersSnapshot.forEach((doc) => {
                if (doc.id !== aliceId) {
                    peerCount++;
                    console.log(`- ${doc.data().name || 'Unnamed user'} (ID: ${doc.id})`);
                }
            });
            
            if (peerCount === 0) {
                console.log('No peers found for Alice after filtering');
            } else {
                console.log(`Found ${peerCount} peers for Alice`);
            }
        }
        
    } catch (error) {
        console.error('Error listing users:', error);
    }
}

// Function to check app settings
async function checkAppSettings() {
    try {
        console.log('\n----- CHECKING APP SETTINGS -----\n');
        
        const settingsSnapshot = await db.collection('app_settings').get();
        
        if (settingsSnapshot.empty) {
            console.log('No app settings found in the database');
            return;
        }
        
        settingsSnapshot.forEach((doc) => {
            const settingsData = doc.data();
            console.log(`Settings document ID: ${doc.id}`);
            console.log('isOpen:', settingsData.isOpen);
            console.log('Other settings:', Object.keys(settingsData).filter(k => k !== 'isOpen').join(', '));
        });
        
    } catch (error) {
        console.error('Error checking app settings:', error);
    }
}

// Run the diagnostic functions
async function runDiagnostics() {
    try {
        await listAllUsers();
        await checkAppSettings();
        
        console.log('\nDiagnostic complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error running diagnostics:', error);
        process.exit(1);
    }
}

runDiagnostics(); 