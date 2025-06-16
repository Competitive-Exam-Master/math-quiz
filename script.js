document.addEventListener('DOMContentLoaded', () => {
    const databaseCheckboxesDiv = document.getElementById('database-checkboxes');
    const generateBtn = document.getElementById('generate-questions-btn');
    const resetSessionBtn = document.getElementById('reset-session-btn');
    const questionListDiv = document.getElementById('question-list');
    const sessionMessageDiv = document.getElementById('session-message');

    const questionsBasePath = './questions/';
    const databaseListFile = 'databases.csv'; // <--- NEW: Path to your CSV file

    let allQuestions = {}; // Stores questions categorized by database name
    let availableQuestionsForSession = []; // Questions remaining for the current session
    const questionsPerBatch = 5;

    // Function to extract a unique ID and content from an H2-separated question block
    function parseQuestionsFromMarkdown(markdownContent) {
        const questions = [];
        const regex = /^##\s*(.+)\n([\s\S]*?)(?=(^##\s*|$))/gm;
        let match;

        while ((match = regex.exec(markdownContent)) !== null) {
            const id = match[1].trim();
            const content = match[2].trim();
            questions.push({ id, content });
        }
        return questions;
    }

    // NEW FUNCTION: Fetch and parse the list of question database files from CSV
    async function fetchQuestionFileList() {
        try {
            const response = await fetch(databaseListFile);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${databaseListFile}`);
            }
            const csvText = await response.text();
            // Split by new line, filter out empty lines, and trim whitespace
            return csvText.split('\n')
                          .map(line => line.trim())
                          .filter(line => line.length > 0);
        } catch (error) {
            console.error(`Error fetching database list:`, error);
            sessionMessageDiv.textContent = `Error loading database list: ${error.message}. Check '${databaseListFile}'.`;
            generateBtn.disabled = true; // Disable generation if list can't be loaded
            return []; // Return empty array to prevent further errors
        }
    }

    // Load question files and populate checkboxes
    async function loadQuestionDatabases() {
        const questionFiles = await fetchQuestionFileList(); // <--- CHANGE: Get files from CSV

        if (questionFiles.length === 0) {
            sessionMessageDiv.textContent = "No question databases found in 'databases.csv'. Please add filenames to it.";
            generateBtn.disabled = true;
            return;
        }

        for (const file of questionFiles) {
            const dbName = file.replace('.md', '');
            try {
                const response = await fetch(`${questionsBasePath}${file}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${file}`);
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
                label.textContent = dbName.charAt(0).toUpperCase() + dbName.slice(1).replace(/_/g, ' '); // Capitalize and replace underscores
                label.prepend(checkbox);
                databaseCheckboxesDiv.appendChild(label);

            } catch (error) {
                console.error(`Error loading ${file}:`, error);
                const errorMessage = document.createElement('p');
                errorMessage.style.color = 'red';
                errorMessage.textContent = `Could not load ${dbName} questions. Check file: '${questionsBasePath}${file}'.`;
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

        if (availableQuestionsForSession.length === 0) {
            sessionMessageDiv.textContent = "All available questions from your current selection have been shown. Please click 'Start New Session' to get more questions or select new databases.";
            generateBtn.disabled = true;
            resetSessionBtn.style.display = 'inline-block';
            return;
        }

        const questionsToDisplay = [];
        const numToPick = Math.min(questionsPerBatch, availableQuestionsForSession.length);

        for (let i = 0; i < numToPick; i++) {
            const randomIndex = Math.floor(Math.random() * availableQuestionsForSession.length);
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
    async function displayQuestions(questions) {
        questionListDiv.innerHTML = '';
        if (questions.length === 0) {
            questionListDiv.innerHTML = '<p>No questions to display.</p>';
            return;
        }

        questions.forEach(q => {
            const questionItem = document.createElement('div');
            questionItem.classList.add('question-item');
            questionItem.innerHTML = `<h3>${q.id}</h3>${q.content}`;
            questionListDiv.appendChild(questionItem);
        });

        if (window.MathJax) {
            await MathJax.startup.promise;
            console.log("MathJax is ready, triggering typesetting for new content.");
            try {
                await MathJax.typesetPromise();
                console.log("MathJax typesetting complete for current batch.");
            } catch (err) {
                console.error("MathJax typesetting failed:", err);
            }
        } else {
            console.warn("MathJax object not found. Ensure the MathJax script is loaded in index.html.");
        }
    }

    // Initial load: Load databases and then start a new session
    // Call loadQuestionDatabases after fetchQuestionFileList is done
    loadQuestionDatabases().then(() => {
        startNewSession();
    });
});
