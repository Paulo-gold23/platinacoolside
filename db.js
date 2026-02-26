const admin = require('firebase-admin');

const fs = require('fs');

// Atenção: O arquivo serviceAccountKey.json será adicionado pelo usuário na raiz do projeto (local)
// ou montado dinamicamente pelo Render no caminho /etc/secrets/ (produção no Docker)
try {
    let serviceAccount;

    // 1. Tenta ler via Variável de Ambiente (A Prova de falhas no Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log("Chave do Firebase carregada via variável de ambiente.");
    }
    // 2. Tenta ler do arquivo local
    else if (fs.existsSync('./serviceAccountKey.json')) {
        serviceAccount = require('./serviceAccountKey.json');
        console.log("Chave do Firebase carregada localmente.");
    }
    // 3. Tenta ler do cofre do Render
    else if (fs.existsSync('/etc/secrets/serviceAccountKey.json')) {
        serviceAccount = require('/etc/secrets/serviceAccountKey.json');
        console.log("Chave do Firebase carregada do cofre do Render (/etc/secrets/).");
    } else {
        throw new Error("Credenciais do Firebase não foram encontradas em nenhum lugar.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("ERRO CONECTANDO AO FIREBASE:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// Função para iniciar o banco de dados com jogadores padrões caso esteja vazio
async function initializeDB() {
    const playersRef = db.collection('Players');
    const snapshot = await playersRef.get();

    if (snapshot.empty) {
        console.log("Banco de dados vazio. Semeando os jogadores iniciais...");
        const initialPlayers = ["Cebola", "Brau", "Jack", "Vyc"];

        for (const player of initialPlayers) {
            await playersRef.add({ name: player });
        }
        console.log("Jogadores criados com sucesso!");
    } else {
        console.log(`Banco online! Encontrados ${snapshot.size} jogadores na base.`);
    }
}

module.exports = { db, initializeDB };
