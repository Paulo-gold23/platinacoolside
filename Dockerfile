FROM ghcr.io/puppeteer/puppeteer:21.9.0

# Define a variável para o Puppeteer pular o download do Chromium, já que a imagem já possui um.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Muda para o usuário root para instalar pacotes necessários, se precisar
USER root

WORKDIR /app

# Copia os arquivos do projeto
COPY package*.json ./
RUN npm install

COPY . .

# Expondo a porta gerada ou a 3000
EXPOSE 3000

# Executar a aplicação
CMD ["node", "server.js"]
