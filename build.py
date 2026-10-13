#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera o arquivo único Sistema_OS_Grupo_Brilhante.html a partir de src/."""
import json, pathlib, datetime, hashlib, base64

BASE = pathlib.Path(__file__).resolve().parent
SRC = BASE / 'src'
ORDEM = ['01_core.js', '02_ui.js', '03_app.js', '04_pages_os.js', '05_filtros.js',
         '06_painel.js', '07_relatorios.js', '08_importar.js', '08b_exportar.js', '08c_usuarios.js', '09_config.js', '10_supabase.js']

css = (SRC / 'style.css').read_text(encoding='utf-8')
js = '\n\n'.join((SRC / f).read_text(encoding='utf-8') for f in ORDEM)
dados = json.load(open(BASE / 'dados_brilhante.json', encoding='utf-8'))
logo = (BASE / 'logo_min.svg').read_text(encoding='utf-8').strip()
# Ícone (logo oficial sobre fundo azul royal) embutido como data URI, pra
# funcionar tanto no site publicado quanto no arquivo único aberto local.
favicon_b64 = base64.b64encode((BASE / 'favicon.png').read_bytes()).decode()

# Tipografia oficial do Grupo Brilhante: Montserrat (variável, pesos 100–900,
# subconjunto latino com acentos do português). Carregada UMA única vez aqui,
# embutida no HTML: funciona no site publicado (sem liberar domínio externo na CSP)
# e no arquivo único aberto direto no computador, inclusive sem internet.
# Pesos e papéis de cada texto ficam nos tokens --fw-* de src/style.css.
fonte_b64 = base64.b64encode((BASE / 'fontes' / 'Montserrat-latin-variable.woff2').read_bytes()).decode()
fonte_css = ("@font-face{font-family:'Montserrat';font-style:normal;font-weight:100 900;"
             "font-display:swap;src:url(data:font/woff2;base64," + fonte_b64 + ") format('woff2');"
             "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
             "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}")

# Versão: string em VERSAO.txt (ex.: 5.1) + data da geração. Ajuste o arquivo ao publicar.
vfile = BASE / 'VERSAO.txt'
versao = vfile.read_text().strip() if vfile.exists() else '1'
data_br = datetime.date.today().strftime('%d/%m/%Y')

html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0C1F55">
<meta name="description" content="Sistema de ordens de serviço e gestão de manutenção de frotas do Grupo Brilhante.">
<title>Grupo Brilhante · Ordens de Serviço de Frotas</title>
<link rel="icon" href="data:image/png;base64,{favicon_b64}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Brilhante OS">
<style id="fonte-marca">{fonte_css}</style>
<style>
{css}
</style>
</head>
<body>
<div id="root"></div>
<div id="toasts" aria-live="polite"></div>
<noscript><p style="padding:24px;font-family:Montserrat,Arial,sans-serif">Este sistema precisa de JavaScript ativado.</p></noscript>
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
