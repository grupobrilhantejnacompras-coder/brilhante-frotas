/* ============================================================
   EXPORTAÇÃO — gera um painel HTML autônomo para a diretoria
   O arquivo sai pronto para abrir em qualquer navegador, sem
   login e sem depender do sistema.
   ============================================================ */
const Exportar = (() => {

  /** Dados compactos do período, prontos para o painel exportado. */
  function coletar(de, ate) {
    const b = DB.get();
    const os = b.ordens.filter(o => o.data && o.data >= de && o.data <= ate);
    const rec = Q.reincidencias(os, b.ordens);
    const mapaRec = new Map(rec.map(r => [r.os.id, r]));
    const dias = Math.max(1, Dt.diff(ate, de) + 1);
    const antDe = Dt.add(de, -dias), antAte = Dt.add(de, -1);
    const osAnt = b.ordens.filter(o => o.data && o.data >= antDe && o.data <= antAte);

    const linhas = os.map(o => {
      const v = DB.veiculo(o.veiculoId) || {};
      const r = mapaRec.get(o.id);
      return {
        d: o.data, n: o.numero, id: o.veiculoId, vn: v.nome || '—', p: o.placa || '—', f: o.frota || '—',
        tp: v.tipo || '—', l: o.local || '—', m: o.mecanico || '—',
        k: o.kmH, u: o.unidade || 'KM', t: o.total,
        i: o.itens.map(x => ({ q: x.qtd, s: x.descricao, g: Rec.grupoDe(x.descricao).nome, t: x.total })),
        r: r ? { dias: r.anterior.dias, ant: r.anterior.os.data, an: r.anterior.os.numero, g: r.anterior.grupos.map(Rec.nomeGrupo).join(', ') } : null
      };
    }).sort((a, c) => a.d.localeCompare(c.d));

    return {
      de, ate, emitidoEm: Dt.today(), emitidoPor: Estado.usuario ? Estado.usuario.nome : 'Grupo Brilhante',
      totalAnterior: Q.soma(osAnt), osAnterior: osAnt.length, periodoAnterior: [antDe, antAte],
      janela: DB.cfg().janelaReincidencia,
      alertas: Painel.alertas(os, b.ordens).map(a => ({ nivel: a.nivel, txt: a.txt })),
      linhas
    };
  }

  /* ---------- runtime do arquivo exportado (independente do sistema) ---------- */
  const RUNTIME = String.raw`
const F = {
  _m: new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),
  _m0: new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}),
  _n: new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}),
  _n1: new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}),
  m: v => F._m.format(v||0), m0: v => F._m0.format(v||0),
  n: v => F._n.format(v||0), n1: v => F._n1.format(v||0),
  dt: i => i ? i.slice(8,10)+'/'+i.slice(5,7)+'/'+i.slice(0,4) : '—',
  dts: i => i ? i.slice(8,10)+'/'+i.slice(5,7) : '—',
  e: s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  kmh: (v,u) => v==null?'—':F._n.format(v)+' '+(u==='H'?'h':'km')
};
const AZUL='#3157CE', AMBAR='#C2721A', TRILHO='#EEF2FF';
let tip;
function ligarTips(root){
  if(!tip){ tip=document.createElement('div'); tip.className='tip'; document.body.appendChild(tip); }
  root.querySelectorAll('[data-tip]').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      tip.innerHTML=el.getAttribute('data-tip'); tip.style.opacity='1';
      const r=tip.getBoundingClientRect();
      tip.style.left=Math.min(e.clientX+14, innerWidth-r.width-10)+'px';
      tip.style.top=Math.max(e.clientY-r.height-12,8)+'px';
    });
    el.addEventListener('mouseleave',()=>{tip.style.opacity='0';});
  });
}
const corta=(t,n)=>{t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t;};
const vazio=m=>'<div class="empty"><div class="d"></div><p>'+F.e(m||'Sem dados no período.')+'</p></div>';

function barsH(items,o){o=o||{};const fmt=o.fmt||F.m0,lw=150,bh=26,gap=10,pr=76;
  if(!items.length) return vazio(o.vazio);
  const max=Math.max.apply(null,items.map(i=>i.valor).concat([1])),h=items.length*(bh+gap),w=640,bw=w-lw-pr;
  let s='<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img">';
  items.forEach((it,i)=>{const y=i*(bh+gap),L=Math.max(3,(it.valor/max)*bw),cor=it.destaque?AMBAR:AZUL;
    const clic=it.filtro!=null?' data-f="'+F.e(it.filtro)+'" data-k="'+F.e(it.chaveF||'')+'" style="cursor:pointer"':'';
    s+='<text x="0" y="'+(y+bh/2+4)+'" style="font-size:11.5px;fill:#0F172A">'+F.e(corta(it.rotulo,24))+'</text>';
    s+='<rect x="'+lw+'" y="'+(y+4)+'" width="'+bw+'" height="'+(bh-8)+'" rx="4" fill="'+TRILHO+'"/>';
    s+='<rect class="bar" x="'+lw+'" y="'+(y+4)+'" width="'+L+'" height="'+(bh-8)+'" rx="4" fill="'+cor+'"'+clic+' data-tip="'+F.e(it.tip||'')+'"></rect>';
    s+='<text x="'+w+'" y="'+(y+bh/2+4)+'" text-anchor="end" class="lv" style="font-size:11.5px">'+fmt(it.valor)+'</text>';
  });
  return s+'</svg>';
}
function barsV(items,o){o=o||{};const fmt=o.fmt||F.n;
  if(!items.length) return vazio(o.vazio);
  const w=640,h=230,pb=40,pt=24,pl=8;
  const max=Math.max.apply(null,items.map(i=>i.valor).concat([1]));
  const cw=(w-pl*2)/items.length,bw=Math.min(46,cw-10);
  let s='<svg class="chart chart-v" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet" role="img">';
  for(let g=0;g<=3;g++){const y=pt+(h-pt-pb)*g/3;s+='<line class="gl" x1="0" x2="'+w+'" y1="'+y+'" y2="'+y+'"/>';}
  items.forEach((it,i)=>{const H=Math.max(2,(it.valor/max)*(h-pt-pb)),x=pl+i*cw+(cw-bw)/2,y=h-pb-H;
    const clic=it.filtro!=null?' data-f="'+F.e(it.filtro)+'" data-k="'+F.e(it.chaveF||'')+'" style="cursor:pointer"':'';
    s+='<rect class="bar" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+H+'" rx="4" fill="'+AZUL+'"'+clic+' data-tip="'+F.e(it.tip||'')+'"/>';
    s+='<text x="'+(x+bw/2)+'" y="'+(y-7)+'" text-anchor="middle" class="lv" style="font-size:11px">'+fmt(it.valor)+'</text>';
    s+='<text x="'+(x+bw/2)+'" y="'+(h-pb+17)+'" text-anchor="middle" style="font-size:11px">'+F.e(corta(it.rotulo,12))+'</text>';
  });
  return s+'</svg>';
}
function area(pts,o){o=o||{};const fmt=o.fmt||F.m0;
  if(pts.length<2) return pts.length?barsV(pts,{fmt:fmt}):vazio(o.vazio);
  const w=640,h=240,pl=8,pr=8,pt=22,pb=36;
  const max=Math.max.apply(null,pts.map(p=>p.valor).concat([1]));
  const X=i=>pl+(w-pl-pr)*(i/(pts.length-1)), Y=v=>h-pb-(v/max)*(h-pt-pb);
  const linha=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(p.valor).toFixed(1)).join('');
  let s='<svg class="chart chart-v" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet" role="img">';
  s+='<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+AZUL+'" stop-opacity=".22"/><stop offset="100%" stop-color="'+AZUL+'" stop-opacity="0"/></linearGradient></defs>';
  for(let g=0;g<=3;g++){const y=pt+(h-pt-pb)*g/3;s+='<line class="gl" x1="0" x2="'+w+'" y1="'+y+'" y2="'+y+'"/>';}
  s+='<path d="'+linha+'L'+X(pts.length-1)+','+(h-pb)+'L'+X(0)+','+(h-pb)+'Z" fill="url(#ga)"/>';
  s+='<path d="'+linha+'" fill="none" stroke="'+AZUL+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  const passo=Math.ceil(pts.length/8);
  pts.forEach((p,i)=>{
    s+='<circle cx="'+X(i)+'" cy="'+Y(p.valor)+'" r="4" fill="#fff" stroke="'+AZUL+'" stroke-width="2"/>';
    s+='<rect x="'+(X(i)-(w/pts.length)/2)+'" y="'+pt+'" width="'+(w/pts.length)+'" height="'+(h-pt-pb)+'" fill="transparent" data-tip="'+F.e(p.tip||'')+'"/>';
    if(i%passo===0||i===pts.length-1) s+='<text x="'+X(i)+'" y="'+(h-pb+17)+'" text-anchor="middle" style="font-size:10.5px">'+F.e(p.rotulo)+'</text>';
  });
  return s+'</svg>';
}
function semanaDe(iso){const [y,m,d]=iso.split('-').map(Number);const x=new Date(y,m-1,d);
  x.setDate(x.getDate()-((x.getDay()+6)%7));
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}

const FX = {local:'', grupo:'', mecanico:'', tipo:''};
function filtradas(){
  return D.linhas.filter(o =>
    (!FX.local || o.l===FX.local) &&
    (!FX.mecanico || o.m===FX.mecanico) &&
    (!FX.tipo || o.tp===FX.tipo) &&
    (!FX.grupo || o.i.some(x=>x.g===FX.grupo)));
}
function agrupar(os,fn){
  const m=new Map();
  os.forEach(o=>{const k=fn(o); if(!k) return;
    const e=m.get(k)||{k:k,qtd:0,valor:0,veic:new Set()}; e.qtd++; e.valor+=o.t; e.veic.add(o.p); m.set(k,e);});
  return [...m.values()].sort((a,b)=>b.valor-a.valor);
}
function porGrupo(os){
  const m=new Map();
  os.forEach(o=>o.i.forEach(x=>{const e=m.get(x.g)||{k:x.g,qtd:0,valor:0}; e.qtd+=x.q; e.valor+=x.t; m.set(x.g,e);}));
  return [...m.values()].sort((a,b)=>b.valor-a.valor);
}
const soma=os=>os.reduce((s,o)=>s+o.t,0);

function pintar(){
  const os=filtradas(), total=soma(os), filtrado=!!(FX.local||FX.grupo||FX.mecanico||FX.tipo);
  const veic=new Set(os.map(o=>o.id)), itens=os.reduce((s,o)=>s+o.i.reduce((a,x)=>a+x.q,0),0);
  const rec=os.filter(o=>o.r);
  const varia=(!filtrado&&D.totalAnterior)?((total-D.totalAnterior)/D.totalAnterior)*100:null;

  const kpi=(l,v,sub,al)=>'<div class="card kpi'+(al?' alert':'')+'"><div class="kl">'+l+'</div><div class="kv">'+v+'</div>'+(sub?'<div class="ks">'+sub+'</div>':'')+'</div>';
  let h='<div class="grid kpis">'+
    kpi('Valor total',F.m0(total), filtrado?'no recorte filtrado':'no período')+
    kpi('Ordens de serviço',F.n(os.length))+
    kpi('Veículos atendidos',F.n(veic.size))+
    kpi('Serviços executados',F.n(itens))+
    kpi('Custo médio por OS',F.m0(os.length?total/os.length:0))+
    (varia==null
      ? kpi('Reincidências',F.n(rec.length), rec.length?'voltaram pelo mesmo sistema':'nenhuma', rec.length>0)
      : kpi('Variação','<span style="color:'+(varia>0?'#B42318':'#047857')+'">'+(varia>0?'+':'')+F.n1(varia)+'%</span>','vs. '+F.dt(D.periodoAnterior[0])+' a '+F.dt(D.periodoAnterior[1])))+
    '</div>';

  if(varia!=null && rec.length) h+='<div class="card" style="padding:14px 18px;margin-top:16px"><strong>'+F.n(rec.length)+'</strong> reincidência(s) no período — veículos que voltaram pelo mesmo sistema em até '+D.janela+' dias.</div>';

  if(D.alertas.length && !filtrado){
    h+='<section class="card sec" style="margin-top:16px"><h2>⚠️ Atenção</h2><div class="alertas">'+
      D.alertas.map(a=>'<div class="al"><span class="badge '+(a.nivel==='alto'?'b-amber':'b-gray')+'">'+(a.nivel==='alto'?'Prioridade':'Observar')+'</span><span>'+a.txt+'</span></div>').join('')+
      '</div></section>';
  }

  const semanas=(()=>{const m=new Map();
    os.forEach(o=>{const k=semanaDe(o.d);const e=m.get(k)||{k:k,qtd:0,valor:0};e.qtd++;e.valor+=o.t;m.set(k,e);});
    return [...m.values()].sort((a,b)=>a.k.localeCompare(b.k));})();

  h+='<div class="grid g2" style="margin-top:16px">'+
    card('Evolução no período', area(semanas.map(s=>({rotulo:F.dts(s.k),valor:s.valor,tip:'<strong>Semana de '+F.dt(s.k)+'</strong><br>'+F.m(s.valor)+'<br>'+s.qtd+' OS'}))))+
    card('Gastos por tipo de serviço', barsH(porGrupo(os).slice(0,10).map(g=>({rotulo:g.k,valor:g.valor,filtro:g.k,chaveF:'grupo',tip:'<strong>'+F.e(g.k)+'</strong><br>'+F.m(g.valor)+'<br>'+g.qtd+' serviços<br><em>clique para filtrar</em>'}))))+
    '</div>';

  h+='<div class="grid g2" style="margin-top:16px">'+
    card('Gastos por local', barsH(agrupar(os,o=>o.l).slice(0,10).map(e=>({rotulo:e.k,valor:e.valor,filtro:e.k,chaveF:'local',tip:'<strong>'+F.e(e.k)+'</strong><br>'+F.m(e.valor)+'<br>'+e.qtd+' OS · '+e.veic.size+' veículos<br><em>clique para filtrar</em>'}))))+
    card('Serviços por mecânico', barsV(agrupar(os,o=>o.m).map(e=>({rotulo:e.k,valor:e.qtd,filtro:e.k,chaveF:'mecanico',tip:'<strong>'+F.e(e.k)+'</strong><br>'+e.qtd+' OS · '+F.m(e.valor)+'<br><em>clique para filtrar</em>'})),{fmt:F.n}))+
    '</div>';

  const topV=agrupar(os,o=>o.id+'|'+o.vn+'|'+o.p+'|'+o.f);
  h+='<div style="margin-top:16px">'+card('Veículos com maior custo',
    barsH(topV.slice(0,10).map(e=>{const [id,vn,p]=e.k.split('|');
      const r=os.filter(o=>o.id===id&&o.r).length;
      return {rotulo:vn+' '+(p!=='—'?p:''),valor:e.valor,destaque:r>0,
        tip:'<strong>'+F.e(vn)+'</strong> · '+F.e(p)+'<br>'+F.m(e.valor)+' em '+e.qtd+' OS'+(r?'<br>⚠️ '+r+' reincidência(s)':'')};})) +
    '<div class="legend"><span><i style="background:'+AMBAR+'"></i>com reincidência</span><span><i style="background:'+AZUL+'"></i>sem reincidência</span></div>')+'</div>';

  const linhaVeic=e=>{const [id,vn,p,f]=e.k.split('|');
    const ls=os.filter(o=>o.id===id);
    const its=ls.reduce((s,o)=>s+o.i.length,0), r=ls.filter(o=>o.r).length;
    return [F.e(vn),F.e(p),F.e(f),F.n(e.qtd),F.n(its),F.m(e.valor), r?'<span class="badge b-amber">'+r+'</span>':'—'];};
  const colVeic=['Veículo','Placa','Frota','OS','Serviços','Total gasto','Reincid.'];
  h+='<div style="margin-top:16px">'+card('Veículos atendidos',
    tabela(colVeic, topV.slice(0,15).map(linhaVeic), topV.length<=15?['TOTAL','','',F.n(os.length),'',F.m(total),'']:null) +
    (topV.length>15
      ? '<details class="det"><summary>Ver os outros '+(topV.length-15)+' veículos</summary>'+
        tabela(colVeic, topV.slice(15).map(linhaVeic), ['TOTAL GERAL','','',F.n(os.length),'',F.m(total),''])+'</details>'
      : ''),true)+'</div>';

  if(rec.length){
    h+='<div style="margin-top:16px">'+card('Reincidências no período', tabela(
      ['Veículo','Placa','Sistema','Ocorrência anterior','Ocorrência atual','Intervalo','Valor da OS'],
      rec.slice(0,30).map(o=>[F.e(o.vn),F.e(o.p),'<span class="badge b-amber">'+F.e(o.r.g)+'</span>',
        F.dt(o.r.ant)+' — OS '+o.r.an, F.dt(o.d)+' — OS '+o.n, '<strong>'+o.r.dias+' dias</strong>', F.m(o.t)]))
      + (rec.length>30?'<p class="dim" style="padding:0 16px 14px">…e mais '+(rec.length-30)+' reincidência(s) no período.</p>':'')
      ,true)+'</div>';
  }

  const nServ=os.reduce((s,o)=>s+o.i.length,0);
  h+='<div style="margin-top:16px">'+card('Detalhamento dos serviços',
    '<details class="det"><summary>Ver os '+F.n(nServ)+' lançamentos do período</summary>'+
    tabela(['Data','Veículo','Placa','KM/H','Mecânico','Serviço','Qtd','Valor'],
      os.flatMap(o=>o.i.map((x,k)=>[k?'':F.dt(o.d),k?'':F.e(o.vn),k?'':F.e(o.p),k?'':F.kmh(o.k,o.u),k?'':F.e(o.m),F.e(x.s),F.n(x.q),F.m(x.t)])),
      ['','','','','','TOTAL DO PERÍODO','',F.m(total)])+'</details>',true)+'</div>';

  document.getElementById('painel').innerHTML=h;
  ligarTips(document.getElementById('painel'));
  document.querySelectorAll('#painel [data-f]').forEach(el=>el.addEventListener('click',()=>{
    const k=el.getAttribute('data-k')||'local', v=el.getAttribute('data-f');
    FX[k]=FX[k]===v?'':v; sincronizar(); pintar();
  }));
}
function card(t,c,semPad){return '<section class="card sec"><h2>'+F.e(t)+'</h2><div class="'+(semPad?'':'pad')+'">'+c+'</div></section>';}
function tabela(cols,linhas,tot){
  if(!linhas.length) return vazio('Nenhum registro.');
  let s='<div class="tw"><table><thead><tr>'+cols.map((c,i)=>'<th'+(i>2?' class="r"':'')+'>'+F.e(c)+'</th>').join('')+'</tr></thead><tbody>';
  linhas.forEach(l=>{s+='<tr>'+l.map((c,i)=>'<td'+(i>2?' class="r"':'')+'>'+c+'</td>').join('')+'</tr>';});
  if(tot) s+='<tr class="tot">'+tot.map((c,i)=>'<td'+(i>2?' class="r"':'')+'>'+c+'</td>').join('')+'</tr>';
  return s+'</tbody></table></div>';
}
function sincronizar(){
  ['local','grupo','mecanico','tipo'].forEach(k=>{const el=document.getElementById('fx-'+k); if(el) el.value=FX[k];});
  const ch=document.getElementById('chips'); const ativos=[];
  if(FX.local) ativos.push(['local',FX.local]);
  if(FX.grupo) ativos.push(['grupo',FX.grupo]);
  if(FX.mecanico) ativos.push(['mecanico',FX.mecanico]);
  if(FX.tipo) ativos.push(['tipo',FX.tipo]);
  ch.innerHTML = ativos.length
    ? ativos.map(a=>'<button class="chip on" data-limpa="'+a[0]+'">'+F.e(a[1])+' ✕</button>').join('')+
      '<button class="chip" data-limpa="__todos">Limpar tudo</button>'
    : '<span class="dim">Clique nas barras dos gráficos para filtrar o painel.</span>';
  ch.querySelectorAll('[data-limpa]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.getAttribute('data-limpa');
    if(k==='__todos'){FX.local=FX.grupo=FX.mecanico=FX.tipo='';} else FX[k]='';
    sincronizar(); pintar();
  }));
}
window.addEventListener('beforeprint',()=>document.querySelectorAll('details').forEach(d=>d.open=true));
function iniciar(){
  const uni=(fn)=>[...new Set(D.linhas.map(fn))].filter(Boolean).sort();
  const opt=(l,v)=>'<option value="'+F.e(v)+'">'+F.e(l)+'</option>';
  const sel=(id,rot,lista)=>'<select id="fx-'+id+'"><option value="">'+rot+'</option>'+lista.map(x=>opt(x,x)).join('')+'</select>';
  document.getElementById('filtros').innerHTML=
    sel('local','Todos os locais',uni(o=>o.l))+
    sel('grupo','Todos os serviços',[...new Set(D.linhas.flatMap(o=>o.i.map(x=>x.g)))].sort())+
    sel('mecanico','Todos os mecânicos',uni(o=>o.m))+
    sel('tipo','Todos os tipos',uni(o=>o.tp))+
    '<button class="btn" onclick="window.print()">Imprimir / PDF</button>';
  ['local','grupo','mecanico','tipo'].forEach(k=>
    document.getElementById('fx-'+k).addEventListener('change',e=>{FX[k]=e.target.value; sincronizar(); pintar();}));
  sincronizar(); pintar();
}
iniciar();
`;

  const CSS = String.raw`
*{box-sizing:border-box}
body{margin:0;background:#F1F4F9;color:#0F172A;font-family:'Inter','Segoe UI',system-ui,-apple-system,Arial,sans-serif;
  font-size:14px;line-height:1.5;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
h1,h2{margin:0;font-weight:700;letter-spacing:-.015em}
.wrap{max-width:1180px;margin:0 auto;padding:24px}
header.top{background:linear-gradient(105deg,#0C1F55,#1B3FAE);color:#fff;padding:26px 0}
header.top .wrap{display:flex;align-items:center;gap:18px;padding-top:0;padding-bottom:0}
header.top .logo{width:58px;flex:none;color:#fff}
header.top .logo svg{display:block;width:100%;height:auto;fill:currentColor}
header.top .co{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#B7C6EC}
header.top h1{font-size:21px;margin:2px 0}
header.top .pd{font-size:12.5px;color:#B7C6EC}
.barra{background:#fff;border-bottom:1px solid #E2E8F0;position:sticky;top:0;z-index:10}
.barra .wrap{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-top:12px;padding-bottom:12px}
select,.btn{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;color:#0F172A}
.btn{background:#1B3FAE;color:#fff;border-color:#1B3FAE;font-weight:600;cursor:pointer}
.btn:hover{background:#17359A}
#chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 0 14px}
.chip{font:inherit;font-size:12.5px;padding:5px 11px;border-radius:20px;border:1px solid #CBD5E1;background:#fff;cursor:pointer}
.chip.on{background:#1B3FAE;border-color:#1B3FAE;color:#fff;font-weight:600}
.dim{color:#64748B;font-size:12.5px}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:10px;box-shadow:0 1px 3px rgba(15,23,42,.06)}
.sec>h2{font-size:15px;padding:14px 16px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;gap:9px}
.sec>h2::before{content:"";width:8px;height:8px;background:#1B3FAE;transform:rotate(45deg);border-radius:1px;flex:none}
.pad{padding:16px}
.grid{display:grid;gap:16px}
.kpis{grid-template-columns:repeat(auto-fit,minmax(158px,1fr))}
.g2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
.kpi{position:relative;overflow:hidden;padding:16px}
.kpi::after{content:"";position:absolute;top:-16px;right:-16px;width:34px;height:34px;background:#EEF2FF;transform:rotate(45deg)}
.kpi.alert::after{background:#FEF3C7}
.kpi .kl{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748B;margin-bottom:8px;position:relative}
.kpi .kv{font-size:clamp(20px,1.85vw,26px);font-weight:800;letter-spacing:-.02em;line-height:1.1}
.kpi.alert .kv{color:#B45309}
.kpi .ks{font-size:12px;color:#64748B;margin-top:5px}
.alertas{display:flex;flex-direction:column;gap:9px;padding:16px}
.al{display:flex;gap:10px;align-items:flex-start}
.badge{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:11.5px;font-weight:600;white-space:nowrap}
.b-amber{background:#FEF3C7;color:#B45309}.b-gray{background:#F1F5F9;color:#64748B}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#64748B;
  padding:9px 12px;border-bottom:1px solid #E2E8F0;background:#F8FAFC;white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid #E2E8F0}
th.r,td.r{text-align:right}
tr.tot td{font-weight:700;background:#F8FAFC;border-top:2px solid #CBD5E1}
.chart{width:100%;max-height:420px}
.chart-v{max-height:264px}
.chart text{font-family:inherit;font-size:11px;fill:#64748B}
.chart .lv{fill:#0F172A;font-weight:600}
.chart .gl{stroke:#E2E8F0;stroke-width:1}
.bar{transition:opacity .13s}.bar:hover{opacity:.82}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#64748B;margin:10px 0 0 16px;padding-bottom:14px}
.legend i{width:10px;height:10px;border-radius:2px;display:inline-block;margin-right:5px}
.det{border-top:1px solid #E2E8F0}
.det>summary{cursor:pointer;padding:12px 16px;font-size:12.5px;font-weight:600;color:#1B3FAE;list-style:none}
.det>summary::-webkit-details-marker{display:none}
.det>summary::before{content:"▸ ";display:inline-block;transition:transform .15s}
.det[open]>summary::before{content:"▾ "}
.det>summary:hover{background:#F8FAFC}
.empty{text-align:center;padding:40px 16px;color:#64748B}
.empty .d{width:26px;height:26px;margin:0 auto 12px;background:#DDE5FB;transform:rotate(45deg);border-radius:3px}
.tip{position:fixed;z-index:300;background:#0F172A;color:#fff;padding:7px 11px;border-radius:7px;font-size:12px;
  pointer-events:none;opacity:0;transition:opacity .1s;box-shadow:0 4px 12px rgba(15,23,42,.25);max-width:230px}
footer.fim{padding:24px;text-align:center;color:#64748B;font-size:11.5px}
@media print{
  body{background:#fff}
  .barra,#chips,.btn{display:none!important}
  header.top{background:#fff;color:#0F172A;border-bottom:3px solid #1B3FAE;padding:0 0 14px}
  header.top .logo{color:#1B3FAE}header.top .co{color:#1B3FAE}header.top .pd{color:#64748B}
  .card{box-shadow:none}.sec{page-break-inside:avoid}
  @page{margin:12mm}
}
@media (max-width:640px){.wrap{padding:16px}header.top .logo{width:44px}}
`;

  function html(dados) {
    const titulo = 'Painel de Manutenção de Frotas';
    return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grupo Brilhante · ${titulo} · ${Fmt.date(dados.de)} a ${Fmt.date(dados.ate)}</title>
<style>${CSS}</style>
</head><body>
<header class="top"><div class="wrap">
  <span class="logo">${LOGO_SVG}</span>
  <div><div class="co">Grupo Brilhante</div><h1>${titulo}</h1>
  <div class="pd">Período: ${Fmt.date(dados.de)} a ${Fmt.date(dados.ate)} · Emitido em ${Fmt.date(dados.emitidoEm)} por ${Fmt.esc(dados.emitidoPor)}</div></div>
</div></header>
<div class="barra"><div class="wrap" id="filtros"></div></div>
<div class="wrap">
  <div id="chips"></div>
  <div id="painel"></div>
</div>
<footer class="fim">Grupo Brilhante · Juína/MT · Painel gerado pelo Sistema de Ordens de Serviço de Frotas.<br>
Produzir Alimento, Gerar Sustento e Trazer Desenvolvimento.</footer>
<script>const D=${JSON.stringify(dados)};
${RUNTIME}
<\/script>
</body></html>`;
  }

  const nomeArquivo = d => `Painel-Frotas-Brilhante-${d.de}-a-${d.ate}.html`;

  function baixar(de, ate) {
    const d = coletar(de, ate);
    if (!d.linhas.length) { UI.toast('Não há ordens de serviço neste período para exportar.', 'warn'); return null; }
    const conteudo = html(d), nome = nomeArquivo(d);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'text/html;charset=utf-8' }));
    a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    UI.toast('Painel baixado: ' + nome, 'ok');
    return { conteudo, nome };
  }

  async function compartilhar(de, ate) {
    const d = coletar(de, ate);
    if (!d.linhas.length) { UI.toast('Não há ordens de serviço neste período para compartilhar.', 'warn'); return; }
    const arquivo = new File([html(d)], nomeArquivo(d), { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Painel de Manutenção — Grupo Brilhante', text: resumoTexto(d) });
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    baixar(de, ate);
    UI.toast('Compartilhamento direto indisponível neste navegador — o arquivo foi baixado.', 'warn');
  }

  /** Resumo curto para colar no WhatsApp / e-mail. */
  function resumoTexto(d) {
    const total = d.linhas.reduce((s, o) => s + o.t, 0);
    const veic = new Set(d.linhas.map(o => o.id)).size;
    const rec = d.linhas.filter(o => o.r).length;
    const varia = d.totalAnterior ? ((total - d.totalAnterior) / d.totalAnterior) * 100 : null;
    const top = {};
    d.linhas.forEach(o => { const k = o.vn + (o.p !== '—' ? ' ' + o.p : ''); top[k] = (top[k] || 0) + o.t; });
    const top3 = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return [
      'GRUPO BRILHANTE — Manutenção de Frotas',
      'Período: ' + Fmt.date(d.de) + ' a ' + Fmt.date(d.ate),
      '',
      'Valor total: ' + Fmt.money(total),
      'Ordens de serviço: ' + d.linhas.length,
      'Veículos atendidos: ' + veic,
      'Custo médio por OS: ' + Fmt.money(d.linhas.length ? total / d.linhas.length : 0),
      'Reincidências: ' + rec,
      varia == null ? '' : 'Variação vs. período anterior: ' + (varia > 0 ? '+' : '') + Fmt.num1(varia) + '%',
      '',
      'Maiores custos:',
      ...top3.map((t, i) => (i + 1) + '. ' + t[0] + ' — ' + Fmt.money(t[1])),
    ].filter(x => x !== '').join('\n');
  }

  async function copiarResumo(de, ate) {
    const d = coletar(de, ate);
    if (!d.linhas.length) { UI.toast('Não há dados neste período.', 'warn'); return; }
    const txt = resumoTexto(d);
    try {
      await navigator.clipboard.writeText(txt);
      UI.toast('Resumo copiado — cole no WhatsApp ou e-mail.', 'ok');
    } catch (e) {
      UI.modal('Resumo do período', `<textarea class="input" style="min-height:260px" readonly>${Fmt.esc(txt)}</textarea>`,
        `<button class="btn" data-fechar>Fechar</button>`);
    }
  }

  return { coletar, html, baixar, compartilhar, copiarResumo, resumoTexto };
})();
