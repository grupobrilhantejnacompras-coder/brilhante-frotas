#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrai a planilha RELATORIO SEMANAL OFICINA para JSON estruturado."""
import openpyxl, warnings, re, json, unicodedata, datetime
warnings.filterwarnings('ignore')

SRC = '/root/.claude/uploads/c081ca53-a6f0-53ff-958d-7c41d7778814/b460d7fb-RELATORIO_SEMANAL_OFICINA_5_1.xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True)

def norm(s):
    if s is None: return ''
    s = str(s).strip()
    return s

def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','-', s.lower()).strip('-')

def num(v):
    if v is None: return None
    if isinstance(v,(int,float)): return float(v)
    s = str(v).replace('R$','').replace('.','').replace(',','.').strip()
    try: return float(s)
    except: return None

# ---------------------------------------------------------------- datas
def parse_date(v):
    """Retorna (iso, suspeita)."""
    if v is None: return (None, False)
    if isinstance(v, datetime.datetime) or isinstance(v, datetime.date):
        d = v if isinstance(v, datetime.date) and not isinstance(v, datetime.datetime) else v.date()
        if d.year != 2026:
            try: return (d.replace(year=2026).isoformat(), True)
            except: return (None, True)
        return (d.isoformat(), False)
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$', s)
    if m:
        dd, mm, yy = int(m.group(1)), int(m.group(2)), m.group(3)
        y = int(yy); susp = False
        if y < 100: y += 2000; susp = True
        elif y < 1000: y = 2000 + (y % 100); susp = True   # '206' -> 2006 -> 2026
        if y != 2026: y = 2026; susp = True
        try: return (datetime.date(y, mm, dd).isoformat(), susp)
        except: return (None, True)
    m = re.match(r'^(\d{2})(\d{2})/(\d{4})$', s)          # '1607/2026'
    if m:
        try: return (datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat(), True)
        except: return (None, True)
    return (None, True) if s else (None, False)

# ---------------------------------------------------------------- veículos
PLACA_RE = re.compile(r'(?<![A-Z0-9])([A-Z]{3}[\s\-]?\d[A-Z0-9]\d{2})(?![A-Z0-9])')
ALIAS_PLACA = {   # correções de digitação identificadas na planilha
    'RFS6Q67': 'RFS6G67', 'NPJ6497': 'NPJ6E97', 'PRJ4I56': 'OOM9H19',
    'QCW2843': 'QCW2913', 'PRD1C833': 'PRD1C83', 'QBE0B97': 'QBE0C97',
}
def acha_placa(txt):
    up = str(txt).upper()
    m = PLACA_RE.search(up)
    if not m: return None
    p = m.group(1).replace(' ','').replace('-','')
    return ALIAS_PLACA.get(p, p)

# locais / fazendas conhecidos (o resto é tratado como condutor)
LOCAIS = {
 'barroso':'Barroso','safra':'Safra','rio preto':'Rio Preto','rio doce':'Rio Doce','rio dode':'Rio Doce',
 'balsa':'Balsa','faz.balsa':'Balsa','casemat':'Casemat','caasemat':'Casemat','mogno':'Mogno',
 'conquista':'Conquista','conquista/safra':'Conquista','manejo':'Manejo','portal':'Chácara Portal',
 'chacara portal':'Chácara Portal','floresta em pe':'Floresta em Pé','floresta em pé':'Floresta em Pé',
 'arvore de ouro':'Árvore de Ouro','faz. arvore de ouro':'Árvore de Ouro','pre moldado':'Pré-Moldado',
 'pre molado':'Pré-Moldado','fabrica ração':'Fábrica de Ração','fabrica racao':'Fábrica de Ração',
 'oficina':'Oficina','operação florestal':'Operação Florestal','casteleite':'Casteleite','le':'Casemat',
}
def classifica(txt):
    """Devolve (condutor, local) para um texto solto."""
    t = norm(txt).strip(' .')
    if not t: return ('','')
    k = t.lower().strip()
    if k in LOCAIS: return ('', LOCAIS[k])
    ka = unicodedata.normalize('NFKD', k).encode('ascii','ignore').decode()
    for lk, lv in LOCAIS.items():
        lka = unicodedata.normalize('NFKD', lk).encode('ascii','ignore').decode()
        if ka == lka or ka.startswith(lka+' ') or lka in ka.split('/'):
            return ('', lv)
    return (t.title() if t.islower() or t.isupper() else t, '')
