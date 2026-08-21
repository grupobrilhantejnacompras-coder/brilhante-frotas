#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera o arquivo único Sistema_OS_Grupo_Brilhante.html a partir de src/."""
import json, pathlib, datetime, hashlib

BASE = pathlib.Path(__file__).resolve().parent
SRC = BASE / 'src'
ORDEM = ['01_core.js', '02_ui.js', '03_app.js', '04_pages_os.js', '05_filtros.js',
         '06_painel.js', '07_relatorios.js', '08_importar.js', '08b_exportar.js', '08c_usuarios.js', '09_config.js']

css = (SRC / 'style.css').read_text(encoding='utf-8')
js = '\n\n'.join((SRC / f).read_text(encoding='utf-8') for f in ORDEM)
dados = json.load(open(BASE / 'dados_brilhante.json', encoding='utf-8'))
logo = (BASE / 'logo_min.svg').read_text(encoding='utf-8').strip()

# Versão: número sequencial guardado em VERSAO.txt + data da geração.
vfile = BASE / 'VERSAO.txt'
versao = int(vfile.read_text().strip()) + 1 if vfile.exists() else 1
vfile.write_text(str(versao))
data_br = datetime.date.today().strftime('%d/%m/%Y')

html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0C1F55">
<meta name="description" content="Sistema de ordens de serviço e gestão de manutenção de frotas do Grupo Brilhante.">
<title>Grupo Brilhante · Ordens de Serviço de Frotas</title>
<link rel="icon" href="data:image/svg+xml,{'%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 rx=%2218%22 fill=%22%231B3FAE%22/%3E%3Cpath d=%22M50 20 78 42 50 82 22 42Z%22 fill=%22%23fff%22/%3E%3C/svg%3E'}">
<style>
{css}
</style>
</head>
<body>
<div id="root"></div>
<div id="toasts" aria-live="polite"></div>
<noscript><p style="padding:24px;font-family:sans-serif">Este sistema precisa de JavaScript ativado.</p></noscript>
<script>
/* Logo institucional do Grupo Brilhante (vetorizada a partir do arquivo original). */
window.APP_VERSAO = {{ n: "{versao}", data: "{data_br}" }};
window.LOGO_SVG = {json.dumps(logo)};
/* Base de dados extraída da planilha RELATORIO SEMANAL OFICINA. */
window.DADOS_PLANILHA = {json.dumps(dados, ensure_ascii=False, separators=(',', ':'))};
</script>
<script>
{js}
</script>
</body>
</html>
"""

out = BASE / 'Sistema_OS_Grupo_Brilhante.html'
out.write_text(html, encoding='utf-8')
kb = out.stat().st_size / 1024
# publica também a pasta do site (fonte única para a Vercel)
site = BASE / 'site'
site.mkdir(exist_ok=True)
(site / 'index.html').write_text(html, encoding='utf-8')
print(f'{out.name} — v{versao} — {kb:.0f} KB  ({len(dados["ordens"])} OS, {len(dados["veiculos"])} veículos, {len(dados["servicos"])} serviços)')
print(f'site/index.html atualizado (sha {hashlib.sha256(html.encode()).hexdigest()[:12]})')
