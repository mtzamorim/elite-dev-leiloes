import { useCallback,useEffect,useMemo,useState } from 'react';
import { ArrowDown,ArrowRight,ArrowUpRight,Search,ShieldCheck,Timer,Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api,formatMoney } from '../lib/api';
import type {Auction} from '../lib/types';
import { AuctionCard,ArtworkImage,EmptyState,Feedback } from '../components/Common';
import { Countdown,Status,useAuctionEvents } from '../components/Live';

type Filter='ALL'|'LIVE'|'SCHEDULED'|'ENDED';
const filters:{label:string;value:Filter}[]=[{label:'Todos os lotes',value:'ALL'},{label:'Ao vivo',value:'LIVE'},{label:'Em breve',value:'SCHEDULED'},{label:'Encerrados',value:'ENDED'}];

export function HomePage() {
  const [filter,setFilter]=useState<Filter>('ALL');
  const [text,setText]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [items,setItems]=useState<Auction[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(text.trim());setPage(1);},320);return()=>clearTimeout(timer);},[text]);
  const load=useCallback(async()=>{
    try {
      const params=new URLSearchParams({status:filter,page:String(page)});
      if(search)params.set('q',search);
      const data=await api<{items:Auction[];total:number}>(`/auctions?${params}`);
      setItems(data.items);setTotal(data.total);setError('');
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  },[filter,page,search]);
  useEffect(()=>{setLoading(true);void load();},[load]);
  useAuctionEvents(load);
  const feature=useMemo(()=>items.find(x=>x.status==='LIVE')||items[0],[items]);
  const displayed=feature?items.filter(i=>i.id!==feature.id):items;
  return <>
    <section className="hero-band"><div className="container hero-intro"><div className="hero-intro-left"><span className="overline"><span className="overline-line"/> LEILÕES ONDE HISTÓRIAS GANHAM VALOR</span><h1>Arte que inspira.<br/><em>Disputas que emocionam.</em></h1><p>Descubra peças extraordinárias, acompanhe lances em tempo real e faça parte de cada nova história.</p><a className="hero-scroll" href="#lotes">Explorar coleção <ArrowDown size={17}/></a></div><div className="hero-index"><div><strong>01 / 03</strong><span>CURADORIA ESPECIAL</span></div><div className="hero-lines"><i/><i/><i/></div></div></div></section>
    <section className="container featured-area" aria-label="Lote em destaque">
      {feature ? <div className="featured"><div className="featured-image"><ArtworkImage src={feature.imageUrl} artworkId={feature.artworkId} artworkSource={feature.artworkSource} alt={feature.title}/><span className="featured-watermark">ATELIÊ COLLECTION — 001</span></div><div className="featured-body"><p className="eyebrow">DESTAQUE DA COLEÇÃO <span className="separator-dot">●</span> {feature.artworkDate}</p><Status status={feature.status}/><h2>{feature.title}</h2><p className="featured-artist">por {feature.artist}</p><p className="featured-description">Uma peça do acervo público transformada em experiência de leilão — com transparência em cada lance.</p><div className="featured-metrics"><div><span>{feature.currentBidCents?'Lance atual':'Lance inicial'}</span><strong>{formatMoney(feature.currentBidCents??feature.initialBidCents)}</strong></div><div><span>Tempo restante</span><Countdown status={feature.status} endAt={feature.endsAt} startAt={feature.startsAt}/></div></div><Link to={`/lote/${feature.id}`} className="btn btn-primary btn-wide">Conhecer este lote <ArrowUpRight size={18}/></Link></div></div>
      : <div className="featured-skeleton">{loading?'Carregando coleção...':'Aguardando novos lotes para a coleção.'}</div>}
    </section>
    <section className="trust-line"><div className="container trust-inner"><span><Wifi size={17}/> Lances em tempo real</span><span><ShieldCheck size={17}/> Histórico auditável</span><span><Timer size={17}/> Encerramento justo</span></div></section>
    <section id="lotes" className="container catalog-section"><div className="catalog-heading"><div><p className="eyebrow">ENCONTRE SUA PRÓXIMA DESCOBERTA</p><h2>Explore os leilões<span className="heading-italic">.</span></h2><p className="muted">Obras selecionadas. O próximo lance pode ser seu.</p></div><div className="catalog-count"><strong>{total}</strong><span>LOTE{total!==1?'S':''} ENCONTRADO{total!==1?'S':''}</span></div></div>
      <div className="catalog-toolbar"><div className="filter-tabs" role="group" aria-label="Filtrar lotes">{filters.map(f=><button key={f.value} className={filter===f.value?'active':''} onClick={()=>{setFilter(f.value);setPage(1);}}>{f.label}</button>)}</div><label className="search-field"><Search size={17}/><input aria-label="Buscar por obra ou artista" placeholder="Buscar obra ou artista..." value={text} onChange={e=>setText(e.target.value)}/></label></div>
      {error&&<Feedback error message={error}/>}
      {loading?<div className="cards-grid loading-grid">{[1,2,3].map(n=><div key={n} className="card-loading"/>)}</div>:items.length===0?<EmptyState title="Nenhum lote encontrado" description="Experimente outra busca ou selecione uma categoria diferente."/>:<div className="cards-grid">{displayed.map(item=><AuctionCard key={item.id} auction={item}/>)}</div>}
      {total>12&&<div className="pagination"><button className="btn btn-outline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {Math.ceil(total/12)}</span><button className="btn btn-outline" disabled={page>=Math.ceil(total/12)} onClick={()=>setPage(p=>p+1)}>Próxima <ArrowRight size={16}/></button></div>}
    </section>
    <section className="bottom-cta"><div className="container cta-inner"><div><span className="eyebrow">MAIS QUE UM LEILÃO</span><h2>Transparência do primeiro<br/><em>ao último lance.</em></h2><p>Todo lance possui uma assinatura verificável e pode ser consultado publicamente, sem revelar dados pessoais.</p></div><Link to={feature?`/auditoria/${feature.id}`:'/#lotes'} className="btn btn-cream">Conhecer a auditoria <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
