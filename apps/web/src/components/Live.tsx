import { useEffect,useMemo,useState } from 'react';
import { socket } from '../lib/socket';
import { subscribeAuctionEvents } from '../lib/socketSubscriptions';
import type { AuctionStatus } from '../lib/types';

export function useAuctionEvents(refresh:()=>void,id?:string) {
  useEffect(()=>subscribeAuctionEvents(socket,refresh,id),[refresh,id]);
}

function remaining(until:string,now:number) {
  const total=Math.max(0,Math.ceil((new Date(until).getTime()-now)/1000));
  const days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600);
  const minutes=Math.floor((total%3600)/60),seconds=total%60;
  return days?`${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m`:
    `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
export function Countdown({endAt,startAt,status,compact=false}:{endAt:string;startAt:string;status:AuctionStatus;compact?:boolean}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[]);
  const target=status==='SCHEDULED'?startAt:endAt;
  const display=useMemo(()=>remaining(target,now),[target,now]);
  if(status==='ENDED')return <span className="countdown quiet">Encerrado</span>;
  if(status==='CANCELED')return <span className="countdown quiet">Cancelado</span>;
  if(status==='FINISHING')return <span className="countdown quiet">Finalizando...</span>;
  return <span className={`countdown ${compact?'countdown-sm':''}`} aria-label={`${status==='SCHEDULED'?'Começa':'Termina'} em ${display}`}>
    <span className="countdown-prefix">{status==='SCHEDULED'?'Começa em':'Encerra em'}</span><strong>{display}</strong>
  </span>;
}
export function Status({status}:{status:AuctionStatus}) {
  const label:Record<AuctionStatus,string>={LIVE:'Ao vivo',SCHEDULED:'Em breve',FINISHING:'Encerrando',ENDED:'Encerrado',CANCELED:'Cancelado'};
  return <span className={`status status-${status.toLowerCase()}`}>{status==='LIVE'&&<span className="status-dot"/>}{label[status]}</span>;
}