FROTA_RE = re.compile(r'\b(?:frota\s*)?(\d{4,5}\.\d{2}|F\s?\d{3})\b', re.I)

TIPOS = [
    (r'colheitadeira', 'Colheitadeira', 'H'),
    (r'\bp[aá]\b|carregadeira|motoniveladora|escavadeira|sdlg|new holland|w20f|721b', 'Máquina', 'H'),
    (r'trator|valtra', 'Trator', 'H'),
    (r'carret|reboque|dolly|semi ?reboque|r/estrada|boiad', 'Carreta', 'KM'),
    (r'caminh|atego|axor|scania|volvo|cargo|vw |mb |merc|f4000|bandeirante|banderante|\bford\b', 'Caminhão', 'KM'),
    (r'moto|quadriciclo|bros|fan |pop |start', 'Moto', 'KM'),
    (r'hilux|triton|s10|strada|trailbl|camionete|ranger|frontier|amarok', 'Camionete', 'KM'),
]
def tipo_de(nome):
    n = unicodedata.normalize('NFKD', nome.lower()).encode('ascii','ignore').decode()
    for rx, tp, un in TIPOS:
        if re.search(rx, n): return tp, un
    return 'Outros', 'KM'

MARCAS = ['Toyota','Mitsubishi','Chevrolet','Fiat','Ford','Volkswagen','Mercedes-Benz','Scania','Volvo','Honda','John Deere','Massey Ferguson','New Holland','SDLG','Valtra','Case']
def marca_modelo(nome):
    n = nome.lower()
    tab = [('hilux',('Toyota','Hilux')),('triton',('Mitsubishi','L200 Triton')),('s10',('Chevrolet','S10')),
           ('trailbl',('Chevrolet','Trailblazer')),('strada',('Fiat','Strada')),('f4000',('Ford','F4000')),
           ('bandeirante',('Toyota','Bandeirante')),('banderante',('Toyota','Bandeirante')),
           ('atego',('Mercedes-Benz','Atego 2730')),('axor',('Mercedes-Benz','Axor 3344')),
           ('scania',('Scania','')),('volvo',('Volvo','')),('cargo',('Ford','Cargo')),
           ('massey',('Massey Ferguson','')),('new holland',('New Holland','')),('sdlg',('SDLG','')),
           ('valtra',('Valtra','A750')),('jd',('John Deere','')),('honda',('Honda','')),
           ('bros',('Honda','NXR Bros')),('pop',('Honda','Pop')),('fan',('Honda','CG Fan')),
           ('start',('Yamaha','Start 160')),('quadriciclo',('Honda','Quadriciclo')),
           ('vw',('Volkswagen','')),('mb ',('Mercedes-Benz','')),('merc',('Mercedes-Benz','')),
           ('ford',('Ford','')),('pipa',('','Pipa'))]
    for k,(ma,mo) in tab:
        if k in n: return ma, mo
    return '', ''

def limpa_nome(t):
    t = re.sub(r'\s+',' ', str(t)).strip()
    t = re.sub(r'\bplaca\s*:?\s*','', t, flags=re.I)
    t = re.sub(r'^\s*[\-–]\s*','', t)
    return t.strip(' :/-')

# ============================================================ 1. SERVIÇOS
servicos = []
ws = wb['valores ']
desloc = num(ws['C1'].value) or 3
BLOCOS_SERV = [  # (col_desc, col_valor, categoria)
    ('B','C','Mecânica'), ('E','F','Mecânica'),
    ('H','I','Ar Condicionado - Caminhão'),
    ('K','L','Ar Condicionado - Carro'),
    ('N','O','Ar Condicionado - Maquinário'),
]
vistos = set()
for cd, cv, cat in BLOCOS_SERV:
    for r in range(3, ws.max_row+1):
        d = norm(ws[f'{cd}{r}'].value); v = num(ws[f'{cv}{r}'].value)
        if not d or v is None: continue
        dl = d.lower()
        if dl.startswith('espelho') or dl in ('valor','valor:','mecanica','mecânica'): continue
        if re.match(r'^serviço de ar condicionado', dl): continue
        chave = (slug(d), v)
        if chave in vistos: continue
        vistos.add(chave)
        servicos.append({'descricao': d, 'valor': v, 'categoria': cat, 'origem': 'planilha'})

