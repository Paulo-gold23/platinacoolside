const API_URL = 'https://motor-platinacoolside.onrender.com';

const playerSelect = document.getElementById('playerSelect');
const gameNameInput = document.getElementById('gameName');
const searchGameForm = document.getElementById('searchGameForm');
const searchBtn = document.getElementById('searchBtn');
const btnText = searchBtn.querySelector('.btn-text');
const loader = searchBtn.querySelector('.loader');

const searchResults = document.getElementById('searchResults');
const resultsList = document.getElementById('resultsList');
const errorMsg = document.getElementById('error-message');

const leaderboardBody = document.getElementById('leaderboardBody');
const toast = document.getElementById('toast');

// Variável global para armazenar a instância do select customizado
let playerChoices;
let playersMap = {}; // Mapa para puxar nomes de forma otimizada

// Carregar Jogadores
async function fetchPlayers() {
    try {
        const response = await fetch(`${API_URL}/players`);
        const players = await response.json();

        // Limpa e prepara as opções
        playerSelect.innerHTML = '<option value="" disabled selected>Selecione o Jogador</option>';
        players.forEach(player => {
            playersMap[player.id] = player.name; // Alimenta o cache de nomes

            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            playerSelect.appendChild(option);
        });

        // Inicializa o Choices.js para transformar o select nato em um custom select de luxo
        if (playerChoices) {
            playerChoices.destroy(); // destroi se já existir para recriar
        }

        playerChoices = new Choices(playerSelect, {
            searchEnabled: false,
            itemSelectText: '',
            shouldSort: false,
            placeholder: true,
        });

    } catch (error) {
        console.error('Erro ao buscar jogadores:', error);
        playerSelect.innerHTML = '<option value="" disabled>Erro ao carregar jogadores</option>';
    }
}

