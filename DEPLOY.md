# GATI — Guia de Deploy

Este arquivo descreve como fazer o deploy do GATI em um servidor de produção usando Docker.

---

## Pré-requisitos

- Servidor Linux com Docker e Docker Compose instalados
- Microsoft SQL Server acessível na rede
- Conta no GitHub com acesso ao Container Registry (`ghcr.io`)

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DB_CONNECTION_STRING=Driver={FreeTDS};Server=YOUR_SERVER;Port=YOUR_PORT;Database=YOUR_DB;UID=YOUR_USER;PWD=YOUR_PASSWORD;TDS_Version=7.4;
JWT_SECRET_KEY=your-jwt-secret-at-least-32-characters-long
SMTP_PASSWORD=your_smtp_app_password
SMTP_FROM=your@email.com
```

---

## Deploy com Docker Compose

### 1. Faça login no Container Registry

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### 2. Suba os serviços

```bash
docker compose up -d
```

Isso inicia o backend na porta `5001` e o frontend na porta `8081`.

---

## Configuração de Proxy Reverso (Nginx)

Exemplo de configuração para expor o frontend e rotear `/api` para o backend:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8081;
    }

    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Banco de Dados

O sistema exige **Microsoft SQL Server**. O schema inicial deve ser aplicado manualmente antes do primeiro deploy. Execute os scripts SQL presentes na pasta de migrações do projeto contra o banco configurado.

---

## Logo Personalizada

Para exibir uma logo nos documentos PDF gerados, coloque um arquivo `logo.png` na raiz de execução do container backend (`/app/logo.png`). Se o arquivo não existir, o PDF é gerado sem imagem.

---

## CI/CD Automático

O workflow `.github/workflows/deploy.yml` builda e publica as imagens Docker automaticamente no `ghcr.io` após os testes passarem. As imagens são publicadas como:

- `ghcr.io/YOUR_GITHUB_USER/gati-backend:latest`
- `ghcr.io/YOUR_GITHUB_USER/gati-frontend:latest`

Atualize o `docker-compose.yml` com o seu usuário do GitHub.
