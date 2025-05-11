document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const peersData = [
        { id: 'aliceW', name: 'Alice Wonderland', code: 'ALICE2025' },
        { id: 'bobB', name: 'Bob The Builder', code: 'BOB2025' },
        { id: 'charlieB', name: 'Charlie Brown', code: 'CHARLIE2025' },
        { id: 'dianaP', name: 'Diana Prince', code: 'DIANA2025' },
        { id: 'edwardS', name: 'Edward Scissorhands', code: 'EDWARD2025' }
    ];

    const questions = [
        "Contribution to team goals?",
        "Quality of work delivered?",
        "Timeliness and meeting deadlines?",
        "Communication and listening skills?",
        "Collaboration and teamwork abilities?"
    ];
    // --- END CONFIGURATION ---

    let currentUser = null;
    let evaluations = {}; // Stores all evaluation data
    // Structure: evaluations[currentUser.code] = { evaluatedPeerId1: {q0: score, q1: score ...}, evaluatedPeerId2: {...} }
    let currentEvaluatedPeers = []; // List of peer IDs already evaluated by the current user

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
    const downloadEvaluationsButton = document.getElementById('downloadEvaluationsButton');

    loginButton.addEventListener('click', handleLogin);
    userCodeInput.addEventListener('keypress', function(event) {
        if (event.key === "Enter") {
            handleLogin();
        }
    });
    submitEvaluationButton.addEventListener('click', handleSubmitEvaluation);
    downloadEvaluationsButton.addEventListener('click', handleDownloadEvaluations);

    function handleLogin() {
        const code = userCodeInput.value.trim();
        loginError.textContent = '';
        const foundUser = peersData.find(p => p.code.toLowerCase() === code.toLowerCase());

        if (foundUser) {
            currentUser = foundUser;
            evaluations[currentUser.code] = evaluations[currentUser.code] || {}; // Initialize if not present
            currentEvaluatedPeers = Object.keys(evaluations[currentUser.code]);

            loginSection.style.display = 'none';
            evaluationSection.style.display = 'block';
            welcomeMessage.textContent = `Welcome, ${currentUser.name}!`;
            renderPeerList();
            checkCompletion();
        } else {
            loginError.textContent = 'Invalid code. Please try again.';
        }
    }

    function renderPeerList() {
        peerListContainer.innerHTML = '';
        const peersToEvaluate = peersData.filter(p => p.id !== currentUser.id);

        if (peersToEvaluate.length === 0) {
            peerListContainer.innerHTML = '<p>There are no other peers to evaluate in the system.</p>';
            completionSection.style.display = 'block'; // Show completion if only one user or no one else to eval
            return;
        }

        peersToEvaluate.forEach(peer => {
            const peerItem = document.createElement('div');
            peerItem.classList.add('peer-item');
            peerItem.textContent = peer.name;
            peerItem.dataset.peerId = peer.id;

            if (currentEvaluatedPeers.includes(peer.id)) {
                peerItem.classList.add('evaluated');
            } else {
                peerItem.addEventListener('click', () => loadEvaluationForm(peer));
            }
            peerListContainer.appendChild(peerItem);
        });
    }

    function loadEvaluationForm(peer) {
        if (currentEvaluatedPeers.includes(peer.id)) return; // Already evaluated

        evaluatingPeerName.textContent = `Evaluating: ${peer.name}`;
        questionsForm.innerHTML = ''; // Clear previous questions
        evaluationMessage.textContent = '';

        questions.forEach((q, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-item');
            questionDiv.innerHTML = `<label for="q${index}">${index + 1}. ${q}</label>`;

            const likertDiv = document.createElement('div');
            likertDiv.classList.add('likert-scale');
            for (let i = 1; i <= 5; i++) {
                const radioLabel = document.createElement('label');
                const radioInput = document.createElement('input');
                radioInput.type = 'radio';
                radioInput.name = `q${index}`;
                radioInput.value = i;
                radioInput.required = true; // Make sure a selection is made

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

    function handleSubmitEvaluation() {
        const peerId = submitEvaluationButton.dataset.evaluatingPeerId;
        const peerName = submitEvaluationButton.dataset.evaluatingPeerName;

        if (!peerId) return;

        const formData = new FormData(questionsForm);
        const scores = {};
        let allAnswered = true;

        for (let i = 0; i < questions.length; i++) {
            const score = formData.get(`q${i}`);
            if (score) {
                scores[`q${i}`] = parseInt(score);
            } else {
                allAnswered = false;
                break;
            }
        }

        if (!allAnswered) {
            evaluationMessage.textContent = 'Please answer all questions before submitting.';
            evaluationMessage.className = 'error-message';
            return;
        }

        // Store evaluation
        if (!evaluations[currentUser.code]) {
            evaluations[currentUser.code] = {};
        }
        evaluations[currentUser.code][peerId] = {
            peerName: peerName, // Store peer name for easier CSV generation
            scores: scores
        };

        currentEvaluatedPeers.push(peerId);

        evaluationMessage.textContent = `Evaluation for ${peerName} submitted successfully!`;
        evaluationMessage.className = 'success-message';
        questionsForm.reset();
        evaluationFormContainer.style.display = 'none'; // Hide form after submission
        renderPeerList(); // Re-render to update evaluated status
        checkCompletion();
    }

    function checkCompletion() {
        const peersToEvaluateCount = peersData.filter(p => p.id !== currentUser.id).length;
        if (peersToEvaluateCount > 0 && currentEvaluatedPeers.length === peersToEvaluateCount) {
            completionSection.style.display = 'block';
            evaluationFormContainer.style.display = 'none'; // Hide form if it was open
            peerListContainer.style.display = 'none'; // Optionally hide the peer list too
            welcomeMessage.textContent = `All evaluations complete, ${currentUser.name}!`;
        } else if (peersToEvaluateCount === 0) { // Handles case where there's only one user or no one else to eval
             completionSection.style.display = 'block';
             peerListContainer.innerHTML = '<p>No peers available for evaluation at this time.</p>';
        }
    }

    function handleDownloadEvaluations() {
        if (!currentUser || !evaluations[currentUser.code]) {
            alert("No evaluations to download.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        // Header Row
        const questionHeaders = questions.map((q, i) => `Question ${i+1} ("${q.substring(0,20)}...")`).join(',');
        csvContent += `Evaluator Name,Evaluator Code,Evaluated Peer Name,Evaluated Peer ID,${questionHeaders}\r\n`;

        // Data Rows
        const userEvaluations = evaluations[currentUser.code];
        for (const peerId in userEvaluations) {
            const evaluation = userEvaluations[peerId];
            const scoresRow = questions.map((_, i) => evaluation.scores[`q${i}`] || '').join(',');
            const row = [
                currentUser.name,
                currentUser.code,
                evaluation.peerName, // Using stored peer name
                peerId,
                scoresRow
            ].join(',');
            csvContent += row + "\r\n";
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        link.setAttribute("download", `peer_evaluations_${currentUser.code}_${timestamp}.csv`);
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
    }
});