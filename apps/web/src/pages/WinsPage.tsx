import { useCallback,useEffect,useState } from 'react';
import { ArrowUpRight,Award,Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading,EmptyState,ArtworkImage,Feedback } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { api,formatMoney } from '../lib/api';
import type {Auction} from '../lib/types';

export function WinsPage(){
  const {user,loading:authLoading}=useAuth();
  const [items,setItems]=useState<Auction[]>([]);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{if(user?.role!=='BIDDER')return;try{const data=await api<{items:Auction[]}>('/me/wins');setItems(data.items);setError('');}catch(e){setError((e as Error).message);}},[user]);
  useEffect(()=>{void load();},[load]);
  if(authLoading)return <div className="container page-loading">Carregando arremates...</div>;
  if(user?.role!=='BIDDER')return <div className="container page-section"><EmptyState title="Entre para acompanhar seus arremates" description="Os comprovantes ficam associados à conta licitante." action={<Link className="btn btn-primary" to="/entrar">Entrar</Link>}/></div>;
  return <div className="container page-section"><PageHeading eyebrow="MINHA COLEÇÃO" title="Meus arremates." description="Obras conquistadas e comprovantes disponíveis para compartilhar."/>
    {error&&<Feedback error message={error}/>}{items.length===0?<EmptyState title="Sua coleção está por começar" description="Quando você vencer um lote, o resultado e o comprovante serão exibidos aqui." action={<Link className="btn btn-primary" to="/">Descobrir leilões <ArrowUpRight size={17}/></Link>}/>:<div className="wins-list">{items.map(item=><article className="win-card" key={item.id}><div className="win-image"><ArtworkImage src={item.imageUrl} artworkId={item.artworkId} artworkSource={item.artworkSource} alt={item.title}/></div><div className="win-info"><span className="eyebrow"><Award size={14}/> ARREMATE CONFIRMADO</span><h2>{item.title}</h2><p>{item.artist}</p><div className="win-value"><span>Valor de arremate</span><strong>{formatMoney(item.currentBidCents)}</strong></div></div><div className="win-actions"><Link className="btn btn-outline" to={`/lote/${item.id}`}>Ver lote</Link>{item.receiptId&&<Link className="btn btn-primary" to={`/comprovante/${item.receiptId}`}><Ticket size={17}/> Comprovante <ArrowUpRight size={16}/></Link>}</div></article>)}</div>}
  </div>;
}
