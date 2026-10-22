import { useState,type FormEvent } from 'react';
import { ArrowRight,Gavel,HandCoins,LockKeyhole,ShieldCheck } from 'lucide-react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Feedback } from '../components/Common';
import type {Role} from '../lib/types';

export function AuthPage() {
  const {login,register,user}=useAuth();
  const [params]=useSearchParams();
  const redirect=params.get('redirect');
  const navigate=useNavigate();
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [role,setRole]=useState<Role>('BIDDER');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const destination=redirect?.startsWith('/')&&!redirect.startsWith('//')?redirect:'/';
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try {if(mode==='login')await login(email,password);else await register({name,email,password,role});navigate(destination,{replace:true});}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <div className="auth-surface"><div className="container auth-layout"><div className="auth-story"><p className="eyebrow">BEM-VINDO AO ATELIÊ</p><h1>O próximo capítulo<br/>da sua coleção <em>começa aqui.</em></h1><p>Uma experiência transparente para quem descobre, coleciona e dá novos destinos a obras singulares.</p><div className="auth-benefits"><span><Gavel size={21}/> Lances em tempo real</span><span><ShieldCheck size={21}/> Histórico auditável</span><span><LockKeyhole size={21}/> Saldo protegido</span></div><div className="auth-art">✳</div></div>
      <div className="auth-box"><div className="auth-mode"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');}}>Entrar</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');}}>Criar conta</button></div><h2>{mode==='login'?'Bom ter você de volta.':'Entre para a coleção.'}</h2><p className="muted">{mode==='login'?'Acesse sua conta para acompanhar os leilões.':'Escolha seu perfil e comece sua jornada.'}</p>
        <form onSubmit={submit} className="stack-form">{mode==='register'&&<><label htmlFor="reg-name">Seu nome completo</label><input id="reg-name" autoComplete="name" minLength={2} maxLength={120} required value={name} onChange={e=>setName(e.target.value)}/></>}
          <label htmlFor="auth-email">E-mail</label><input id="auth-email" type="email" placeholder="voce@exemplo.com" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
          <label htmlFor="auth-pass">Senha</label><input id="auth-pass" type="password" minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="Mínimo de 8 caracteres" required value={password} onChange={e=>setPassword(e.target.value)}/>
          {mode==='register'&&<div className="role-choice"><p>Como você quer participar?</p><div className="role-options"><button type="button" className={role==='BIDDER'?'active':''} onClick={()=>setRole('BIDDER')}><HandCoins size={24}/><strong>Licitante</strong><small>Participar e arrematar</small></button><button type="button" className={role==='AUCTIONEER'?'active':''} onClick={()=>setRole('AUCTIONEER')}><Gavel size={24}/><strong>Leiloeiro</strong><small>Publicar e gerenciar</small></button></div></div>}
          {error&&<Feedback error message={error}/>}
          <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>{busy?'Validando...':mode==='login'?'Entrar na minha conta':'Criar minha conta'} <ArrowRight size={18}/></button>
        </form><div className="auth-footnote">Este é um ambiente de demonstração. Nenhuma cobrança real será realizada.</div>
      </div></div></div>;
}
