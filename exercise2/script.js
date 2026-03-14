const LIBRARY_STORAGE_KEY = 'exerciseLibrary_v1';
const LIBRARY_VERSION = 1;
const HISTORY_STORAGE_KEY = 'exerciseHistory_v1';
const HISTORY_VERSION = 1;
const EXTRA_SEED_STORAGE_KEY = 'extraSeed';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const state = {
    dateString: getLocalDateString(new Date()),
    library: loadLibrary(),
    history: loadHistory(),
    historyViewMonth: getMonthStart(new Date()),
    selectedHistoryDate: null,
    activeTab: 'exercise',
    statusTimer: null,
    ui: {}
};

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDateString(dateString) {
    const parts = String(dateString || '').split('-').map((part) => parseInt(part, 10));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(value) {
    return String(value || '').trim();
}

function normalizeName(value) {
    return sanitizeName(value).toLowerCase();
}

function getDefaultLibrary() {
    return {
        version: LIBRARY_VERSION,
        categories: []
    };
}

function getDefaultHistory() {
    return {
        version: HISTORY_VERSION,
        entries: []
    };
}

function normalizeLibrary(raw) {
    const categories = Array.isArray(raw && raw.categories) ? raw.categories : [];

    return {
        version: LIBRARY_VERSION,
        categories: categories.map((category) => {
            const exercises = Array.isArray(category && category.exercises) ? category.exercises : [];
            return {
                id: sanitizeName(category && category.id) || createId('cat'),
                name: sanitizeName(category && category.name),
                exercises: exercises.map((exercise) => ({
                    id: sanitizeName(exercise && exercise.id) || createId('ex'),
                    name: sanitizeName(exercise && exercise.name)
                })).filter((exercise) => exercise.name)
            };
        }).filter((category) => category.name)
    };
}

function validateLibrary(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, message: 'Library file must be a JSON object.' };
    }

    if (!Array.isArray(raw.categories)) {
        return { ok: false, message: 'Library JSON must include a categories array.' };
    }

    const library = normalizeLibrary(raw);

    const categoryNameSet = new Set();
    const categoryIdSet = new Set();

    for (const category of library.categories) {
        const normalizedCategoryName = normalizeName(category.name);

        if (categoryNameSet.has(normalizedCategoryName)) {
            return { ok: false, message: `Duplicate category name: "${category.name}".` };
        }

        if (categoryIdSet.has(category.id)) {
            return { ok: false, message: `Duplicate category id: "${category.id}".` };
        }

        categoryNameSet.add(normalizedCategoryName);
        categoryIdSet.add(category.id);

        const exerciseNameSet = new Set();
        const exerciseIdSet = new Set();

        for (const exercise of category.exercises) {
            const normalizedExerciseName = normalizeName(exercise.name);

            if (!normalizedExerciseName) {
                return { ok: false, message: `Category "${category.name}" has an empty exercise name.` };
            }

            if (exerciseNameSet.has(normalizedExerciseName)) {
                return {
                    ok: false,
                    message: `Duplicate exercise "${exercise.name}" in category "${category.name}".`
                };
            }

            if (exerciseIdSet.has(exercise.id)) {
                return {
                    ok: false,
                    message: `Category "${category.name}" has duplicate exercise ids.`
                };
            }

            exerciseNameSet.add(normalizedExerciseName);
            exerciseIdSet.add(exercise.id);
        }
    }

    return { ok: true, library };
}

function normalizeHistory(raw) {
    const entries = Array.isArray(raw && raw.entries) ? raw.entries : [];

    return {
        version: HISTORY_VERSION,
        entries: entries.map((entry) => {
            const entryDate = sanitizeName(entry && entry.date);
            const parsedDate = parseLocalDateString(entryDate);

            return {
                id: sanitizeName(entry && entry.id) || createId('hist'),
                date: parsedDate ? getLocalDateString(parsedDate) : '',
                completedAt: sanitizeName(entry && entry.completedAt) || new Date().toISOString(),
                categoryId: sanitizeName(entry && entry.categoryId),
                categoryName: sanitizeName(entry && entry.categoryName),
                exerciseId: sanitizeName(entry && entry.exerciseId),
                exerciseName: sanitizeName(entry && entry.exerciseName),
                reps: entry && entry.reps !== undefined ? String(entry.reps) : '',
                weight: entry && entry.weight !== undefined ? String(entry.weight) : '',
                seed: typeof (entry && entry.seed) === 'number' ? entry.seed : 0
            };
        }).filter((entry) => entry.date && entry.exerciseName)
    };
}

