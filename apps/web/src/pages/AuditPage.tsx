import { useCallback,useEffect,useState } from 'react';
import { ArrowLeft,CheckCircle2,Copy,RefreshCcw,ShieldAlert,ShieldCheck,ShieldQuestion } from 'lucide-react';
import { Link,useParams } from 'react-router-dom';
import { api,formatDate,formatMoney } from '../lib/api';
import type {AuditResult,Auction,Bid} from '../lib/types';
import { EmptyState,Feedback,PageHeading } from '../components/Common';

export function AuditPage(){
  const {id}=useParams<{id:string}>();
  const [audit,setAudit]=useState<AuditResult|null>(null);
  const [auction,setAuction]=useState<Auction|null>(null);
  const [bids,setBids]=useState<Bid[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState('');
  const load=useCallback(async()=>{
    if(!id)return;setLoading(true);
    try{const response=await api<{audit:AuditResult;auction:Auction;bids:Bid[]}>(`/audit/auctions/${id}`);setAudit(response.audit);setAuction(response.auction);setBids(response.bids);setError('');}
    catch(e){setError((e as Error).message);}finally{setLoading(false);}
  },[id]);
  useEffect(()=>{void load();},[load]);
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied('Hash copiado para a área de transferência.');}catch{setCopied('Não foi possível copiar automaticamente.');}};
  const icon=audit?.status==='INTEGRO'?<ShieldCheck size={33}/>:audit?.status==='ALTERADO'?<ShieldAlert size={33}/>:<ShieldQuestion size={33}/>;
  if(loading&&!audit)return <div className="container page-loading">Verificando histórico e âncoras externas...</div>;
  if(!audit||!auction)return <div className="container page-section"><EmptyState title="Auditoria não disponível" description={error||'Lote não encontrado.'} action={<Link to="/" className="btn btn-primary">Ver coleção</Link>}/></div>;
  return <div className="container page-section audit-page"><div className="breadcrumbs"><Link to={`/lote/${id}`}><ArrowLeft size={15}/> Voltar ao lote</Link><span>/</span><span>Auditoria pública</span></div>
    <PageHeading eyebrow="REGISTRO VERIFICÁVEL" title="Auditoria pública." description="Qualquer pessoa pode analisar o histórico deste lote. Nenhum login é necessário."><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCcw size={17}/>{loading?'Verificando...':'Verificar novamente'}</button></PageHeading>
    <div className={`audit-summary audit-${audit.status.toLowerCase()}`}><div className="audit-status-icon">{icon}</div><div><p className="eyebrow">RESULTADO DA VERIFICAÇÃO</p><h2>{audit.status==='INTEGRO'?'Histórico íntegro e verificado':audit.status==='ALTERADO'?'Alteração detectada':'Verificação inconclusiva'}</h2><p>{audit.reason}</p></div><span className="audit-result-badge">{audit.status}</span></div>
    {error&&<Feedback error message={error}/ >}{copied&&<Feedback message={copied}/>}
    <div className="audit-facts"><div><span>LOTE AUDITADO</span><strong>{auction.title}</strong><small>{auction.artist}</small></div><div><span>LANÇAMENTOS REGISTRADOS</span><strong>{audit.bidCount}</strong><small>Sequência verificada</small></div><div><span>ÂNCORAS EXTERNAS</span><strong>{audit.anchorCount===null?'—':audit.anchorCount}</strong><small>Armazenadas fora do banco</small></div></div>
    <section className="panel audit-records"><div className="section-between"><div><p className="eyebrow">CADEIA CRIPTOGRÁFICA</p><h2>Histórico completo de lances</h2></div><span className="subtle-pill"><ShieldCheck size={16}/> HMAC-SHA-256</span></div><p className="muted audit-explanation">Cada assinatura incorpora lote, sequência, licitante anônimo, valor, data e assinatura anterior. A comparação com âncoras externas ajuda a detectar inclusões, modificações e exclusões feitas diretamente no banco.</p>
      {bids.length===0?<div className="history-empty">O lote ainda não recebeu lances.</div>:<div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>SEQ.</th><th>LICITANTE</th><th>VALOR</th><th>DATA/HORA</th><th>ASSINATURA</th></tr></thead><tbody>{bids.map(b=><tr key={b.sequence}><td>#{String(b.sequence).padStart(3,'0')}</td><td>{b.alias}</td><td><strong>{formatMoney(b.amountCents)}</strong></td><td>{formatDate(b.createdAt)}</td><td><button className="hash-button" title={b.signature} onClick={()=>copy(b.signature)}><code>{b.signature.slice(0,14)}…</code><Copy size={14}/></button></td></tr>)}</tbody></table></div>}
    </section><div className="audit-info"><CheckCircle2 size={20}/><div><strong>Sobre o método</strong><p>A integridade criptográfica verifica a coerência dos registros, não a procedência da obra nem a autenticidade da identidade dos participantes. O armazenamento externo deve permanecer persistente e protegido para detectar a supressão do último lance.</p></div></div>
  </div>;
}
