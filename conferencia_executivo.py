#!/usr/bin/env python3
"""Segundo método de conferência do Painel executivo: recalcula, em Python e direto do
dados_brilhante.json (sem usar nada do código do sistema), os números que a tela mostra.
Saída: JSON com cenários de filtro e os valores esperados. Usado por teste_executivo.js."""
import json, re, sys, unicodedata, datetime
from collections import defaultdict

d = json.load(open('dados_brilhante.json', encoding='utf-8'))
ordens, veics, servs = d['ordens'], {v['id']: v for v in d['veiculos']}, {s['codigo']: s for s in d['servicos']}
hoje = datetime.datetime.utcnow().date().isoformat()

def norm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'\s+', ' ', s).strip()

def placa_norm(s): return re.sub(r'[^A-Z0-9]', '', str(s or '').upper())
def cat(o):
    v = veics.get(o.get('veiculoId'))
    return v['tipo'] if v and v.get('tipo') else '(sem categoria)'
def resps(o): return [x.strip() for x in str(o.get('mecanico') or '').split(',') if x.strip()]

def filtrar(f):
    out = []
    for o in ordens:
        if (f.get('de') or f.get('ate')) and not o.get('data'): continue
        if f.get('de') and o['data'] < f['de']: continue
        if f.get('ate') and o['data'] > f['ate']: continue
        if f.get('veiculo') and o.get('veiculoId') != f['veiculo']: continue
        if placa_norm(f.get('placa')) and placa_norm(f['placa']) not in placa_norm(o.get('placa')): continue
        if f.get('categoria') and cat(o) != f['categoria']: continue
        if f.get('status') and (o.get('status') or 'Sem situação') != f['status']: continue
        if f.get('resp') and f['resp'] not in resps(o): continue
        out.append(o)
    return out

def calcular(f):
    os_ = filtrar(f)
    c = [o for o in os_ if o.get('status') != 'Cancelada']
    soma = round(sum(o['total'] for o in c), 2)
    meses = defaultdict(float)
    for o in c:
        if o.get('data'): meses[o['data'][:7]] += o['total']
    cats = defaultdict(float)
    for o in c: cats[cat(o)] += o['total']
    vs = defaultdict(float)
    for o in c: vs[o.get('veiculoId') or 'placa:' + placa_norm(o.get('placa'))] += o['total']
    svc = defaultdict(lambda: [set(), 0.0])
    for i, o in enumerate(c):
        for it in o['itens']:
            cod = it.get('servicoCod'); nome = servs[cod]['descricao'] if cod in servs and servs[cod].get('descricao') else str(it.get('descricao') or '').strip()
            k = norm(nome)
            if not k: continue
            svc[k][0].add(i); svc[k][1] += it['total']
    top_s = sorted(svc.items(), key=lambda kv: (-len(kv[1][0]), -kv[1][1]))[:10]
    return {
        'total': len(os_), 'emAberto': sum(1 for o in os_ if o.get('status') in ('Aberta', 'Em andamento')),
        'concluidas': sum(1 for o in os_ if o.get('status') == 'Concluída'),
        'gasto': soma, 'medio': round(soma / len(c), 2) if c else 0,
        'veiculos': len(vs),
        'meses': {k: round(v, 2) for k, v in sorted(meses.items())},
        'cats': {k: round(v, 2) for k, v in sorted(cats.items())},
        'topVeic': [[k, round(v, 2)] for k, v in sorted(vs.items(), key=lambda kv: -kv[1])[:5]],
        'topServ': [[norm(k), len(v[0]), round(v[1], 2)] for k, v in top_s[:5]],
    }

def qualidade(f):
    os_ = filtrar(f); q = {}
    q['semDataBase'] = sum(1 for o in ordens if not o.get('data'))
    q['placaFora'] = sum(1 for o in os_ if placa_norm(o.get('placa')) and not re.match(r'^[A-Z]{3}\d[A-Z0-9]\d{2}$', placa_norm(o.get('placa'))))
    q['semCadastro'] = sum(1 for o in os_ if o.get('veiculoId') not in veics)
    q['dataSuspeitaOuFutura'] = sum(1 for o in os_ if o.get('data') and (o['data'] > hoje or o.get('dataSuspeita')))
    q['totalDiverge'] = sum(1 for o in os_ if abs(sum(i['total'] for i in o['itens']) - o['total']) > 0.01)
    q['semItensOuZero'] = sum(1 for o in os_ if not o['itens'] or not o['total'] > 0)
    nums = defaultdict(int)
    for o in os_:
        if o.get('numero') not in (None, ''): nums[str(o['numero'])] += 1
    q['numRepetidosOS'] = sum(v for v in nums.values() if v > 1)
    forte = defaultdict(list)
    for o in os_:
        if not o.get('data'): continue
        ass = '|'.join(sorted(f"{norm(i['descricao'])}:{i.get('qtd') or 1}:{i['total']}" for i in o['itens']))
        forte[(o['data'], o.get('veiculoId'), f"{o['total']:.2f}", ass)].append(o)
    q['dupForteOS'] = sum(len(l) for l in forte.values() if len(l) > 1)
    q['semPlacaCadastro'] = sum(1 for o in os_ if not placa_norm((veics.get(o.get('veiculoId')) or {}).get('placa')))
    q['semCategoria'] = sum(1 for o in os_ if o.get('veiculoId') in veics and not veics[o['veiculoId']].get('tipo'))
    q['itensSemCatalogoOS'] = sum(1 for o in os_ if any(not i.get('servicoCod') for i in o['itens']))
    return q

# veículo com mais O.S. e uma combinação não vazia
cont = defaultdict(int)
for o in ordens: cont[o.get('veiculoId')] += 1
vmax = max(cont, key=cont.get)
cenarios = [
    ('sem filtro', {}),
    ('junho de 2026', {'de': '2026-06-01', 'ate': '2026-06-30'}),
    ('categoria Caminhão', {'categoria': 'Caminhão'}),
    ('placa parcial QCX', {'placa': 'qcx'}),
    ('responsável Jeferson', {'resp': 'Jeferson'}),
    ('veículo com mais OS', {'veiculo': vmax}),
    ('combinado (mar–ago, Camionete)', {'de': '2026-03-01', 'ate': '2026-08-31', 'categoria': 'Camionete'}),
    ('sem OS no período', {'de': '2027-01-01', 'ate': '2027-12-31'}),
]
print(json.dumps([{'nome': n, 'filtro': f, 'esperado': calcular(f), 'qualidade': qualidade(f)} for n, f in cenarios], ensure_ascii=False))