function validateHistory(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, message: 'History must be a JSON object.' };
    }

    if (!Array.isArray(raw.entries)) {
        return { ok: false, message: 'History JSON must include an entries array.' };
    }

    const history = normalizeHistory(raw);
    return { ok: true, history };
}

function loadLibrary() {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);

    if (!raw) return getDefaultLibrary();

    try {
        const parsed = JSON.parse(raw);
        const validation = validateLibrary(parsed);
        if (!validation.ok) return getDefaultLibrary();
        return validation.library;
    } catch {
        return getDefaultLibrary();
    }
}

function loadHistory() {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!raw) return getDefaultHistory();

    try {
        const parsed = JSON.parse(raw);
        const validation = validateHistory(parsed);
        if (!validation.ok) return getDefaultHistory();
        return validation.history;
    } catch {
        return getDefaultHistory();
    }
}

function saveLibrary() {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library));
}

function saveHistory() {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history));
}

function getExtraSeed() {
    const value = localStorage.getItem(EXTRA_SEED_STORAGE_KEY);
    if (value === null) return 0;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function setExtraSeed(value) {
    localStorage.setItem(EXTRA_SEED_STORAGE_KEY, String(value));
}

function generateNewSeed() {
    const newValue = Math.floor(Math.random() * 1e9);
    setExtraSeed(newValue);
    generateExercises();
}

function getSeed(dateString) {
    const extra = getExtraSeed();
    const combined = `${dateString}|${extra}`;

    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash &= hash;
    }

    return Math.abs(hash);
}

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function getRandomExercise(exercises, seed) {
    const random = seededRandom(seed);
    const index = Math.floor(random * exercises.length);
    return exercises[index];
}

function getOverrideKey(categoryId) {
    const extra = getExtraSeed();
    return `override_${state.dateString}_${extra}_${categoryId}`;
}

function clearAllOverrideKeys() {
    const keysToDelete = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('override_')) {
            keysToDelete.push(key);
        }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
}

function getCookie(name) {
    const encodedName = `${encodeURIComponent(name)}=`;
    const cookies = document.cookie ? document.cookie.split('; ') : [];

    for (const cookie of cookies) {
        if (cookie.startsWith(encodedName)) {
            return decodeURIComponent(cookie.slice(encodedName.length));
        }
    }

    return null;
}

