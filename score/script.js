const STORAGE_KEYS = {
    players: "scorekeeper.players.v1",
    activeGame: "scorekeeper.activeGame.v1",
    history: "scorekeeper.history.v1",
    settings: "scorekeeper.settings.v1"
};

const state = {
    players: [],
    activeGame: null,
    history: [],
    settings: {
        showArchivedPlayers: false
    },
    draft: {
        selectedPlayerIds: []
    },
    scoreDialogPlayerId: null,
    scoreMode: "add",
    highlightedPlayerId: null,
    highlightedScoreAmount: null
};

let messageTimer = null;
let scoreHighlightTimer = null;

const el = {
    newGameForm: document.getElementById("new-game-form"),
    gameNameInput: document.getElementById("game-name-input"),
    playerNameInput: document.getElementById("player-name-input"),
    addPlayerBtn: document.getElementById("add-player-btn"),
    selectedPlayers: document.getElementById("selected-players"),
    selectedPlayerCount: document.getElementById("selected-player-count"),
    savedPlayers: document.getElementById("saved-players"),
    savedSuggestions: document.getElementById("player-suggestions"),
    toggleArchivedBtn: document.getElementById("toggle-archived-btn"),
    clearSelectedBtn: document.getElementById("clear-selected-btn"),
    activeGamePanel: document.getElementById("active-game-panel"),
    activeGameEmpty: document.getElementById("active-game-empty"),
    activePlayers: document.getElementById("active-players"),
    eventLog: document.getElementById("event-log"),
    finishGameBtn: document.getElementById("finish-game-btn"),
    abandonGameBtn: document.getElementById("abandon-game-btn"),
    undoLastBtn: document.getElementById("undo-last-btn"),
    historyList: document.getElementById("history-list"),
    historyCount: document.getElementById("history-count"),
    directoryList: document.getElementById("directory-list"),
    exportBtn: document.getElementById("export-btn"),
    importInput: document.getElementById("import-input"),
    clearDataBtn: document.getElementById("clear-data-btn"),
    newGameNavBtn: document.getElementById("new-game-nav-btn"),
    resumeGameBtn: document.getElementById("resume-game-btn"),
    appMessage: document.getElementById("app-message"),
    scoreDialog: document.getElementById("score-dialog"),
    scoreForm: document.getElementById("score-form"),
    scoreDialogTitle: document.getElementById("score-dialog-title"),
    scoreDialogCurrent: document.getElementById("score-dialog-current"),
    scoreAmountLabel: document.getElementById("score-amount-label"),
    scoreModeToggle: document.getElementById("score-mode-toggle"),
    scoreModeAdd: document.getElementById("score-mode-add"),
    scoreModeSubtract: document.getElementById("score-mode-subtract"),
    scoreAmountInput: document.getElementById("score-amount-input"),
    scoreCancelBtn: document.getElementById("score-cancel-btn"),
    historyTemplate: document.getElementById("history-item-template")
};

function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function persist() {
    saveJson(STORAGE_KEYS.players, state.players);
    saveJson(STORAGE_KEYS.activeGame, state.activeGame);
    saveJson(STORAGE_KEYS.history, state.history);
    saveJson(STORAGE_KEYS.settings, state.settings);
}

function hydrate() {
    state.players = loadJson(STORAGE_KEYS.players, []);
    state.activeGame = loadJson(STORAGE_KEYS.activeGame, null);
    state.history = loadJson(STORAGE_KEYS.history, []);
    state.settings = {
        showArchivedPlayers: false,
        ...loadJson(STORAGE_KEYS.settings, {})
    };
}

function normalizeName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
}