// Carregar Leaderboard
async function fetchLeaderboard() {
    try {
        const response = await fetch(`${API_URL}/leaderboard`);
        const leaderboard = await response.json();

        leaderboardBody.innerHTML = ''; // Limpa

        if (leaderboard.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="4" class="loading-td">Nenhum jogador encontrado.</td></tr>';
            return;
        }

        leaderboard.forEach((entry, index) => {
            const tr = document.createElement('tr');

            const tdPos = document.createElement('td');
            tdPos.textContent = `${index + 1}º`;

            const tdName = document.createElement('td');
            tdName.textContent = entry.name;

            const tdGames = document.createElement('td');
            tdGames.textContent = entry.games;

            const tdPoints = document.createElement('td');
            tdPoints.textContent = `${entry.totalPoints} pts`;

            tr.appendChild(tdPos);
            tr.appendChild(tdName);
            tr.appendChild(tdGames);
            tr.appendChild(tdPoints);

            leaderboardBody.appendChild(tr);
        });

        // NOVO: Renderizar/Atualizar gráfico
        if (typeof updateChart === 'function') {
            updateChart(leaderboard);
        }
    } catch (error) {
        console.error('Erro ao buscar ranking:', error);
        leaderboardBody.innerHTML = '<tr><td colspan="4" class="loading-td error-text">Erro ao carregar o ranking. Tente recarregar.</td></tr>';
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Form de Pesquisa de Jogo no HLTB
searchGameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    searchResults.classList.add('hidden');
    resultsList.innerHTML = '';

    const playerId = playerChoices ? playerChoices.getValue(true) : playerSelect.value;
    const gameName = gameNameInput.value.trim();

    if (!playerId) {
        showError("Por favor, selecione quem platinou primeiro!");
        return;
    }
    if (!gameName) return;

    searchBtn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/search-game?q=${encodeURIComponent(gameName)}`);
        const games = await response.json();

        if (!response.ok) throw new Error("Erro na busca remota do HLTB.");

        if (games.length === 0) {
            showError(`Nenhum jogo encontrado com campanha mensurável para "${gameName}".`);
            return;
        }

        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <img src="${game.imageUrl}" alt="Capa" class="game-card-img" onerror="this.src='https://howlongtobeat.com/img/hltb_brand.png'">
                <div class="game-card-info">
                    <div class="game-card-title">${game.gameName}</div>
                    <div class="game-card-hours">Tempo de Platina: <strong>${game.hours} Horas</strong></div>
                </div>
                <button type="button" class="btn-choose">ESCOLHER</button>
            `;

            // Clique para salvar esse exato jogo
            card.querySelector('button').addEventListener('click', () => selectAndSaveGame(playerId, game));

            resultsList.appendChild(card);
        });

        searchResults.classList.remove('hidden');

    } catch (error) {
        showError(error.message);
    } finally {
        searchBtn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

// Envia o Jogo Selecionado para Gravar no Firebase
async function selectAndSaveGame(playerId, gameData) {
    if (!confirm(`Deseja adicionar ${gameData.gameName} (${gameData.hours}h) para este jogador?`)) return;

    try {
        // Bloqueia a interface do card
        searchResults.classList.add('hidden');
        gameNameInput.value = '';

        const payload = {
            player_id: playerId,
            game_name: gameData.gameName,
            hours: gameData.hours,
            image_url: gameData.imageUrl,
            hltb_link: gameData.url
        };

        const response = await fetch(`${API_URL}/add-game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Erro ao adicionar platina");
        }

        showToast(`Wow! ${result.category} (+${result.points} pts)`);
        fetchLeaderboard();
        fetchHistory(); // Atualizar aba de histórico também

    } catch (err) {
        showError(err.message);
    }
}

// ------------------------------------
// GERENCIADOR DE ABAS (TABS)
// ------------------------------------
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remover classes active
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Adicionar classe active na aba clicada e na div correta
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// ------------------------------------
// CHART.JS (GRÁFICO DE PIZZA)
// ------------------------------------
let pieChart;

function updateChart(leaderboardData) {
    const ctx = document.getElementById('pointsChart').getContext('2d');

    const labels = leaderboardData.map(p => p.name);
    const dataPoints = leaderboardData.map(p => p.totalPoints);

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pontos',
                data: dataPoints,
                backgroundColor: [
                    '#0070D1', '#d32f2f', '#FFD700', '#2E7D32', '#9c27b0', '#ff9800'
                ],
                borderWidth: 2,
                borderColor: '#141414'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f0f0f0', font: { family: 'Montserrat' } }
                }
            }
        }
    });
}

// ------------------------------------
// HISTÓRICO DE JOGOS
// ------------------------------------
const historyBody = document.getElementById('historyBody');

async function fetchHistory() {
    try {
        const response = await fetch(`${API_URL}/games`);
        const gamesList = await response.json();

        historyBody.innerHTML = '';

        if (gamesList.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4" class="loading-td">Nenhum jogo cadastrado.</td></tr>';
            return;
        }

        gamesList.forEach(game => {
            const tr = document.createElement('tr');

            // Mapper - Se o player id não constar, coloque Desconhecido. É melhor puxar via object em memoria
            const playerName = playersMap[game.player_id] || "Desconhecido";

            tr.innerHTML = `
                <td><strong>${playerName}</strong></td>
                <td>
                    <a href="${game.hltb_link}" target="_blank" class="hltb-link">
                        ${game.game_name}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </td>
                <td style="color: var(--ps-light-blue); font-weight: bold;">+${game.points}</td>
                <td><span style="font-size: 0.8rem; background:rgba(255,255,255,0.1); padding: 4px 8px; border-radius:4px;">${game.category}</span></td>
            `;

            historyBody.appendChild(tr);
        });

    } catch (error) {
        historyBody.innerHTML = '<tr><td colspan="4" class="loading-td error-text">Erro ao carregar o Histórico.</td></tr>';
    }
}

// Init
fetchPlayers().then(() => {
    fetchLeaderboard();
    fetchHistory();
});