function setCookie(name, value, days) {
    const expires = days
        ? `; expires=${new Date(Date.now() + days * 86400000).toUTCString()}`
        : '';

    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

function getExerciseData(exerciseName) {
    const cookieName = `exercise_${exerciseName}`;
    const data = getCookie(cookieName);

    if (!data) return { reps: '', weight: '' };

    try {
        return JSON.parse(data);
    } catch {
        return { reps: '', weight: '' };
    }
}

function saveExerciseData(exerciseName, reps, weight) {
    const cookieName = `exercise_${exerciseName}`;
    setCookie(cookieName, JSON.stringify({ reps, weight }), 30);
}

function updateExerciseData(exerciseName, field, value) {
    const savedData = getExerciseData(exerciseName);
    savedData[field] = value;
    saveExerciseData(exerciseName, savedData.reps, savedData.weight);
}

function getCompletedStatus(categoryId, exerciseName) {
    const extra = getExtraSeed();
    const key = `completed_${state.dateString}_${extra}_${categoryId}_${exerciseName}`;
    return localStorage.getItem(key) === 'true';
}

function setCompletedStatus(categoryId, exerciseName, completed) {
    const extra = getExtraSeed();
    const key = `completed_${state.dateString}_${extra}_${categoryId}_${exerciseName}`;
    localStorage.setItem(key, completed.toString());
}

function addHistoryEntry(payload) {
    state.history.entries.push({
        id: createId('hist'),
        date: payload.date,
        completedAt: new Date().toISOString(),
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        exerciseId: payload.exerciseId,
        exerciseName: payload.exerciseName,
        reps: payload.reps || '',
        weight: payload.weight || '',
        seed: payload.seed || 0
    });

    saveHistory();
    renderHistory();
}

function setStatus(message, isError) {
    const el = state.ui.libraryStatus;
    el.textContent = message;
    el.classList.toggle('has-error', Boolean(isError));

    if (state.statusTimer) {
        clearTimeout(state.statusTimer);
        state.statusTimer = null;
    }

    if (message) {
        state.statusTimer = setTimeout(() => {
            el.textContent = '';
            el.classList.remove('has-error');
            state.statusTimer = null;
        }, 2500);
    }
}

function refreshCategorySelect() {
    const select = state.ui.categorySelect;
    const previousValue = select.value;
    select.innerHTML = '';

    if (state.library.categories.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No categories yet';
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    select.disabled = false;

    state.library.categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });

    if (previousValue && state.library.categories.some((category) => category.id === previousValue)) {
        select.value = previousValue;
    }
}

function renderLibraryList() {
    const list = state.ui.libraryList;
    list.innerHTML = '';

    if (state.library.categories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'library-empty';
        empty.textContent = 'No categories yet. Add a category and exercises to start generating workouts.';
        list.appendChild(empty);
        return;
    }

    state.library.categories.forEach((category) => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'library-category';

        const header = document.createElement('div');
        header.className = 'library-category-header';

        const categoryName = document.createElement('div');
        categoryName.className = 'library-category-name';
        categoryName.textContent = category.name;

        const removeCategoryBtn = document.createElement('button');
        removeCategoryBtn.type = 'button';
        removeCategoryBtn.className = 'danger-btn';
        removeCategoryBtn.textContent = 'Remove category';
        removeCategoryBtn.addEventListener('click', () => {
            const shouldDelete = window.confirm(`Remove category "${category.name}" and all its exercises?`);
            if (!shouldDelete) return;

            state.library.categories = state.library.categories.filter((item) => item.id !== category.id);
            clearAllOverrideKeys();
            saveLibrary();
            renderLibraryManager();
            generateExercises();
            setStatus('Category removed.', false);
        });

        header.appendChild(categoryName);
        header.appendChild(removeCategoryBtn);

        const exerciseList = document.createElement('div');
        exerciseList.className = 'exercise-chip-list';

        if (category.exercises.length === 0) {
            const emptyExercise = document.createElement('span');
            emptyExercise.className = 'library-empty';
            emptyExercise.textContent = 'No exercises yet';
            exerciseList.appendChild(emptyExercise);
        } else {
            category.exercises.forEach((exercise) => {
                const chip = document.createElement('span');
                chip.className = 'exercise-chip';
                chip.textContent = exercise.name;

                const removeExerciseBtn = document.createElement('button');
                removeExerciseBtn.type = 'button';
                removeExerciseBtn.setAttribute('aria-label', `Remove ${exercise.name}`);
                removeExerciseBtn.textContent = 'x';
                removeExerciseBtn.addEventListener('click', () => {
                    const shouldDelete = window.confirm(
                        `Remove exercise "${exercise.name}" from category "${category.name}"?`
                    );
                    if (!shouldDelete) return;

                    category.exercises = category.exercises.filter((item) => item.id !== exercise.id);
                    clearAllOverrideKeys();
                    saveLibrary();
                    renderLibraryManager();
                    generateExercises();
                    setStatus('Exercise removed.', false);
                });

                chip.appendChild(removeExerciseBtn);
                exerciseList.appendChild(chip);
            });
        }

        categoryItem.appendChild(header);
        categoryItem.appendChild(exerciseList);
        list.appendChild(categoryItem);
    });
}

