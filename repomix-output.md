This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

## Additional Info

# Directory Structure
```
.firebaserc
.repomixignore
firebase.json
firestore.indexes.json
firestore.rules
public/index.html
public/script.js
public/style.css
README.md
repomix.config.json
```

# Files

## File: .firebaserc
```
{
  "projects": {
    "default": "peer-evaluation-6dcee"
  }
}
```

## File: .repomixignore
```
# Add patterns to ignore here, one per line
# Example:
# *.log
# tmp/
functions/*
.gitignore
```

## File: firebase.json
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint",
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ],
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## File: firestore.indexes.json
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

## File: firestore.rules
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // This rule allows anyone with your Firestore database reference to view, edit,
    // and delete all data in your Firestore database. It is useful for getting
    // started, but it is configured to expire after 30 days because it
    // leaves your app open to attackers. At that time, all client
    // requests to your Firestore database will be denied.
    //
    // Make sure to write security rules for your app before that time, or else
    // all client requests to your Firestore database will be denied until you Update
    // your rules
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 6, 10);
    }
  }
}
```

## File: public/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Peer Evaluation Tool</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Peer Evaluation</h1>

        <div id="loginSection">
            <h2>Enter Your Code</h2>
            <input type="text" id="userCodeInput" placeholder="Your Special Code">
            <button id="loginButton">Login</button>
            <p id="loginError" class="error-message"></p>
        </div>

        <div id="evaluationSection" style="display: none;">
            <h2 id="welcomeMessage"></h2>
            <p>Please evaluate your peers. Click on a name to start.</p>

            <div id="peerList">
                <!-- Peers will be listed here by JavaScript -->
            </div>

            <div id="evaluationFormContainer" style="display: none;">
                <h3 id="evaluatingPeerName"></h3>
                <form id="questionsForm">
                    <!-- Questions will be injected here by JavaScript -->
                </form>
                <button id="submitEvaluationButton">Submit Evaluation</button>
                <p id="evaluationMessage" class="success-message"></p>
            </div>

            <div id="completionSection" style="display: none;">
                <h3>All evaluations complete!</h3>
                <p>Thank you for participating.</p>
                <button id="downloadEvaluationsButton">Download Evaluations (CSV)</button>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
```

