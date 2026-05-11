# 🚀 Guia de Deploy - AuryMoney

Este projeto está configurado para funcionar tanto no **Railway** quanto no **Vercel**.

---

## 📦 Railway (Deploy Atual)

### Como fazer deploy:

1. **Commit e Push**
```bash
git add .
git commit -m "Update"
git push origin main
```

2. **Railway detecta automaticamente**
   - Build command: `npm run build`
   - Start command: `npm start`
   - O Railway usa o arquivo `server/index.js` para servir o app

### Configurações Railway:
- ✅ Framework: Node.js
- ✅ Build: Vite
- ✅ Porta: Automática (process.env.PORT)

---

## ⚡ Vercel (Migração Futura)

### Como fazer deploy:

#### Opção 1: Via CLI
```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer deploy
vercel

# Deploy para produção
vercel --prod
```

#### Opção 2: Via GitHub
1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Import Project"
3. Conecte seu repositório GitHub
4. O Vercel detecta automaticamente as configurações

### Configurações Vercel:
- ✅ Framework Preset: Vite
- ✅ Build Command: `npm run vercel-build` (ou `npm run build`)
- ✅ Output Directory: `dist`
- ✅ Install Command: `npm install`

### Variáveis de Ambiente (ambas plataformas):
```
VITE_FIREBASE_API_KEY=sua-chave-aqui
VITE_FIREBASE_AUTH_DOMAIN=seu-dominio.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
VITE_FIREBASE_MEASUREMENT_ID=seu-measurement-id
```

---

## 🔄 Diferenças entre Railway e Vercel

| Feature | Railway | Vercel |
|---------|---------|--------|
| Tipo | Full-stack (Node.js + Static) | Static + Serverless |
| Build | Automático via Git | Automático via Git |
| Domínio | railway.app | vercel.app |
| SSL | Automático | Automático |
| Custo | Free tier + uso | Free tier + uso |
| Preview | ✅ | ✅ |

---

## 📝 Arquivos de Configuração

### Railway:
- `server/index.js` - Servidor Express para servir o app
- `package.json` - Scripts de build

### Vercel:
- `vercel.json` - Configuração de rotas SPA
- `package.json` - Script `vercel-build`

---

## ✅ Checklist antes do deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Build local funcionando (`npm run build`)
- [ ] Firebase configurado
- [ ] Commit e push para o GitHub

---

## 🆘 Troubleshooting

### Railway:
- **Erro de porta**: O Railway define automaticamente via `process.env.PORT`
- **Build falhou**: Verificar logs no dashboard do Railway

### Vercel:
- **Rotas não funcionam**: O `vercel.json` está configurado para SPA
- **Build falhou**: Verificar se todas as dependências estão no package.json

---

## 🎯 Recomendação

- **Railway**: Ideal para desenvolvimento e testes (servidor Node.js incluído)
- **Vercel**: Ideal para produção (otimizado para React/Vite, CDN global)

---

Desenvolvido com ❤️ para Lenin & Evelyn