for i, s in enumerate(sorted(servicos, key=lambda x:(x['categoria'], x['descricao'])), 1):
    s['codigo'] = f"SV{i:03d}"
servicos = sorted(servicos, key=lambda x: x['codigo'])

# ============================================================ 2. ORDENS (blocos)
SETORES = {
    'Mecanica':      ('Mecânica',        'Jeferson'),
    'Posto de mola': ('Posto de Mola',   'Vandame'),
    'Ser.ar cond.':  ('Ar Condicionado', 'Equipe Ar Condicionado'),
}
registros = []   # itens brutos
for aba,(setor, mecanico) in SETORES.items():
    ws = wb[aba]
    maxr, maxc = ws.max_row, ws.max_column
    # localizar cabeçalhos
    heads = []
    for r in range(1, maxr+1):
        for c in range(1, maxc+1):
            v = norm(ws.cell(r,c).value)
            if not v or len(v) > 8: continue
            k = unicodedata.normalize('NFKD', v.lower()).encode('ascii','ignore').decode()
            k = re.sub(r'[^a-z]','',k)
            if k == 'data':
                heads.append((r,c))
    head_rows = sorted(set(r for r,_ in heads))
    for (hr, c) in heads:
        veic_raw = norm(ws.cell(hr, c+2).value)
        if not veic_raw: continue
        veic = limpa_nome(veic_raw)
        # limite inferior do bloco
        prox = [r for r in head_rows if r > hr]
        fim = (min(prox)-1) if prox else maxr
        data_atual, susp_atual, km_atual = None, False, None
        grupo = None
        for r in range(hr+1, fim+1):
            desc = norm(ws.cell(r, c+2).value)
            val  = num(ws.cell(r, c+3).value)
            dv   = ws.cell(r, c).value
            kmv  = ws.cell(r, c+1).value
            if dv not in (None,''):
                d, sp = parse_date(dv)
                if d: data_atual, susp_atual = d, sp
                grupo = None
            if kmv not in (None,''):
                k = num(kmv)
                ks = norm(kmv)
                km_atual = k if k not in (None,0) else (None if re.search(r'sem|s/', ks, re.I) else k)
                grupo = None if dv not in (None,'') else grupo
            if not desc: continue
            dl = unicodedata.normalize('NFKD', desc.lower()).encode('ascii','ignore').decode()
            if dl.startswith('total') or dl in ('valor','valor:'): continue
            if val is None: continue
            registros.append({
                'aba': aba, 'setor': setor, 'mecanico': mecanico,
                'veiculo_raw': veic, 'data': data_atual, 'data_suspeita': susp_atual,
                'km': km_atual, 'descricao': desc, 'valor': val, 'linha': r, 'col': c,
            })

# ---- OP.F. (estrutura própria: NF/mecânico na 4ª coluna)
ws = wb['OP.F.']
for c0, veic in [(2,'Hilux OHR4A14 - Operação Florestal'), (8,'S10 EFY4F10 - Operação Florestal'), (13,'Hilux FM06H82 - Operação Florestal')]:
    for r in range(3, 23):
        desc = norm(ws.cell(r, c0+2).value); val = num(ws.cell(r, c0+4).value)
        if c0 == 2:
            desc = norm(ws.cell(r, c0+2).value); val = num(ws.cell(r, c0+4).value); mecc = norm(ws.cell(r,c0+3).value)
        else:
            desc = norm(ws.cell(r, c0+1).value); val = num(ws.cell(r, c0+3).value); mecc = norm(ws.cell(r,c0+2).value)
        if not desc or val is None: continue
        if desc.lower().startswith('total'): continue
        mec = 'Jeferson'
        if 'vandame' in mecc.lower(): mec = 'Vandame'
        registros.append({'aba':'OP.F.', 'setor':'Operação Florestal', 'mecanico': mec,
            'veiculo_raw': veic, 'data': None, 'data_suspeita': False, 'km': None,
            'descricao': desc, 'valor': val, 'linha': r, 'col': c0})

