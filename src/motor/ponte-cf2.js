window.cf2={
 init(){
 configureScenario(null);configureDuration(8);configureFinancialProfile(3000);GAME_MODE='player';PARTICIPANT_COUNT=1;rebuildNames();
 render=()=>{};afterInvoice=()=>{};showMonthTransition=()=>{};
 state={month:0,stage:'buy',feedback:false,next:null,blackFridayDone:false,teams:[team(0)],finished:false};state.teams[0].name='Miguel';startMonth();return this.snapshot();
 },
 snapshot(){const t=state.teams[0];return {month:state.month+1,cash:t.cash,reserve:t.investment,debt:totalBankDebt(t),limit:cardAvailable(t),bill:t.invoiceTotal,minimum:t.invoiceMinimum,interest:t.lastRotativeInterest||0,active:t.investmentActive,assets:t.assets.map(a=>a.id),salary:t.salary,costs:expense(t),log:t.auditLog.slice(-8),goods:['laptop','phone','bike','backpack'].map(id=>{const p=PRODUCTS[id],n=Math.min(3,installmentMonthsFor(p)),r=financingRateFor(p,n);return{id,name:p.name,price:p.price,debit:debitPrice(p),n,installment:financedInstallment(p.price,n,r),total:financedTotal(p.price,n,r)}})};},
 buy(id,method){const t=state.teams[0];if(t.assets.some(a=>a.id===id))return this.snapshot();t.selectedProducts=[id];t.purchasePlans={[id]:{method,installments:3}};applyPayment(t);return this.snapshot();},
 pay(choice){const t=state.teams[0];if(t.invoiceTotal>0){t.choice=choice;applyInvoice(t);}return this.snapshot();},
 reserve(on){state.teams[0].investmentActive=on;return this.snapshot();},
 rescue(){const t=state.teams[0];t.cash+=rescueInvestment(t,t.investment);return this.snapshot();},
 bonus(){const t=state.teams[0];t.cash+=250;auditEvent(t,'storyJob',{amount:250});return this.snapshot();},
 next(choice){const t=state.teams[0];if(t.invoiceTotal>0){t.choice=choice;applyInvoice(t);}applyMonthlyContributions();state.month++;startMonth();return this.snapshot();}
};
const oldSnapshot=cf2.snapshot;
cf2.snapshot=function(){const s=oldSnapshot.call(this),t=state.teams[0];s.gross=t.grossSalary;s.available=quickShowcase(t).map(x=>x.id);s.goods=ACTIVE_PRODUCTS.map(id=>{const p=PRODUCTS[id];return{id,name:p.name,price:p.price,debit:debitPrice(p),max:installmentMonthsFor(p),eligible:productEligible(t,id),benefit:p.monthlyBenefit||0}});return s};
cf2.quote=function(id,plan){const t=state.teams[0],p=PRODUCTS[id];if(!p)return{error:'Produto inválido.'};const entry=plan.method==='card'?purchaseEntry(plan):0,n=plan.method==='card'?Number(plan.installments):1,principal=p.price-entry,rate=plan.method==='card'?financingRateFor(p,n):0,total=plan.method==='debit'?debitPrice(p):entry+financedTotal(principal,n,rate);return{error:!productEligible(t,id)?'Você já tem este item ou uma versão superior.':t.invoiceTotal>.009?'Resolva a fatura deste mês antes de comprar.':quickPurchaseValidation(t,p,p,plan,false),entry,n,total,interest:Math.max(0,total-p.price),rate,installment:financedInstallment(principal,n,rate),cashOut:plan.method==='debit'?total:entry}};
cf2.buy=function(id,method,installments=2,entry=0){const plan={method,installments:Number(installments),entry:Number(entry)},q=this.quote(id,plan);if(q.error)return{...this.snapshot(),error:q.error};const t=state.teams[0];t.selectedProducts=[id];t.purchasePlans={[id]:plan};applyPayment(t);return this.snapshot()};
cf2.spend=function(amount,label){const t=state.teams[0];if(!Number.isFinite(amount)||amount<0||t.cash<amount)return{...this.snapshot(),error:'Saldo insuficiente.'};t.cash=Math.round((t.cash-amount)*100)/100;auditEvent(t,'storyExpense',{amount,label});return this.snapshot()};

cf2.startAdventure=function(profile,custom){configureScenario(null);configureDuration(8);configureFinancialProfile(STORY_PROFILES[profile].limit);if(custom)configureScenario({...custom,name:"Aventura de Miguel",catalog:Object.keys(STANDARD_PRODUCT_DATA).filter(id=>id!=="sneakers"),startingNeeds:[],experience:"story",timeFactor:1});state={month:0,stage:'buy',feedback:false,next:null,blackFridayDone:false,teams:[team(0)],finished:false};state.teams[0].name='Miguel';state.teams[0].fixedCosts=custom?custom.costs:STORY_PROFILES[profile].costs;startMonth();return this.snapshot()};

cf2.capture=function(){return JSON.parse(JSON.stringify(captureSavePayload()))};
cf2.validSave=function(p){return validSavePayload(p)};
cf2.restore=function(p){if(!validSavePayload(p))throw Error('Estado financeiro inválido.');configureScenario(p.scenario??p.state.scenario??null);configureDuration(p.months);configureFinancialProfile(p.initialCreditLimit??3000);GAME_MODE=p.mode;PARTICIPANT_COUNT=p.count;rebuildNames();state=JSON.parse(JSON.stringify(p.state));return this.snapshot()};

cf2.credit=function(amount,label){if(!Number.isFinite(amount)||amount<=0||amount>1000)throw Error("Crédito inválido");const t=state.teams[0];t.cash=Math.round((t.cash+amount)*100)/100;auditEvent(t,"storyMissionIncome",{amount,label});return this.snapshot()};

// Payroll for custom game scenarios: same proportional deductions as the base reference.
const jPayrollBaseTeam=team;team=function(i){const t=jPayrollBaseTeam(i);if(activeScenario?.payrollMode==='proportional-v1'&&Number.isFinite(activeScenario.gross)&&activeScenario.gross>0){t.initialGross=activeScenario.gross;t.payrollMode='proportional-v1';t.grossSalary=activeScenario.gross;t.payrollDiscount=Math.round((t.grossSalary-t.salary)*100)/100}return t};
function jSyncPayroll(t){if(t.initialIncome>0&&!t.initialGross){t.initialGross=Math.round(t.initialIncome*2500/2149.31*100)/100;t.payrollMode='proportional-v1'}if(t.payrollMode==='proportional-v1'&&t.initialGross>0&&t.initialIncome>0){t.grossSalary=Math.round(t.initialGross*t.salary/t.initialIncome*100)/100;t.payrollDiscount=Math.round((t.grossSalary-t.salary)*100)/100}}
const jPayrollBaseShell=shell;shell=function(t,i,body){jSyncPayroll(t);let html=jPayrollBaseShell(t,i,body);if(t.payrollMode==='proportional-v1')html=html.replace('💼 Renda inicial de referência','💼 Salário bruto').replace(money(t.initialIncome),money(t.grossSalary)).replace('💰 Renda líquida','💰 Salário líquido');return html};

const jSnapshot6=cf2.snapshot;cf2.snapshot=function(){state.teams.forEach(jSyncPayroll);return jSnapshot6.call(this)};