function renderLibraryManager() {
    refreshCategorySelect();
    renderLibraryList();
}

function addCategory() {
    const name = sanitizeName(state.ui.categoryNameInput.value);

    if (!name) {
        setStatus('Category name is required.', true);
        return;
    }

    const exists = state.library.categories.some((category) => normalizeName(category.name) === normalizeName(name));
    if (exists) {
        setStatus('Category name already exists.', true);
        return;
    }

    state.library.categories.push({
        id: createId('cat'),
        name,
        exercises: []
    });

    state.ui.categoryNameInput.value = '';
    saveLibrary();
    renderLibraryManager();
    generateExercises();
    setStatus('Category added.', false);
}

function addExercise() {
    const categoryId = state.ui.categorySelect.value;
    const name = sanitizeName(state.ui.exerciseNameInput.value);

    if (!categoryId) {
        setStatus('Select a category first.', true);
        return;
    }

    if (!name) {
        setStatus('Exercise name is required.', true);
        return;
    }

    const category = state.library.categories.find((item) => item.id === categoryId);
    if (!category) {
        setStatus('Selected category not found.', true);
        return;
    }

    const exists = category.exercises.some((exercise) => normalizeName(exercise.name) === normalizeName(name));
    if (exists) {
        setStatus('Exercise already exists in this category.', true);
        return;
    }

    category.exercises.push({
        id: createId('ex'),
        name
    });

    state.ui.exerciseNameInput.value = '';
    saveLibrary();
    renderLibraryManager();
    generateExercises();
    setStatus('Exercise added.', false);
}

function buildExportPayload() {
    return {
        version: 1,
        library: state.library,
        history: state.history
    };
}

