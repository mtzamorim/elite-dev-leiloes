import type { Socket } from 'socket.io-client';

type AuctionEventSocket = Pick<Socket, 'connected'|'on'|'off'|'emit'>;

/** Socket.IO remove os rooms ao desconectar. Reinscrevemos e recarregamos ao reconectar. */
export function subscribeAuctionEvents(connection:AuctionEventSocket,refresh:()=>void,id?:string) {
  const event=id?'auction:changed':'auctions:changed';
  const onConnect=()=>{
    if(id) connection.emit('auction:join',id);
    refresh();
  };
  connection.on(event,refresh);
  connection.on('connect',onConnect);
  if(connection.connected && id) connection.emit('auction:join',id);
  return ()=>{
    connection.off(event,refresh);
    connection.off('connect',onConnect);
    if(id && connection.connected) connection.emit('auction:leave',id);
  };
}
