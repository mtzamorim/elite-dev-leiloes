import { createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import { api,post } from '../lib/api';
import type { Role,User } from '../lib/types';
import { socket } from '../lib/socket';

type AuthContextValue={
  user:User|null;loading:boolean;
  login:(email:string,password:string)=>Promise<void>;
  register:(payload:{name:string;email:string;password:string;role:Role})=>Promise<void>;
  logout:()=>Promise<void>;refresh:()=>Promise<void>;
};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try {const data=await api<{user:User|null}>('/auth/me');setUser(data.user);}catch{setUser(null);}
  },[]);
  useEffect(()=>{
    refresh().finally(()=>setLoading(false));
    socket.connect();
    return ()=>{socket.disconnect();};
  },[refresh]);
  const login=useCallback(async(email:string,password:string)=>{
    const result=await post<{user:User}>('/auth/login',{email,password});
    setUser(result.user);
    socket.disconnect().connect();
  },[]);
  const register=useCallback(async(payload:{name:string;email:string;password:string;role:Role})=>{
    const result=await post<{user:User}>('/auth/register',payload);
    setUser(result.user);
    socket.disconnect().connect();
  },[]);
  const logout=useCallback(async()=>{
    await post('/auth/logout');
    setUser(null);
    socket.disconnect().connect();
  },[]);
  const value=useMemo(()=>({user,loading,login,register,logout,refresh}),[user,loading,login,register,logout,refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context=useContext(AuthContext);
  if(!context) throw new Error('useAuth sem AuthProvider');
  return context;
}
