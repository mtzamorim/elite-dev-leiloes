export type Role = 'AUCTIONEER' | 'BIDDER';
export type AuctionStatus = 'LIVE' | 'SCHEDULED' | 'FINISHING' | 'ENDED' | 'CANCELED';
export type Money = string; // centavos no backend (BigInt serializado)

export interface User {
  id:string;name:string;email:string;role:Role;createdAt:string;
}
export interface Auction {
  id:string; title:string;artist:string;artworkDate:string;artworkId:number;
  description:string;imageUrl:string;ownerName:string;
  initialBidCents:Money;incrementCents:Money;currentBidCents:Money | null;
  minNextBidCents:Money;leaderAlias:string|null;isLeading:boolean;isOwner:boolean;
  startsAt:string;endsAt:string;status:AuctionStatus;numberOfBids:number;
  receiptId:string|null;cancellationReason:string|null;createdAt:string;
}
export interface Bid {
  id?:string;sequence:number;alias:string;amountCents:Money;createdAt:string;
  signature:string;previousHash?:string;
}
export interface Wallet {
  totalCents:Money;committedCents:Money;availableCents:Money;
}
export interface WalletEntry {
  id:string;kind:'DEPOSIT'|'RESERVE'|'RELEASE'|'SETTLEMENT_DEBIT'|'SETTLEMENT_CREDIT';
  amountCents:Money;auctionId:string|null;createdAt:string;
}
export interface Artwork {
  artworkId:number;title:string;artist:string;artworkDate:string;imageUrl:string;
}
export interface Receipt {
  id:string;auctionId:string;winningBidId:string;winnerAlias:string;
  amountCents:Money;createdAt:string;signature:string;lot:Auction;
}
export interface AuditResult {
  status:'INTEGRO'|'ALTERADO'|'INDETERMINADO';reason:string;
  bidCount:number;anchorCount:number|null;head:string;
}