function playerSort(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function getPlayerById(playerId) {
    return state.players.find((player) => player.id === playerId) || null;
}

function getPlayerName(playerId) {
    const player = getPlayerById(playerId);
    return player ? player.name : "Unknown player";
}

function getExistingPlayerByNormalizedName(name) {
    const normalized = normalizeName(name).toLocaleLowerCase();
    return state.players.find((player) => normalizeName(player.name).toLocaleLowerCase() === normalized) || null;
}

function createPlayer(name) {
    const player = {
        id: uid("player"),
        name: normalizeName(name),
        createdAt: new Date().toISOString(),
        archived: false
    };
    state.players.push(player);
    state.players.sort(playerSort);
    persist();
    return player;
}

function ensurePlayer(name) {
    const normalized = normalizeName(name);
    if (!normalized) {
        return null;
    }
    return getExistingPlayerByNormalizedName(normalized) || createPlayer(normalized);
}

function defaultGameName() {
    return `Game ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function activeGamePlayers() {
    if (!state.activeGame) {
        return [];
    }
    return state.activeGame.playerIds.map((playerId) => {
        const player = getPlayerById(playerId);
        return {
            id: playerId,
            name: player ? player.name : "Unknown player",
            score: state.activeGame.scores[playerId] || 0
        };
    }).sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

function startGame(gameName, playerIds) {
    const now = new Date().toISOString();
    const scores = {};
    playerIds.forEach((playerId) => {
        scores[playerId] = 0;
    });

    state.activeGame = {
        id: uid("game"),
        name: normalizeName(gameName) || defaultGameName(),
        createdAt: now,
        startedAt: now,
        completedAt: null,
        playerIds: [...playerIds],
        scores,
        events: [],
        status: "active"
    };
    persist();
    render();
}

function addSelectedPlayer(playerId) {
    if (!playerId || state.draft.selectedPlayerIds.includes(playerId)) {
        return;
    }
    state.draft.selectedPlayerIds.push(playerId);
    renderNewGame();
}

function removeSelectedPlayer(playerId) {
    state.draft.selectedPlayerIds = state.draft.selectedPlayerIds.filter((id) => id !== playerId);
    renderNewGame();
}

function addPlayerFromInput() {
    const value = normalizeName(el.playerNameInput.value);
    if (!value) {
        el.playerNameInput.focus();
        return;
    }
    const player = ensurePlayer(value);
    if (player) {
        addSelectedPlayer(player.id);
    }
    el.playerNameInput.value = "";
    render();
}

function setScore(playerId, amount) {
    if (!state.activeGame) {
        return;
    }
    const numericAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
        return;
    }
    const signedAmount = state.scoreMode === "subtract" ? -Math.abs(numericAmount) : Math.abs(numericAmount);
    state.activeGame.scores[playerId] = (state.activeGame.scores[playerId] || 0) + signedAmount;
    state.activeGame.events.unshift({
        id: uid("event"),
        playerId,
        amount: signedAmount,
        timestamp: new Date().toISOString()
    });
    persist();
    highlightPlayerCard(playerId, signedAmount);
}

function highlightPlayerCard(playerId, amount) {
    state.highlightedPlayerId = playerId;
    state.highlightedScoreAmount = amount;

    if (scoreHighlightTimer) {
        window.clearTimeout(scoreHighlightTimer);
    }

    renderActiveGame();

    window.requestAnimationFrame(() => {
        const card = el.activePlayers.querySelector(`[data-player-id="${playerId}"]`);
        if (card) {
            card.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest"
            });
        }
    });

    scoreHighlightTimer = window.setTimeout(() => {
        if (state.highlightedPlayerId === playerId) {
            state.highlightedPlayerId = null;
            state.highlightedScoreAmount = null;
            renderActiveGame();
        }
        scoreHighlightTimer = null;
    }, 2400);
}

function undoLastEvent() {
    if (!state.activeGame || !state.activeGame.events.length) {
        return;
    }
    const lastEvent = state.activeGame.events.shift();
    state.activeGame.scores[lastEvent.playerId] = (state.activeGame.scores[lastEvent.playerId] || 0) - lastEvent.amount;
    persist();
    renderActiveGame();
}

function computeWinners(scores, playerIds) {
    let high = Number.NEGATIVE_INFINITY;
    playerIds.forEach((playerId) => {
        high = Math.max(high, scores[playerId] || 0);
    });
    return playerIds.filter((playerId) => (scores[playerId] || 0) === high);
}

function finishGame() {
    if (!state.activeGame) {
        return;
    }
    const completedAt = new Date().toISOString();
    const winners = computeWinners(state.activeGame.scores, state.activeGame.playerIds);
    const playerNames = {};
    state.activeGame.playerIds.forEach((playerId) => {
        playerNames[playerId] = getPlayerName(playerId);
    });
    const summary = {
        id: state.activeGame.id,
        name: state.activeGame.name,
        createdAt: state.activeGame.createdAt,
        startedAt: state.activeGame.startedAt,
        completedAt,
        playerIds: [...state.activeGame.playerIds],
        playerNames,
        scores: { ...state.activeGame.scores },
        winners,
        eventCount: state.activeGame.events.length
    };
    state.history.unshift(summary);
    state.activeGame = null;
    persist();
    render();
    showMessage(`Saved "${summary.name}" to history.`);
    document.getElementById("history-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function abandonGame() {
    if (!state.activeGame) {
        return;
    }
    const confirmed = window.confirm("Abandon the current game? The active game will be removed.");
    if (!confirmed) {
        return;
    }
    state.activeGame = null;
    persist();
    render();
}

function renamePlayer(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return;
    }
    const nextName = window.prompt("Rename player", player.name);
    const normalized = normalizeName(nextName);
    if (!normalized || normalized === player.name) {
        return;
    }
    const duplicate = getExistingPlayerByNormalizedName(normalized);
    if (duplicate && duplicate.id !== playerId) {
        window.alert("A player with that name already exists.");
        return;
    }
    player.name = normalized;
    state.players.sort(playerSort);
    persist();
    render();
}

function toggleArchived(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return;
    }
    player.archived = !player.archived;
    persist();
    render();
}

function exportData() {
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        players: state.players,
        activeGame: state.activeGame,
        history: state.history,
        settings: state.settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scorekeeper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || ""));
            if (!Array.isArray(data.players) || !Array.isArray(data.history)) {
                throw new Error("Invalid backup format.");
            }
            state.players = data.players;
            state.activeGame = data.activeGame || null;
            state.history = data.history;
            state.settings = {
                showArchivedPlayers: false,
                ...(data.settings || {})
            };
            state.draft.selectedPlayerIds = [];
            persist();
            render();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Could not import backup.");
        } finally {
            el.importInput.value = "";
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    const confirmed = window.confirm("Clear all players, history, and any active game?");
    if (!confirmed) {
        return;
    }
    localStorage.removeItem(STORAGE_KEYS.players);
    localStorage.removeItem(STORAGE_KEYS.activeGame);
    localStorage.removeItem(STORAGE_KEYS.history);
    localStorage.removeItem(STORAGE_KEYS.settings);
    state.players = [];
    state.activeGame = null;
    state.history = [];
    state.settings = { showArchivedPlayers: false };
    state.draft.selectedPlayerIds = [];
    render();
}

function openScoreDialog(playerId) {
    const player = getPlayerById(playerId);
    if (!player || !state.activeGame) {
        return;
    }
    state.scoreDialogPlayerId = playerId;
    setScoreMode("add");
    el.scoreDialogTitle.textContent = `Adjust ${player.name}`;
    el.scoreDialogCurrent.textContent = `Current score: ${state.activeGame.scores[playerId] || 0}`;
    el.scoreAmountInput.value = "";
    if (typeof el.scoreDialog.showModal === "function") {
        el.scoreDialog.showModal();
        focusScoreAmountInput();
    }
}

function closeScoreDialog() {
    state.scoreDialogPlayerId = null;
    el.scoreDialog.close();
}

function setScoreMode(mode) {
    state.scoreMode = mode === "subtract" ? "subtract" : "add";
    el.scoreDialog.dataset.mode = state.scoreMode;
    el.scoreAmountLabel.textContent = state.scoreMode === "subtract" ? "Points to subtract" : "Points to add";
    el.scoreModeAdd.classList.toggle("is-active", state.scoreMode === "add");
    el.scoreModeAdd.classList.toggle("button-primary", state.scoreMode === "add");
    el.scoreModeAdd.classList.toggle("button-ghost", state.scoreMode !== "add");
    el.scoreModeSubtract.classList.toggle("is-active", state.scoreMode === "subtract");
    el.scoreModeSubtract.classList.toggle("button-primary", state.scoreMode === "subtract");
    el.scoreModeSubtract.classList.toggle("button-ghost", state.scoreMode !== "subtract");
    el.scoreModeAdd.setAttribute("aria-pressed", String(state.scoreMode === "add"));
    el.scoreModeSubtract.setAttribute("aria-pressed", String(state.scoreMode === "subtract"));
}

function showMessage(text) {
    el.appMessage.textContent = text;
    el.appMessage.hidden = false;

    if (messageTimer) {
        window.clearTimeout(messageTimer);
    }

    messageTimer = window.setTimeout(() => {
        el.appMessage.hidden = true;
        el.appMessage.textContent = "";
        messageTimer = null;
    }, 3500);
}

function focusScoreAmountInput() {
    const focusNow = () => {
        try {
            el.scoreAmountInput.focus({ preventScroll: true });
        } catch {
            el.scoreAmountInput.focus();
        }
        el.scoreAmountInput.select();
    };

    window.requestAnimationFrame(focusNow);
    window.setTimeout(focusNow, 60);
    window.setTimeout(focusNow, 180);
}

function submitScoreForm() {
    if (!state.scoreDialogPlayerId) {
        return;
    }
    setScore(state.scoreDialogPlayerId, el.scoreAmountInput.value);
    closeScoreDialog();
}

function formatDate(iso) {
    return new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function renderSuggestions() {
    el.savedSuggestions.innerHTML = "";
    state.players.filter((player) => !player.archived).forEach((player) => {
        const option = document.createElement("option");
        option.value = player.name;
        el.savedSuggestions.appendChild(option);
    });
}

function renderNewGame() {
    const selectedIds = state.draft.selectedPlayerIds;
    el.selectedPlayerCount.textContent = `${selectedIds.length} player${selectedIds.length === 1 ? "" : "s"}`;
    el.selectedPlayers.innerHTML = "";

    if (!selectedIds.length) {
        el.selectedPlayers.className = "chip-list empty-state-inline";
        el.selectedPlayers.textContent = "No players selected yet.";
    } else {
        el.selectedPlayers.className = "chip-list";
        selectedIds.forEach((playerId) => {
            const player = getPlayerById(playerId);
            if (!player) {
                return;
            }
            const chip = document.createElement("div");
            chip.className = "player-chip";
            chip.innerHTML = `<span>${player.name}</span>`;
            const removeButton = document.createElement("button");
            removeButton.className = "button button-ghost chip-remove-button";
            removeButton.type = "button";
            removeButton.textContent = "-";
            removeButton.setAttribute("aria-label", `Remove ${player.name}`);
            removeButton.addEventListener("click", () => removeSelectedPlayer(playerId));
            chip.appendChild(removeButton);
            el.selectedPlayers.appendChild(chip);
        });
    }

    const visiblePlayers = state.players.filter((player) => state.settings.showArchivedPlayers || !player.archived);
    el.savedPlayers.innerHTML = "";
    if (!visiblePlayers.length) {
        el.savedPlayers.className = "player-list empty-state-inline";
        el.savedPlayers.textContent = "No saved players yet.";
    } else {
        el.savedPlayers.className = "player-list";
        visiblePlayers.forEach((player) => {
            const row = document.createElement("div");
            row.className = "player-row";
            const label = document.createElement("div");
            label.innerHTML = `<strong>${player.name}</strong>${player.archived ? ' <span class="muted">(archived)</span>' : ""}`;
            const actions = document.createElement("div");
            actions.className = "player-row-actions";

            const toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.className = "button button-secondary";
            toggleButton.textContent = selectedIds.includes(player.id) ? "Selected" : "Pick";
            toggleButton.disabled = selectedIds.includes(player.id);
            toggleButton.addEventListener("click", () => addSelectedPlayer(player.id));

            const archiveButton = document.createElement("button");
            archiveButton.type = "button";
            archiveButton.className = "button button-ghost";
            archiveButton.textContent = player.archived ? "Unarchive" : "Archive";
            archiveButton.addEventListener("click", () => toggleArchived(player.id));

            actions.append(toggleButton, archiveButton);
            row.append(label, actions);
            el.savedPlayers.appendChild(row);
        });
    }

    el.toggleArchivedBtn.textContent = state.settings.showArchivedPlayers ? "Hide Archived" : "Show Archived";
    renderSuggestions();
}

function renderActiveGame() {
    if (!state.activeGame) {
        el.activeGamePanel.closest(".panel-side").hidden = true;
        el.activeGamePanel.hidden = true;
        el.activeGameEmpty.hidden = true;
        el.resumeGameBtn.hidden = true;
        return;
    }

    el.activeGamePanel.closest(".panel-side").hidden = false;
    el.activeGamePanel.hidden = false;
    el.activeGameEmpty.hidden = true;
    el.resumeGameBtn.hidden = false;
    el.activePlayers.innerHTML = "";

    activeGamePlayers().forEach((player) => {
        const card = document.createElement("article");
        card.className = "score-card";
        card.dataset.playerId = player.id;
        if (state.highlightedPlayerId === player.id) {
            card.classList.add("is-highlighted");
        }
        const deltaLabel = state.highlightedPlayerId === player.id && Number.isFinite(state.highlightedScoreAmount)
            ? `<span class="score-delta ${state.highlightedScoreAmount < 0 ? "is-negative" : "is-positive"}">${state.highlightedScoreAmount > 0 ? "+" : ""}${state.highlightedScoreAmount}</span>`
            : "";
        card.innerHTML = `
            <div class="score-card-top">
                <div class="score-card-main">
                    <div class="score-card-label">
                        <h3>${player.name}</h3>
                    </div>
                    <div class="score-inline">
                        ${deltaLabel}
                        <span class="score-total">${player.score}</span>
                        <button class="button button-primary score-add-button" type="button">+</button>
                    </div>
                </div>
            </div>
        `;
        const scoreButton = card.querySelector(".score-add-button");
        scoreButton.addEventListener("click", () => openScoreDialog(player.id));
        el.activePlayers.appendChild(card);
    });

    el.eventLog.innerHTML = "";
    if (!state.activeGame.events.length) {
        el.eventLog.className = "timeline empty-state-inline";
        el.eventLog.textContent = "No scoring events yet.";
    } else {
        el.eventLog.className = "timeline";
        state.activeGame.events.forEach((event) => {
            const item = document.createElement("div");
            item.className = "timeline-item";
            const sign = event.amount > 0 ? "+" : "";
            item.innerHTML = `
                <strong>${getPlayerName(event.playerId)} ${sign}${event.amount}</strong>
                <p class="timeline-meta muted">${formatDate(event.timestamp)}</p>
            `;
            el.eventLog.appendChild(item);
        });
    }
}

function renderHistory() {
    el.historyCount.textContent = `${state.history.length} game${state.history.length === 1 ? "" : "s"}`;
    el.historyList.innerHTML = "";

    if (!state.history.length) {
        el.historyList.className = "history-list empty-state-inline";
        el.historyList.textContent = "Finished games will appear here.";
        return;
    }

    el.historyList.className = "history-list";
    state.history.forEach((game) => {
        const fragment = el.historyTemplate.content.cloneNode(true);
        fragment.querySelector(".history-title").textContent = game.name;
        fragment.querySelector(".history-meta").textContent = `${formatDate(game.completedAt)} • ${game.eventCount || 0} events`;

        const winnerNames = game.winners.map((playerId) => game.playerNames?.[playerId] || getPlayerName(playerId)).join(", ");
        fragment.querySelector(".history-winner").textContent = game.winners.length > 1 ? `Tie: ${winnerNames}` : `Winner: ${winnerNames}`;

        const scoresWrap = fragment.querySelector(".history-scores");
        game.playerIds
            .map((playerId) => ({ playerId, score: game.scores[playerId] || 0 }))
            .sort((a, b) => b.score - a.score || (game.playerNames?.[a.playerId] || getPlayerName(a.playerId)).localeCompare(game.playerNames?.[b.playerId] || getPlayerName(b.playerId), undefined, { sensitivity: "base" }))
            .forEach((entry) => {
                const row = document.createElement("div");
                row.className = "history-score-row";
                row.innerHTML = `<strong>${game.playerNames?.[entry.playerId] || getPlayerName(entry.playerId)}</strong><p class="muted">${entry.score} points</p>`;
                scoresWrap.appendChild(row);
            });

        el.historyList.appendChild(fragment);
    });
}

function renderDirectory() {
    el.directoryList.innerHTML = "";
    if (!state.players.length) {
        el.directoryList.className = "directory-list empty-state-inline";
        el.directoryList.textContent = "Player management lives here once you add someone.";
        return;
    }

    el.directoryList.className = "directory-list";
    [...state.players].sort(playerSort).forEach((player) => {
        const row = document.createElement("div");
        row.className = "directory-row";

        const info = document.createElement("div");
        info.innerHTML = `
            <strong>${player.name}</strong>
            <p class="muted">Added ${formatDate(player.createdAt)}${player.archived ? " • archived" : ""}</p>
        `;

        const actions = document.createElement("div");
        actions.className = "directory-actions";

        const renameButton = document.createElement("button");
        renameButton.type = "button";
        renameButton.className = "button button-secondary";
        renameButton.textContent = "Rename";
        renameButton.addEventListener("click", () => renamePlayer(player.id));

        const archiveButton = document.createElement("button");
        archiveButton.type = "button";
        archiveButton.className = "button button-ghost";
        archiveButton.textContent = player.archived ? "Unarchive" : "Archive";
        archiveButton.addEventListener("click", () => toggleArchived(player.id));

        actions.append(renameButton, archiveButton);
        row.append(info, actions);
        el.directoryList.appendChild(row);
    });
}

function render() {
    document.body.classList.toggle("game-active", Boolean(state.activeGame));
    renderNewGame();
    renderActiveGame();
    renderHistory();
    renderDirectory();
}

function handleStartGame(event) {
    event.preventDefault();
    if (state.activeGame) {
        window.alert("Finish or abandon the active game before starting another.");
        return;
    }
    if (state.draft.selectedPlayerIds.length < 2) {
        window.alert("Pick at least two players to start a game.");
        return;
    }
    startGame(el.gameNameInput.value, state.draft.selectedPlayerIds);
    state.draft.selectedPlayerIds = [];
    el.gameNameInput.value = "";
    el.playerNameInput.value = "";
    render();
    document.getElementById("current-game-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
    el.addPlayerBtn.addEventListener("click", addPlayerFromInput);
    el.playerNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addPlayerFromInput();
        }
    });
    el.newGameForm.addEventListener("submit", handleStartGame);
    el.toggleArchivedBtn.addEventListener("click", () => {
        state.settings.showArchivedPlayers = !state.settings.showArchivedPlayers;
        persist();
        renderNewGame();
    });
    el.clearSelectedBtn.addEventListener("click", () => {
        state.draft.selectedPlayerIds = [];
        renderNewGame();
    });
    el.finishGameBtn.addEventListener("click", finishGame);
    el.abandonGameBtn.addEventListener("click", abandonGame);
    el.undoLastBtn.addEventListener("click", undoLastEvent);
    el.exportBtn.addEventListener("click", exportData);
    el.importInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            importData(file);
        }
    });
    el.clearDataBtn.addEventListener("click", clearAllData);
    el.newGameNavBtn.addEventListener("click", () => {
        document.getElementById("new-game-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.resumeGameBtn.addEventListener("click", () => {
        document.getElementById("current-game-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.scoreCancelBtn.addEventListener("click", closeScoreDialog);
    el.scoreModeToggle.addEventListener("click", (event) => {
        const button = event.target.closest(".mode-button");
        if (!button) {
            return;
        }
        event.preventDefault();
        setScoreMode(button.dataset.mode);
    });
    el.scoreForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitScoreForm();
    });
    el.scoreAmountInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return;
        }
        event.preventDefault();
        submitScoreForm();
    });
}

hydrate();
bindEvents();
render();
