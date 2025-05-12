const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount/serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

// Data structure for the questions from the image
const evaluationQuestions = [
  {
    category: "Mechanical Skill & Hero Proficiency",
    code: "A",
    questions: [
      { id: "A1", text: "Player demonstrates accurate and consistent aiming." },
      { id: "A2", text: "Player utilizes movement mechanics effectively for positioning, dodging, and engagement." },
      { id: "A3", text: "Player uses their primary hero's abilities accurately and with good timing." },
      { id: "A4", text: "Player demonstrates proficiency across a wide hero pool for their role." },
      { id: "A5", text: "Player effectively executes the core mechanics required for their assigned role." },
      { id: "A6", text: "Player shows quick reaction times in time-sensitive matchups." }
    ]
  },
  {
    category: "Game Sense & Strategy",
    code: "B",
    questions: [
      { id: "B1", text: "Player demonstrates strong map awareness (enemy positions, objective status, flank routes)." },
      { id: "B2", text: "Player understands and plays according to the current objective effectively." },
      { id: "B3", text: "Player makes sound decisions regarding positioning during fights and rotations." },
      { id: "B4", text: "Player understands character matchups, synergies, and potential team comps." },
      { id: "B5", text: "Player effectively manages their ultimate ability (builds it efficiently, uses it impactfully)." },
      { id: "B6", text: "Player contributes valuable input to team strategy and potential adjustments." },
      { id: "B7", text: "Player understands and tracks ultimate economy and cooldowns." }
    ]
  },
  {
    category: "Teamwork & Communication",
    code: "C",
    questions: [
      { id: "C1", text: "Player communicates clearly, concisely, and provides relevant information (callouts, intentions)." },
      { id: "C2", text: "Player actively listens to and processes teammate communication and callouts." },
      { id: "C3", text: "Player coordinates effectively with teammates for ability combos and ultimate usage." },
      { id: "C4", text: "Player follows team directives and adapts to team calls during a match." },
      { id: "C5", text: "Player maintains a positive and constructive attitude within the team environment." },
      { id: "C6", text: "Player fulfills their role responsibilities in relation to others (peeling, focusing targets called)." }
    ]
  },
  {
    category: "Adaptability & Learning",
    code: "D",
    questions: [
      { id: "D1", text: "Player adapts their playstyle effectively based on the flow of the game and enemy strategies." },
      { id: "D2", text: "Player is receptive to constructive criticism and coaching feedback." },
      { id: "D3", text: "Player actively seeks to learn from mistakes (e.g., through VOD review, self-reflection)." },
      { id: "D4", text: "Player demonstrates improvement in areas previously identified for development." },
      { id: "D5", text: "Player shows willingness to learn new heroes, roles, or strategies as required by the team." }
    ]
  },
  {
    category: "Attitude & Professionalism",
    code: "E",
    questions: [
      { id: "E1", text: "Player maintains composure under pressure and avoids tilt." },
      { id: "E2", text: "Player demonstrates commitment and punctuality for practices, scrims, and matches." },
      { id: "E3", text: "Player shows respect toward teammates, opponents, and coaching staff." },
      { id: "E4", text: "Player contributes positively to team morale." },
      { id: "E5", text: "Player displays a strong work ethic and desire to improve." },
      { id: "E6", text: "Player adheres to team rules and codes of conduct." }
    ]
  }
];

// Function to upload all questions to Firestore
async function uploadQuestions() {
  try {
    // Clear existing questions if any
    const questionsRef = db.collection('questions');
    const snapshot = await questionsRef.get();
    
    // Delete existing documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log('Existing questions cleared.');
    
    // Add new questions
    for (const category of evaluationQuestions) {
      // Create a category document
      const categoryRef = await questionsRef.add({
        name: category.category,
        code: category.code,
        type: 'category'
      });
      
      console.log(`Category added: ${category.category}`);
      
      // Add all questions for this category
      for (const question of category.questions) {
        await questionsRef.add({
          categoryId: categoryRef.id,
          categoryCode: category.code,
          id: question.id,
          text: question.text,
          type: 'question'
        });
      }
      
      console.log(`Added ${category.questions.length} questions for category: ${category.category}`);
    }
    
    console.log('All questions uploaded successfully!');
  } catch (error) {
    console.error('Error uploading questions:', error);
  } finally {
    // Exit the process when done
    process.exit(0);
  }
}

// Run the upload function
uploadQuestions(); 