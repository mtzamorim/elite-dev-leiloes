import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { ArrowRight,ArrowUpRight,CalendarClock,CheckCircle2,Gavel,Plus,Search,ShieldAlert,Trash2,X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api,formatDate,formatMoney,localDateTime,post,reaisToCents } from '../lib/api';
import type {Artwork,Auction} from '../lib/types';
import { ArtworkImage,EmptyState,Feedback,PageHeading } from '../components/Common';
import { Status,useAuctionEvents } from '../components/Live';
import { useAuth } from '../contexts/AuthContext';

export function SellerPage() {
  const {user,loading:authLoading}=useAuth();
  const [lots,setLots]=useState<Auction[]>([]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Artwork[]>([]);
  const [selected,setSelected]=useState<Artwork|null>(null);
  const [searching,setSearching]=useState(false);
  const [creating,setCreating]=useState(false);
  const [initial,setInitial]=useState('1000');
  const [increment,setIncrement]=useState('100');
  const [startsAt,setStartsAt]=useState(()=>localDateTime(2));
  const [endsAt,setEndsAt]=useState(()=>localDateTime(92));
  const [description,setDescription]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [cancel,setCancel]=useState<Auction|null>(null);
  const [reason,setReason]=useState('');
  const [cancelling,setCancelling]=useState(false);
  const load=useCallback(async()=>{if(user?.role!=='AUCTIONEER')return;try{const data=await api<{items:Auction[]}>('/auctions/mine');setLots(data.items);}catch(e){setError((e as Error).message);}},[user]);
  useEffect(()=>{void load();},[load]);useAuctionEvents(load);
  const search=async(event:FormEvent)=>{
    event.preventDefault();setSearching(true);setError('');setSuccess('');
    try{const data=await api<{artworks:Artwork[]}>(`/artworks?q=${encodeURIComponent(query)}`);setResults(data.artworks);}
    catch(e){setError((e as Error).message);}finally{setSearching(false);}
  };
  const create=async(event:FormEvent)=>{
    event.preventDefault();if(!selected){setError('Selecione uma obra no catálogo para publicar.');return;}
    setCreating(true);setError('');setSuccess('');
    try{
      const start=new Date(startsAt),end=new Date(endsAt);
      if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw new Error('Informe datas de início e fim válidas.');
      await post('/auctions',{artworkId:selected.artworkId,description,startsAt:start.toISOString(),endsAt:end.toISOString(),initialBidCents:reaisToCents(initial),incrementCents:reaisToCents(increment)});
      setSuccess('Lote publicado! Ele já está disponível na vitrine.');setSelected(null);setResults([]);setQuery('');setDescription('');await load();
    }catch(e){setError((e as Error).message);}finally{setCreating(false);}
  };
  const doCancel=async()=>{
    if(!cancel)return;setCancelling(true);setError('');
    try{await post(`/auctions/${cancel.id}/cancel`,{reason});setCancel(null);setReason('');setSuccess('Lote cancelado. O saldo reservado do líder, se houver, foi estornado.');await load();}
    catch(e){setError((e as Error).message);}finally{setCancelling(false);}
  };
  if(authLoading)return <div className="container page-loading">Preparando seu painel...</div>;
  if(user?.role!=='AUCTIONEER')return <div className="container page-section"><EmptyState title="Área exclusiva de leiloeiros" description="Acesse uma conta de leiloeiro para montar e acompanhar seus lotes." action={<Link className="btn btn-primary" to="/entrar">Entrar</Link>}/></div>;
  const active=lots.filter(l=>l.status==='LIVE').length;
  const sold=lots.filter(l=>l.receiptId).length;
  const revenue=lots.filter(l=>l.receiptId).reduce((sum,l)=>sum+Number(l.currentBidCents||0),0);
  return <div className="container page-section seller-page"><PageHeading eyebrow="ESTÚDIO DO LEILOEIRO" title="Seu painel de curadoria." description="Selecione obras da coleção pública, crie experiências e acompanhe os resultados."/>
    <div className="seller-summary"><div><span>Lotes publicados</span><strong>{lots.length}</strong><small>No seu catálogo</small></div><div><span>Em andamento</span><strong>{active}</strong><small>Recebendo lances agora</small></div><div><span>Arremates</span><strong>{sold}</strong><small>Encerrados com vencedor</small></div><div><span>Total recebido</span><strong>{formatMoney(revenue)}</strong><small>Créditos por arremates</small></div></div>
    <div className="seller-create-panel"><div className="seller-panel-header"><span className="seller-step-number">01</span><div><p className="eyebrow">NOVO LEILÃO</p><h2>Publique um novo lote</h2><p className="muted">Toda obra vem do catálogo aberto do Art Institute of Chicago.</p></div></div>
      <div className="create-layout"><div className="artwork-picker"><h3>Escolha a obra</h3><form onSubmit={search} className="artwork-search"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} minLength={2} maxLength={80} placeholder="Busque por artista ou obra" aria-label="Pesquisar obras no catálogo" required/></label><button className="btn btn-dark" type="submit" disabled={searching}>{searching?'Buscando...':'Buscar'}</button></form>
          {selected&&<div className="selected-art"><div className="selected-art-image"><ArtworkImage src={selected.imageUrl} alt={selected.title}/></div><div><small>OBRA SELECIONADA</small><strong>{selected.title}</strong><span>{selected.artist}</span></div><button type="button" onClick={()=>setSelected(null)} aria-label="Limpar seleção"><X size={18}/></button></div>}
          {results.length>0&&<div className="artwork-results" aria-label="Resultados de obras">{results.map(item=><button className={`artwork-result ${selected?.artworkId===item.artworkId?'selected':''}`} key={item.artworkId} onClick={()=>setSelected(item)} type="button" aria-pressed={selected?.artworkId===item.artworkId}><span className="result-img"><ArtworkImage src={item.imageUrl} alt={item.title}/></span><span><strong>{item.title}</strong><small>{item.artist}</small></span>{selected?.artworkId===item.artworkId&&<CheckCircle2 size={19}/>}</button>)}</div>}
          {results.length===0&&!selected&&<div className="artwork-placeholder"><Search size={28}/><p>Busque uma obra para começar a curadoria.</p><small>Experimente “Van Gogh”, “Seurat” ou “Monet”.</small></div>}
        </div>
        <form id="create-auction-form" className="auction-create-fields" onSubmit={create}><h3>Configure o leilão</h3><label htmlFor="starting">Lance inicial (R$)</label><div className="money-input"><span>R$</span><input id="starting" type="number" min="1" step="0.01" required value={initial} onChange={e=>setInitial(e.target.value)}/></div><label htmlFor="increment">Incremento mínimo (R$)</label><div className="money-input"><span>R$</span><input id="increment" type="number" min="1" step="0.01" required value={increment} onChange={e=>setIncrement(e.target.value)}/></div>
          <div className="form-two-col"><div><label htmlFor="starts-at">Início</label><input id="starts-at" type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></div><div><label htmlFor="ends-at">Encerramento</label><input id="ends-at" type="datetime-local" required value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></div></div>
          <label htmlFor="auction-description">Descrição do lote</label><textarea id="auction-description" rows={3} maxLength={1200} placeholder="Conte ao licitante o que torna esta peça singular..." value={description} onChange={e=>setDescription(e.target.value)}/><button className="btn btn-primary btn-wide" disabled={creating||!selected} type="submit"><Plus size={18}/>{creating?'Publicando lote...':'Publicar lote'} <ArrowRight size={18}/></button>
        </form></div>
      {(error||success)&&<div className="form-feedback">{error&&<Feedback error message={error}/>}{success&&<Feedback message={success}/>}</div>}
    </div>
    <div className="seller-lots"><div className="section-between"><div><p className="eyebrow">GESTÃO DE LOTES</p><h2>Seu catálogo <span className="muted">({lots.length})</span></h2></div><span className="subtle-pill"><Gavel size={15}/> Gestão em tempo real</span></div>
      {lots.length===0?<EmptyState title="Você ainda não criou lotes" description="Escolha uma obra do acervo e publique seu primeiro leilão."/>:<div className="seller-table"><div className="seller-table-head"><span>LOTE</span><span>STATUS</span><span>VALOR</span><span>ENCERRAMENTO</span><span>AÇÕES</span></div>{lots.map(l=><div className="seller-table-row" key={l.id}><div className="seller-table-item"><div className="seller-thumb"><ArtworkImage src={l.imageUrl} alt={l.title}/></div><div><strong>{l.title}</strong><small>{l.numberOfBids} lances • {l.artist}</small></div></div><div><Status status={l.status}/></div><strong>{formatMoney(l.currentBidCents??l.initialBidCents)}</strong><span className="seller-enddate">{formatDate(l.endsAt)}</span><div className="seller-actions"><Link className="icon-btn" to={`/lote/${l.id}`} aria-label={`Ver lote ${l.title}`} title="Ver lote"><ArrowUpRight size={18}/></Link>{(l.status==='SCHEDULED'||l.status==='LIVE')&&<button type="button" className="icon-btn icon-danger" aria-label={`Cancelar ${l.title}`} title="Cancelar lote" onClick={()=>{setCancel(l);setReason('');}}><Trash2 size={17}/></button>}{l.receiptId&&<Link className="icon-btn" to={`/comprovante/${l.receiptId}`} title="Comprovante" aria-label={`Comprovante de ${l.title}`}><CheckCircle2 size={18}/></Link>}</div></div>)}</div>}
    </div>
    {cancel&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCancel(null);}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><button className="modal-close icon-btn" onClick={()=>setCancel(null)} aria-label="Fechar"><X size={20}/></button><ShieldAlert className="danger-icon" size={32}/><p className="eyebrow">CONFIRMAÇÃO</p><h2 id="cancel-title">Cancelar este lote?</h2><p>Você está cancelando <strong>{cancel.title}</strong>. Esta ação encerra o leilão e não pode ser desfeita.</p>{cancel.numberOfBids>0?<><div className="soft-note"><CalendarClock size={16}/> Há {cancel.numberOfBids} lance(s). O saldo do último líder será estornado automaticamente.</div><label htmlFor="cancel-reason">Motivo obrigatório (mínimo de 10 caracteres)</label><textarea id="cancel-reason" rows={3} minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explique por que o lote será retirado"/></>:<p className="muted small">Este lote ainda não recebeu lances.</p>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={()=>setCancel(null)}>Voltar</button><button className="btn btn-danger" type="button" onClick={doCancel} disabled={cancelling||(cancel.numberOfBids>0&&reason.trim().length<10)}>{cancelling?'Cancelando...':'Confirmar cancelamento'}</button></div></div></div>}
  </div>;
}
