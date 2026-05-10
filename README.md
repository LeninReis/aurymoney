# Aury Money 💜

App de gestão financeira para o casal Lenin & Evelyn.

## Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Banco:** Firebase Firestore (sync em tempo real)
- **IA:** Claude Haiku (Anthropic)

## Configuração

1. Copie o `.env.example` para `.env` e preencha as variáveis
2. `npm install`
3. `npm run build` (gera o frontend)
4. `npm start` (sobe o servidor)

## Deploy no Railway
1. Sobe este repositório no GitHub
2. Cria um novo projeto no Railway conectado ao GitHub
3. Adiciona as variáveis de ambiente no Railway
4. Railway detecta o `npm start` automaticamente

## Variáveis de Ambiente
```
ANTHROPIC_API_KEY=sk-ant-...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
PORT=3001
```
