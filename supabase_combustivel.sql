-- ============================================================
-- Combustíveis — bases importadas (Excel / NF-e / Sankhya) na nuvem
-- Projeto: ysszhioygqyjbcgjgpca
--
-- Rode este script inteiro UMA VEZ no SQL Editor do Supabase (Run).
-- É seguro repetir. Não mexe em OS, veículos nem usuários.
--
-- Como funciona:
--  - cada importação vira um "instantâneo" (linha nova); nada é apagado,
--    então dá para ver o histórico e voltar atrás;
--  - o dashboard lê o instantâneo mais recente de cada tipo
--    ('consumo' = planilha RELATORIO COMBUSTIVEL, 'compras' = notas);
--  - SÓ ADMINISTRADOR ativo, com a senha conferida no banco, consegue
--    gravar. A tabela não tem acesso direto: tudo passa pelas funções.
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.combustivel_bases (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('consumo', 'compras')),
  arquivo       text not null default '',
  resumo        text not null default '',
  dados         jsonb,                       -- null = voltar à base que vem embutida no dashboard
  importado_por text not null default '',
  importado_em  timestamptz not null default now()
);
create index if not exists combustivel_bases_tipo_idx on public.combustivel_bases (tipo, id desc);

alter table public.combustivel_bases enable row level security;
-- (nenhuma policy de propósito: ninguém lê/grava a tabela direto)

-- Último instantâneo de cada tipo (leitura aberta, como as OS hoje)
create or replace function public.combustivel_ultimas()
returns setof public.combustivel_bases
language sql security definer set search_path = public, extensions
as $$
  select distinct on (tipo) * from public.combustivel_bases order by tipo, id desc;
$$;

-- Histórico (sem o conteúdo pesado)
create or replace function public.combustivel_historico()
returns table (id bigint, tipo text, arquivo text, resumo text, importado_por text, importado_em timestamptz, restaura_original boolean)
language sql security definer set search_path = public, extensions
as $$
  select id, tipo, arquivo, resumo, importado_por, importado_em, (dados is null)
  from public.combustivel_bases order by id desc limit 50;
$$;

-- Grava um instantâneo: só Administrador ativo com senha correta
create or replace function public.combustivel_salvar_base(
  p_usuario text, p_senha text, p_tipo text, p_arquivo text, p_resumo text, p_dados jsonb
) returns bigint
language plpgsql security definer set search_path = public, extensions
as $$
declare
  u record;
  novo bigint;
begin
  select usuario, nome, perfil, status, senha_hash into u
    from public.usuarios
   where lower(trim(usuario)) = lower(trim(p_usuario))
   limit 1;
  if not found or u.senha_hash <> crypt(coalesce(p_senha, ''), u.senha_hash) then
    perform pg_sleep(0.5);
    raise exception 'Usuário ou senha incorretos.' using errcode = '28000';
  end if;
  if u.status <> 'Ativo' or u.perfil <> 'Administrador' then
    raise exception 'Somente administrador ativo pode importar dados de combustível.' using errcode = '42501';
  end if;
  if p_tipo not in ('consumo', 'compras') then
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  insert into public.combustivel_bases (tipo, arquivo, resumo, dados, importado_por)
  values (p_tipo, left(coalesce(p_arquivo, ''), 300), left(coalesce(p_resumo, ''), 600), p_dados, u.nome)
  returning id into novo;
  return novo;
end;
$$;

grant execute on function public.combustivel_ultimas()   to anon, authenticated;
grant execute on function public.combustivel_historico() to anon, authenticated;
grant execute on function public.combustivel_salvar_base(text, text, text, text, text, jsonb) to anon, authenticated;