## File: public/script.js
```javascript
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    // Replace with your deployed PocketBase URL
    const POCKETBASE_URL = 'https://your-peer-eval-backend.example.com'; // IMPORTANT: CHANGE THIS
    // --- END CONFIGURATION ---

    let currentUser = null; // Will store { id, name, code, ... } from PocketBase
    let allQuestions = []; // Will store questions from PocketBase { id, text, order, ... }
    let peersToEvaluate = [];
    let evaluatedPeerIdsForCurrentUser = new Set(); // Store IDs of peers already evaluated by current user

    const loginSection = document.getElementById('loginSection');
    const userCodeInput = document.getElementById('userCodeInput');
    const loginButton = document.getElementById('loginButton');
    const loginError = document.getElementById('loginError');

    const evaluationSection = document.getElementById('evaluationSection');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const peerListContainer = document.getElementById('peerList');
    const evaluationFormContainer = document.getElementById('evaluationFormContainer');
    const evaluatingPeerName = document.getElementById('evaluatingPeerName');
    const questionsForm = document.getElementById('questionsForm');
    const submitEvaluationButton = document.getElementById('submitEvaluationButton');
    const evaluationMessage = document.getElementById('evaluationMessage');
    const completionSection = document.getElementById('completionSection');
    // const downloadEvaluationsButton = document.getElementById('downloadEvaluationsButton'); // Removed

    // --- PocketBase API Interaction Functions ---

    async function fetchFromPocketBase(endpoint, options = {}) {
        try {
            const response = await fetch(`${POCKETBASE_URL}/api/collections/${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                console.error('PocketBase API Error:', errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            if (response.status === 204) { // No Content
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }

    async function loginUser(code) {
        // This attempts to find a user by their unique code.
        // Ensure API rules for 'users' collection allow this lookup.
        // A 'List' rule like '@request.auth.id != ""' means we need to be authenticated.
        // For a public login, you might need a specific API view or use PocketBase's auth.
        // For simplicity, assuming an admin API key or specific rule for code lookup.
        // If using PocketBase's own auth: pb.collection('users').authWithPassword(code, 'fixed_dummy_password');
        // Here, we'll filter by code. This requires the 'users' collection List API rule to be permissive enough,
        // or you need to authenticate with an admin/viewer token if rules are strict.
        // For this example, let's assume the API rules allow an *authenticated* user to list/filter.
        // To make this work without pre-authentication, you'd typically have a custom endpoint
        // or allow unauthenticated list with a filter on 'code' if you deem it safe.

        // A common pattern for "login with code" without full user auth:
        // 1. Client sends code.
        // 2. Backend has an endpoint that takes the code, finds the user, and returns a *session token* or user details.
        // For PocketBase, if 'code' is the username in an 'auth' collection:
        // const authData = await pb.collection('users').authWithPassword(code, 'THE_PASSWORD_FOR_CODE_USERS');
        // currentUser = authData.record;
        // pb.authStore.save(authData.token, authData.record); // Save token for subsequent requests

        // Simplified approach: Fetch user by code (assumes appropriate API rules or admin context for this call)
        // This is a placeholder for a more robust authentication.
        // For now, we'll assume this fetch works based on your API rules.
        // You might need to adjust API rules for 'users' collection:
        // List Rule: "" (public) - then filter. OR use an admin API token.
        // For a truly secure setup, avoid embedding admin tokens in client.
        // The most straightforward way with PocketBase would be to make 'code' the username
        // in an auth collection and use `authWithPassword`.

        // Let's proceed with a filter, assuming List access is configured (e.g. for admin/service account making this call)
        // OR, if 'users' List API rule is simply "@request.auth.id != """, this call would fail if not authenticated.
        // For initial setup, you might temporarily open 'users' List access to public (`""`) for testing this part,
        // then secure it. A better way is a dedicated login endpoint.

        // **Using a simplified "get first item by filter" for demonstration**
        // This requires the `users` collection to have a List API rule like `""` (public) or
        // the request to be authenticated with sufficient privilege.
        // A more secure way is to use PocketBase authentication: `pb.collection('users').authWithPassword('user_code_as_username', 'user_password');`
        // Then `pb.authStore.model` would be the current user.

        const params = new URLSearchParams({ filter: `(code='${code}')` });
        const response = await fetchFromPocketBase(`users/records?${params.toString()}`);

        if (response && response.items && response.items.length > 0) {
            return response.items[0]; // The user object from PocketBase
        }
        return null;
    }

    async function fetchQuestions() {
        const params = new URLSearchParams({ sort: 'order' });
        const response = await fetchFromPocketBase(`questions/records?${params.toString()}`);
        return response.items || [];
    }

    async function fetchPeers(currentUserId) {
        const params = new URLSearchParams({ filter: `(id!='${currentUserId}')` });
        const response = await fetchFromPocketBase(`users/records?${params.toString()}`);
        return response.items || [];
    }

    async function fetchUserEvaluations(userId) {
        const params = new URLSearchParams({ filter: `(evaluator='${userId}')`, expand: 'evaluatedPeer' });
        const response = await fetchFromPocketBase(`evaluations/records?${params.toString()}`);
        return response.items || [];
    }

    async function submitEvaluationToBackend(evaluatorId, evaluatedPeerId, scoresData) {
        const payload = {
            evaluator: evaluatorId,
            evaluatedPeer: evaluatedPeerId,
            scores: scoresData, // e.g., {"question_record_id1": 5, "question_record_id2": 4}
            submittedAt: new Date().toISOString()
        };
        // This assumes the client is authenticated with PocketBase and the token is sent automatically
        // or that API rules for 'evaluations' (Create) allow this.
        // If using pb.authStore, PocketBase JS SDK handles auth headers. With raw fetch, you might need to add:
        // headers: { 'Authorization': `Bearer ${pb.authStore.token}` } if not using admin for all.
        // For simplicity, assuming API rules are set for an authenticated user to create.
        await fetchFromPocketBase('evaluations/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }


    // --- Event Handlers and UI Logic ---
    loginButton.addEventListener('click', handleLogin);
    userCodeInput.addEventListener('keypress', function(event) {
        if (event.key === "Enter") {
            handleLogin();
        }
    });
    submitEvaluationButton.addEventListener('click', handleSubmitEvaluation);
    // downloadEvaluationsButton no longer exists

    async function handleLogin() {
        const code = userCodeInput.value.trim();
        loginError.textContent = '';
        if (!code) {
            loginError.textContent = 'Please enter your code.';
            return;
        }

        try {
            const user = await loginUser(code);

            if (user) {
                currentUser = user; // Store the full user object from PocketBase (includes 'id')
                // For subsequent authenticated requests if not using admin key for everything:
                // You would typically authenticate with PocketBase here using the user's credentials
                // or a token obtained during login, e.g., pb.authStore.save(token, model);

                loginSection.style.display = 'none';
                evaluationSection.style.display = 'block';
                welcomeMessage.textContent = `Welcome, ${currentUser.name}!`;

                // Fetch necessary data
                allQuestions = await fetchQuestions();
                peersToEvaluate = await fetchPeers(currentUser.id);
                const userSubmissions = await fetchUserEvaluations(currentUser.id);
                evaluatedPeerIdsForCurrentUser = new Set(userSubmissions.map(sub => sub.evaluatedPeer)); // Use PocketBase record ID

                renderPeerList();
                checkCompletion();
            } else {
                loginError.textContent = 'Invalid code or user not found.';
            }
        } catch (error) {
            loginError.textContent = `Login failed: ${error.message}. Check console for details.`;
            console.error("Login process error:", error);
        }
    }

    function renderPeerList() {
        peerListContainer.innerHTML = '';
        if (peersToEvaluate.length === 0) {
            peerListContainer.innerHTML = '<p>There are no other peers to evaluate in the system.</p>';
            return;
        }

        peersToEvaluate.forEach(peer => {
            const peerItem = document.createElement('div');
            peerItem.classList.add('peer-item');
            peerItem.textContent = peer.name;
            peerItem.dataset.peerId = peer.id; // Use PocketBase record ID

            if (evaluatedPeerIdsForCurrentUser.has(peer.id)) {
                peerItem.classList.add('evaluated');
            } else {
                peerItem.addEventListener('click', () => loadEvaluationForm(peer));
            }
            peerListContainer.appendChild(peerItem);
        });
    }

    function loadEvaluationForm(peer) {
        if (evaluatedPeerIdsForCurrentUser.has(peer.id)) return;

        evaluatingPeerName.textContent = `Evaluating: ${peer.name}`;
        questionsForm.innerHTML = '';
        evaluationMessage.textContent = '';

        allQuestions.forEach((q) => { // q object now has {id, text, order}
            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-item');
            // Use q.id (PocketBase record ID for the question) for the name attribute to link score to question
            questionDiv.innerHTML = `<label for="q-${q.id}">${q.order}. ${q.text}</label>`;

            const likertDiv = document.createElement('div');
            likertDiv.classList.add('likert-scale');
            for (let i = 1; i <= 5; i++) {
                const radioLabel = document.createElement('label');
                const radioInput = document.createElement('input');
                radioInput.type = 'radio';
                radioInput.name = `q-${q.id}`; // Name uses question's PocketBase ID
                radioInput.value = i;
                radioInput.required = true;

                radioLabel.appendChild(radioInput);
                radioLabel.appendChild(document.createTextNode(i));
                likertDiv.appendChild(radioLabel);
            }
            questionDiv.appendChild(likertDiv);
            questionsForm.appendChild(questionDiv);
        });

        submitEvaluationButton.dataset.evaluatingPeerId = peer.id;
        submitEvaluationButton.dataset.evaluatingPeerName = peer.name;
        evaluationFormContainer.style.display = 'block';
    }

    async function handleSubmitEvaluation() {
        const peerId = submitEvaluationButton.dataset.evaluatingPeerId;
        const peerName = submitEvaluationButton.dataset.evaluatingPeerName;

        if (!currentUser || !peerId) return;

        const formData = new FormData(questionsForm);
        const scoresData = {}; // To store as JSON: {"question_pb_id1": score, "question_pb_id2": score}
        let allAnswered = true;

        allQuestions.forEach(q => {
            const score = formData.get(`q-${q.id}`);
            if (score) {
                scoresData[q.id] = parseInt(score); // Key is the question's PocketBase record ID
            } else {
                allAnswered = false;
            }
        });

        if (!allAnswered) {
            evaluationMessage.textContent = 'Please answer all questions before submitting.';
            evaluationMessage.className = 'error-message';
            return;
        }

        try {
            await submitEvaluationToBackend(currentUser.id, peerId, scoresData);

            evaluatedPeerIdsForCurrentUser.add(peerId);
            evaluationMessage.textContent = `Evaluation for ${peerName} submitted successfully!`;
            evaluationMessage.className = 'success-message';
            questionsForm.reset();
            evaluationFormContainer.style.display = 'none';
            renderPeerList();
            checkCompletion();
        } catch (error) {
            evaluationMessage.textContent = `Error submitting evaluation: ${error.message}. Check console.`;
            evaluationMessage.className = 'error-message';
            console.error("Submit evaluation error:", error);
        }
    }

    function checkCompletion() {
        if (peersToEvaluate.length > 0 && evaluatedPeerIdsForCurrentUser.size === peersToEvaluate.length) {
            completionSection.style.display = 'block';
            evaluationFormContainer.style.display = 'none';
            peerListContainer.style.display = 'none';
            welcomeMessage.textContent = `All evaluations complete, ${currentUser.name}! Thank you.`;
        } else if (peersToEvaluate.length === 0) {
            completionSection.style.display = 'block';
            peerListContainer.innerHTML = '<p>No peers available for evaluation at this time.</p>';
            welcomeMessage.textContent = `Welcome, ${currentUser.name}! No peers to evaluate.`;
        }
    }

    // Initial setup - hide sections that should only appear after login
    evaluationSection.style.display = 'none';
    completionSection.style.display = 'none';
});
```

## File: public/style.css
```css
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 20px;
    background-color: #f4f4f4;
    color: #333;
}

.container {
    max-width: 800px;
    margin: auto;
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

h1, h2, h3 {
    color: #333;
    text-align: center;
}

#loginSection, #evaluationSection {
    margin-top: 20px;
}

input[type="text"] {
    width: calc(100% - 22px);
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

button {
    display: inline-block;
    background: #5cb85c;
    color: #fff;
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

button:hover {
    background: #4cae4c;
}

#loginButton {
    width: 100%;
}

.error-message {
    color: red;
    text-align: center;
    margin-top: 10px;
}

.success-message {
    color: green;
    margin-top: 10px;
}

#peerList {
    margin-top: 20px;
    margin-bottom: 20px;
}

.peer-item {
    background: #e9ecef;
    color: #007bff;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
    border: 1px solid #ced4da;
}

.peer-item:hover {
    background: #d3d9df;
}

.peer-item.evaluated {
    background: #adb5bd; /* Grayed out */
    color: #f8f9fa;
    cursor: not-allowed;
    text-decoration: line-through;
}

#evaluationFormContainer {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #eee;
    border-radius: 5px;
    background-color: #f9f9f9;
}

