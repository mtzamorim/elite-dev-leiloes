import { describe,expect,it,vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { subscribeAuctionEvents } from './socket';

describe('inscrição das salas Socket.IO',()=>{
  it('reinscreve após reconectar, atualiza a sala e remove listeners ao desmontar',()=>{
    const listeners=new Map<string,Set<()=>void>>();
    const emits:string[]=[];
    const fake={
      connected:true,
      on(event:string,handler:()=>void){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event)!.add(handler);return this;},
      off(event:string,handler:()=>void){listeners.get(event)?.delete(handler);return this;},
      emit(event:string,id:string){emits.push(`${event}:${id}`);return this;}
    } as unknown as Socket;
    const dispatch=(event:string)=>{for(const callback of listeners.get(event)||[])callback();};
    const refresh=vi.fn();
    const leave=subscribeAuctionEvents(fake,refresh,'lote-01');
    expect(emits).toEqual(['auction:join:lote-01']);
    dispatch('auction:changed');
    expect(refresh).toHaveBeenCalledTimes(1);
    dispatch('connect');
    expect(emits).toEqual(['auction:join:lote-01','auction:join:lote-01']);
    expect(refresh).toHaveBeenCalledTimes(2);
    leave();
    expect(emits.at(-1)).toBe('auction:leave:lote-01');
    dispatch('connect');
    dispatch('auction:changed');
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
