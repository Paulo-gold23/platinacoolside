const { db, initializeDB } = require('./db.js');

async function clearCollections() {
    console.log("Apagando coleção Games...");
    const gamesSnapshot = await db.collection('Games').get();

    // Deleta os games
    let batch = db.batch();
    for (const doc of gamesSnapshot.docs) {
        batch.delete(doc.ref);
    }
    await batch.commit();

    console.log("Apagando coleção Players...");
    const playersSnapshot = await db.collection('Players').get();
    let batch2 = db.batch();
    for (const doc of playersSnapshot.docs) {
        batch2.delete(doc.ref);
    }
    await batch2.commit();

    console.log("Tudo apagado com sucesso.");
}

clearCollections().then(() => {
    console.log("Semeando jogadores novamente...");
    return initializeDB();
}).then(() => {
    console.log("Processo concluído!");
    process.exit(0);
}).catch(console.error);
