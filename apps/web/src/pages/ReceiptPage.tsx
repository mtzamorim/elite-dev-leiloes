import { useEffect,useState } from 'react';
import { ArrowLeft,CheckCircle2,Copy,Download,ExternalLink,ShieldAlert } from 'lucide-react';
import { Link,useParams } from 'react-router-dom';
import { api,formatDate,formatMoney } from '../lib/api';
import type {Receipt} from '../lib/types';
import { EmptyState,Feedback } from '../components/Common';

export function ReceiptPage(){
  const {id}=useParams<{id:string}>();
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [valid,setValid]=useState(false);
  const [auditStatus,setAuditStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    if(!id)return;
    api<{receipt:Receipt;valid:boolean;auditStatus:string}>(`/audit/receipts/${id}`)
      .then(data=>{setReceipt(data.receipt);setValid(data.valid);setAuditStatus(data.auditStatus);})
      .catch(e=>setMessage((e as Error).message))
      .finally(()=>setLoading(false));
  },[id]);
  const share=async()=>{
    try{await navigator.clipboard.writeText(window.location.href);setMessage('Link público do comprovante copiado.');}
    catch{setMessage('Copie o endereço da página para compartilhar.');}
  };
  if(loading)return <div className="container page-loading">Preparando comprovante...</div>;
  if(!receipt)return <div className="container page-section"><EmptyState title="Comprovante não encontrado" description={message||'O endereço informado não corresponde a um arremate.'} action={<Link to="/" className="btn btn-primary">Voltar à coleção</Link>}/></div>;
  return <div className="container receipt-wrapper"><div className="receipt-toolbar"><Link to={`/lote/${receipt.auctionId}`} className="text-link"><ArrowLeft size={16}/> Voltar ao lote</Link><div><button className="btn btn-outline" onClick={()=>window.print()}><Download size={17}/> Imprimir / PDF</button><button className="btn btn-primary" onClick={share}><Copy size={17}/> Copiar link</button></div></div>
    {message&&<Feedback message={message}/>}
    <article className="receipt-paper"><div className="receipt-heading"><span className="receipt-brand">✳ ateliê.</span><span className="receipt-counter">COMPROVANTE DE ARREMATE<br/>DOCUMENTO Nº {receipt.id.slice(0,8).toUpperCase()}</span></div><div className="receipt-main"><span className="eyebrow">CERTIFICADO DIGITAL</span><h1>Uma obra,<br/><em>uma nova história.</em></h1><p>Registramos que o lote descrito abaixo foi arrematado com sucesso em nossa plataforma de leilões simulados.</p><div className="receipt-stamp">{valid?<CheckCircle2 size={27}/>:<ShieldAlert size={27}/>}<span>{valid?'ASSINATURA VERIFICADA':`VERIFICAÇÃO: ${auditStatus||'PENDENTE'}`}</span></div></div>
      <div className="receipt-fields"><div><span>OBRA ARREMATADA</span><strong>{receipt.lot.title}</strong><small>{receipt.lot.artist}</small></div><div><span>LICITANTE VENCEDOR</span><strong>{receipt.winnerAlias}</strong><small>Identidade preservada</small></div><div><span>DATA DO ARREMATE</span><strong>{formatDate(receipt.createdAt)}</strong><small>Registrado em horário do servidor</small></div><div><span>VALOR FINAL</span><strong className="receipt-total">{formatMoney(receipt.amountCents)}</strong><small>Valor simulado</small></div></div>
      <div className="receipt-validation"><div><span>ASSINATURA CRIPTOGRÁFICA</span><code>{receipt.signature}</code></div><Link to={`/auditoria/${receipt.auctionId}`}>Consultar histórico auditável <ExternalLink size={17}/></Link></div><div className="receipt-footer">Documento compartilhável, emitido automaticamente no encerramento do lote. Não possui valor fiscal ou legal como comprovante de pagamento real.<span>ATELIÊ © 2026</span></div></article>
  </div>;
}
