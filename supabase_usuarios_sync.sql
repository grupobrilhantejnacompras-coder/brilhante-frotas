-- ============================================================
-- Sincronização de USUÁRIOS com o Supabase (login no servidor)
-- Projeto: ysszhioygqyjbcgjgpca
--
-- Rode este script inteiro no SQL Editor do Supabase (Run). É seguro
-- repetir: usa IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS
-- em tudo, então rodar de novo não duplica nem apaga usuários.
--
-- O que muda depois de rodar:
--  - a senha (hash) nunca é lida pelo site: só as funções abaixo, que
--    rodam dentro do banco, enxergam a coluna senha_hash;
--  - criar, editar ou excluir um usuário passa a valer em qualquer
--    computador ou celular na hora, não só onde foi feito;
--  - o login passa a ser conferido aqui no banco, não mais só no navegador.
-- ============================================================

-- extensão usada para gerar/checar o hash da senha
create extension if not exists pgcrypto;

-- garante as colunas que o app espera (a tabela já existe com id/nome/
-- usuario/senha_hash/perfil/permissoes; isso só completa o que faltar)
alter table usuarios add column if not exists setor text;
alter table usuarios add column if not exists status text not null default 'Ativo';
alter table usuarios add column if not exists permissoes jsonb not null default '[]'::jsonb;
alter table usuarios add column if not exists ultimo_acesso date;
alter table usuarios add column if not exists criado_em date;

-- ------------------------------------------------------------
-- Trava a tabela: ninguém lê/grava usuarios direto (a senha_hash não
-- pode vazar). Todo acesso passa pelas funções e pela view abaixo.
-- ------------------------------------------------------------
alter table usuarios enable row level security;
drop policy if exists usuarios_sem_acesso_direto on usuarios;
-- (nenhuma policy criada de propósito = anon/authenticated não leem nem
--  gravam direto; as funções "security definer" abaixo continuam podendo)

-- ------------------------------------------------------------
-- View pública, sem a senha, para listar usuários na tela de administração
-- ------------------------------------------------------------
create or replace view usuarios_publico as
  select id, nome, usuario, perfil, setor, status, permissoes, ultimo_acesso, criado_em
  from usuarios;

grant select on usuarios_publico to anon, authenticated;

-- ------------------------------------------------------------
-- Login: confere usuário/senha no banco e devolve o usuário (sem senha)
-- se bateu; devolve vazio se não bateu. Atualiza "último acesso" só
-- quando a senha confere e o usuário está Ativo.
-- ------------------------------------------------------------
create or replace function verificar_login(p_usuario text, p_senha text)
returns table (
  id text, nome text, usuario text, perfil text, setor text,
  status text, permissoes jsonb, ultimo_acesso date
)
language plpgsql security definer
as $$
begin
  return query
    update usuarios set ultimo_acesso = case when usuarios.status = 'Ativo' then current_date else usuarios.ultimo_acesso end
    where lower(trim(usuarios.usuario)) = lower(trim(p_usuario))
      and usuarios.senha_hash = crypt(p_senha, usuarios.senha_hash)
    returning usuarios.id, usuarios.nome, usuarios.usuario, usuarios.perfil, usuarios.setor,
              usuarios.status, usuarios.permissoes, usuarios.ultimo_acesso;
end;
$$;

grant execute on function verificar_login(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Cria ou atualiza um usuário. p_id vem sempre preenchido pelo app
-- (ele gera o id antes de chamar); p_senha nulo ou vazio mantém a
-- senha atual (não mexe no hash já salvo).
-- ------------------------------------------------------------
create or replace function salvar_usuario(
  p_id text, p_nome text, p_usuario text, p_senha text,
  p_perfil text, p_setor text, p_status text, p_permissoes jsonb
) returns text
language plpgsql security definer
as $$
begin
  insert into usuarios (id, nome, usuario, senha_hash, perfil, setor, status, permissoes, criado_em)
  values (
    p_id, p_nome, p_usuario,
    crypt(coalesce(nullif(p_senha, ''), '0000'), gen_salt('bf', 6)),
    p_perfil, p_setor, coalesce(p_status, 'Ativo'), coalesce(p_permissoes, '[]'::jsonb), current_date
  )
  on conflict (id) do update set
    nome = excluded.nome,
    usuario = excluded.usuario,
    perfil = excluded.perfil,
    setor = excluded.setor,
    status = coalesce(p_status, usuarios.status),
    permissoes = coalesce(p_permissoes, usuarios.permissoes),
    senha_hash = case when p_senha is not null and p_senha <> ''
                      then crypt(p_senha, gen_salt('bf', 6))
                      else usuarios.senha_hash end;
  return p_id;
end;
$$;

grant execute on function salvar_usuario(text, text, text, text, text, text, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- Exclui um usuário — nunca deixa o sistema sem nenhum administrador ativo.
-- ------------------------------------------------------------
create or replace function excluir_usuario(p_id text) returns boolean
language plpgsql security definer
as $$
declare v_perfil text; v_status text; v_admins int;
begin
  select perfil, status into v_perfil, v_status from usuarios where id = p_id;
  if v_perfil = 'Administrador' and v_status = 'Ativo' then
    select count(*) into v_admins from usuarios where perfil = 'Administrador' and status = 'Ativo';
    if v_admins <= 1 then return false; end if;
  end if;
  delete from usuarios where id = p_id;
  return true;
end;
$$;

grant execute on function excluir_usuario(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Conferência rápida depois de rodar: deve devolver os 8 usuários de
-- fábrica (sem mostrar a senha).
-- ------------------------------------------------------------
select id, nome, usuario, perfil, status from usuarios_publico order by id;
