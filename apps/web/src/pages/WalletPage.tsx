import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { ArrowDownLeft,ArrowUpRight,CheckCircle2,CircleDollarSign,LockKeyhole,Plus,Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Feedback,EmptyState,PageHeading } from '../components/Common';
import { api,formatDate,formatMoney,post,reaisToCents } from '../lib/api';
import { socket } from '../lib/socket';
import type {Wallet as WalletType,WalletEntry} from '../lib/types';

const labels:Record<WalletEntry['kind'],string>={DEPOSIT:'Depósito simulado',RESERVE:'Reserva de lance',RELEASE:'Saldo liberado',SETTLEMENT_DEBIT:'Arremate liquidado',SETTLEMENT_CREDIT:'Venda creditada'};
export function WalletPage(){
  const {user,loading:authLoading}=useAuth();
  const [wallet,setWallet]=useState<WalletType|null>(null);
  const [entries,setEntries]=useState<WalletEntry[]>([]);
  const [amount,setAmount]=useState('500');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const load=useCallback(async()=>{
    try{const data=await api<{wallet:WalletType;entries:WalletEntry[]}>('/wallet');setWallet(data.wallet);setEntries(data.entries);setError('');}
    catch(e){setError((e as Error).message);}
  },[]);
  useEffect(()=>{if(user?.role==='BIDDER')void load();},[load,user]);
  useEffect(()=>{socket.on('auctions:changed',load);return()=>{socket.off('auctions:changed',load);};},[load]);
  const deposit=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setSuccess('');
    try{await post('/wallet/deposit',{amountCents:reaisToCents(amount)});await load();setSuccess('Depósito simulado realizado! Seu saldo disponível foi atualizado.');setAmount('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  if(authLoading)return <div className="container page-loading">Carregando sua conta...</div>;
  if(user?.role!=='BIDDER')return <div className="container page-section"><EmptyState title="Área exclusiva para licitantes" description="Entre com um perfil de licitante para acompanhar sua carteira." action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>}/></div>;
  return <div className="container page-section"><PageHeading eyebrow="MINHA CONTA" title="Sua carteira." description="Acompanhe depósitos, reservas de lances e valores disponíveis."/>
    <div className="wallet-overview"><div className="wallet-main-card"><div className="wallet-main-top"><span>ATELIÊ / CARTEIRA DIGITAL</span><Wallet size={26}/></div><div className="wallet-label">Saldo disponível</div><div className="wallet-main-number">{formatMoney(wallet?.availableCents)}</div><div className="wallet-card-foot">Saldo simulado <span>•••• {user.id.slice(-4).toUpperCase()}</span></div></div>
      <div className="wallet-breakdown"><div><span className="wallet-stat-icon"><CircleDollarSign size={22}/></span><span className="muted">Saldo total</span><strong>{formatMoney(wallet?.totalCents)}</strong><small>Depósitos e arremates</small></div><div><span className="wallet-stat-icon"><LockKeyhole size={22}/></span><span className="muted">Saldo comprometido</span><strong>{formatMoney(wallet?.committedCents)}</strong><small>Reservado em lances líderes</small></div></div></div>
    <div className="two-panel-layout"><section className="panel"><p className="eyebrow">ADICIONAR FUNDOS</p><h2>Depositar saldo</h2><p className="muted">Este depósito é apenas uma simulação para testar os lances, sem movimentação financeira real.</p><form className="deposit-form" onSubmit={deposit}><label htmlFor="deposit-amount">Valor do depósito (R$)</label><div className="money-input"><span>R$</span><input id="deposit-amount" type="number" min="1" max="5000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></div><div className="quick-amounts">{[100,500,1000].map(n=><button type="button" key={n} onClick={()=>setAmount(String(n))}>{formatMoney(n*100)}</button>)}</div><button type="submit" disabled={busy} className="btn btn-primary btn-wide"><Plus size={18}/>{busy?'Depositando...':'Adicionar à carteira'}</button></form>{error&&<Feedback error message={error}/ >}{success&&<Feedback message={success}/>}</section>
      <section className="panel"><div className="section-between"><div><p className="eyebrow">HISTÓRICO FINANCEIRO</p><h2>Movimentações</h2></div><span className="subtle-pill">Últimas 25</span></div>{entries.length===0?<div className="history-empty">Sua carteira ainda não possui movimentações.</div>:<div className="wallet-entries">{entries.map(entry=><div className="wallet-entry" key={entry.id}><span className={`entry-icon ${Number(entry.amountCents)>=0?'credit':'debit'}`}>{Number(entry.amountCents)>=0?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</span><div><strong>{labels[entry.kind]}</strong><small>{formatDate(entry.createdAt)}</small></div><strong className={Number(entry.amountCents)>=0?'credit-text':'debit-text'}>{Number(entry.amountCents)>0?'+':''}{formatMoney(entry.amountCents)}</strong></div>)}</div>}</section>
    </div><div className="soft-note wallet-note"><CheckCircle2 size={19}/> Quando você é superado, o saldo reservado volta ao disponível imediatamente. Se vencer, a liquidação ocorre após o encerramento.</div>
  </div>;
}
