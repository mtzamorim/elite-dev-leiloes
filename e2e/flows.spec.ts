import { expect,test } from '@playwright/test';
const auctionId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const time=(minutes:number)=>new Date(Date.now()+minutes*60_000).toISOString();
const fakeAuction=(overrides:Record<string,unknown>={})=>({
  id:auctionId,title:'A Sunday on La Grande Jatte',artist:'Georges Seurat',artworkDate:'1884',artworkId:27992,
  description:'Descrição de demonstração',imageUrl:'',ownerName:'Curadoria Ateliê',initialBidCents:'10000',incrementCents:'2000',
  currentBidCents:'12000',minNextBidCents:'14000',leaderAlias:'Licitante #ABC123',isLeading:false,isOwner:false,
  startsAt:time(-10),endsAt:time(60),status:'LIVE',numberOfBids:1,receiptId:null,cancellationReason:null,createdAt:time(-15),...overrides
});
const bidder={id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',name:'Ana Cliente',email:'ana@demo.com',role:'BIDDER',createdAt:time(-100)};
async function mockBase(page:import('@playwright/test').Page, user:unknown=null) {
  await page.route('**/api/auth/me',route=>route.fulfill({json:{user}}));
  await page.route('**/api/auctions?**',route=>route.fulfill({json:{items:[fakeAuction()],total:1,page:1,pageSize:12}}));
  await page.route(`**/api/auctions/${auctionId}`,route=>route.fulfill({json:{auction:fakeAuction()}}));
  await page.route(`**/api/auctions/${auctionId}/bids`,route=>route.fulfill({json:{items:[{id:'bid1',sequence:1,alias:'Licitante #ABC123',amountCents:'12000',createdAt:time(-5),signature:'a'.repeat(64)}]}}));
}
test('vitrine, navegação ao lote e auditoria visível sem login',async({page})=>{
  await mockBase(page);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Arte que inspira/i})).toBeVisible();
  await expect(page.getByText('A Sunday on La Grande Jatte').first()).toBeVisible();
  await page.getByRole('link',{name:/Conhecer este lote/}).click();
  await expect(page.getByRole('heading',{name:'Histórico de lances'})).toBeVisible();
  await expect(page.getByRole('link',{name:/Histórico verificável/})).toBeVisible();
});
test('licitante vê erro de lance e confirmação simulada',async({page})=>{
  await mockBase(page,bidder);
  await page.route(`**/api/auctions/${auctionId}/bids`,async route=>{
    if(route.request().method()==='POST')await route.fulfill({status:201,json:{sequence:2,amountCents:'14000',extended:false,auditAnchored:true}});
    else await route.fulfill({json:{items:[]}});
  });
  await page.goto(`/lote/${auctionId}`);
  await page.getByLabel('Seu próximo lance').fill('140');
  await page.getByRole('button',{name:/Confirmar meu lance/}).click();
  await expect(page.getByText(/Seu lance foi registrado com sucesso/i)).toBeVisible();
});
test('tema alternado permanece depois de atualizar',async({page})=>{
  await mockBase(page);
  await page.goto('/');
  const before=await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button',{name:/Ativar tema/}).click();
  const after=await page.locator('html').getAttribute('data-theme');
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme',after!);
});
test('leiloeiro confirma estorno informando justificativa',async({page})=>{
  const seller={...bidder,id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',role:'AUCTIONEER'};
  await mockBase(page,seller);
  await page.route('**/api/auctions/mine',route=>route.fulfill({json:{items:[fakeAuction({isOwner:true})]}}));
  await page.route(`**/api/auctions/${auctionId}/cancel`,route=>route.fulfill({json:{ok:true}}));
  await page.goto('/painel');
  await page.getByRole('button',{name:/Cancelar A Sunday/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel(/Motivo obrigatório/).fill('Retirado do catálogo para demonstração.');
  await page.getByRole('button',{name:'Confirmar cancelamento'}).click();
  await expect(page.getByText(/Lote cancelado/)).toBeVisible();
});

test('licitante superado recebe indicador explícito na sala',async({page})=>{
  await mockBase(page,bidder);
  await page.route(`**/api/auctions/${auctionId}`,route=>route.fulfill({json:{auction:fakeAuction({hasParticipated:true,isLeading:false})}}));
  await page.goto(`/lote/${auctionId}`);
  await expect(page.getByText(/Você foi superado\. Faça um novo lance/)).toBeVisible();
});
