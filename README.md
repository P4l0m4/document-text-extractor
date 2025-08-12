## What is this ?

This API extracts text from documents.

Supported formats:

- text-based PDF
- scanned PDF
- PNG
- JPEG/JPG

Supported documents can contain a mix of these different formats and up to 100 pages.
It can handle up to 3 simultaneous requests per second.

Languages:

- English
- French

## Disclaimer

This project was made with KIRO AI. Needless to say, it contains many mistakes and useless code. I am not a backend developer, therefore, this will not be fixed as long as it works.

## Process

- Send document to API.
- API reads every page and extracts text depending on its format (it will convert scanned PDF to jpg).
- API stores text in the "summary" array of objects (one object per page), which is sent to the front end app as well as "extractedText" (full text blob), the document metadata and its processing status.
- API cleans up the files from memory.

## Tech stack

- Nest.js
- Tesseract
- OCR
- Docker
- Express
- PDF2PIC
- PDFParse
- graphicsmagick
- ghostscript

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

```
