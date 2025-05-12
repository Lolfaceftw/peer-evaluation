/**
 * This file is not meant to be executed directly.
 * It contains code snippets showing how to modify the main web application
 * to use the categorized questions structure.
 */

/**
 * Example modification to fetch and display questions with categories
 * Replace this in the existing script.js file
 */

// Function to fetch questions from Firestore and organize by category
async function fetchCategorizedQuestions() {
  try {
    // First, fetch all category documents
    const categoriesSnapshot = await db.collection('questions')
      .where('type', '==', 'category')
      .orderBy('code')
      .get();
    
    const categories = [];
    categoriesSnapshot.forEach(doc => {
      categories.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Then fetch all questions
    const questionsSnapshot = await db.collection('questions')
      .where('type', '==', 'question')
      .orderBy('categoryCode')
      .orderBy('id')
      .get();
    
    // Organize questions by category
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
    
    return organizedQuestions;
  } catch (error) {
    console.error('Error fetching categorized questions:', error);
    return null;
  }
}

// Example function to build the HTML for the categorized questions
function buildCategorizedQuestionsHTML(organizedQuestions) {
  const container = document.createElement('div');
  container.className = 'evaluation-categories-container';
  
  // Loop through each category
  Object.values(organizedQuestions).forEach(category => {
    const categorySection = document.createElement('div');
    categorySection.className = 'category-section';
    
    // Add category header
    const categoryHeader = document.createElement('h3');
    categoryHeader.textContent = `${category.categoryDetails.code}. ${category.categoryDetails.name}`;
    categorySection.appendChild(categoryHeader);
    
    // Create question list
    const questionsList = document.createElement('ol');
    
    // Add each question
    category.questions.forEach(question => {
      const questionItem = document.createElement('li');
      
      // Create Likert scale inputs
      const likertContainer = document.createElement('div');
      likertContainer.className = 'likert-scale';
      
      // Create question text
      const questionText = document.createElement('span');
      questionText.textContent = question.text;
      questionItem.appendChild(questionText);
      
      // Create 5-point scale (1-5)
      const scaleOptions = document.createElement('div');
      scaleOptions.className = 'scale-options';
      
      for (let i = 1; i <= 5; i++) {
        const optionContainer = document.createElement('div');
        optionContainer.className = 'scale-option';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question_${question.id}`;
        input.value = i;
        input.id = `question_${question.id}_rating_${i}`;
        input.dataset.questionId = question.id;
        
        const label = document.createElement('label');
        label.setAttribute('for', `question_${question.id}_rating_${i}`);
        label.textContent = i;
        
        optionContainer.appendChild(input);
        optionContainer.appendChild(label);
        scaleOptions.appendChild(optionContainer);
      }
      
      likertContainer.appendChild(scaleOptions);
      questionItem.appendChild(likertContainer);
      questionsList.appendChild(questionItem);
    });
    
    categorySection.appendChild(questionsList);
    container.appendChild(categorySection);
  });
  
  return container;
}

// Example of how to modify the setupEvaluationUI function
// to use the categorized questions
async function setupEvaluationUIWithCategories() {
  // ... existing code ...
  
  // Fetch categorized questions
  const organizedQuestions = await fetchCategorizedQuestions();
  
  if (!organizedQuestions) {
    console.error('Failed to fetch questions.');
    return;
  }
  
  // Clear previous questions
  evaluationQuestionsContainer.innerHTML = '';
  
  // Build and append questions HTML
  const questionsElement = buildCategorizedQuestionsHTML(organizedQuestions);
  evaluationQuestionsContainer.appendChild(questionsElement);
  
  // ... rest of the existing code ...
}

// Example modification to collect scores from the categorized UI
function collectScoresFromCategorizedUI() {
  const scores = {};
  const radioButtons = document.querySelectorAll('.likert-scale input[type="radio"]:checked');
  
  radioButtons.forEach(radio => {
    const questionId = radio.dataset.questionId;
    scores[questionId] = parseInt(radio.value, 10);
  });
  
  return scores;
}

// Remember to modify the handleSubmitEvaluation function to use the new scores format
// The scores will now be keyed by question ID instead of just sequential numbers 