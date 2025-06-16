document.addEventListener('DOMContentLoaded', () => {
    const databaseCheckboxesDiv = document.getElementById('database-checkboxes');
    const generateBtn = document.getElementById('generate-questions-btn');
    const resetSessionBtn = document.getElementById('reset-session-btn');
    const questionListDiv = document.getElementById('question-list');
    const sessionMessageDiv = document.getElementById('session-message');

    const questionsBasePath = './questions/';
    const questionFiles = ['algebra.md', 'calculus.md', 'geometry.md']; // Add more as you create them

    let allQuestions = {}; // Stores questions categorized by database name
    let availableQuestionsForSession = []; // Questions remaining for the current session
    const questionsPerBatch = 5;

    // Function to extract a unique ID and content from an H2-separated question block
    function parseQuestionsFromMarkdown(markdownContent) {
        const questions = [];
        // Split by H2 headings (e.g., "## AlgQ1")
        // The regex captures the heading text (group 1) and then the content following it.
        // We use a non-greedy match for content until the next H2 or end of string.
        const regex = /^##\s*(.+)\n([\s\S]*?)(?=(^##\s*|$))/gm;
        let match;

        while ((match = regex.exec(markdownContent)) !== null) {
            const id = match[1].trim();
            const content = match[2].trim();
            questions.push({ id, content });
        }
        return questions;
    }

    // Load question files and populate checkboxes
    async function loadQuestionDatabases() {
        for (const file of questionFiles) {
            const dbName = file.replace('.md', ''); // e.g., 'algebra'
            try {
                const response = await fetch(`${questionsBasePath}${file}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const markdown = await response.text();
                allQuestions[dbName] = parseQuestionsFromMarkdown(markdown);

                // Create checkbox for each database
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = dbName;
                checkbox.id = `db-${dbName}`;
                label.htmlFor = `db-${dbName}`;
                label.textContent = dbName.charAt(0).toUpperCase() + dbName.slice(1); // Capitalize first letter
                label.prepend(checkbox);
                databaseCheckboxesDiv.appendChild(label);

            } catch (error) {
                console.error(`Error loading ${file}:`, error);
                const errorMessage = document.createElement('p');
                errorMessage.style.color = 'red';
                errorMessage.textContent = `Could not load ${dbName} questions. Please check the file path and content.`;
                databaseCheckboxesDiv.appendChild(errorMessage);
            }
        }
    }

    // Initialize a new session
    function startNewSession() {
        availableQuestionsForSession = [];
        questionListDiv.innerHTML = '';
        sessionMessageDiv.textContent = 'Select databases and generate questions.';
        generateBtn.disabled = false;
        resetSessionBtn.style.display = 'none';

        // Uncheck all checkboxes
        document.querySelectorAll('#database-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    // Event listener for Generate Questions button
    generateBtn.addEventListener('click', () => {
        const selectedDBs = Array.from(document.querySelectorAll('#database-checkboxes input[type="checkbox"]:checked'))
                               .map(cb => cb.value);

        if (selectedDBs.length === 0) {
            alert('Please select at least one question database.');
            return;
        }

        // If starting a new selection or previous pool is exhausted, populate the pool
        if (availableQuestionsForSession.length === 0) {
            const uniqueQuestionsFromSelectedDBs = new Set();
            selectedDBs.forEach(dbName => {
                if (allQuestions[dbName]) {
                    allQuestions[dbName].forEach(q => uniqueQuestionsFromSelectedDBs.add(JSON.stringify(q)));
                }
            });
            availableQuestionsForSession = Array.from(uniqueQuestionsFromSelectedDBs).map(qStr => JSON.parse(qStr));

            if (availableQuestionsForSession.length === 0) {
                sessionMessageDiv.textContent = "No questions found in the selected databases. Please check the files or select different databases.";
                generateBtn.disabled = true;
                return;
            }
            sessionMessageDiv.textContent = `New session started with ${availableQuestionsForSession.length} total unique questions.`;
        }

        // Check if all questions are used, if so, prompt to reset
        if (availableQuestionsForSession.length === 0) {
            sessionMessageDiv.textContent = "All available questions from your current selection have been shown. Please click 'Start New Session' to get more questions or select new databases.";
            generateBtn.disabled = true;
            resetSessionBtn.style.display = 'inline-block'; // Show reset button
            return;
        }

        // Randomly select 5 questions (or fewer if not enough available)
        const questionsToDisplay = [];
        const numToPick = Math.min(questionsPerBatch, availableQuestionsForSession.length);

        for (let i = 0; i < numToPick; i++) {
            const randomIndex = Math.floor(Math.random() * availableQuestionsForSession.length);
            // Splice removes the item and returns an array of the removed item(s)
            const question = availableQuestionsForSession.splice(randomIndex, 1)[0];
            questionsToDisplay.push(question);
        }

        displayQuestions(questionsToDisplay);

        if (availableQuestionsForSession.length === 0) {
            sessionMessageDiv.textContent = "All available questions from your current selection have been shown. Please click 'Start New Session' to get more questions or select new databases.";
            generateBtn.disabled = true;
            resetSessionBtn.style.display = 'inline-block';
        } else {
            sessionMessageDiv.textContent = `Remaining questions in current session pool: ${availableQuestionsForSession.length}`;
            resetSessionBtn.style.display = 'inline-block';
        }
    });

    // Event listener for Reset Session button
    resetSessionBtn.addEventListener('click', startNewSession);

    // Display questions on the page and trigger MathJax rendering
    function displayQuestions(questions) {
        questionListDiv.innerHTML = ''; // Clear previous questions
        if (questions.length === 0) {
            questionListDiv.innerHTML = '<p>No questions to display.</p>';
            return;
        }

        questions.forEach(q => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            // Directly set innerHTML. MathJax will process this.
            questionItem.innerHTML = `<h3>${q.id}</h3>${q.content}`;
            questionListDiv.appendChild(questionItem);
        });

        // Crucial: Tell MathJax to re-render the newly added content
        // Check if MathJax is defined before calling its method
        if (typeof MathJax !== 'undefined') {
            console.log("Calling MathJax.typesetPromise()...");
            MathJax.typesetPromise()
                .then(() => {
                    console.log("MathJax typesetting complete.");
                })
                .catch((err) => {
                    console.error("MathJax typesetting failed:", err);
                });
        } else {
            console.warn("MathJax not loaded yet or not found when attempting to typeset.");
        }
    }

    // Initial load: Load databases and then start a new session
    loadQuestionDatabases().then(() => {
        startNewSession();
    });
});
