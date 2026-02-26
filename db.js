const admin = require('firebase-admin');

const fs = require('fs');

// Atenção: O arquivo serviceAccountKey.json será adicionado pelo usuário na raiz do projeto (local)
// ou montado dinamicamente pelo Render no caminho /etc/secrets/ (produção no Docker)
try {
    let serviceAccount;

    if (fs.existsSync('./serviceAccountKey.json')) {
        serviceAccount = require('./serviceAccountKey.json');
        console.log("Chave do Firebase carregada localmente.");
    } else if (fs.existsSync('/etc/secrets/serviceAccountKey.json')) {
        serviceAccount = require('/etc/secrets/serviceAccountKey.json');
        console.log("Chave do Firebase carregada do cofre do Render (/etc/secrets/).");
    } else {
        throw new Error("Não encontrado local e nem no cofre.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("ERRO: O arquivo serviceAccountKey.json não foi encontrado ou é inválido.");
    console.error("Você precisa criar um projeto no Firebase Gerar a Chave Privada em 'Configurações do Projeto' -> 'Contas de Serviço'.");
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
