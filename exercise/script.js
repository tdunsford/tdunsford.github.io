// Get current date as YYYY-MM-DD
const today = new Date();
const dateString = today.toISOString().split('T')[0];
document.getElementById('current-date').textContent = `Exercises for ${dateString}`;

// Cache for fetched columns
let columnsCache = [];

// Persistent extra seed stored in localStorage. Default 0 keeps previous date-only behavior.
function getExtraSeed() {
    const v = localStorage.getItem('extraSeed');
    return v !== null ? parseInt(v, 10) : 0;
}

function setExtraSeed(val) {
    localStorage.setItem('extraSeed', String(val));
    const display = document.getElementById('seed-display');
    if (display) display.textContent = `Seed value: ${val}`;
}

function generateNewSeed() {
    const newVal = Math.floor(Math.random() * 1e9);
    setExtraSeed(newVal);
    generateExercises();
}

function resetSeed() {
    setExtraSeed(0);
    generateExercises();
}

// Combined hash function using date + extraSeed for deterministic but controllable seed
function getSeed(dateString) {
    const extra = getExtraSeed();
    const combined = `${dateString}|${extra}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Initialize seed display on load
setTimeout(() => setExtraSeed(getExtraSeed()), 0);

// Generate random number using seed
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Select random exercise from array with seeded randomness
function getRandomExercise(array, seed) {
    const random = seededRandom(seed);
    const index = Math.floor(random * array.length);
    return array[index];
}

// Get cookie value by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Set cookie with name, value, and days to expire
function setCookie(name, value, days) {
    const expires = days ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}` : '';
    document.cookie = `${name}=${value}${expires}; path=/`;
}

// Get exercise data from cookie
function getExerciseData(exerciseName) {
    const cookieName = `exercise_${exerciseName}`;
    const data = getCookie(cookieName);
    return data ? JSON.parse(data) : { reps: '', weight: '' };
}

// Save exercise data to cookie
function saveExerciseData(exerciseName, reps, weight) {
    const cookieName = `exercise_${exerciseName}`;
    setCookie(cookieName, JSON.stringify({ reps, weight }), 30); // Save for 30 days
}

// Get completed status from localStorage
function getCompletedStatus(exerciseName) {
    const extra = getExtraSeed();
    const key = `completed_${dateString}_${extra}_${exerciseName}`;
    return localStorage.getItem(key) === 'true';
}

// Set completed status in localStorage
function setCompletedStatus(exerciseName, completed) {
    const extra = getExtraSeed();
    const key = `completed_${dateString}_${extra}_${exerciseName}`;
    localStorage.setItem(key, completed.toString());
}

// Fetch data from Google Sheet
async function fetchExercises() {
    try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3FpjlJSKTBxMpjLjv5D6wW2dBMrib2ZCrOH8V1geesAIP3Y4zuzXZCYclA80gAJuBnORSTh1L7Wnc/pub?output=csv');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        // Parse CSV data
        const columns = [];
        lines.forEach((line, index) => {
            // if (index === 0) return; // Skip header row
            
            const cells = line.split(',');
            cells.forEach((cell, cellIndex) => {
                if (!columns[cellIndex]) columns[cellIndex] = [];
                if (cell.trim() !== '') {
                    columns[cellIndex].push(cell.trim());
                }
            });
        });
        
        // Remove empty columns
        const validColumns = columns.filter(col => col.length > 0);
        columnsCache = validColumns;
        return validColumns;
    } catch (error) {
        console.error('Error fetching exercises:', error);
        document.getElementById('loading').innerHTML = 
            '<div class="error">Failed to load exercises. Please try again later.</div>';
        return null;
    }
}

// Update exercise data in cookie
function updateExerciseData(exerciseName, field, value) {
    const savedData = getExerciseData(exerciseName);
    savedData[field] = value;
    saveExerciseData(exerciseName, savedData.reps, savedData.weight);
}

