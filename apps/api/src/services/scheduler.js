/** Publica somente transições realmente gravadas, evitando eventos duplicados. */
export async function activateScheduledAuctions(db, notify, now = new Date(), limit = 40) {
  const where={status:'SCHEDULED',startsAt:{lte:now},endsAt:{gt:now}};
  const candidates=await db.auction.findMany({where,select:{id:true},orderBy:{startsAt:'asc'},take:limit});
  let activated=0;
  for(const {id} of candidates) {
    const updated=await db.auction.updateMany({where:{...where,id},data:{status:'LIVE'}});
    if(updated.count) {
      activated++;
      notify?.(id);
    }
  }
  return activated;
}
