# DocuFlow Pro

Você é um engenheiro de software especialista em replicação de interfaces e arquitetura web moderna.

Sua tarefa é criar uma plataforma web completa baseada na análise visual e funcional de um site existente.

O objetivo é reproduzir a mesma experiência de usuário, layout e funcionalidades, porém com código totalmente novo e arquitetura moderna.

REQUISITOS DO PROJETO

Crie uma plataforma web que permita geração e gerenciamento de documentos digitais personalizados.

O sistema deve possuir:

• landing page moderna  

• autenticação de usuários  

• painel administrativo  

• geração automática de documentos em PDF  

• sistema de templates  

• QR Code para verificação de documentos  

• histórico de documentos gerados  

INTERFACE

A interface deve ser extremamente moderna e minimalista.

Características:

tema escuro (azul escuro)  

elementos em branco  

design limpo  

interface futurista  

A página inicial deve conter:

apresentação da plataforma  

botão de login  

botão de criar conta  

AUTENTICAÇÃO

Criar sistema completo com:

cadastro de usuários  

login com email e senha  

proteção de rotas  

sessão segura  

DASHBOARD

Após login o usuário deve acessar um painel contendo:

criar novo documento  

histórico de documentos  

download de PDF  

verificação de documentos  

GERAÇÃO DE DOCUMENTOS

Os documentos devem ser gerados através de formulários dinâmicos.

Exemplo de campos:

nome  

identificação  

data  

descrição  

informações adicionais  

GERAÇÃO DE PDF

Quando o usuário enviar o formulário:

os dados devem preencher automaticamente um template  

um PDF deve ser gerado automaticamente  

o usuário pode visualizar ou baixar o documento  

QR CODE

Cada documento deve possuir um QR Code.

O QR Code deve direcionar para uma página pública:

/verify/{document_id}

Essa página deve exibir:

identificador do documento  

data de criação  

status do documento  

TECNOLOGIAS

Frontend:

React  

Vite  

TailwindCSS  

Backend:

Node.js  

Express  

Banco de dados:

PostgreSQL ou Supabase  

PERFORMANCE

O projeto deve ser otimizado para:

carregamento rápido  

lazy loading  

componentes reutilizáveis  

ESTRUTURA DO PROJETO

Organize o código da seguinte forma:

/src  

/components  

/pages  

/templates  

/services  

/utils  

/api  

/assets  

RESULTADO FINAL

Forneça:

estrutura completa do projeto  

todos os arquivos necessários  

instruções para rodar localmente  

guia para deploy

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shape-write.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7e96bba6-3563-4a6c-b2ef-02cc3d7499f8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
