import { useState } from 'react';
import { Link,NavLink,useNavigate } from 'react-router-dom';
import { ArrowUpRight,Coins,Gavel,HeartHandshake,LogIn,LogOut,Menu,Moon,Search,Sun,Ticket,UserCircle,Wallet,X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
export function Layout({children}:{children:React.ReactNode}) {
  const {user,logout}=useAuth();
  const {theme,toggle}=useTheme();
  const [menu,setMenu]=useState(false);
  const navigate=useNavigate();
  const nav=[{to:'/',label:'Explorar',icon:Search},
    ...(user?.role==='BIDDER'?[{to:'/meus-lances',label:'Meus lances',icon:Gavel},{to:'/carteira',label:'Carteira',icon:Wallet},{to:'/arremates',label:'Arremates',icon:Ticket}]:[]),
    ...(user?.role==='AUCTIONEER'?[{to:'/painel',label:'Painel do leiloeiro',icon:Coins}]:[])
  ];
  const onLogout=async()=>{await logout();setMenu(false);navigate('/');};
  return <div className="app-shell">
    <header className="site-header"><div className="container header-inner">
      <Link to="/" className="brand" aria-label="Ateliê, página inicial"><span className="brand-symbol">✳</span><span>ateliê<span className="brand-point">.</span></span></Link>
      <nav className="desktop-nav" aria-label="Navegação principal">{nav.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/'}>{item.label}</NavLink>)}</nav>
      <div className="header-actions">
        <button className="icon-btn theme-btn" onClick={toggle} aria-label={theme==='dark'?'Ativar tema claro':'Ativar tema escuro'} title="Alternar tema">{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
        {user?<div className="user-control"><span className="avatar">{initials(user.name)}</span><span className="user-name">{user.name.split(' ')[0]}</span><button className="icon-btn logout-btn" onClick={onLogout} title="Sair" aria-label="Sair"><LogOut size={17}/></button></div>
          :<Link to="/entrar" className="btn btn-dark header-login"><LogIn size={16}/> Entrar</Link>}
        <button className="icon-btn mobile-menu-btn" aria-label={menu?'Fechar menu':'Abrir menu'} onClick={()=>setMenu(!menu)}>{menu?<X size={23}/>:<Menu size={23}/>}</button>
      </div>
    </div></header>
    {menu&&<nav className="mobile-top-menu" aria-label="Menu móvel">{nav.map(item=><NavLink key={item.to} to={item.to} onClick={()=>setMenu(false)}>{item.label}</NavLink>)}{!user&&<NavLink to="/entrar" onClick={()=>setMenu(false)}>Entrar / criar conta</NavLink>}</nav>}
    <main id="principal" className="main-content">{children}</main>
    <footer className="site-footer"><div className="container footer-inner"><div><span className="brand footer-brand">✳ ateliê.</span><p>Uma nova perspectiva sobre o valor da arte.</p></div><div className="footer-details"><span>Leilões de arte em tempo real</span><span>Acervo: <a href="https://www.artic.edu/open-access/open-access-images" target="_blank" rel="noreferrer">Art Institute of Chicago <ArrowUpRight size={13}/></a></span><span>Projeto demonstrativo • sem transações reais</span></div></div></footer>
    <nav className="mobile-dock" aria-label="Navegação rápida">{nav.slice(0,4).map(item=><NavLink key={item.to} to={item.to} end={item.to==='/'}><item.icon size={20}/><span>{item.label.replace(' do leiloeiro','')}</span></NavLink>)}{!user&&<NavLink to="/entrar"><UserCircle size={20}/><span>Conta</span></NavLink>}</nav>
  </div>;
}
