export class ApiError extends Error {
  constructor(public code:string,message:string,public status:number) {super(message);this.name='ApiError';}
}
export async function api<T>(route:string,options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api${route}`,{
    ...options,
    credentials:'include',
    headers:{'Content-Type':'application/json',...(options.headers||{})}
  });
  const json:unknown=await response.json().catch(()=>null);
  if(!response.ok) {
    const error=json as {error?:{code?:string;message?:string}}|null;
    throw new ApiError(error?.error?.code||'HTTP_ERROR',error?.error?.message||'Serviço indisponível. Tente novamente.',response.status);
  }
  return json as T;
}
export const post=<T>(route:string,body:unknown={})=>api<T>(route,{method:'POST',body:JSON.stringify(body)});

export function formatMoney(cents: string | number | bigint | null | undefined) {
  const value=Number(cents??0)/100;
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
}
export const formatDate=(value:string|Date,options?:Intl.DateTimeFormatOptions)=>
  new Intl.DateTimeFormat('pt-BR',options||{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

export function reaisToCents(raw:string):number {
  const value=Number(raw.trim().replace(',','.'));
  if(!Number.isFinite(value)||value<=0) throw new Error('Informe um valor válido.');
  const cents=Math.round(value*100);
  if(!Number.isSafeInteger(cents)) throw new Error('Valor acima do limite permitido.');
  return cents;
}
export function localDateTime(minutesFromNow:number) {
  const date=new Date(Date.now()+minutesFromNow*60000);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
