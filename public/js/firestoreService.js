import { db } from './firebaseInit.js';
import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    // Timestamp, // Not directly used in the functions being moved, serverTimestamp is.
    serverTimestamp,
    updateDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
import { logDebug, logDebugWarn, logDebugError } from './debugService.js';

// --- Firestore Collection References ---
// These are defined here for use by the service functions.
// Consider moving to a config.js if they are used elsewhere outside of firestore interactions.
const usersCollectionRef = collection(db, "users");
const questionsCollectionRef = collection(db, "questions");
const evaluationsCollectionRef = collection(db, "evaluations");
const summarizedEvaluationsCollectionRef = collection(db, "summarized_evaluations");
const appSettingsCollectionRef = collection(db, "app_settings");

// --- Firestore Interaction Functions ---

export async function loginUserWithCode(code) {
    logDebug("firestoreService.loginUserWithCode called with raw code:", code);
    if (!code) {
        logDebug("firestoreService.loginUserWithCode: code is empty, returning null");
        return null;
    }
    try {
        const upperCaseCode = code.toUpperCase();
        logDebug("firestoreService.loginUserWithCode: querying Firestore for code:", upperCaseCode);
        const q = query(usersCollectionRef, where("code", "==", upperCaseCode));
        const querySnapshot = await getDocs(q);
        logDebug("firestoreService.loginUserWithCode: Firestore query executed. Snapshot empty:", querySnapshot.empty, "Size:", querySnapshot.size);

        if (querySnapshot.empty) {
            logDebug("firestoreService.loginUserWithCode: No user found with code in Firestore.");
            return null;
        }
        const userDoc = querySnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() };
        logDebug("firestoreService.loginUserWithCode: User found:", userData);
        return userData;
    } catch (error) {
        logDebugError("firestoreService.loginUserWithCode:", error);
        throw error;
    }
}

export async function fetchCategorizedQuestions() {
    logDebug("firestoreService.fetchCategorizedQuestions called");
    try {
        const categoriesQuery = query(
            questionsCollectionRef,
            where('type', '==', 'category'),
            orderBy('code')
        );
        const categoriesSnapshot = await getDocs(categoriesQuery);
        logDebug("firestoreService.fetchCategorizedQuestions: Categories snapshot size:", categoriesSnapshot.size);
        
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        const questionsQuery = query(
            questionsCollectionRef,
            where('type', '==', 'question'),
            orderBy('categoryCode'), // Ensure this matches field used in admin script
            orderBy('id') // Assuming question 'id' or an 'order' field within category
        );
        const questionsSnapshot = await getDocs(questionsQuery);
        logDebug("firestoreService.fetchCategorizedQuestions: Questions snapshot size:", questionsSnapshot.size);
        
        const organizedQuestions = {};
        categories.forEach(category => {
            organizedQuestions[category.id] = {
                categoryDetails: category,
                questions: []
            };
        });
        
        questionsSnapshot.forEach(doc => {
            const question = {
                id: doc.id,
                ...doc.data()
            };
            if (organizedQuestions[question.categoryId]) {
                organizedQuestions[question.categoryId].questions.push(question);
            }
        });
        
        logDebug("firestoreService.fetchCategorizedQuestions: Organized questions by", Object.keys(organizedQuestions).length, "categories");
        return organizedQuestions;
    } catch (error) {
        logDebugError('Error fetching categorized questions from firestoreService:', error);
        return null; // Return null or throw, depending on desired error handling
    }
}

// Fallback, keep for now if needed, or remove if confident in categorized approach.
export async function fetchAllQuestions() {
    logDebug("firestoreService.fetchAllQuestions called (legacy method)");
    try {
        const q = query(questionsCollectionRef, orderBy("order")); // Assumes 'order' field exists for non-categorized
        const querySnapshot = await getDocs(q);
        const questions = [];
        querySnapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() });
        });
        logDebug("firestoreService.fetchAllQuestions: Found", questions.length, "questions (legacy format)");
        return questions;
    } catch (error) {
        logDebugError("Error fetching legacy questions from firestoreService:", error);
        throw error;
    }
}

