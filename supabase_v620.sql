-- ============================================================
-- v6.20 — rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Projeto: ysszhioygqyjbcgjgpca. É seguro rodar de novo (if not exists / drop policy if exists)
-- e não altera nem apaga nenhuma O.S. existente.
--
--  1) coluna "status" em ordens: a situação (Aberta / Em andamento / Concluída / Cancelada)
--     passa a valer em todos os computadores;
--  2) tabela "veiculos": o cadastro de veículos (nome, placa, categoria…) passa a ser o mesmo
--     em todos os computadores;
--  3) o índice que impede dois números de O.S. iguais NÃO está aqui: ele só pode ser criado depois
--     que os números repetidos forem corrigidos (arquivo supabase_numero_unico.sql).
-- ============================================================

-- 1) situação da O.S.
alter table public.ordens add column if not exists status text;

-- 2) cadastro de veículos
create table if not exists public.veiculos (
  id text primary key,
  nome text,
  placa text,
  tipo text,
  dados jsonb not null default '{}'::jsonb,   -- ficha completa do veículo, como no sistema
  atualizado_em timestamptz not null default now()
);
alter table public.veiculos enable row level security;

drop policy if exists veiculos_leitura on public.veiculos;
create policy veiculos_leitura on public.veiculos for select to anon, authenticated using (true);
drop policy if exists veiculos_inclui on public.veiculos;
create policy veiculos_inclui on public.veiculos for insert to anon, authenticated with check (true);
drop policy if exists veiculos_altera on public.veiculos;
create policy veiculos_altera on public.veiculos for update to anon, authenticated using (true) with check (true);
-- (de propósito não há permissão de apagar veículos pelo site)

grant select, insert, update on public.veiculos to anon, authenticated;
