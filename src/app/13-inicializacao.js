const ef=root.querySelector('#b-engine');ef.onload=()=>{try{engine=ef.contentWindow.cf2;pull(engine.init());}catch(e){say('Não foi possível iniciar o motor financeiro.');console.error(e)}};
ef.srcdoc=source.replace('</body>','<script>'+bridge+'<'+ '/script></body>');
let fastStarted=false;
function switchMode(story){if(story){nativeApi()?.audio?.({enabled:false,effects:false,music:false,volume:0});nativeApi()?.pause?.(true)}root.querySelector('#b-rpg-intro').hidden=true;if(!story){openClassic();return}configSetup.hidden=true;root.querySelector('#b-launch').hidden=true;root.querySelector('#b-rpg').hidden=false;root.querySelector('#b-traditional').hidden=true;root.classList.add('b-playing');releaseHold();sound.mode(true);close();draw();}

root.querySelector('#b-home').style.display='';root.querySelector('#b-story').onclick=()=>switchMode(true);root.querySelector('#b-race').onclick=()=>switchMode(false);

