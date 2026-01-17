# 🏭 MetalStock Pro - Backend API

Express.js API para a plataforma MetalStock Pro.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Configurar ambiente (copiar e editar .env)
cp .env.example .env

# Executar em desenvolvimento
npm run dev

# Criar admin inicial
node seed.js
```

## 📡 Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registar utilizador |
| POST | `/api/auth/login` | Login (retorna JWT) |
| GET | `/api/auth/me` | Dados do utilizador autenticado |
| GET | `/api/health` | Health check |

## 🔐 Admin Default

- **Email:** `admin@metalstock.pt`
- **Password:** `admin123`

## 🌐 Deploy (Vercel)

```bash
vercel --prod
```
