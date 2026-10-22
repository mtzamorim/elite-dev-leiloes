import { ArrowRight,ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {Auction} from '../lib/types';
import { formatMoney } from '../lib/api';
import { Countdown,Status } from './Live';

export function ArtworkImage({src,alt,className=''}:{src:string;alt:string;className?:string}) {
  return src ? <img className={className} src={src} alt={alt} loading="lazy" onError={event=>{
    event.currentTarget.style.visibility='hidden';
    event.currentTarget.parentElement?.classList.add('image-fallback');
  }}/> : <div className={`missing-image ${className}`}><ImageOff size={38} strokeWidth={1.2}/><span>Obra sem reprodução</span></div>;
}
export function AuctionCard({auction}:{auction:Auction}) {
  return <Link className="auction-card" to={`/lote/${auction.id}`} aria-label={`Ver lote: ${auction.title}`}>
    <div className="card-photo"><ArtworkImage src={auction.imageUrl} alt={auction.title}/><div className="photo-status"><Status status={auction.status}/></div></div>
    <div className="card-content"><span className="eyebrow small">{auction.artist}</span><h3>{auction.title}</h3>
      <div className="card-bottom"><div><span className="muted small">{auction.currentBidCents?'Lance atual':'Lance inicial'}</span><strong className="money">{formatMoney(auction.currentBidCents??auction.initialBidCents)}</strong></div><span className="card-arrow"><ArrowRight size={18}/></span></div>
      <div className="card-timer"><Countdown compact endAt={auction.endsAt} startAt={auction.startsAt} status={auction.status}/><span className="muted tiny">{auction.numberOfBids} {auction.numberOfBids===1?'lance':'lances'}</span></div>
    </div>
  </Link>;
}
export function EmptyState({title,description,action}:{title:string;description:string;action?:React.ReactNode}) {
  return <div className="empty-state"><div className="empty-art">✦</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function PageHeading({eyebrow,title,description,children}:{eyebrow:string;title:string;description?:string;children?:React.ReactNode}) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<p className="muted">{description}</p>}</div>{children&&<div className="heading-actions">{children}</div>}</div>;
}
export function Feedback({message,error=false}:{message:string;error?:boolean}) {
  return <div className={`feedback ${error?'feedback-error':'feedback-success'}`} role={error?'alert':'status'}>{message}</div>;
}