export async function fetchPeersForEvaluation(currentUserId_Firestore) {
    logDebug("firestoreService.fetchPeersForEvaluation called for user:", currentUserId_Firestore);
    if (!currentUserId_Firestore) {
        logDebugError("firestoreService.fetchPeersForEvaluation: No user ID provided");
        return [];
    }
    try {
        const querySnapshot = await getDocs(usersCollectionRef);
        const peers = [];
        querySnapshot.forEach((doc) => {
            if (doc.id !== currentUserId_Firestore) {
                peers.push({ id: doc.id, ...doc.data() });
            }
        });
        logDebug(`firestoreService.fetchPeersForEvaluation: Final peers list contains ${peers.length} users.`);
        return peers;
    } catch (error) {
        logDebugError("Error fetching peers from firestoreService:", error);
        throw error;
    }
}

export async function fetchUserSubmittedEvaluations(evaluatorFirestoreId) {
    logDebug("firestoreService.fetchUserSubmittedEvaluations: Called for evaluatorId:", evaluatorFirestoreId);
    if (!evaluatorFirestoreId) {
        logDebugWarn("firestoreService.fetchUserSubmittedEvaluations: No evaluatorFirestoreId provided, returning empty array.");
        return [];
    }
    try {
        const q = query(evaluationsCollectionRef, where("evaluatorId", "==", evaluatorFirestoreId));
        const querySnapshot = await getDocs(q);
        const submissions = [];
        querySnapshot.forEach((doc) => {
            submissions.push({ id: doc.id, ...doc.data() });
        });
        logDebug("firestoreService.fetchUserSubmittedEvaluations: Returning", submissions.length, "submissions.");
        return submissions;
    } catch (error) {
        logDebugError("Error fetching user submissions from firestoreService:", error);
        throw error;
    }
}

export async function submitEvaluation(evaluatorFirestoreId, evaluatedPeerFirestoreId, scoresData, evaluatorName, evaluatedPeerName) {
    logDebug("firestoreService.submitEvaluation called.");
    if (!evaluatorFirestoreId || !evaluatedPeerFirestoreId || !scoresData) {
        throw new Error("firestoreService.submitEvaluation: Missing data for submitting evaluation.");
    }
    try {
        await addDoc(evaluationsCollectionRef, {
            evaluatorId: evaluatorFirestoreId,
            evaluatorName: evaluatorName,
            evaluatedPeerId: evaluatedPeerFirestoreId,
            evaluatedPeerName: evaluatedPeerName,
            scores: scoresData,
            submittedAt: serverTimestamp()
        });
        logDebug("firestoreService.submitEvaluation: Evaluation submitted successfully.");
    } catch (error) {
        logDebugError("Error submitting evaluation in firestoreService:", error);
        throw error;
    }
}

