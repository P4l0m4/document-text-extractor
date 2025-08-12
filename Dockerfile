# Node 18 + Alpine
FROM node:18-alpine

# Dépendances pour PDF->image + outils
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript \
    poppler-utils \
    python3 \
    make \
    g++ \
    curl

# Embarquer les langues Tesseract.js (offline)
RUN mkdir -p /app/tessdata && \
    curl -L -o /app/tessdata/eng.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata && \
    curl -L -o /app/tessdata/fra.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/main/fra.traineddata

# Optionnel: police courante (parfois utile pour rasterisation)
# RUN apk add --no-cache ttf-dejavu

# Répertoire appli
WORKDIR /app

# Caching npm
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Code
COPY . .

# Temp pour PDF conversion
RUN mkdir -p temp

# Build
RUN npm run build

EXPOSE 3000

# Healthcheck (curl est installé)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["npm", "run", "start:prod"]

# Pour Tesseract.js (lu par ton code via process.env)
ENV TESSERACT_LANG_PATH=/app/tessdata