// Generate exercises for today
async function generateExercises() {
    const loadingElement = document.getElementById('loading');
    const container = document.getElementById('exercises-container');
    
    loadingElement.style.display = 'block';
    container.innerHTML = '';
    
    try {
        const exercises = await fetchExercises();
        
        if (!exercises || exercises.length === 0) {
            loadingElement.innerHTML = '<div class="error">No exercises found in the spreadsheet.</div>';
            return;
        }
        
        loadingElement.style.display = 'none';
        
        const seed = getSeed(dateString);

        exercises.forEach((column, columnIndex) => {
            const categoryName = column[0];

            const overrideKey = `override_${dateString}_${getExtraSeed()}_${columnIndex}`;
            const override = localStorage.getItem(overrideKey);

            // Determine initial exercise (override if present)
            let exerciseName = override || getRandomExercise(column.slice(1), seed + columnIndex);

            const savedData = getExerciseData(exerciseName);

            const card = document.createElement('div');
            card.className = 'exercise-card';
            card.dataset.exerciseName = exerciseName;
            card.dataset.categoryName = categoryName;
            card.dataset.columnIndex = columnIndex;

            const title = document.createElement('div');
            title.className = 'category-title';
            title.textContent = categoryName;
            container.appendChild(title);

            const exerciseNameElement = document.createElement('div');
            exerciseNameElement.className = 'exercise-name';
            exerciseNameElement.textContent = exerciseName;

            // Create details section
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'exercise-details';

            const repsRow = document.createElement('div');
            repsRow.className = 'detail-row';
            const repsLabel = document.createElement('span');
            repsLabel.className = 'detail-label';
            repsLabel.textContent = 'Reps:';
            const repsSpan = document.createElement('span');
            repsSpan.className = 'editable-value';
            repsSpan.id = `reps-${exerciseName}`;
            repsSpan.dataset.field = 'reps';
            repsSpan.textContent = savedData.reps || '--';
            repsRow.appendChild(repsLabel);
            repsRow.appendChild(repsSpan);

            const weightRow = document.createElement('div');
            weightRow.className = 'detail-row';
            const weightLabel = document.createElement('span');
            weightLabel.className = 'detail-label';
            weightLabel.textContent = 'Weight:';
            const weightSpan = document.createElement('span');
            weightSpan.className = 'editable-value';
            weightSpan.id = `weight-${exerciseName}`;
            weightSpan.dataset.field = 'weight';
            weightSpan.textContent = savedData.weight || '--';
            weightRow.appendChild(weightLabel);
            weightRow.appendChild(weightSpan);

            detailsContainer.appendChild(repsRow);
            detailsContainer.appendChild(weightRow);

            // Add completion checkbox
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'completion-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `completed-${exerciseName}`;
            checkbox.checked = getCompletedStatus(exerciseName);
            checkbox.addEventListener('change', () => {
                setCompletedStatus(card.dataset.exerciseName, checkbox.checked);
            });
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = 'Completed';
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);

            // Change button (pick a different exercise from this column only)
            const changeBtn = document.createElement('button');
            changeBtn.className = 'change-btn';
            changeBtn.type = 'button';
            changeBtn.textContent = 'Change';
            changeBtn.addEventListener('click', () => {
                const options = column.slice(1).filter(e => e !== card.dataset.exerciseName);
                if (options.length === 0) return;
                const newExercise = options[Math.floor(Math.random() * options.length)];
                // persist override for this column/date/extra seed
                localStorage.setItem(overrideKey, newExercise);

                // update card dataset and displayed values
                card.dataset.exerciseName = newExercise;
                exerciseNameElement.textContent = newExercise;

                const newSaved = getExerciseData(newExercise);
                repsSpan.id = `reps-${newExercise}`;
                repsSpan.textContent = newSaved.reps || '--';
                weightSpan.id = `weight-${newExercise}`;
                weightSpan.textContent = newSaved.weight || '--';

                // update checkbox id and state
                checkbox.id = `completed-${newExercise}`;
                label.htmlFor = checkbox.id;
                checkbox.checked = getCompletedStatus(newExercise);
            });

            // Attach edit handlers that reference card.dataset.exerciseName at click time
            repsSpan.addEventListener('click', () => editValue(card.dataset.exerciseName, 'reps'));
            weightSpan.addEventListener('click', () => editValue(card.dataset.exerciseName, 'weight'));

            // Create footer to hold details and checkbox side by side
            const footer = document.createElement('div');
            footer.className = 'exercise-footer';
            footer.appendChild(detailsContainer);

            // put checkbox and change button together
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.alignItems = 'center';
            controls.appendChild(checkboxContainer);
            controls.appendChild(changeBtn);

            footer.appendChild(controls);

            card.appendChild(exerciseNameElement);
            card.appendChild(footer);

            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error generating exercises:', error);
        loadingElement.innerHTML = '<div class="error">Error generating exercises. Please try again.</div>';
    }
}

// Function to handle editing values
function editValue(exerciseName, field) {
    const currentValue = getExerciseData(exerciseName)[field];
    const newValue = prompt(`Enter ${field}:`, currentValue);
    
    if (newValue !== null) {
        updateExerciseData(exerciseName, field, newValue);
        // Update the display
        document.getElementById(`${field}-${exerciseName}`).textContent = newValue || '--';
    }
}

// Generate exercises on page load
generateExercises();
