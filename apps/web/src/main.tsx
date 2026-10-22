import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter,Route,Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { AuctionPage } from './pages/AuctionPage';
import { AuthPage } from './pages/AuthPage';
import { WalletPage } from './pages/WalletPage';
import { SellerPage } from './pages/SellerPage';
import { BidsPage } from './pages/BidsPage';
import { WinsPage } from './pages/WinsPage';
import { AuditPage } from './pages/AuditPage';
import { ReceiptPage } from './pages/ReceiptPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ThemeProvider><AuthProvider><BrowserRouter><Layout><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/lote/:id" element={<AuctionPage/>}/>
    <Route path="/entrar" element={<AuthPage/>}/>
    <Route path="/carteira" element={<WalletPage/>}/>
    <Route path="/painel" element={<SellerPage/>}/>
    <Route path="/meus-lances" element={<BidsPage/>}/>
    <Route path="/arremates" element={<WinsPage/>}/>
    <Route path="/auditoria/:id" element={<AuditPage/>}/>
    <Route path="/comprovante/:id" element={<ReceiptPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes></Layout></BrowserRouter></AuthProvider></ThemeProvider></StrictMode>
);