function exportLibraryJson() {
    const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `exercise-data-${state.dateString}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    setStatus('Data exported.', false);
}

function parseImportPayload(parsed) {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.library) {
        const libraryValidation = validateLibrary(parsed.library);
        if (!libraryValidation.ok) return { ok: false, message: libraryValidation.message };

        if (parsed.history !== undefined) {
            const historyValidation = validateHistory(parsed.history);
            if (!historyValidation.ok) return { ok: false, message: historyValidation.message };

            return {
                ok: true,
                library: libraryValidation.library,
                history: historyValidation.history,
                importedHistory: true
            };
        }

        return {
            ok: true,
            library: libraryValidation.library,
            history: state.history,
            importedHistory: false
        };
    }

    const legacyValidation = validateLibrary(parsed);
    if (!legacyValidation.ok) return { ok: false, message: legacyValidation.message };

    return {
        ok: true,
        library: legacyValidation.library,
        history: state.history,
        importedHistory: false
    };
}

async function importLibraryFile(file) {
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = parseImportPayload(parsed);

        if (!result.ok) {
            setStatus(result.message, true);
            return;
        }

        state.library = result.library;
        state.history = result.history;

        clearAllOverrideKeys();
        saveLibrary();
        if (result.importedHistory) saveHistory();

        renderLibraryManager();
        generateExercises();
        renderHistory();
        setStatus(result.importedHistory ? 'Library and history imported.' : 'Library imported.', false);
    } catch {
        setStatus('Invalid JSON file.', true);
    } finally {
        state.ui.importLibraryInput.value = '';
    }
}

function editValue(exerciseName, field, targetElement) {
    if (targetElement.dataset.editing === 'true') return;
    targetElement.dataset.editing = 'true';

    const currentValue = getExerciseData(exerciseName)[field] || '';
    const currentDisplay = targetElement.textContent;

    const input = document.createElement('input');
    input.className = 'inline-number-input';
    input.type = 'number';
    input.inputMode = field === 'reps' ? 'numeric' : 'decimal';
    input.step = field === 'reps' ? '1' : 'any';
    input.min = '0';
    input.placeholder = field === 'reps' ? '0' : '0.0';
    input.value = currentValue;
    input.setAttribute('aria-label', `Edit ${field}`);

    let finalized = false;
    const finish = (save) => {
        if (finalized) return;
        finalized = true;

        if (save) {
            const rawValue = input.value.trim();
            const isNumeric = rawValue === '' || !Number.isNaN(Number(rawValue));
            const newValue = isNumeric ? rawValue : currentValue;
            updateExerciseData(exerciseName, field, newValue);
            targetElement.textContent = newValue || '--';
        } else {
            targetElement.textContent = currentDisplay;
        }

        targetElement.dataset.editing = 'false';
        input.replaceWith(targetElement);
    };

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            finish(true);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            finish(false);
        }
    });

    input.addEventListener('blur', () => finish(true));

    targetElement.replaceWith(input);
    input.focus();
    input.select();
}

function createMetricChip(label, field, value) {
    const chip = document.createElement('div');
    chip.className = 'metric-chip';

    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'editable-value';
    valueEl.dataset.field = field;
    valueEl.textContent = value || '--';

    chip.appendChild(labelEl);
    chip.appendChild(valueEl);

    return { chip, valueEl };
}

function generateExercises() {
    const loadingElement = state.ui.loading;
    const container = state.ui.exercisesContainer;

    loadingElement.style.display = 'block';
    loadingElement.textContent = 'Loading exercises...';
    container.innerHTML = '';

    const categoriesWithExercises = state.library.categories.filter(
        (category) => Array.isArray(category.exercises) && category.exercises.length > 0
    );

    if (categoriesWithExercises.length === 0) {
        loadingElement.textContent = 'Add at least one category and one exercise to generate your workout.';
        return;
    }

    loadingElement.style.display = 'none';

    const dailySeed = getSeed(state.dateString);

    categoriesWithExercises.forEach((category, index) => {
        const overrideKey = getOverrideKey(category.id);
        const overrideExerciseId = localStorage.getItem(overrideKey);
        const overrideExercise = category.exercises.find((exercise) => exercise.id === overrideExerciseId);

        const selectedExercise = overrideExercise || getRandomExercise(category.exercises, dailySeed + index);
        const savedData = getExerciseData(selectedExercise.name);

        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.dataset.exerciseName = selectedExercise.name;
        card.dataset.exerciseId = selectedExercise.id;
        card.dataset.categoryId = category.id;

        const header = document.createElement('div');
        header.className = 'card-header';

        const nameRow = document.createElement('div');
        nameRow.className = 'exercise-name-row';

        const exerciseNameElement = document.createElement('div');
        exerciseNameElement.className = 'exercise-name';
        exerciseNameElement.textContent = selectedExercise.name;

        const changeBtn = document.createElement('button');
        changeBtn.className = 'change-icon-btn';
        changeBtn.type = 'button';
        changeBtn.textContent = '↻';
        changeBtn.setAttribute('aria-label', 'Change exercise');
        changeBtn.title = 'Change exercise';

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'category-badge';
        categoryBadge.textContent = category.name.toUpperCase();

        nameRow.appendChild(exerciseNameElement);
        nameRow.appendChild(changeBtn);
        header.appendChild(nameRow);
        header.appendChild(categoryBadge);

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const repsMetric = createMetricChip('Reps', 'reps', savedData.reps);
        const weightMetric = createMetricChip('Weight', 'weight', savedData.weight);

        meta.appendChild(repsMetric.chip);
        meta.appendChild(weightMetric.chip);

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'completion-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `completed-${category.id}`;
        checkbox.checked = getCompletedStatus(category.id, selectedExercise.name);

        checkbox.addEventListener('change', () => {
            const exerciseName = card.dataset.exerciseName;
            setCompletedStatus(category.id, exerciseName, checkbox.checked);

            if (checkbox.checked) {
                const metrics = getExerciseData(exerciseName);
                addHistoryEntry({
                    date: state.dateString,
                    categoryId: category.id,
                    categoryName: category.name,
                    exerciseId: card.dataset.exerciseId,
                    exerciseName,
                    reps: metrics.reps || '',
                    weight: metrics.weight || '',
                    seed: getExtraSeed()
                });
            }
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = 'Completed';

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);

        changeBtn.addEventListener('click', () => {
            const remaining = category.exercises.filter((exercise) => exercise.id !== card.dataset.exerciseId);
            if (remaining.length === 0) return;

            const next = remaining[Math.floor(Math.random() * remaining.length)];
            localStorage.setItem(overrideKey, next.id);

            card.dataset.exerciseName = next.name;
            card.dataset.exerciseId = next.id;
            exerciseNameElement.textContent = next.name;

            const nextSaved = getExerciseData(next.name);
            repsMetric.valueEl.textContent = nextSaved.reps || '--';
            weightMetric.valueEl.textContent = nextSaved.weight || '--';
            checkbox.checked = getCompletedStatus(category.id, next.name);
        });

        repsMetric.valueEl.addEventListener('click', () => editValue(card.dataset.exerciseName, 'reps', repsMetric.valueEl));
        weightMetric.valueEl.addEventListener('click', () => editValue(card.dataset.exerciseName, 'weight', weightMetric.valueEl));

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        actions.appendChild(checkboxContainer);

        const body = document.createElement('div');
        body.className = 'card-body';
        body.appendChild(meta);
        body.appendChild(actions);

        card.appendChild(header);
        card.appendChild(body);

        container.appendChild(card);
    });
}

function getHistoryEntriesForDate(dateKey) {
    return state.history.entries
        .filter((entry) => entry.date === dateKey)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

function getHistoryCountByDate() {
    const counts = new Map();

    state.history.entries.forEach((entry) => {
        const current = counts.get(entry.date) || 0;
        counts.set(entry.date, current + 1);
    });

    return counts;
}

function formatMonthLabel(date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ensureHistorySelection() {
    if (state.selectedHistoryDate) {
        return;
    }

    const todayKey = state.dateString;
    if (getHistoryEntriesForDate(todayKey).length > 0) {
        state.selectedHistoryDate = todayKey;
        state.historyViewMonth = getMonthStart(parseLocalDateString(todayKey));
        return;
    }

    state.selectedHistoryDate = null;
}

function renderHistoryDayDetails() {
    const heading = state.ui.historyDayHeading;
    const list = state.ui.historyDayList;

    list.innerHTML = '';

    if (!state.selectedHistoryDate) {
        heading.textContent = 'Select a day';
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.textContent = 'No completed exercise selected.';
        list.appendChild(empty);
        return;
    }

    heading.textContent = `History for ${state.selectedHistoryDate}`;
    const entries = getHistoryEntriesForDate(state.selectedHistoryDate);

    if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.textContent = 'No completed exercises for this day.';
        list.appendChild(empty);
        return;
    }

    entries.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'history-entry';

        const title = document.createElement('div');
        title.className = 'history-entry-title';
        title.textContent = `${entry.exerciseName} (${entry.categoryName || 'Uncategorized'})`;

        const metaMetrics = document.createElement('div');
        metaMetrics.className = 'history-entry-meta';
        metaMetrics.textContent = `Reps: ${entry.reps || '--'} | Weight: ${entry.weight || '--'}`;

        const metaTime = document.createElement('div');
        metaTime.className = 'history-entry-meta';
        metaTime.textContent = `Completed: ${formatTime(entry.completedAt)}`;

        item.appendChild(title);
        item.appendChild(metaMetrics);
        item.appendChild(metaTime);

        list.appendChild(item);
    });
}

function renderHistoryCalendar() {
    const calendar = state.ui.historyCalendar;
    const monthLabel = state.ui.historyMonthLabel;
    const countByDate = getHistoryCountByDate();

    calendar.innerHTML = '';
    monthLabel.textContent = formatMonthLabel(state.historyViewMonth);

    WEEKDAY_LABELS.forEach((label) => {
        const day = document.createElement('div');
        day.className = 'history-weekday';
        day.textContent = label;
        calendar.appendChild(day);
    });

    const firstDay = new Date(state.historyViewMonth.getFullYear(), state.historyViewMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - startOffset);

    for (let i = 0; i < 42; i++) {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const dateKey = getLocalDateString(date);
        const inCurrentMonth = date.getMonth() === state.historyViewMonth.getMonth();
        const count = countByDate.get(dateKey) || 0;

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'history-day-cell';
        if (!inCurrentMonth) cell.classList.add('outside-month');
        if (state.selectedHistoryDate === dateKey) cell.classList.add('selected');

        const dayNumber = document.createElement('span');
        dayNumber.className = 'history-day-number';
        dayNumber.textContent = String(date.getDate());
        cell.appendChild(dayNumber);

        const indicator = document.createElement('span');
        indicator.className = 'history-day-indicator';
        indicator.textContent = count > 0 ? `● ${count}` : '';
        cell.appendChild(indicator);

        cell.addEventListener('click', () => {
            state.selectedHistoryDate = dateKey;
            if (!inCurrentMonth) state.historyViewMonth = getMonthStart(date);
            renderHistory();
        });

        calendar.appendChild(cell);
    }
}

function renderHistory() {
    ensureHistorySelection();
    renderHistoryCalendar();
    renderHistoryDayDetails();
}

function switchTab(tabName) {
    state.activeTab = tabName;

    state.ui.tabPanels.forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.tabpanel === tabName);
    });

    state.ui.tabButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.tab === tabName);
    });
}

function init() {
    state.ui.currentDate = document.getElementById('current-date');
    state.ui.loading = document.getElementById('loading');
    state.ui.exercisesContainer = document.getElementById('exercises-container');
    state.ui.categoryNameInput = document.getElementById('category-name-input');
    state.ui.categorySelect = document.getElementById('category-select');
    state.ui.exerciseNameInput = document.getElementById('exercise-name-input');
    state.ui.addCategoryBtn = document.getElementById('add-category-btn');
    state.ui.addExerciseBtn = document.getElementById('add-exercise-btn');
    state.ui.libraryStatus = document.getElementById('library-status');
    state.ui.libraryList = document.getElementById('library-list');
    state.ui.exportLibraryBtn = document.getElementById('export-library-btn');
    state.ui.importLibraryInput = document.getElementById('import-library-input');
    state.ui.newSeedBtn = document.getElementById('new-seed-btn');
    state.ui.historyPrevMonthBtn = document.getElementById('history-prev-month-btn');
    state.ui.historyNextMonthBtn = document.getElementById('history-next-month-btn');
    state.ui.historyMonthLabel = document.getElementById('history-month-label');
    state.ui.historyCalendar = document.getElementById('history-calendar');
    state.ui.historyDayHeading = document.getElementById('history-day-heading');
    state.ui.historyDayList = document.getElementById('history-day-list');
    state.ui.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    state.ui.tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

    state.ui.currentDate.textContent = `Exercises for ${state.dateString}`;

    state.ui.addCategoryBtn.addEventListener('click', addCategory);
    state.ui.addExerciseBtn.addEventListener('click', addExercise);
    state.ui.exportLibraryBtn.addEventListener('click', exportLibraryJson);
    state.ui.newSeedBtn.addEventListener('click', generateNewSeed);

    state.ui.historyPrevMonthBtn.addEventListener('click', () => {
        state.historyViewMonth = shiftMonth(state.historyViewMonth, -1);
        renderHistory();
    });

    state.ui.historyNextMonthBtn.addEventListener('click', () => {
        state.historyViewMonth = shiftMonth(state.historyViewMonth, 1);
        renderHistory();
    });

    state.ui.categoryNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addCategory();
        }
    });

    state.ui.exerciseNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addExercise();
        }
    });

    state.ui.importLibraryInput.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        importLibraryFile(file);
    });

    state.ui.tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    renderLibraryManager();
    generateExercises();
    renderHistory();
    switchTab(state.activeTab);
}

document.addEventListener('DOMContentLoaded', init);