.question-item {
    margin-bottom: 15px;
}

.question-item label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.likert-scale {
    display: flex;
    justify-content: space-around;
}

.likert-scale label {
    font-weight: normal;
    margin-right: 5px;
}
.likert-scale input[type="radio"] {
    margin-right: 3px;
}


#downloadEvaluationsButton {
    background: #007bff;
    margin-top: 20px;
}

#downloadEvaluationsButton:hover {
    background: #0056b3;
}
```

## File: repomix.config.json
```json
{
  "input": {
    "maxFileSize": 52428800
  },
  "output": {
    "filePath": "repomix-output.md",
    "style": "markdown",
    "parsableStyle": false,
    "fileSummary": true,
    "directoryStructure": true,
    "files": true,
    "removeComments": false,
    "removeEmptyLines": false,
    "compress": false,
    "topFilesLength": 5,
    "showLineNumbers": false,
    "copyToClipboard": false,
    "git": {
      "sortByChanges": true,
      "sortByChangesMaxCommits": 100
    }
  },
  "include": [],
  "ignore": {
    "useGitignore": true,
    "useDefaultPatterns": true,
    "customPatterns": []
  },
  "security": {
    "enableSecurityCheck": true
  },
  "tokenCount": {
    "encoding": "o200k_base"
  }
}
```

## File: README.md
```markdown
# Test
```
