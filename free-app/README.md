# Meu Controle Financeiro — versão gratuita

Aplicação móvel simples para login, contas bancárias, gastos, limite mensal e importação do backup do app anterior. Os dados financeiros ficam no Supabase com isolamento por usuário (RLS); a interface estática e a pequena função de configuração podem rodar no plano gratuito da Vercel.

## O que já está implementado

- login e criação de conta por e-mail;
- cadastro de contas, inclusive conta digital e saldo inicial;
- cadastro e exclusão de gastos;
- vínculo opcional do gasto com uma conta;
- painel do mês, saldo, limite e valores pendentes;
- leitura correta de `2700,00`, `2.700,00`, `2700.00` e valores com `R$`;
- importação do JSON exportado do app ChatGPT Sites, com prevenção de duplicados;
- preservação do limite mensal e dos limites por categoria presentes no backup;
- banco permanente no Supabase, protegido por políticas por usuário.

## Publicação gratuita — uma única vez

1. No painel SQL do projeto Supabase/Lovable Cloud, execute todo o conteúdo de `supabase/migration.sql`. A migração é aditiva: não apaga as despesas existentes.
2. Na Vercel, importe o repositório do GitHub e informe `free-app` como **Root Directory**.
3. Em **Settings > Environment Variables**, cadastre:
   - `SUPABASE_URL`: URL do projeto Supabase;
   - `SUPABASE_PUBLISHABLE_KEY`: chave pública/publishable do projeto. A chave `service_role` nunca deve ser usada aqui.
4. Faça o deploy. A Vercel fornecerá uma URL HTTPS.
5. No Supabase, adicione essa URL em **Authentication > URL Configuration > Redirect URLs** e defina-a como **Site URL**.
6. Entre no app, abra **Ajustes > Importar backup** e selecione o arquivo JSON guardado localmente.

## Desenvolvimento e verificação

Requer Node.js 20 ou superior apenas para os testes:

```sh
npm run check
npm test
```

Para testar a função `/api/config` localmente, use a CLI da Vercel com um arquivo `.env` que contenha apenas a URL e a chave pública. O arquivo `.env` e os backups são ignorados pelo Git.

## Segurança

- O repositório não contém senha, token de sessão, chave administrativa ou backup financeiro.
- A chave publishable do Supabase identifica o projeto, mas não substitui as políticas RLS.
- Todas as tabelas financeiras usam RLS para que cada usuário acesse apenas seus registros.
- O backup é lido no navegador; o arquivo completo não é publicado nem enviado ao GitHub.
