const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
puppeteer.use(StealthPlugin());

async function getCorrectGameNameViaDDG(query) {
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:howlongtobeat.com/game ' + query)}`;
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);

        let correctName = null;
        $('.result__a').each((i, el) => {
            const title = $(el).text();
            if (title.toLowerCase().includes('howlongtobeat')) {
                correctName = title.replace(/ -( )?HowLongToBeat/gi, '')
                    .replace(/ \| HowLongToBeat/gi, '')
                    .replace(/HowLongToBeat:( )?/gi, '')
                    .replace(/How long is /gi, '')
                    .replace(/\?/g, '')
                    .trim();
                return false;
            }
        });

        return correctName;
    } catch (e) {
        console.error("[DDG] Erro na busca auxiliar:", e.message);
        return null;
    }
}

// Exportar apenas a função de busca aprimorada
async function searchHLTB(userQuery) {
    let browser;
    try {
        console.log(`[SCRAPER] Iniciando busca para: ${userQuery}`);

        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // 1. Checar se é uma URL direta
        if (userQuery.trim().includes('howlongtobeat.com/game/')) {
            console.log(`[SCRAPER] Rota de link direto detectada: ${userQuery}`);
            const url = userQuery.trim();
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 2000));

            const gameData = await page.evaluate(() => {
                const titleEle = document.querySelector('div[class*="profile_header"]') || document.querySelector('h1') || document.querySelector('.profile_header');
                const title = titleEle ? titleEle.innerText.trim() : 'Jogo Desconhecido';

                let imgUrl = null;
                const imgEle = document.querySelector('div[class*="profile_header_picture"] img') || document.querySelector('.game_image img') || document.querySelector('img');
                if (imgEle) {
                    imgUrl = imgEle.src;
                }
                let fullText = document.body.innerText;
                return { title, fullText, imgUrl };
            });

            let hours = 0;
            // Busca com prioridade do maior engajamento (Platina)
            const completionistMatch = gameData.fullText.match(/Completionist\n?.*?(\d+(?:½|\.\d+)?)\s*Hours/i)
                || gameData.fullText.match(/Completionist\s*(\d+(?:½|\.\d+)?)/i)
                || gameData.fullText.match(/Main \+ Extras\n?.*?(\d+(?:½|\.\d+)?)\s*Hours/i)
                || gameData.fullText.match(/Main \+ Extras\s*(\d+(?:½|\.\d+)?)/i)
                || gameData.fullText.match(/Main Story\n?.*?(\d+(?:½|\.\d+)?)\s*Hours/i)
                || gameData.fullText.match(/Main Story\s*(\d+(?:½|\.\d+)?)/i);

            if (completionistMatch && completionistMatch[1]) {
                let numStr = completionistMatch[1].replace('½', '.5');
                hours = parseFloat(numStr);
            }

            return hours > 0 ? [{
                gameName: gameData.title,
                hours: hours,
                imageUrl: gameData.imgUrl || 'https://howlongtobeat.com/img/hltb_brand.png',
                url: url
            }] : [];
        }

        // 2. Tentar usar Busca convencional
        let query = await getCorrectGameNameViaDDG(userQuery);

        if (!query) {
            console.log(`[SCRAPER] Fallback para a query original...`);
            query = userQuery;
        } else {
            console.log(`[SCRAPER] Nome corrigido pelo buscador: ${query}`);
        }

        let words = query.split(' ');
        let formatResults = [];

        while (words.length > 0 && formatResults.length === 0) {
            let currentQuery = words.join(' ');
            console.log(`[SCRAPER] Tentando buscar por: ${currentQuery}`);

            const searchUrl = `https://howlongtobeat.com/?q=${encodeURIComponent(currentQuery)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

            await new Promise(r => setTimeout(r, 2000));

            const gameDataList = await page.evaluate(() => {
                const res = [];
                // Estratégia Blindada: Encontrar as listas (ul) resultantes e pegar as (li) que tenham link de jogo
                const lists = document.querySelectorAll('ul');
                for (let ul of lists) {
                    const items = ul.querySelectorAll('li');
                    for (let li of items) {
                        const a = li.querySelector('a[href^="/game/"]');
                        if (a) {
                            const rawTitle = a.getAttribute('title') || a.innerText || li.innerText.split('\\n')[0];
                            let cleanedTitle = rawTitle.trim();
                            // Se vier com o tempo inserido pela estrutura da página, limpamos a sujeira
                            if (cleanedTitle.includes('Main Story')) {
                                cleanedTitle = cleanedTitle.split('Main Story')[0].trim();
                            } else if (cleanedTitle.includes('\\n')) {
                                cleanedTitle = cleanedTitle.split('\\n')[0].trim();
                            }

                            // Rejeita links lixo e botões
                            if (cleanedTitle && !cleanedTitle.match(/^\d+$/) && !cleanedTitle.toLowerCase().includes('we found') && cleanedTitle.toLowerCase() !== 'add to profile') {
                                let imgUrl = null;
                                const imgEle = li.querySelector('img');
                                if (imgEle) {
                                    imgUrl = imgEle.src;
                                }

                                res.push({
                                    title: cleanedTitle,
                                    fullText: li.innerText || '',
                                    imageUrl: imgUrl,
                                    url: a.href
                                });
                            }
                        }
                    }
                }

                // Filtrar repetições mantendo a ordem de relevância
                const uniqueRes = [];
                const seenTitles = new Set();
                for (let item of res) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        uniqueRes.push(item);
                    }
                }

                return uniqueRes.slice(0, 5);
            });

            if (gameDataList.length > 0) {
                for (let game of gameDataList) {
                    let hours = 0;
                    // Procura em ordem de completude de platina
                    const completionistMatch = game.fullText.match(/Completionist\s*(\d+(?:½|\.\d+)?)/i)
                        || game.fullText.match(/Main \+ Extras\s*(\d+(?:½|\.\d+)?)/i)
                        || game.fullText.match(/Main Story\s*(\d+(?:½|\.\d+)?)/i);

                    if (completionistMatch && completionistMatch[1]) {
                        let numStr = completionistMatch[1].replace('½', '.5');
                        hours = parseFloat(numStr);
                    }

                    if (hours > 0) {
                        formatResults.push({
                            gameName: game.title,
                            hours: hours,
                            imageUrl: game.imageUrl || 'https://howlongtobeat.com/img/hltb_brand.png',
                            url: game.url || searchUrl
                        });
                    }
                }
            }

            if (formatResults.length === 0) {
                words.pop();
            }
        }

        return formatResults;

    } catch (error) {
        console.error("[SCRAPER] Erro:", error.message);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

function calculateScore(hours) {
    if (hours < 5) return 0; // Inválido
    if (hours >= 5 && hours < 15) return 1; // Fácil
    if (hours >= 15 && hours < 41) return 2; // Médio
    if (hours >= 41 && hours <= 80) return 3; // Difícil
    return 4; // Muito Difícil (81h+)
}

module.exports = { searchHLTB, calculateScore };