# ============================================================ 3. CONDUTOR / LOCAL (abas resumo)
cond_local = {}   # placa -> (condutor, local)
def registra_cl(titulo, cl):
    placa = acha_placa(titulo)
    if not placa: return
    cond, local = '', ''
    for parte in [p for p in re.split(r'[/|]', norm(cl)) if p.strip()]:
        c, l = classifica(parte)
        cond = cond or c; local = local or l
    cur = cond_local.get(placa, ('',''))
    cond_local[placa] = (cond or cur[0], local or cur[1])
for aba, ct, cc in [('Ser.mecanica','B','C'), ('Ser.postomola','B','C'), ('Ar cond.','A','B')]:
    ws = wb[aba]
    for r in range(2, ws.max_row+1):
        t = norm(ws[f'{ct}{r}'].value)
        if not t or t.lower().startswith('total') or t.lower().startswith('desloc'): continue
        registra_cl(t, norm(ws[f'{cc}{r}'].value))

# condutor a partir do título dos blocos (ex.: "Hilux RFB5I19/Moacir")
def extrai_condutor(titulo):
    """Condutor/local embutido no título do bloco: 'Hilux RFB5I19/Moacir'."""
    m = re.search(r'[/(]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\s\-]{2,30})\)?\s*$', titulo)
    cand = ''
    if m: cand = m.group(1).strip(' .')
    else:
        mp = PLACA_RE.search(titulo.upper())
        if mp:
            tail = titulo[mp.end():].strip(' .:/-')
            if 2 < len(tail) <= 30: cand = tail
    if not cand or re.search(r'frota|placa|\bkm\b|opera', cand, re.I): return ('','')
    return classifica(cand)

# ============================================================ 4. VEÍCULOS
veiculos = {}
def chave_veic(titulo):
    p = acha_placa(titulo)
    if p: return p
    m2 = re.search(r'\b(\d{4,5}\.\d{2}|F\s?\d{3})\b', titulo.upper())
    if m2: return 'FR-'+m2.group(1).replace(' ','')
    return 'ID-'+slug(titulo)[:24].upper()

for reg in registros:
    t = reg['veiculo_raw']
    k = chave_veic(t)
    tipo, unidade = tipo_de(t)
    ma, mo = marca_modelo(t)
    placa = k if PLACA_RE.match(k) else ''
    fm = FROTA_RE.search(t)
    frota = fm.group(1).upper().replace(' ','') if fm else ''
    cond_t, loc_t = extrai_condutor(t)
    cl = cond_local.get(placa, ('',''))
    v = veiculos.setdefault(k, {'id': k, 'placa': placa, 'frota': frota, 'tipo': tipo,
        'unidade': unidade, 'marca': ma, 'modelo': mo, 'condutor': '', 'local': '',
        'descricao': t, 'titulos': []})
    v['titulos'].append(t)
    if not v['frota'] and frota: v['frota'] = frota
    if not v['condutor']: v['condutor'] = cond_t or cl[0]
    if not v['local']: v['local'] = loc_t or cl[1]
    # preferir descrição mais informativa
    if len(t) > len(v['descricao']): v['descricao'] = t

# nome amigável do veículo
RUIDO = re.compile(r'\b(placa|frota|quilomet\w*|cond(utor)?|faz\.?|fazenda|operação florestal|operacao florestal)\b[:.]?', re.I)
def nome_veic(v):
    nome = re.split(r'[/(\[]', v['descricao'])[0]
    nome = PLACA_RE.sub('', nome.upper())
    nome = RUIDO.sub('', nome)
    nome = re.sub(r'\b(\d{4,5}\.\d{2}|F\d{3})\b','', nome)
    nome = re.sub(r'[\[\]()]','', nome)
    nome = re.sub(r'\s{2,}',' ', nome).strip(' :.,-')
    # remove condutor colado no fim ("HILUX ADRIANO")
    if v['condutor']:
        nome = re.sub(re.escape(v['condutor'].upper())+r'\s*$','', nome).strip(' :.,-')
    nome = nome.title().replace('Mb ','MB ').replace('Vw ','VW ').replace('Jd ','JD ')
    nome = re.sub(r'\bS10\b','S10', nome, flags=re.I)
    if len(nome) < 2: nome = v['tipo']
    return nome
for v in veiculos.values():
    v['nome'] = nome_veic(v)
    if not v['placa']: v['placa'] = '—'
    if not v['frota']: v['frota'] = '—'
    del v['titulos']

