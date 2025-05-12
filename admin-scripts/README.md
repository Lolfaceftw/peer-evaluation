# Peer Evaluation Questions Uploader

This script uploads evaluation questions to Firebase Firestore for the Peer Evaluation app.

## Structure

The questions are structured in categories as follows:
- A. Mechanical Skill & Hero Proficiency
- B. Game Sense & Strategy
- C. Teamwork & Communication 
- D. Adaptability & Learning
- E. Attitude & Professionalism

Each category contains multiple questions with unique IDs.

## Usage

1. Ensure you have Node.js installed
2. Install dependencies
   ```
   npm install
   ```

3. Place the Firebase service account key in `serviceAccount/serviceAccountKey.json`
   - This key should be downloaded from the Firebase console
   - Keep this key secure and never commit it to public repositories

4. Run the upload script
   ```
   node upload-questions.js
   ```
   
   Or use the npm script:
   ```
   npm run upload-questions
   ```

## Firestore Schema

The script creates the following structure in Firestore:

- **Collection:** `questions`
  - **Documents of type 'category':**
    - `name`: Category name
    - `code`: Category code (A, B, C, etc.)
    - `type`: "category"
  
  - **Documents of type 'question':**
    - `categoryId`: Reference to parent category document ID
    - `categoryCode`: Category code (A, B, C, etc.)
    - `id`: Question ID (e.g., A1, B2, etc.)
    - `text`: Question text
    - `type`: "question"

## Modifying Questions

To modify the questions:
1. Edit the `evaluationQuestions` array in `upload-questions.js`
2. Run the script again to update Firestore

Note: Running the script will clear all existing questions in the collection before uploading the new ones.

## Integrating with Web Application

The file `modify-existing-script.js` contains example code snippets showing how to update the main web application to use the categorized questions structure. This includes:

1. Function to fetch questions from Firestore organized by category
2. Function to build HTML for displaying categorized questions with Likert scales
3. Function to collect scores from the updated UI
4. Instructions on how to modify the existing evaluation form and submission logic

These code snippets are meant as a reference for updating the main application's `script.js` file.

### `hard-reset-evaluations.js`

**Purpose:** This script PERMANENTLY DELETES ALL DATA from the `evaluations` and `summarized_evaluations` Firestore collections. It is intended for performing a complete hard reset of evaluation data.

**WARNING: THIS IS A DESTRUCTIVE OPERATION. THERE IS NO UNDO. USE WITH EXTREME CAUTION. IT IS STRONGLY RECOMMENDED TO HAVE FIRESTORE BACKUPS ENABLED AND TO TEST THIS SCRIPT IN A NON-PRODUCTION ENVIRONMENT FIRST.**

**Prerequisites:**

1.  **Service Account Key:** You must have a Firebase service account key JSON file with Firestore read/write permissions.
2.  **Dependencies:** Ensure `firebase-admin` and a CommonJS-compatible version of `inquirer` (e.g., v8.x.x) are installed in the `admin-scripts` directory:
    ```bash
    npm install firebase-admin inquirer@8.2.4
    ```

**Configuration:**

1.  Open `