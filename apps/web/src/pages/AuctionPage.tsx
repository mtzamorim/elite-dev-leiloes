import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { AlertTriangle,ArrowLeft,ArrowUpRight,BadgeCheck,Clock3,Info,LockKeyhole,ShieldCheck,TrendingUp,Wallet } from 'lucide-react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { api,formatDate,formatMoney,post,reaisToCents } from '../lib/api';
import type {Auction,Bid} from '../lib/types';
import { ArtworkImage,EmptyState,Feedback } from '../components/Common';
import { Countdown,Status,useAuctionEvents } from '../components/Live';
import { useAuth } from '../contexts/AuthContext';

export function AuctionPage() {
  const {id}=useParams<{id:string}>();
  const {user}=useAuth();
  const navigate=useNavigate();
  const [auction,setAuction]=useState<Auction|null>(null);
  const [bids,setBids]=useState<Bid[]>([]);
  const [amount,setAmount]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    if(!id)return;
    try {
      const [details,history]=await Promise.all([
        api<{auction:Auction}>(`/auctions/${id}`),
        api<{items:Bid[]}>(`/auctions/${id}/bids`)
      ]);
      setAuction(details.auction);setBids(history.items);setError('');
      setAmount(prev=>prev||String(Number(details.auction.minNextBidCents)/100));
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  },[id]);
  useEffect(()=>{setLoading(true);setAuction(null);setAmount('');void load();},[load]);
  useAuctionEvents(load,id);
  const onBid=async(event:FormEvent)=>{
    event.preventDefault();if(!id)return;
    setBusy(true);setMessage('');setError('');
    try {
      const result=await post<{extended:boolean;auditAnchored:boolean}>(`/auctions/${id}/bids`,{amountCents:reaisToCents(amount)});
      setMessage(result.extended?'Lance aceito! O encerramento foi prorrogado em 2 minutos.':'Seu lance foi registrado com sucesso.');
      if(!result.auditAnchored)setMessage('Lance aceito. A âncora externa da auditoria está pendente; acompanhe a verificação pública.');
      await load();
      setAmount('');
    } catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  if(loading&&!auction)return <div className="container page-loading">Carregando detalhes do lote...</div>;
  if(!auction)return <div className="container page-section"><EmptyState title="Lote não encontrado" description={error||'Verifique o endereço e tente novamente.'} action={<Link to="/" className="btn btn-primary">Explorar lotes</Link>}/></div>;
  return <div className="container page-section auction-page"><div className="breadcrumbs"><Link to="/"><ArrowLeft size={15}/> Coleção</Link><span>/</span><span>{auction.title}</span></div>
    <div className="auction-detail-grid"><div className="auction-left"><div className="detail-image"><ArtworkImage src={auction.imageUrl} artworkId={auction.artworkId} artworkSource={auction.artworkSource} alt={auction.title}/><span className="art-image-index">{auction.artworkSource==='CLEVELAND'?'CLEVELAND MUSEUM OF ART · CC0':'ART INSTITUTE OF CHICAGO · ACERVO ABERTO'}</span></div>{auction.isOwner&&auction.numberOfBids===0&&(auction.status==='LIVE'||auction.status==='SCHEDULED')&&<div className="soft-note"><Info size={17}/> Se a reprodução não aparecer, <Link to="/painel">adicione uma imagem no painel do leiloeiro</Link>.</div>}<div className="art-metadata"><div><span>Artista</span><strong>{auction.artist}</strong></div><div><span>Período</span><strong>{auction.artworkDate}</strong></div><div><span>Curadoria</span><strong>{auction.ownerName}</strong></div></div>
      <div className="detail-description"><p className="eyebrow">SOBRE A OBRA</p><h2>História e detalhes</h2><p>{auction.description||'Uma obra selecionada para nosso catálogo de leilões.'}</p><a href={auction.artworkUrl||`https://www.artic.edu/artworks/${auction.artworkId}`} target="_blank" rel="noreferrer" className="text-link">Consultar no museu <ArrowUpRight size={15}/></a></div></div>
      <div className="auction-right"><div className="detail-head"><div className="detail-topline"><span className="eyebrow">LOTE #{auction.id.slice(0,8).toUpperCase()}</span><Status status={auction.status}/></div><h1>{auction.title}</h1><p>por {auction.artist}</p></div>
        <div className="bid-panel"><div className="bid-topline"><span>{auction.currentBidCents?'Lance mais alto':'Lance inicial'}</span><span className="bid-count"><TrendingUp size={15}/> {auction.numberOfBids} lances</span></div><div className="bid-amount">{formatMoney(auction.currentBidCents??auction.initialBidCents)}</div><div className="bid-leader">{auction.leaderAlias?<>Liderança: <strong>{auction.leaderAlias}</strong></>:<>Este lote ainda não recebeu lances</>}</div>
          <div className="bid-countdown"><Clock3 size={20}/><Countdown status={auction.status} endAt={auction.endsAt} startAt={auction.startsAt}/></div>
          {auction.isLeading&&auction.status==='LIVE'&&<div className="winning-banner" role="status"><BadgeCheck size={18}/> Você está ganhando este lote!</div>}
          {auction.hasParticipated&&!auction.isLeading&&auction.status==='LIVE'&&<div className="outbid-banner" role="status"><AlertTriangle size={18}/> Você foi superado. Faça um novo lance para voltar à disputa.</div>}
          {auction.status==='LIVE'&&user?.role==='BIDDER'&&!auction.isLeading&&<form className="bid-form" onSubmit={onBid}><label htmlFor="bid-value">Seu próximo lance <span>(mínimo {formatMoney(auction.minNextBidCents)})</span></label><div className="money-input"><span>R$</span><input id="bid-value" inputMode="decimal" type="number" step="0.01" min={Number(auction.minNextBidCents)/100} value={amount} onChange={e=>setAmount(e.target.value)} required/></div><button className="btn btn-primary btn-wide" type="submit" disabled={busy}>{busy?'Registrando lance...':'Confirmar meu lance'} <ArrowUpRight size={18}/></button></form>}
          {auction.status==='LIVE'&&!user&&<button className="btn btn-primary btn-wide" onClick={()=>navigate(`/entrar?redirect=${encodeURIComponent(`/lote/${auction.id}`)}`)}>Entre para dar um lance <ArrowUpRight size={18}/></button>}
          {auction.status==='LIVE'&&user?.role==='AUCTIONEER'&&<div className="feedback">Leiloeiros gerenciam lotes, mas não podem participar de lances.</div>}
          {auction.status==='SCHEDULED'&&<div className="soft-note"><Info size={17}/> Os lances serão habilitados assim que o lote começar.</div>}
          {auction.status==='FINISHING'&&<div className="soft-note"><Info size={17}/> Estamos verificando a auditoria e concluindo o arremate.</div>}
          {auction.status==='CANCELED'&&<div className="soft-note"><Info size={17}/> {auction.cancellationReason||'Lote cancelado.'}</div>}
          {auction.status==='ENDED'&&<div className="soft-note"><BadgeCheck size={17}/> {auction.receiptId?'Lote arrematado. O comprovante está disponível.':'Lote encerrado sem lances.'}</div>}
          {message&&<Feedback message={message}/>}{error&&<Feedback error message={error}/>}
          {auction.receiptId&&<Link className="btn btn-outline btn-wide" to={`/comprovante/${auction.receiptId}`}>Ver comprovante de arremate <ArrowUpRight size={17}/></Link>}
          <div className="bid-help"><LockKeyhole size={14}/> Saldo comprometido até ser superado ou vencer o lote.</div>
        </div>
        <div className="history-section"><div className="section-between"><div><p className="eyebrow">ATUALIZAÇÃO AO VIVO</p><h2>Histórico de lances</h2></div><span className="live-mark"><i/> Tempo real</span></div>
          {bids.length===0?<div className="history-empty">Nenhum lance ainda. Que tal começar?</div>:<div className="bid-history">{bids.slice(0,12).map((bid,index)=><div key={bid.sequence} className={`bid-history-row ${index===0?'bid-history-top':''}`}><div className="bid-history-icon">{index===0?'↗':'↗'}</div><div><strong>{bid.alias}</strong><span>{formatDate(bid.createdAt)}</span></div><strong>{formatMoney(bid.amountCents)}</strong></div>)}</div>}
          <Link className="audit-link" to={`/auditoria/${auction.id}`}><ShieldCheck size={19}/><span><strong>Histórico verificável</strong><small>Auditoria pública independente de login</small></span><ArrowUpRight size={18}/></Link>
        </div>
      </div></div>
  </div>;
}