# ============================================================ 5. AGRUPAR EM OS
from collections import defaultdict
grupos = defaultdict(list)
for reg in registros:
    k = (chave_veic(reg['veiculo_raw']), reg['data'], reg['setor'], reg['aba'], reg['col'])
    grupos[k].append(reg)

# casa descrição do item com serviço do catálogo
cat_idx = []
for s in servicos:
    base = unicodedata.normalize('NFKD', s['descricao'].lower()).encode('ascii','ignore').decode()
    base = re.sub(r'^servi[cç]o?s?\s*(de|do|da)?\s*','', base)
    base = re.sub(r'[^a-z0-9 ]',' ', base)
    toks = set(t for t in base.split() if len(t) > 3)
    cat_idx.append((s, toks, s['valor']))

def casar_servico(desc, valor):
    d = unicodedata.normalize('NFKD', desc.lower()).encode('ascii','ignore').decode()
    d = re.sub(r'[^a-z0-9 ]',' ', d)
    dt = set(t for t in d.split() if len(t) > 3)
    melhor, score = None, 0
    for s, toks, v in cat_idx:
        if not toks: continue
        inter = len(dt & toks)
        if inter == 0: continue
        sc = inter / max(1, len(toks)) + (0.5 if abs(v - valor) < 0.01 else 0)
        if sc > score: melhor, score = s, sc
    return melhor['codigo'] if (melhor and score >= 0.65) else None

ordens = []
seq = 0
for k, itens in sorted(grupos.items(), key=lambda kv: (kv[0][1] or '9999', kv[0][0])):
    vid, data, setor, aba, col = k
    seq += 1
    km = next((i['km'] for i in itens if i['km']), None)
    v = veiculos[vid]
    os_itens = []
    for i in itens:
        qtd = 1
        m = re.match(r'^\s*(\d{1,2})\s*[xX]?\s*(?=[A-Za-zÀ-ÿ])', i['descricao'])
        d = i['descricao']
        if m and int(m.group(1)) <= 12:
            qtd = int(m.group(1)); d = i['descricao'][m.end():].strip()
        unit = round(i['valor']/qtd, 2) if qtd > 1 else i['valor']
        os_itens.append({'qtd': qtd, 'descricao': d or i['descricao'],
                         'valorUnit': unit, 'total': i['valor'],
                         'servicoCod': casar_servico(d or i['descricao'], unit)})
    total = round(sum(x['total'] for x in os_itens), 2)
    ordens.append({
        'numero': seq, 'data': data, 'dataSuspeita': any(i['data_suspeita'] for i in itens),
        'veiculoId': vid, 'placa': v['placa'], 'frota': v['frota'],
        'kmH': km, 'unidade': v['unidade'],
        'local': v['local'] or ('Oficina' if setor != 'Operação Florestal' else 'Operação Florestal'),
        'condutor': v['condutor'], 'mecanico': itens[0]['mecanico'], 'setor': setor,
        'itens': os_itens, 'total': total, 'obs': '', 'status': 'Concluída', 'origem': 'planilha'
    })

# ---------------------------------------------------------------- saída
locais = sorted({o['local'] for o in ordens if o['local']})
condutores = sorted({v['condutor'] for v in veiculos.values() if v['condutor']})
mecanicos = sorted({o['mecanico'] for o in ordens})
out = {
    'geradoEm': datetime.date.today().isoformat(),
    'origem': 'RELATORIO SEMANAL OFICINA 5 1.xlsx',
    'deslocamentoPorKm': desloc,
    'servicos': servicos,
    'veiculos': sorted(veiculos.values(), key=lambda v: (v['tipo'], v['nome'])),
    'ordens': ordens,
    'locais': locais, 'condutores': condutores, 'mecanicos': mecanicos,
}
with open('/home/claude/dados_brilhante.json','w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

sem_data = sum(1 for o in ordens if not o['data'])
print(f"serviços: {len(servicos)} | veículos: {len(veiculos)} | OS: {len(ordens)} | itens: {len(registros)}")
print(f"valor total: R$ {sum(o['total'] for o in ordens):,.2f} | OS sem data: {sem_data} | datas suspeitas: {sum(1 for o in ordens if o['dataSuspeita'])}")
print("locais:", locais)
print("condutores:", condutores)
print("itens casados com catálogo:", sum(1 for o in ordens for i in o['itens'] if i['servicoCod']), "/", sum(len(o['itens']) for o in ordens))