export async function saveSummarizedEvaluation(summaryDataFromManager) {
    logDebug("firestoreService.saveSummarizedEvaluation called with raw data:", summaryDataFromManager);
    try {
        const formattedCategoryAverages = {};
        if (summaryDataFromManager.categoryAverages && typeof summaryDataFromManager.categoryAverages === 'object') {
            Object.values(summaryDataFromManager.categoryAverages).forEach(category => {
                 if (category && category.name && category.average !== undefined) {
                    formattedCategoryAverages[category.name] = category.average;
                } else {
                    logDebugWarn("firestoreService.saveSummarizedEvaluation: Skipping category due to missing name or undefined average:", category);
                }
            });
        }
        
        const finalSummarizedDataToSave = {
            evaluatorId: summaryDataFromManager.evaluatorId,
            evaluatorName: summaryDataFromManager.evaluatorName,
            evaluatedPeerId: summaryDataFromManager.evaluatedPeerId,
            evaluatedPeerName: summaryDataFromManager.evaluatedPeerName,
            evaluationPeriodId: summaryDataFromManager.evaluationPeriodId || "default", // Ensure default
            categoryAverages: formattedCategoryAverages,
            overallAverage: summaryDataFromManager.overallAverage,
            timestamp: serverTimestamp() 
        };
        
        logDebug("firestoreService.saveSummarizedEvaluation: Final data being prepared for save/update:", finalSummarizedDataToSave);

        for (const key in finalSummarizedDataToSave) {
            if (finalSummarizedDataToSave[key] === undefined) {
                logDebugError(`firestoreService.saveSummarizedEvaluation: UNDEFINED FIELD DETECTED in finalSummarizedDataToSave: ${key}. Aborting save.`);
                return false; 
            }
        }
        if (finalSummarizedDataToSave.categoryAverages && typeof finalSummarizedDataToSave.categoryAverages === 'object') {
            for (const catName in finalSummarizedDataToSave.categoryAverages) {
                 if (finalSummarizedDataToSave.categoryAverages[catName] === undefined) {
                    logDebugError(`firestoreService.saveSummarizedEvaluation: UNDEFINED average for category ${catName} in finalSummarizedDataToSave. Aborting save.`);
                    return false;
                 }
            }
        }

        const q = query(
            summarizedEvaluationsCollectionRef,
            where("evaluatorId", "==", finalSummarizedDataToSave.evaluatorId),
            where("evaluatedPeerId", "==", finalSummarizedDataToSave.evaluatedPeerId),
            where("evaluationPeriodId", "==", finalSummarizedDataToSave.evaluationPeriodId) // Added
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, finalSummarizedDataToSave);
            logDebug("firestoreService.saveSummarizedEvaluation: Updated existing summarized evaluation.");
        } else {
            await addDoc(summarizedEvaluationsCollectionRef, finalSummarizedDataToSave);
            logDebug("firestoreService.saveSummarizedEvaluation: Created new summarized evaluation.");
        }
        return true;
    } catch (error) {
        logDebugError("Error saving summarized evaluation in firestoreService:", error);
        logDebugError("Data that was being processed by saveSummarizedEvaluation:", finalSummarizedDataToSave); // Log the data that Firestore choked on
        logDebugError("Initial data received by saveSummarizedEvaluation:", summaryDataFromManager);
        return false;
    }
}

export async function fetchUserSummarizedEvaluations(evaluatorId) {
    logDebug("firestoreService.fetchUserSummarizedEvaluations for user:", evaluatorId);
    try {
        const q = query(
            summarizedEvaluationsCollectionRef,
            where("evaluatorId", "==", evaluatorId)
        );
        const querySnapshot = await getDocs(q);
        const summaries = [];
        querySnapshot.forEach(doc => {
            summaries.push({ id: doc.id, ...doc.data() });
        });
        logDebug("firestoreService.fetchUserSummarizedEvaluations: Found", summaries.length, "summarized evaluations.");
        return summaries;
    } catch (error) {
        logDebugError("Error fetching summarized evaluations from firestoreService:", error);
        return [];
    }
}

let appSettingsListenerUnsubscribe = null;

export function listenToAppSettings(callbacks) {
    logDebug("firestoreService.listenToAppSettings: Setting up listener...");
    if (appSettingsListenerUnsubscribe) {
        logDebug("firestoreService.listenToAppSettings: Unsubscribing from previous listener.");
        appSettingsListenerUnsubscribe();
    }

    appSettingsListenerUnsubscribe = onSnapshot(appSettingsCollectionRef, (snapshot) => {
        logDebug("firestoreService.listenToAppSettings (onSnapshot): App settings snapshot received. Docs count:", snapshot.size);
        if (!snapshot.empty) {
            const settingsDoc = snapshot.docs[0];
            const settingsData = settingsDoc.data();
            const newIsOpenState = settingsData.isOpen === true;
            const newIsDebugMode = settingsData.isDebug === true;
            const newResetAllPeersTimestamp = settingsData.resetAllPeers || null;
            callbacks.onSettingsChange(newIsOpenState, newIsDebugMode, newResetAllPeersTimestamp, settingsData);
        } else {
            logDebugWarn("firestoreService.listenToAppSettings (onSnapshot): No app settings document found. Defaulting to open=true, debug=false, no reset signal locally.");
            callbacks.onSettingsChange(true, false, null, {}); 
        }
    }, (error) => {
        logDebugError("firestoreService.listenToAppSettings (onSnapshot):", error);
        logDebugWarn("firestoreService.listenToAppSettings (onSnapshot ERROR): Defaulting to open=true, debug=false, no reset signal locally on error.");
        callbacks.onSettingsChange(true, false, null, {}); 
    });
    
    return appSettingsListenerUnsubscribe; // Return the unsubscribe function
} 