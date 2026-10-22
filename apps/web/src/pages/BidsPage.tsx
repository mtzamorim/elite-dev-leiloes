import { useCallback,useEffect,useState } from 'react';
import { ArrowUpRight,Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuctionCard,EmptyState,Feedback,PageHeading } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { useAuctionEvents } from '../components/Live';
import { api,formatMoney } from '../lib/api';
import type {Auction} from '../lib/types';

export function BidsPage(){
  const {user,loading:authLoading}=useAuth();
  const [items,setItems]=useState<{auction:Auction;myLastBidCents:string;myLastBidAt:string}[]>([]);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    if(user?.role!=='BIDDER')return;
    try {const result=await api<{items:typeof items}>('/me/bids');setItems(result.items);setError('');}catch(e){setError((e as Error).message);}
  },[user]);
  useEffect(()=>{void load();},[load]);useAuctionEvents(load);
  if(authLoading)return <div className="container page-loading">Carregando histórico...</div>;
  if(user?.role!=='BIDDER')return <div className="container page-section"><EmptyState title="Entre para ver seus lances" description="Esta área é exclusiva de contas licitantes." action={<Link className="btn btn-primary" to="/entrar">Entrar</Link>}/></div>;
  return <div className="container page-section"><PageHeading eyebrow="MINHA ATIVIDADE" title="Meus lances." description="Acompanhe cada lote de que você participou, sem precisar atualizar a página."/>
    {error&&<Feedback error message={error}/>}{items.length===0?<EmptyState title="Sua história começa com um lance" description="Explore a coleção e descubra a obra que vai conquistar você." action={<Link className="btn btn-primary" to="/">Explorar lotes <ArrowUpRight size={17}/></Link>}/>:<div className="participations-grid">{items.map(item=><div key={item.auction.id} className="participation"><AuctionCard auction={item.auction}/><div className="participation-footer"><span><Gavel size={15}/> Seu último lance: <strong>{formatMoney(item.myLastBidCents)}</strong></span><strong className={item.auction.isLeading?'credit-text':'muted'}>{item.auction.status==='LIVE'?(item.auction.isLeading?'Você está ganhando':'Você foi superado'):item.auction.status==='ENDED'?(item.auction.receiptId?'Lote arrematado':'Encerrado'):'Confira o lote'}</strong></div></div>)}</div>}
  </div>;
}
