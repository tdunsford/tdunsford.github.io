const STORAGE_KEYS = {
    players: "scorekeeper.players.v1",
    activeGame: "scorekeeper.activeGame.v1",
    history: "scorekeeper.history.v1",
    settings: "scorekeeper.settings.v1"
};

const PLAYER_EMOJI_CATEGORIES = [
    {
        label: "Faces",
        emojis: ["🙂", "😀", "😄", "😁", "😎", "🤩", "🥳", "😇", "😉", "😊", "😍", "😘", "🤗", "🤓", "🧐", "🤠", "🥸", "😺", "😸", "😻"]
    },
    {
        label: "People",
        emojis: ["🧑", "👨", "👩", "👦", "👧", "👶", "🧒", "👨‍🦱", "👩‍🦱", "👨‍🦰", "👩‍🦰", "👱", "👨‍🦳", "👩‍🦳", "👨‍🦲", "👩‍🦲", "🧔", "👨‍🧔", "👩‍🧔", "👴", "👵", "🧓", "👲", "🧕"]
    },
    {
        label: "Roles",
        emojis: ["👮", "🕵️", "💂", "👷", "🤴", "👸", "👳", "🧑‍🎓", "🧑‍🏫", "🧑‍⚕️", "🧑‍🍳", "🧑‍🌾", "🧑‍🔧", "🧑‍🏭", "🧑‍💼", "🧑‍🔬", "🧑‍💻", "🧑‍🎤", "🧑‍🎨", "🧑‍✈️", "🧑‍🚀", "🧑‍🚒", "🥷", "🧙", "🧛", "🧜", "🧝", "🧞", "🧟"]
    },
    {
        label: "Action",
        emojis: ["🙌", "👏", "👍", "👎", "👋", "🤝", "🙏", "💪", "🧠", "❤️", "🔥", "⭐", "🌈", "☀️", "🌙", "⚡", "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇", "🤦", "🤷", "💃", "🕺", "🧍", "🧎", "🏃", "🚶", "🧘", "🏋️", "🤸", "⛹️", "🤾", "🚴", "🧗", "🏄", "🏊", "🤽", "🚣", "🧑‍🦽", "🧑‍🦼"]
    },
    {
        label: "Animals",
        emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "🐝", "🦋", "🐢", "🐙", "🦖"]
    },
    {
        label: "Nature",
        emojis: ["🌸", "🌻", "🌵", "🍀", "🌍", "🪐"]
    },
    {
        label: "Food",
        emojis: ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🍑", "🍍", "🥥", "🍔", "🍕", "🌭", "🍟", "🌮", "🌯", "🍜", "🍣", "🍪", "🍩", "🍿", "🎂", "☕", "🍺"]
    },
    {
        label: "Games",
        emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎱", "🏓", "🎯", "🎮", "🎲", "🧩", "🏆", "🥇"]
    },
    {
        label: "Music",
        emojis: ["🎸", "🎹", "🥁", "🎤", "🎧", "🪩"]
    },
    {
        label: "Objects",
        emojis: ["📱", "💻", "⌚", "🚗", "✈️", "🚀", "🎉", "🎈", "🎁", "💎", "🛟", "🧸"]
    }
];
const DEFAULT_PLAYER_EMOJI = "🙂";
const HISTORY_DELETE_WINDOW_MS = 30 * 60 * 1000;
const ADD_GAME_NAME_VALUE = "__add_game_name__";

const state = {
    players: [],
    activeGame: null,
    history: [],
    settings: {
        showArchivedPlayers: false,
        currentGameSort: "alpha",
        activeTab: "games"
    },
    draft: {
        selectedPlayerIds: [],
        selectedGameName: "",
        selectedPlayerEmoji: DEFAULT_PLAYER_EMOJI
    },
    scoreDialogPlayerId: null,
    editingPlayerId: null,
    scoreCalculator: {
        pendingTotal: 0,
        currentDigits: "",
        currentSign: 1
    },
    highlightedPlayerId: null,
    highlightedScoreAmount: null
};

let messageTimer = null;
let scoreHighlightTimer = null;

