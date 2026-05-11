# Aury Money 💜

App de gestão financeira para o casal Lenin & Evelyn.

## Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express (Railway) ou Static (Vercel)
- **Banco:** Firebase Firestore (sync em tempo real)
- **IA:** Claude Haiku (Anthropic)

## Configuração Local

1. Copie o `.env.example` para `.env` e preencha as variáveis
2. `npm install`
3. `npm run dev` (desenvolvimento)
4. `npm run build` (build para produção)

## 🚀 Deploy

Este projeto está preparado para **Railway** e **Vercel**.

### Railway (Atual)
```bash
git push origin main
```
Railway detecta automaticamente e faz deploy.

### Vercel (Migração Futura)
```bash
vercel --prod
```
Ou conecte via GitHub no painel do Vercel.

📖 **Guia completo:** Veja [DEPLOY.md](./DEPLOY.md) para instruções detalhadas.

## Variáveis de Ambiente
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
PORT=3001
```
