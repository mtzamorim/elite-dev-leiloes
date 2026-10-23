import { randomUUID } from 'node:crypto';
import { expect,request,test } from '@playwright/test';

// Exercita API, banco, sessão por cookie e duas salas reais. Nunca usar com banco de produção.
test('dois licitantes disputam no PostgreSQL e recebem eventos sem recarregar',async({browser},testInfo)=>{
  test.skip(process.env.E2E_REAL!=='true'||testInfo.project.name!=='chromium-desktop',
    'Requer E2E_REAL=true, servidor e banco isolado com seed; executado uma vez no Chromium desktop.');
  const baseURL='http://127.0.0.1:3001';
  const firstApi=await request.newContext({baseURL});
  const secondApi=await request.newContext({baseURL});
  let firstContext:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  let secondContext:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  const suffix=randomUUID();
  const createBidder=async(api:typeof firstApi,name:string)=>{
    const created=await api.post('/api/auth/register',{data:{name,email:`${name}-${suffix}@test.invalid`,password:'SenhaTeste@1234',role:'BIDDER'}});
    expect(created.ok(),await created.text()).toBeTruthy();
    const deposit=await api.post('/api/wallet/deposit',{data:{amountCents:50_000_000}});
    expect(deposit.ok(),await deposit.text()).toBeTruthy();
  };
  try {
    await createBidder(firstApi,'licitante-um');
    await createBidder(secondApi,'licitante-dois');
    const lotsResponse=await firstApi.get('/api/auctions?status=LIVE');
    expect(lotsResponse.ok()).toBeTruthy();
    const lots=await lotsResponse.json() as {items:Array<{id:string;endsAt:string;minNextBidCents:string;incrementCents:string}>};
    const lot=lots.items.find(item=>new Date(item.endsAt).getTime()>Date.now()+10*60_000);
    expect(lot,'Seed precisa disponibilizar um lote ao vivo por pelo menos 10 minutos.').toBeDefined();
    if(!lot) return;
    const firstAmount=Number(lot.minNextBidCents);
    const secondAmount=firstAmount+Number(lot.incrementCents);
    expect(secondAmount).toBeLessThanOrEqual(50_000_000);

    firstContext=await browser.newContext({baseURL:'http://127.0.0.1:5173',storageState:await firstApi.storageState()});
    secondContext=await browser.newContext({baseURL:'http://127.0.0.1:5173',storageState:await secondApi.storageState()});
    const [firstPage,secondPage]=[await firstContext.newPage(),await secondContext.newPage()];
    await Promise.all([firstPage.goto(`/lote/${lot.id}`),secondPage.goto(`/lote/${lot.id}`)]);
    await expect(firstPage.locator('.bid-amount')).toBeVisible();
    await expect(secondPage.locator('.bid-amount')).toBeVisible();
    await expect(firstPage.getByRole('button',{name:/Confirmar meu lance/})).toBeVisible();

    const firstBid=await firstApi.post(`/api/auctions/${lot.id}/bids`,{data:{amountCents:firstAmount}});
    expect(firstBid.ok(),await firstBid.text()).toBeTruthy();
    await expect(firstPage.getByText('Você está ganhando este lote!')).toBeVisible({timeout:12_000});
    await expect(secondPage.locator('.bid-amount')).toContainText(
      new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(firstAmount/100),{timeout:12_000});

    const secondBid=await secondApi.post(`/api/auctions/${lot.id}/bids`,{data:{amountCents:secondAmount}});
    expect(secondBid.ok(),await secondBid.text()).toBeTruthy();
    await expect(firstPage.getByText(/Você foi superado/)).toBeVisible({timeout:12_000});
    await expect(secondPage.getByText('Você está ganhando este lote!')).toBeVisible({timeout:12_000});

    const [walletOne,walletTwo,audit]=await Promise.all([
      firstApi.get('/api/wallet'),secondApi.get('/api/wallet'),
      firstApi.get(`/api/audit/auctions/${lot.id}`)
    ]);
    expect(walletOne.ok()&&walletTwo.ok()&&audit.ok()).toBeTruthy();
    const one=await walletOne.json(),two=await walletTwo.json(),auditResult=await audit.json();
    expect(one.wallet.committedCents).toBe('0');
    expect(two.wallet.committedCents).toBe(String(secondAmount));
    expect(auditResult.audit.status).toBe('INTEGRO');
    await secondPage.screenshot({path:testInfo.outputPath('sala-real.png'),fullPage:true});
    await firstPage.goto(`/auditoria/${lot.id}`);
    await expect(firstPage.getByText('Histórico íntegro e verificado')).toBeVisible();
    await firstPage.screenshot({path:testInfo.outputPath('auditoria-real.png'),fullPage:true});
  } finally {
    await firstContext?.close();
    await secondContext?.close();
    await firstApi.dispose();
    await secondApi.dispose();
  }
});
