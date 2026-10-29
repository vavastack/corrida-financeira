// Integration changes navigation only; the financial rules and final UI remain Chapter 1's.
let cf2TimeFactor=1,cf2PauseSince=null,cf2PauseValue=0,cf2WasPaused=false;
window.cf2Native={
metadata(){return{salary:BASE_SALARY,profiles:STORY_PROFILES,catalog:Object.values(STANDARD_PRODUCT_DATA).filter(p=>p.id!=='sneakers').map(p=>({id:p.id,name:p.name,standard:STANDARD_ACTIVE_PRODUCTS.includes(p.id)})),needs:NEED_DEFINITIONS.map(n=>({key:n.key,label:n.label}))}},
budget(c){return Math.round(raceMinutes(c.months,c.count||1,c.format||'player',c.advanced?c.customLimit:c.limit,1)*Number(c.timeDifficulty||1)*60)*1000},
launch(c){cf2PauseSince=null;cf2TimeFactor=Number(c.timeDifficulty)||1;if(c.advanced)configureScenario({name:'Condições avançadas',income:c.income,gross:c.gross,payrollMode:c.payrollMode,costs:c.costs,limit:c.customLimit,cash:c.cash,reserve:c.reserve,catalog:c.catalog,startingNeeds:c.startingNeeds,experience:'race',timeFactor:cf2TimeFactor});else{configureScenario(null);configureFinancialProfile(c.limit)}configureDuration(c.months);GAME_MODE=c.format;PARTICIPANT_COUNT=c.count;storyPending=c.advanced?'custom':'balanced';appRaceMode=true;startConfiguredGame();},
theme(t){document.documentElement.dataset.theme=t==='light'?'light':'dark'},
audio(s){appSoundOn=!!(s.enabled&&s.effects);appMusicOn=!!(s.enabled&&s.music);finalComfort.music=Math.round(100*(s.musicVolume??1));finalComfort.effects=Math.round(100*(s.effectsVolume??1));if(s.enabled&&(s.effects||s.music))appAudioReady();appAudioSync();if(appAudioMaster&&appAudioContext)appAudioMaster.gain.setTargetAtTime(s.enabled?s.volume*.7:0,appAudioContext.currentTime,.04)},
pause(on){if(!state.teams.length||state.finished)return;if(on&&cf2PauseSince===null){cf2PauseValue=appElapsed();cf2PauseSince=Date.now();cf2WasPaused=appClockPaused;appClockPaused=true;}else if(!on&&cf2PauseSince!==null){const dt=Date.now()-cf2PauseSince;if(appRaceMode&&appRaceStart!==null)appRaceStart+=dt;else if(appClockSince!==null)appClockSince+=dt;cf2PauseSince=null;appClockPaused=cf2WasPaused;}appClockTick()},
home(){appHome()}
};
const chapterElapsed=appElapsed;appElapsed=function(){return cf2PauseSince!==null?cf2PauseValue:chapterElapsed()};
appRaceBudget=()=>cf2Native.budget({months:MONTHS,count:PARTICIPANT_COUNT,format:GAME_MODE,limit:INITIAL_CREDIT_LIMIT,timeDifficulty:cf2TimeFactor});
showHome=()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.parent.cf2GoHome()};
openSetup=()=>window.parent.cf2OpenClassic();openScenario=openSetup;
showOptions=()=>window.parent.cf2OpenOptions();
const integrationStyle=document.createElement('style');integrationStyle.textContent='#homeScreen,#newGameDialog,#storyIntro,#setupDialog,#scenarioDialog,#themeToggle{display:none!important}';document.head.append(integrationStyle);
// Route any legacy dialog entry through the unified shell, including captured handlers.
for(const [id,route]of [['optionsDialog',()=>window.parent.cf2OpenOptions()],['newGameDialog',()=>window.parent.cf2OpenClassic()],['setupDialog',()=>window.parent.cf2OpenClassic()],['scenarioDialog',()=>window.parent.cf2OpenClassic()]]){const d=document.getElementById(id);if(d)d.showModal=route}
const chapterRender=render;render=function(){chapterRender();const heading=document.querySelector('#gameWrap header h1');if(heading){heading.textContent='MODO CLÁSSICO — A CORRIDA';const sub=document.createElement('small');sub.textContent='com Miguel';sub.style.cssText='display:block;font-size:.52em;font-weight:500;margin-top:6px';heading.append(sub)}};