const el = {
    newGameForm: document.getElementById("new-game-form"),
    gameNameSelect: document.getElementById("game-name-select"),
    gameNameDialog: document.getElementById("game-name-dialog"),
    gameNameForm: document.getElementById("game-name-form"),
    newGameNameInput: document.getElementById("new-game-name-input"),
    gameNameCancelBtn: document.getElementById("game-name-cancel-btn"),
    playerNameInput: document.getElementById("player-name-input"),
    playerEmojiPicker: document.getElementById("player-emoji-picker"),
    openPlayerDialogBtn: document.getElementById("open-player-dialog-btn"),
    savedPlayers: document.getElementById("saved-players"),
    savedSuggestions: document.getElementById("player-suggestions"),
    toggleArchivedBtn: document.getElementById("toggle-archived-btn"),
    sortControls: document.getElementById("sort-controls"),
    sortScoreBtn: document.getElementById("sort-score-btn"),
    sortAlphaBtn: document.getElementById("sort-alpha-btn"),
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
    resumeGameBtn: document.getElementById("resume-game-btn"),
    tabButtons: [...document.querySelectorAll(".tab-button")],
    tabPanels: [...document.querySelectorAll(".tab-panel")],
    appMessage: document.getElementById("app-message"),
    scoreDialog: document.getElementById("score-dialog"),
    scoreForm: document.getElementById("score-form"),
    scoreDialogTitle: document.getElementById("score-dialog-title"),
    scoreDialogCurrent: document.getElementById("score-dialog-current"),
    scoreCalculatorTotal: document.getElementById("score-calculator-total"),
    scoreCalculatorEntry: document.getElementById("score-calculator-entry"),
    scoreKeypad: document.getElementById("score-keypad"),
    scoreCancelBtn: document.getElementById("score-cancel-btn"),
    playerDialog: document.getElementById("player-dialog"),
    playerForm: document.getElementById("player-form"),
    playerDialogTitle: document.getElementById("player-dialog-title"),
    playerCancelBtn: document.getElementById("player-cancel-btn"),
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
        currentGameSort: "alpha",
        activeTab: "games",
        ...loadJson(STORAGE_KEYS.settings, {})
    };
    state.players = state.players.map((player) => ({
        ...player,
        emoji: player.emoji || DEFAULT_PLAYER_EMOJI
    }));
    localStorage.removeItem("scorekeeper.gameNames.v1");
}

function normalizeName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
}

