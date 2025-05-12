// admin-scripts/hard-reset-evaluations.js
// WARNING: This script performs destructive operations.
// It will delete ALL data from the 'evaluations' and 'summarized_evaluations' collections.
// Make sure you have a backup or are operating in a test environment if data is critical.

const admin = require('firebase-admin');
const inquirer = require('inquirer'); // For user confirmation

// ---- Configuration ----
// IMPORTANT: Replace with the actual path to your service account key JSON file
const serviceAccountPath = '../peer-evaluation-6dcee-firebase-adminsdk-fbsvc-541c831672.json'; 
// IMPORTANT: Make sure this service account has Firestore read/write permissions.

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:");
    console.error("1. Ensure 'firebase-admin' is installed (npm install firebase-admin inquirer).");
    console.error(`2. Ensure the service account key exists at '${serviceAccountPath}'.`);
    console.error("3. Ensure the service account key has necessary Firestore permissions.");
    console.error("Details:", error.message);
    process.exit(1);
}

const db = admin.firestore();

/**
 * Deletes all documents in a specified collection.
 * Firestore limits batch deletes to 500 documents at a time.
 * This function handles collections larger than 500 by iterating in batches.
 * @param {string} collectionPath - The path to the collection to delete.
 * @returns {Promise<void>}
 */
async function deleteCollection(collectionPath) {
    console.log(`Starting deletion for collection: ${collectionPath}`);
    const collectionRef = db.collection(collectionPath);
    const batchSize = 500; // Firestore batch limit

    let query = collectionRef.orderBy('__name__').limit(batchSize);
    let snapshot = await query.get();
    let documentsDeleted = 0;

    while (snapshot.size > 0) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        documentsDeleted += snapshot.size;
        console.log(`Deleted ${snapshot.size} documents from ${collectionPath}. Total deleted: ${documentsDeleted}`);

        if (snapshot.size < batchSize) {
            break; // All documents deleted
        }

        // Get the last document from the current batch to start the next query after it
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        query = collectionRef.orderBy('__name__').startAfter(lastVisible).limit(batchSize);
        snapshot = await query.get();
    }

    if (documentsDeleted === 0) {
        console.log(`No documents found in ${collectionPath} to delete.`);
    } else {
        console.log(`Finished deleting ${documentsDeleted} documents from ${collectionPath}.`);
    }
}

/**
 * Main function to orchestrate the deletion process with user confirmation.
 */
async function main() {
    console.log("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.log("!!! WARNING: DESTRUCTIVE OPERATION AHEAD                  !!!");
    console.log("!!! This script will permanently delete ALL data from:    !!!");
    console.log("!!!   - 'evaluations' collection                          !!!");
    console.log("!!!   - 'summarized_evaluations' collection               !!!");
    console.log("!!!                                                       !!!");
    console.log("!!! THERE IS NO UNDO. Ensure you have backups if needed.  !!!");
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");

    const questions = [
        {
            type: 'confirm',
            name: 'confirmEvaluationsDelete',
            message: "Are you ABSOLUTELY sure you want to delete ALL documents from the 'evaluations' collection?",
            default: false,
        },
        {
            type: 'confirm',
            name: 'confirmSummarizedDelete',
            message: "Are you ABSOLUTELY sure you want to delete ALL documents from the 'summarized_evaluations' collection?",
            default: false,
        },
        {
            type: 'input',
            name: 'finalConfirmation',
            message: "This is your final chance. Type 'YES I AM SURE' to proceed with the deletion(s) confirmed above:",
            validate: function (value) {
                if (value === 'YES I AM SURE') {
                    return true;
                }
                return 'Please type "YES I AM SURE" to confirm, or Ctrl+C to abort.';
            },
            when: (answers) => answers.confirmEvaluationsDelete || answers.confirmSummarizedDelete,
        }
    ];

    try {
        const answers = await inquirer.prompt(questions);

        let deletionsConfirmed = false;

        if (answers.confirmEvaluationsDelete && answers.finalConfirmation === 'YES I AM SURE') {
            console.log("\nProceeding with deletion of 'evaluations' collection...");
            await deleteCollection('evaluations');
            deletionsConfirmed = true;
        } else if (answers.confirmEvaluationsDelete) {
            console.log("\nSkipping deletion of 'evaluations' collection due to lack of final confirmation.");
        } else {
            console.log("\nSkipping deletion of 'evaluations' collection as per user choice.");
        }

        if (answers.confirmSummarizedDelete && answers.finalConfirmation === 'YES I AM SURE') {
            console.log("\nProceeding with deletion of 'summarized_evaluations' collection...");
            await deleteCollection('summarized_evaluations');
            deletionsConfirmed = true;
        } else if (answers.confirmSummarizedDelete) {
            console.log("\nSkipping deletion of 'summarized_evaluations' collection due to lack of final confirmation.");
        } else {
            console.log("\nSkipping deletion of 'summarized_evaluations' collection as per user choice.");
        }

        if (deletionsConfirmed) {
            console.log("\nAll requested deletions completed.");
        } else {
            console.log("\nNo data was deleted. Operation cancelled or no deletions selected.");
        }

    } catch (error) {
        if (error.isTtyError) {
            console.error("Prompt couldn't be rendered in the current environment. Run this script in a standard terminal.");
        } else {
            console.error("An error occurred during the hard reset process:", error);
        }
    }
}

// Run the main function
main().catch(error => {
    console.error("Unhandled error in main execution:", error);
}); 