cf2Native.history=function(){loadSavedHistory();return savedGameHistory.map(r=>({id:r.id,savedAt:r.savedAt,completed:r.completed,months:r.payload.months,month:r.payload.state.month+1,count:r.payload.count}))};
cf2Native.resume=function(id){loadSavedHistory();const r=savedGameHistory.find(r=>r.id===id);if(!r)throw Error('Partida não encontrada.');applySavePayload(r.payload)};
cf2Native.removeSave=function(id){deleteHistoryRecords([id])};cf2Native.save=function(){storeCurrentGame()};
// Closing legacy history without loading must never reveal an empty game document.
document.getElementById('historyDialog').addEventListener('close',()=>{if(document.getElementById('gameWrap').classList.contains('hidden'))window.parent.cf2GoHome()});

// Stable slots; saving the same game updates its existing record.
let cf2SlotId=null;
const cf2SlotLaunch=cf2Native.launch;cf2Native.launch=function(c){loadSavedHistory();if(savedGameHistory.length>=5)throw Error('Cinco vagas ocupadas. Apague uma partida em Carregar jogo.');cf2SlotId=null;return cf2SlotLaunch(c)};
const cf2SlotResume=cf2Native.resume;cf2Native.resume=function(id){cf2SlotResume(id);cf2SlotId=id};
const cf2SlotStore=storeCurrentGame;storeCurrentGame=function(){loadSavedHistory();if(!cf2SlotId&&savedGameHistory.length>=5)throw Error('Cinco vagas ocupadas. Apague uma partida antes de salvar outra.');const backup=[...savedGameHistory];if(cf2SlotId&&savedGameHistory.some(r=>r.id===cf2SlotId)){savedGameHistory=savedGameHistory.filter(r=>r.id!==cf2SlotId);persistSavedHistory()}let result;try{result=cf2SlotStore()}catch(e){savedGameHistory=backup;persistSavedHistory();throw e}if(cf2SlotId){savedGameHistory=savedGameHistory.filter(r=>r.id!==cf2SlotId&&r.id!==result.entry.id);result.entry.id=cf2SlotId;savedGameHistory.unshift(result.entry);result.stored=persistSavedHistory();renderSavedHistory()}else cf2SlotId=result.entry.id;return result};cf2Native.save=function(){return storeCurrentGame()};

// Payroll for custom game scenarios: same proportional deductions as the base reference.
const jPayrollBaseTeam=team;team=function(i){const t=jPayrollBaseTeam(i);if(activeScenario?.payrollMode==='proportional-v1'&&Number.isFinite(activeScenario.gross)&&activeScenario.gross>0){t.initialGross=activeScenario.gross;t.payrollMode='proportional-v1';t.grossSalary=activeScenario.gross;t.payrollDiscount=Math.round((t.grossSalary-t.salary)*100)/100}return t};
function jSyncPayroll(t){if(t.initialIncome>0&&!t.initialGross){t.initialGross=Math.round(t.initialIncome*2500/2149.31*100)/100;t.payrollMode='proportional-v1'}if(t.payrollMode==='proportional-v1'&&t.initialGross>0&&t.initialIncome>0){t.grossSalary=Math.round(t.initialGross*t.salary/t.initialIncome*100)/100;t.payrollDiscount=Math.round((t.grossSalary-t.salary)*100)/100}}
const jPayrollBaseShell=shell;shell=function(t,i,body){jSyncPayroll(t);let html=jPayrollBaseShell(t,i,body);if(t.payrollMode==='proportional-v1')html=html.replace('💼 Renda inicial de referência','💼 Salário bruto').replace(money(t.initialIncome),money(t.grossSalary)).replace('💰 Renda líquida','💰 Salário líquido');return html};