function playerSort(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function gameNameSort(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getSeenGameNames() {
    const names = new Map();

    state.history.forEach((game) => {
        const name = normalizeName(game?.name);
        if (name) {
            names.set(name.toLocaleLowerCase(), name);
        }
    });

    const selectedName = normalizeName(state.draft.selectedGameName);
    if (selectedName) {
        names.set(selectedName.toLocaleLowerCase(), selectedName);
    }

    return [...names.values()].sort(gameNameSort);
}

function getPlayerById(playerId) {
    return state.players.find((player) => player.id === playerId) || null;
}

function getPlayerName(playerId) {
    const player = getPlayerById(playerId);
    return player ? player.name : "Unknown player";
}

function getPlayerEmoji(playerId) {
    const player = getPlayerById(playerId);
    return player ? (player.emoji || DEFAULT_PLAYER_EMOJI) : DEFAULT_PLAYER_EMOJI;
}

function getExistingPlayerByNormalizedName(name) {
    const normalized = normalizeName(name).toLocaleLowerCase();
    return state.players.find((player) => normalizeName(player.name).toLocaleLowerCase() === normalized) || null;
}

function getPlayerStats(playerId) {
    const stats = {
        gamesPlayed: 0,
        wins: 0,
        mostWonGame: ""
    };
    const winsByGame = new Map();

    state.history.forEach((game) => {
        if (!Array.isArray(game.playerIds) || !game.playerIds.includes(playerId)) {
            return;
        }
        stats.gamesPlayed += 1;

        if (!Array.isArray(game.winners) || !game.winners.includes(playerId)) {
            return;
        }
        stats.wins += 1;

        const gameName = normalizeName(game.name);
        if (gameName) {
            winsByGame.set(gameName, (winsByGame.get(gameName) || 0) + 1);
        }
    });

    const [mostWonGame] = [...winsByGame.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))[0] || [];
    stats.mostWonGame = mostWonGame || "";

    return stats;
}

function createPlayer(name, emoji = DEFAULT_PLAYER_EMOJI) {
    const player = {
        id: uid("player"),
        name: normalizeName(name),
        emoji: emoji || DEFAULT_PLAYER_EMOJI,
        createdAt: new Date().toISOString(),
        archived: false
    };
    state.players.push(player);
    state.players.sort(playerSort);
    persist();
    return player;
}

function ensurePlayer(name, emoji = DEFAULT_PLAYER_EMOJI) {
    const normalized = normalizeName(name);
    if (!normalized) {
        return null;
    }
    return getExistingPlayerByNormalizedName(normalized) || createPlayer(normalized, emoji);
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
            emoji: player ? (player.emoji || DEFAULT_PLAYER_EMOJI) : DEFAULT_PLAYER_EMOJI,
            score: state.activeGame.scores[playerId] || 0
        };
    }).sort((a, b) => {
        if (state.settings.currentGameSort === "alpha") {
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

function startGame(gameName, playerIds) {
    const now = new Date().toISOString();
    const normalizedGameName = normalizeName(gameName);
    const scores = {};
    playerIds.forEach((playerId) => {
        scores[playerId] = 0;
    });

    state.activeGame = {
        id: uid("game"),
        name: normalizedGameName,
        createdAt: now,
        startedAt: now,
        completedAt: null,
        playerIds: [...playerIds],
        scores,
        events: [],
        status: "active"
    };
    state.settings.currentGameSort = "alpha";
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

function toggleSelectedPlayer(playerId) {
    if (!playerId) {
        return;
    }
    if (state.draft.selectedPlayerIds.includes(playerId)) {
        removeSelectedPlayer(playerId);
        return;
    }
    addSelectedPlayer(playerId);
}

function removeSelectedPlayer(playerId) {
    state.draft.selectedPlayerIds = state.draft.selectedPlayerIds.filter((id) => id !== playerId);
    renderNewGame();
}

function addPlayerFromInput() {
    submitPlayerForm();
}

function setActiveTab(tabName, shouldPersist = true) {
    const nextTab = ["games", "players", "history", "other"].includes(tabName) ? tabName : "games";
    state.settings.activeTab = nextTab;
    if (shouldPersist) {
        persist();
    }
    renderTabs();
}

function setScore(playerId, amount) {
    if (!state.activeGame) {
        return;
    }
    const numericAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
        return;
    }
    state.activeGame.scores[playerId] = (state.activeGame.scores[playerId] || 0) + numericAmount;
    state.activeGame.events.unshift({
        id: uid("event"),
        playerId,
        amount: numericAmount,
        timestamp: new Date().toISOString()
    });
    persist();
    highlightPlayerCard(playerId, numericAmount);
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
    const playerEmojis = {};
    state.activeGame.playerIds.forEach((playerId) => {
        playerNames[playerId] = getPlayerName(playerId);
        playerEmojis[playerId] = getPlayerEmoji(playerId);
    });
    const summary = {
        id: state.activeGame.id,
        name: state.activeGame.name,
        createdAt: state.activeGame.createdAt,
        startedAt: state.activeGame.startedAt,
        completedAt,
        playerIds: [...state.activeGame.playerIds],
        playerNames,
        playerEmojis,
        scores: { ...state.activeGame.scores },
        winners,
        eventCount: state.activeGame.events.length
    };
    state.history.unshift(summary);
    state.activeGame = null;
    state.settings.activeTab = "history";
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
    openPlayerDialog(playerId);
}

function hasPlayerHistory(playerId) {
    return state.history.some((game) => Array.isArray(game.playerIds) && game.playerIds.includes(playerId));
}

function toggleArchived(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return;
    }
    if (!player.archived && !hasPlayerHistory(playerId)) {
        state.players = state.players.filter((entry) => entry.id !== playerId);
        state.draft.selectedPlayerIds = state.draft.selectedPlayerIds.filter((id) => id !== playerId);
        persist();
        render();
        return;
    }
    player.archived = !player.archived;
    persist();
    render();
}

function canDeleteHistoryEntry(game) {
    if (!game?.completedAt) {
        return false;
    }
    const completedTime = new Date(game.completedAt).getTime();
    return Number.isFinite(completedTime) && (Date.now() - completedTime) <= HISTORY_DELETE_WINDOW_MS;
}

function deleteHistoryEntry(gameId) {
    const game = state.history.find((entry) => entry.id === gameId);
    if (!game || !canDeleteHistoryEntry(game)) {
        return;
    }
    const confirmed = window.confirm(`Delete "${game.name}" from history?`);
    if (!confirmed) {
        return;
    }
    state.history = state.history.filter((entry) => entry.id !== gameId);
    persist();
    renderHistory();
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
    anchor.download = `meeplekeeper-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
                currentGameSort: "alpha",
                activeTab: "games",
                ...(data.settings || {})
            };
            state.draft.selectedPlayerIds = [];
            state.draft.selectedGameName = "";
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
    localStorage.removeItem("scorekeeper.gameNames.v1");
    localStorage.removeItem(STORAGE_KEYS.activeGame);
    localStorage.removeItem(STORAGE_KEYS.history);
    localStorage.removeItem(STORAGE_KEYS.settings);
    state.players = [];
    state.activeGame = null;
    state.history = [];
    state.settings = { showArchivedPlayers: false, currentGameSort: "alpha", activeTab: "games" };
    state.draft.selectedPlayerIds = [];
    state.draft.selectedGameName = "";
    render();
}

function openScoreDialog(playerId) {
    const player = getPlayerById(playerId);
    if (!player || !state.activeGame) {
        return;
    }
    state.scoreDialogPlayerId = playerId;
    resetScoreCalculator();
    el.scoreDialogTitle.textContent = `Adjust ${player.name}`;
    el.scoreDialogCurrent.textContent = `Current score: ${state.activeGame.scores[playerId] || 0}`;
    renderScoreCalculator();
    if (typeof el.scoreDialog.showModal === "function") {
        el.scoreDialog.showModal();
    }
}

function closeScoreDialog() {
    state.scoreDialogPlayerId = null;
    resetScoreCalculator();
    el.scoreDialog.close();
}

function openPlayerDialog(playerId = null) {
    state.editingPlayerId = playerId;
    const player = playerId ? getPlayerById(playerId) : null;
    el.playerDialogTitle.textContent = player ? "Rename Player" : "Add Player";
    el.playerNameInput.value = player ? player.name : "";
    state.draft.selectedPlayerEmoji = player ? (player.emoji || DEFAULT_PLAYER_EMOJI) : (state.draft.selectedPlayerEmoji || DEFAULT_PLAYER_EMOJI);
    renderPlayerEmojiPicker();
    if (typeof el.playerDialog.showModal === "function") {
        el.playerDialog.showModal();
        window.requestAnimationFrame(() => {
            el.playerNameInput.focus({ preventScroll: true });
            el.playerNameInput.select();
        });
    }
}

function closePlayerDialog() {
    state.editingPlayerId = null;
    el.playerDialog.close();
}

function openGameNameDialog() {
    el.newGameNameInput.value = "";
    if (typeof el.gameNameDialog.showModal === "function") {
        el.gameNameDialog.showModal();
        window.requestAnimationFrame(() => {
            el.newGameNameInput.focus({ preventScroll: true });
        });
    }
}

function closeGameNameDialog() {
    el.gameNameDialog.close();
    renderGameNameSelect();
}

function submitGameNameForm() {
    const gameName = normalizeName(el.newGameNameInput.value);
    if (!gameName) {
        el.newGameNameInput.focus();
        return;
    }
    state.draft.selectedGameName = gameName;
    closeGameNameDialog();
    renderNewGame();
}

function submitPlayerForm() {
    const name = normalizeName(el.playerNameInput.value);
    const emoji = sanitizeEmoji(state.draft.selectedPlayerEmoji);

    if (!name) {
        el.playerNameInput.focus();
        return;
    }

    if (state.editingPlayerId) {
        const player = getPlayerById(state.editingPlayerId);
        if (!player) {
            closePlayerDialog();
            return;
        }
        const duplicate = getExistingPlayerByNormalizedName(name);
        if (duplicate && duplicate.id !== state.editingPlayerId) {
            window.alert("A player with that name already exists.");
            return;
        }
        player.name = name;
        player.emoji = emoji;
        state.players.sort(playerSort);
        persist();
        render();
        closePlayerDialog();
        return;
    }

    const existing = getExistingPlayerByNormalizedName(name);
    if (existing) {
        addSelectedPlayer(existing.id);
        closePlayerDialog();
        render();
        return;
    }

    const player = createPlayer(name, emoji);
    addSelectedPlayer(player.id);
    state.draft.selectedPlayerEmoji = DEFAULT_PLAYER_EMOJI;
    render();
    closePlayerDialog();
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

function submitScoreForm() {
    if (!state.scoreDialogPlayerId) {
        return;
    }
    const amount = commitScoreCalculatorEntry();
    if (amount === 0) {
        renderScoreCalculator();
        return;
    }
    setScore(state.scoreDialogPlayerId, amount);
    closeScoreDialog();
}

function resetScoreCalculator() {
    state.scoreCalculator.pendingTotal = 0;
    state.scoreCalculator.currentDigits = "";
    state.scoreCalculator.currentSign = 1;
}

function getScoreCalculatorCurrentValue() {
    if (!state.scoreCalculator.currentDigits) {
        return 0;
    }
    return Number.parseInt(state.scoreCalculator.currentDigits, 10) * state.scoreCalculator.currentSign;
}

function getScoreCalculatorDisplayTotal() {
    return state.scoreCalculator.pendingTotal + getScoreCalculatorCurrentValue();
}

function renderScoreCalculator() {
    el.scoreCalculatorTotal.textContent = String(getScoreCalculatorDisplayTotal());
    el.scoreCalculatorEntry.textContent = `Entry: ${getScoreCalculatorCurrentValue()}`;
}

function commitScoreCalculatorEntry() {
    state.scoreCalculator.pendingTotal += getScoreCalculatorCurrentValue();
    state.scoreCalculator.currentDigits = "";
    state.scoreCalculator.currentSign = 1;
    return state.scoreCalculator.pendingTotal;
}

function appendScoreCalculatorDigit(digit) {
    if (state.scoreCalculator.currentDigits === "0") {
        state.scoreCalculator.currentDigits = digit;
    } else {
        state.scoreCalculator.currentDigits += digit;
    }
    renderScoreCalculator();
}

function toggleScoreCalculatorSign() {
    if (state.scoreCalculator.currentDigits) {
        state.scoreCalculator.currentSign *= -1;
    } else {
        state.scoreCalculator.pendingTotal *= -1;
    }
    renderScoreCalculator();
}

function handleScoreKey(key) {
    if (/^\d$/.test(key)) {
        appendScoreCalculatorDigit(key);
        return;
    }
    if (key === "plus") {
        commitScoreCalculatorEntry();
        renderScoreCalculator();
        return;
    }
    if (key === "sign") {
        toggleScoreCalculatorSign();
        return;
    }
    if (key === "clear") {
        resetScoreCalculator();
        renderScoreCalculator();
    }
}

function formatDate(iso) {
    return new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function formatDateOnly(iso) {
    return new Date(iso).toLocaleDateString([], {
        dateStyle: "medium"
    });
}

function formatPlayerLabel(player) {
    return `<span class="player-name-inline"><span class="player-emoji">${player.emoji || DEFAULT_PLAYER_EMOJI}</span><span>${player.name}</span></span>`;
}

function sanitizeEmoji(value) {
    const normalized = String(value || "").trim();
    return normalized || DEFAULT_PLAYER_EMOJI;
}

function renderPlayerEmojiPicker() {
    el.playerEmojiPicker.innerHTML = "";
    PLAYER_EMOJI_CATEGORIES.forEach((category) => {
        const section = document.createElement("section");
        section.className = "emoji-category";

        const heading = document.createElement("h3");
        heading.className = "emoji-category-title";
        heading.textContent = category.label;
        section.appendChild(heading);

        const grid = document.createElement("div");
        grid.className = "emoji-category-grid";

        category.emojis.forEach((emoji) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `button button-ghost emoji-choice${state.draft.selectedPlayerEmoji === emoji ? " is-active" : ""}`;
            button.textContent = emoji;
            button.setAttribute("aria-label", `Choose ${emoji}`);
            button.setAttribute("aria-pressed", String(state.draft.selectedPlayerEmoji === emoji));
            button.addEventListener("click", () => {
                state.draft.selectedPlayerEmoji = emoji;
                renderPlayerEmojiPicker();
            });
            grid.appendChild(button);
        });

        section.appendChild(grid);
        el.playerEmojiPicker.appendChild(section);
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

function renderGameNameSelect() {
    const selectedName = normalizeName(state.draft.selectedGameName);
    const gameNames = getSeenGameNames();

    el.gameNameSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = gameNames.length ? "Choose a game name" : "Add a game name";
    placeholder.disabled = Boolean(selectedName);
    el.gameNameSelect.appendChild(placeholder);

    gameNames.forEach((gameName) => {
        const option = document.createElement("option");
        option.value = gameName;
        option.textContent = gameName;
        el.gameNameSelect.appendChild(option);
    });

    const addOption = document.createElement("option");
    addOption.value = ADD_GAME_NAME_VALUE;
    addOption.textContent = "Add new game name...";
    el.gameNameSelect.appendChild(addOption);

    el.gameNameSelect.value = selectedName;
}

function renderNewGame() {
    const selectedIds = state.draft.selectedPlayerIds;
    const visiblePlayers = state.players.filter((player) => state.settings.showArchivedPlayers || !player.archived);
    renderGameNameSelect();
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
            label.innerHTML = `${formatPlayerLabel(player)}${player.archived ? ' <span class="muted">(archived)</span>' : ""}`;
            const actions = document.createElement("div");
            actions.className = "player-row-actions";

            const toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.className = "button button-secondary";
            toggleButton.textContent = selectedIds.includes(player.id) ? "Selected" : "Pick";
            toggleButton.addEventListener("click", () => toggleSelectedPlayer(player.id));

            actions.append(toggleButton);
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
        el.sortControls.hidden = true;
        return;
    }

    el.activeGamePanel.closest(".panel-side").hidden = false;
    el.activeGamePanel.hidden = false;
    el.activeGameEmpty.hidden = true;
    el.resumeGameBtn.hidden = false;
    el.sortControls.hidden = false;
    el.sortScoreBtn.classList.toggle("is-active", state.settings.currentGameSort === "score");
    el.sortScoreBtn.classList.toggle("button-secondary", state.settings.currentGameSort === "score");
    el.sortScoreBtn.classList.toggle("button-ghost", state.settings.currentGameSort !== "score");
    el.sortAlphaBtn.classList.toggle("is-active", state.settings.currentGameSort === "alpha");
    el.sortAlphaBtn.classList.toggle("button-secondary", state.settings.currentGameSort === "alpha");
    el.sortAlphaBtn.classList.toggle("button-ghost", state.settings.currentGameSort !== "alpha");
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
                        <h3>${formatPlayerLabel(player)}</h3>
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

        const scoresWrap = fragment.querySelector(".history-scores");
        game.playerIds
            .map((playerId) => ({ playerId, score: game.scores[playerId] || 0 }))
            .sort((a, b) => b.score - a.score || (game.playerNames?.[a.playerId] || getPlayerName(a.playerId)).localeCompare(game.playerNames?.[b.playerId] || getPlayerName(b.playerId), undefined, { sensitivity: "base" }))
            .forEach((entry) => {
                const row = document.createElement("div");
                row.className = "history-score-row";
                if (game.winners.includes(entry.playerId)) {
                    row.classList.add("is-winner");
                }
                row.innerHTML = `<strong>${formatPlayerLabel({ emoji: game.playerEmojis?.[entry.playerId] || getPlayerEmoji(entry.playerId), name: game.playerNames?.[entry.playerId] || getPlayerName(entry.playerId) })}</strong><p class="muted">${entry.score} points</p>`;
                scoresWrap.appendChild(row);
            });

        if (canDeleteHistoryEntry(game)) {
            const actionRow = document.createElement("div");
            actionRow.className = "history-actions";
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "button button-ghost";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteHistoryEntry(game.id));
            actionRow.appendChild(deleteButton);
            fragment.querySelector(".history-card").appendChild(actionRow);
        }

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
        const stats = getPlayerStats(player.id);
        const row = document.createElement("div");
        row.className = "directory-row";

        const info = document.createElement("div");
        info.className = "directory-info";
        info.innerHTML = `
            <strong>${formatPlayerLabel(player)}</strong>
        `;

        [
            `Added ${formatDateOnly(player.createdAt)}${player.archived ? " • archived" : ""}`,
            `Games Played: ${stats.gamesPlayed}`,
            `Wins: ${stats.wins}`,
            ...(stats.wins > 0 ? [`Most won game: ${stats.mostWonGame}`] : [])
        ].forEach((line) => {
            const meta = document.createElement("p");
            meta.className = "muted";
            meta.textContent = line;
            info.appendChild(meta);
        });

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
    renderTabs();
    renderNewGame();
    renderActiveGame();
    renderHistory();
    renderDirectory();
}

function renderTabs() {
    const activeTab = ["games", "players", "history", "other"].includes(state.settings.activeTab) ? state.settings.activeTab : "games";
    state.settings.activeTab = activeTab;

    el.tabButtons.forEach((button) => {
        const isActive = button.dataset.tab === activeTab;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;
    });

    el.tabPanels.forEach((panel) => {
        panel.hidden = panel.id !== `${activeTab}-tab`;
    });
}

function handleStartGame(event) {
    event.preventDefault();
    const gameName = normalizeName(state.draft.selectedGameName);
    if (state.activeGame) {
        window.alert("Finish or abandon the active game before starting another.");
        return;
    }
    if (!gameName) {
        window.alert("Pick a game name to start a game.");
        el.gameNameSelect.focus();
        return;
    }
    if (state.draft.selectedPlayerIds.length < 2) {
        window.alert("Pick at least two players to start a game.");
        return;
    }
    startGame(gameName, state.draft.selectedPlayerIds);
    state.draft.selectedPlayerIds = [];
    state.draft.selectedGameName = "";
    el.playerNameInput.value = "";
    render();
    document.getElementById("current-game-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
    el.openPlayerDialogBtn.addEventListener("click", () => openPlayerDialog());
    el.newGameForm.addEventListener("submit", handleStartGame);
    el.tabButtons.forEach((button) => {
        button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    });
    el.gameNameSelect.addEventListener("change", () => {
        if (el.gameNameSelect.value === ADD_GAME_NAME_VALUE) {
            renderGameNameSelect();
            openGameNameDialog();
            return;
        }
        state.draft.selectedGameName = normalizeName(el.gameNameSelect.value);
        renderGameNameSelect();
    });
    el.toggleArchivedBtn.addEventListener("click", () => {
        state.settings.showArchivedPlayers = !state.settings.showArchivedPlayers;
        persist();
        renderNewGame();
    });
    el.sortScoreBtn.addEventListener("click", () => {
        state.settings.currentGameSort = "score";
        persist();
        renderActiveGame();
    });
    el.sortAlphaBtn.addEventListener("click", () => {
        state.settings.currentGameSort = "alpha";
        persist();
        renderActiveGame();
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
    el.resumeGameBtn.addEventListener("click", () => {
        setActiveTab("games");
        document.getElementById("current-game-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.scoreCancelBtn.addEventListener("click", closeScoreDialog);
    el.playerCancelBtn.addEventListener("click", closePlayerDialog);
    el.gameNameCancelBtn.addEventListener("click", closeGameNameDialog);
    el.gameNameForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitGameNameForm();
    });
    el.playerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitPlayerForm();
    });
    el.scoreKeypad.addEventListener("click", (event) => {
        const button = event.target.closest("[data-score-key]");
        if (!button) {
            return;
        }
        handleScoreKey(button.dataset.scoreKey);
    });
    el.scoreForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitScoreForm();
    });
    el.scoreDialog.addEventListener("keydown", (event) => {
        if (/^\d$/.test(event.key)) {
            event.preventDefault();
            handleScoreKey(event.key);
            return;
        }
        if (event.key === "+") {
            event.preventDefault();
            handleScoreKey("plus");
            return;
        }
        if (event.key === "-") {
            event.preventDefault();
            handleScoreKey("sign");
            return;
        }
        if (event.key === "Backspace" || event.key.toLocaleLowerCase() === "c") {
            event.preventDefault();
            handleScoreKey("clear");
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            submitScoreForm();
        }
    });
}

hydrate();
bindEvents();
render();
