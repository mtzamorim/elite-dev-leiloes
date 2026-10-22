import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Common';
export function NotFoundPage(){return <div className="container page-section"><EmptyState title="Esta página não está no catálogo" description="O endereço pode ter mudado ou não existir." action={<Link className="btn btn-primary" to="/"><ArrowLeft size={17}/> Voltar à coleção</Link>}/></div>;}
