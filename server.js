const express = require('express');
const cors = require('cors');
const { db, initializeDB } = require('./db');
const { searchHLTB, calculateScore } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializa dados padrao
initializeDB().catch(console.error);

// ----------------------
// ENDPOINTS DA API
// ----------------------

// Rota: Buscar jogadores
app.get('/players', async (req, res) => {
    try {
        const snapshot = await db.collection('Players').get();
        const players = [];
        snapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar jogadores" });
    }
});

// Rota: Leaderboard (Ranking agrupado)
app.get('/leaderboard', async (req, res) => {
    try {
        const playersSnapshot = await db.collection('Players').get();
        const gamesSnapshot = await db.collection('Games').get();

        let leaderboard = {};

        playersSnapshot.forEach(doc => {
            leaderboard[doc.id] = { id: doc.id, name: doc.data().name, totalPoints: 0, games: 0 };
        });

        gamesSnapshot.forEach(doc => {
            const game = doc.data();
            if (leaderboard[game.player_id]) {
                leaderboard[game.player_id].totalPoints += game.points;
                leaderboard[game.player_id].games += 1;
            }
        });

        const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => b.totalPoints - a.totalPoints);
        res.json(sortedLeaderboard);
    } catch (error) {
        res.status(500).json({ error: "Erro ao gerar leaderboard" });
    }
});

// NOVO: Rota: Buscar jogos no HLTB
app.get('/search-game', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: "Parâmetro de busca 'q' obrigatório." });
    }

    try {
        const results = await searchHLTB(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar no HowLongToBeat", details: error.message });
    }
});

// NOVO: Rota: Histórico detalhado de todos os jogos
app.get('/games', async (req, res) => {
    try {
        const snapshot = await db.collection('Games').orderBy('created_at', 'desc').get();
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar jogos" });
    }
});

// Rota: Adicionar jogo
// Agora ele recebe as horas do front e apenas salva (evita 2x puppeteer)
app.post('/add-game', async (req, res) => {
    const { player_id, game_name, hours, hltb_link, image_url } = req.body;

    if (!player_id || !game_name || !hours) {
        return res.status(400).json({ error: "Dados incompletos: player_id, game_name e hours são obrigatórios." });
    }

    try {
        const points = calculateScore(hours);

        if (points === 0) {
            return res.status(400).json({ error: "Jogo com menos de 5 horas não conta platina válida." });
        }

        let category = "Fácil";
        if (points === 2) category = "Médio";
        if (points === 3) category = "Difícil";
        if (points === 4) category = "Muito Difícil";

        const newGame = {
            player_id,
            game_name,
            hltb_link: hltb_link || "https://howlongtobeat.com",
            image_url: image_url || "https://howlongtobeat.com/img/hltb_brand.png",
            hours,
            points,
            category,
            created_at: new Date().toISOString()
        };

        const docRef = await db.collection('Games').add(newGame);

        res.json({ message: "Jogo adicionado com sucesso!", gameId: docRef.id, ...newGame });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao adicionar o jogo", details: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
