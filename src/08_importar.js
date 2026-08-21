/* ============================================================
   IMPORTAÇÃO DA PLANILHA — lê o .xlsx direto no navegador
   (ZIP + inflate nativo, sem bibliotecas externas)
   ============================================================ */
const Importar = (() => {

  /* ---------- ZIP ---------- */
  function lerDiretorio(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo .xlsx inválido (diretório do ZIP não encontrado).');
    const n = dv.getUint16(eocd + 10, true), ini = dv.getUint32(eocd + 16, true);
    const itens = {}; let p = ini;
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
      const fnLen = dv.getUint16(p + 28, true), exLen = dv.getUint16(p + 30, true), cmLen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + fnLen));
      itens[nome] = { metodo, tam, off };
      p += 46 + fnLen + exLen + cmLen;
    }
    return { dv, itens };
  }
  async function extrair(buf, dir, nome) {
    const it = dir.itens[nome]; if (!it) return null;
    const dv = dir.dv;
    if (dv.getUint32(it.off, true) !== 0x04034b50) throw new Error('Entrada corrompida: ' + nome);
    const fnLen = dv.getUint16(it.off + 26, true), exLen = dv.getUint16(it.off + 28, true);
    const ini = it.off + 30 + fnLen + exLen;
    const dados = buf.subarray(ini, ini + it.tam);
    if (it.metodo === 0) return new TextDecoder().decode(dados);
    if (typeof DecompressionStream === 'undefined')
      throw new Error('Este navegador não descompacta .xlsx. Use o Chrome ou Edge atualizado.');
    const st = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(await new Response(st).arrayBuffer());
  }

  /* ---------- XML → grade de células ---------- */
  const col2i = ref => { let n = 0; for (const c of ref.replace(/\d+/g, '')) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
  const serial2iso = s => {
    const ms = Math.round((s - 25569) * 86400000);
    const d = new Date(ms);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  };

  function estilosData(xmlEstilos) {
    const fmtData = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
    const saida = new Set();
    if (!xmlEstilos) return saida;
    const doc = new DOMParser().parseFromString(xmlEstilos, 'text/xml');
    doc.querySelectorAll('numFmt').forEach(f => {
      const c = f.getAttribute('formatCode') || '';
      if (/[dmy]/i.test(c) && !/[#0]/.test(c.replace(/\[[^\]]*\]/g, ''))) fmtData.add(+f.getAttribute('numFmtId'));
    });
    const xfs = doc.querySelector('cellXfs');
    if (xfs) [...xfs.querySelectorAll('xf')].forEach((xf, i) => {
      if (fmtData.has(+(xf.getAttribute('numFmtId') || 0))) saida.add(i);
    });
    return saida;
  }

  function lerAba(xml, compart, estData) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const linhas = [];
    doc.querySelectorAll('row').forEach(r => {
      const ri = +r.getAttribute('r') - 1;
      const arr = linhas[ri] = linhas[ri] || [];
      r.querySelectorAll('c').forEach(c => {
        const ref = c.getAttribute('r') || '', t = c.getAttribute('t'), s = c.getAttribute('s');
        const vEl = c.querySelector('v'), isEl = c.querySelector('is t');
        let val = null;
        if (t === 's' && vEl) val = compart[+vEl.textContent] || '';
        else if (t === 'inlineStr' && isEl) val = isEl.textContent;
        else if (t === 'str' && vEl) val = vEl.textContent;
        else if (vEl) {
          const n = parseFloat(vEl.textContent);
          val = isNaN(n) ? vEl.textContent : (estData.has(+s) && n > 20000 && n < 140000 ? { data: serial2iso(n) } : n);
        }
        if (val !== null && val !== '') arr[col2i(ref)] = val;
      });
    });
    return linhas;
  }

  /* ---------- interpretação dos blocos ---------- */
  const txt = v => v == null ? '' : (typeof v === 'object' ? (v.data || '') : String(v)).trim();
  const numero = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const ehData = v => v && typeof v === 'object' && v.data;
  function dataDe(v) {
    if (ehData(v)) { const d = v.data; return d.slice(0, 4) === '2026' ? d : '2026' + d.slice(4); }
    const s = txt(v);
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; if (y < 1000) y = 2000 + (y % 100); if (y !== 2026) y = 2026;
      return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; }
    m = s.match(/^(\d{2})(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }
  const PLACA = /(?:^|[^A-Z0-9])([A-Z]{3}[\s\-]?\d[A-Z0-9]\d{2})(?![A-Z0-9])/;
  const ALIAS = { RFS6Q67: 'RFS6G67', NPJ6497: 'NPJ6E97', PRJ4I56: 'OOM9H19', QCW2843: 'QCW2913', PRD1C833: 'PRD1C83', QBE0B97: 'QBE0C97' };
  function achaPlaca(t) {
    const m = String(t).toUpperCase().match(PLACA);
    if (!m) return null;
    const p = m[1].replace(/[\s\-]/g, '');
    return ALIAS[p] || p;
  }

  function interpretar(abas) {
    const servicos = [], ordens = [], veiculosNovos = [];
    const b = DB.get();
    const idxServ = new Set(b.servicos.map(s => semAcento(s.descricao) + '|' + s.valor));
    const assinaturas = new Set();
    b.ordens.forEach(o => o.itens.forEach(i =>
      assinaturas.add([o.veiculoId, o.data, semAcento(i.descricao), i.total].join('|'))));

    for (const [nome, linhas] of Object.entries(abas)) {
      const n = semAcento(nome);

      /* tabela de preços */
      if (n.startsWith('valor')) {
        const cats = {};
        linhas.forEach((row, ri) => {
          if (!row) return;
          row.forEach((cel, ci) => {
            if (typeof cel !== 'string') return;
            if (/^valor/.test(semAcento(cel)) && row[ci - 1]) cats[ci - 1] = txt(row[ci - 1]);
          });
        });
        linhas.forEach(row => {
          if (!row) return;
          for (let ci = 0; ci < row.length; ci++) {
            const d = txt(row[ci]), v = numero(row[ci + 1]);
            if (!d || d.length < 6 || v == null || v <= 0) continue;
            if (/^valor|^espelho|^total/i.test(semAcento(d))) continue;
            const chave = semAcento(d) + '|' + v;
            if (idxServ.has(chave)) continue;
            idxServ.add(chave);
            servicos.push({ descricao: d, valor: v, categoria: cats[ci] || 'Importado', status: 'Ativo', origem: 'planilha' });
          }
        });
        continue;
      }
      /* Blocos de lançamento. Dois formatos convivem na planilha:
         A) Data | KM | Serviço | Valor          (Mecanica, Posto de mola, Ser.ar cond.)
         B) Veículo | KM | Serviço | NF/Mecânico | Valor   (OP.F., sem coluna de data)
         As abas de resumo semanal não têm cabeçalho "Data" nem "Valor/NF" e são ignoradas. */
      const cabecalhos = [];
      linhas.forEach((row, ri) => {
        if (!row) return;
        row.forEach((cel, ci) => {
          const t = semAcento(txt(cel)).replace(/[^a-z]/g, '');
          if (t === 'data' && txt(row[ci + 2])) { cabecalhos.push({ ri, ci, veic: txt(row[ci + 2]), fmt: 'A' }); return; }
          if (t.startsWith('valor') && semAcento(txt(row[ci - 1])).startsWith('nf')) {
            const titulo = [row[ci - 4], row[ci - 3], row[ci - 2]].map(txt)
              .filter(t => t && !/^(quilom|km|nf|valor|data)/i.test(semAcento(t))).join(' ');
            if (titulo) cabecalhos.push({ ri, ci: ci - 4, colValor: ci, colMec: ci - 1, veic: titulo, fmt: 'B' });
          }
        });
      });
      const linhasCab = [...new Set(cabecalhos.map(c => c.ri))].sort((a, c) => a - c);

      cabecalhos.forEach(cab => {
        const prox = linhasCab.find(r => r > cab.ri);
        const fim = prox ? prox - 1 : linhas.length;
        const placa = achaPlaca(cab.veic);
        let v = placa ? b.veiculos.find(x => x.placa === placa) : null;
        if (!v) v = b.veiculos.find(x => semAcento(x.descricao || x.nome) === semAcento(cab.veic));
        if (!v) { const alvo = semAcento(cab.veic).replace(/[^a-z0-9]/g, '');
          v = b.veiculos.find(x => { const c = semAcento(x.descricao || x.nome).replace(/[^a-z0-9]/g, ''); return c.length > 6 && (c === alvo || alvo.includes(c)); }); }
        if (!v) {   // casa pelo código do veículo/frota embutido no título (ex.: FM06H82, 11203.12, F077)
          const cods = (cab.veic.toUpperCase().match(/\b[A-Z0-9][A-Z0-9.]{4,}\b/g) || [])
            .filter(t => /[A-Z]/.test(t) && /\d/.test(t));
          for (const cod of cods) {
            v = b.veiculos.find(x => (x.descricao || '').toUpperCase().includes(cod));
            if (v) break;
          }
        }
        if (!v) {
          v = {
            id: placa || 'IMP-' + semAcento(cab.veic).replace(/[^a-z0-9]+/g, '-').slice(0, 22).toUpperCase(),
            placa: placa || '—', frota: '—', nome: cab.veic.replace(PLACA, '').trim() || cab.veic,
            tipo: 'Outros', unidade: 'KM', marca: '', modelo: '', condutor: '', local: '',
            descricao: cab.veic, status: 'Ativo', kmAtual: null, origem: 'planilha'
          };
          if (!veiculosNovos.find(x => x.id === v.id)) veiculosNovos.push(v);
        }
        const setor = n.includes('mola') ? 'Posto de Mola' : /\bar\b|ar cond/.test(n) ? 'Ar Condicionado'
          : cab.fmt === 'B' ? 'Operação Florestal' : 'Mecânica';
        const mecPadrao = setor === 'Posto de Mola' ? 'Vandame' : setor === 'Ar Condicionado' ? 'Equipe Ar Condicionado' : 'Jeferson';
        let data = null, km = null;
        const porData = new Map();   // uma OS por data dentro do bloco
        for (let r = cab.ri + 1; r <= fim; r++) {
          const row = linhas[r]; if (!row) continue;
          if (cab.fmt === 'A') {
            const d = dataDe(row[cab.ci]);
            if (d) data = d;
            const k = numero(row[cab.ci + 1]);
            if (k != null && k > 0) km = k;
          }
          const desc = txt(row[cab.ci + 2]);
          const val = numero(row[cab.fmt === 'B' ? cab.colValor : cab.ci + 3]);
          if (!desc || val == null) continue;
          if (/^total|^valor|^nf/.test(semAcento(desc))) continue;
          let qtd = 1, dd = desc;
          const mq = desc.match(/^\s*(\d{1,2})\s*[xX]?\s*(?=[A-Za-zÀ-ÿ])/);
          if (mq && +mq[1] <= 12) { qtd = +mq[1]; dd = desc.slice(mq[0].length).trim() || desc; }
          const sig = [v.id, data, semAcento(dd), val].join('|');
          if (assinaturas.has(sig)) continue;
          assinaturas.add(sig);
          const chave = data || 'sem-data';
          let atual = porData.get(chave);
          if (!atual) {
            let mec = mecPadrao;
            if (cab.fmt === 'B') { const t = txt(row[cab.colMec]); if (/vandame/i.test(t)) mec = 'Vandame'; }
            atual = {
              id: '', numero: 0, data, veiculoId: v.id, placa: v.placa, frota: v.frota, kmH: km,
              unidade: v.unidade, local: v.local || (setor === 'Operação Florestal' ? 'Operação Florestal' : 'Oficina'),
              condutor: v.condutor || '', mecanico: mec, setor,
              itens: [], obs: '', status: 'Concluída', total: 0, origem: 'planilha'
            };
            porData.set(chave, atual); ordens.push(atual);
          }
          atual.itens.push({ qtd, descricao: dd, valorUnit: qtd > 1 ? Math.round(val / qtd * 100) / 100 : val, total: val, servicoCod: null });
          atual.total = Math.round(atual.itens.reduce((s, i) => s + i.total, 0) * 100) / 100;
        }
      });
    }
    return { servicos, ordens: ordens.filter(o => o.itens.length), veiculosNovos };
  }

  /* ---------- fluxo ---------- */
  async function processar(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dir = lerDiretorio(buf);
    const wb = await extrair(buf, dir, 'xl/workbook.xml');
    if (!wb) throw new Error('Este arquivo não parece ser uma planilha Excel (.xlsx).');
    const rels = await extrair(buf, dir, 'xl/_rels/workbook.xml.rels');
    const ssXml = await extrair(buf, dir, 'xl/sharedStrings.xml');
    const stXml = await extrair(buf, dir, 'xl/styles.xml');
    const compart = [];
    if (ssXml) new DOMParser().parseFromString(ssXml, 'text/xml').querySelectorAll('si').forEach(si => {
      compart.push([...si.querySelectorAll('t')].map(t => t.textContent).join(''));
    });
    const estData = estilosData(stXml);
    const mapaRel = {};
    if (rels) new DOMParser().parseFromString(rels, 'text/xml').querySelectorAll('Relationship').forEach(r =>
      mapaRel[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?xl\//, ''));
    const abas = {};
    const doc = new DOMParser().parseFromString(wb, 'text/xml');
    for (const sh of doc.querySelectorAll('sheet')) {
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const alvo = mapaRel[rid];
      if (!alvo) continue;
      const xml = await extrair(buf, dir, 'xl/' + alvo);
      if (xml) abas[sh.getAttribute('name')] = lerAba(xml, compart, estData);
    }
    if (!Object.keys(abas).length) throw new Error('Nenhuma aba encontrada na planilha.');
    return interpretar(abas);
  }

  function previa(res, nomeArquivo) {
    const amostra = res.ordens.slice(0, 8).map(o => ({
      d: Fmt.date(o.data), v: Fmt.esc(DB.nomeVeiculo(o.veiculoId) !== '—' ? DB.nomeVeiculo(o.veiculoId) : o.placa),
      s: Fmt.esc(o.itens.map(i => i.descricao).join(' · ')), t: Fmt.money(o.total)
    }));
    const nada = !res.ordens.length && !res.servicos.length && !res.veiculosNovos.length;
    UI.modal('Prévia da importação', `
      <p class="dim" style="margin-bottom:var(--s4)">Arquivo <strong>${Fmt.esc(nomeArquivo)}</strong> analisado.
      Nada é gravado até você confirmar. Registros já existentes na base são ignorados automaticamente.</p>
      <div class="grid kpis" style="margin-bottom:var(--s4)">
        ${UI.kpi('Ordens de serviço novas', Fmt.num(res.ordens.length))}
        ${UI.kpi('Serviços novos', Fmt.num(res.servicos.length))}
        ${UI.kpi('Veículos novos', Fmt.num(res.veiculosNovos.length))}
        ${UI.kpi('Valor das novas OS', Fmt.money0(res.ordens.reduce((s, o) => s + o.total, 0)))}
      </div>
      ${nada ? UI.vazio('Nada novo para importar', 'Todos os lançamentos desta planilha já estão na base do sistema.')
        : UI.tabela([{ t: 'Data', k: 'd' }, { t: 'Veículo', k: 'v' }, { t: 'Serviços', k: 's' }, { t: 'Total', k: 't', cls: 'ta-r' }], amostra,
          { vazioT: 'Sem novas OS', vazioM: 'A planilha trouxe apenas serviços ou veículos.' })}
      ${res.ordens.length > 8 ? `<p class="dim" style="margin-top:10px">…e mais ${res.ordens.length - 8} ordens de serviço.</p>` : ''}`,
      `<button class="btn ghost" data-fechar>Cancelar</button>
       <button class="btn" id="imp-confirmar"${nada ? ' disabled' : ''}>Confirmar importação</button>`, '840px');

    const bt = document.getElementById('imp-confirmar');
    if (bt) bt.addEventListener('click', () => {
      const b = DB.get();
      res.veiculosNovos.forEach(v => { if (!b.veiculos.find(x => x.id === v.id)) b.veiculos.push(v); });
      res.servicos.forEach(s => DB.salvarServico(s));
      res.ordens.forEach(o => { o.id = ''; DB.salvarOS(o); });
      DB.save();
      UI.fecharModal();
      UI.toast(`Importados: ${res.ordens.length} OS, ${res.servicos.length} serviços, ${res.veiculosNovos.length} veículos.`, 'ok');
      App.render();
    });
  }

  function abrir() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx';
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      UI.toast('Lendo a planilha…');
      try { previa(await processar(f), f.name); }
      catch (e) { console.error(e); UI.toast('Não foi possível ler a planilha: ' + e.message, 'err'); }
    });
    inp.click();
  }
  return { abrir, processar };
})();
