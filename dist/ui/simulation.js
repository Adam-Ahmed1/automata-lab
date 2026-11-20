import {$,element,displayWord,displayState} from './dom.js';
export class SimulationPanel {
 constructor({bridge,graph,onState,onShowTest}){
  this.bridge=bridge;this.graph=graph;this.onState=onState;this.onShowTest=onShowTest;this.position=0;this.timer=null;this.runVersion=0;this.batchVersion=0;
  $('#run-form').addEventListener('submit',event=>{event.preventDefault();this.run();});
  $('#test-empty').onclick=()=>{$('#test-input').value='';this.run();};
  $('#trace-next').onclick=()=>{this.pause();this.move(1);};
  $('#trace-back').onclick=()=>{this.pause();this.move(-1);};
  $('#trace-reset').onclick=()=>{this.pause();this.position=0;this.renderTrace();};
  $('#trace-play').onclick=()=>this.togglePlay();
  $('#batch-form').addEventListener('submit',event=>{event.preventDefault();this.runBatch();});
  $('#word-form').addEventListener('submit',event=>{event.preventDefault();this.analyzeWord();});
 }
 setMachine(machine){
  this.pause();this.machine=machine;this.result=null;this.position=0;this.runVersion++;this.batchVersion++;
  $('#run-button').disabled=false;$('#batch-button').disabled=false;
  $('#run-result').hidden=true;$('#run-error').hidden=true;$('#batch-results').replaceChildren();$('#batch-error').hidden=true;
  const nfa=machine.type==='nfa';$('#test-empty').hidden=!nfa;
  $('#alphabet-hint').textContent=(machine.definition.alphabet.length?'Alphabet: '+machine.definition.alphabet.map(s=>s===' '?'␠ (space)':s).join('  ·  '):nfa?'Empty alphabet.':'Add an alphabet symbol to test this machine.')+(nfa?' Leave input blank to test ε.':'');
 }
 async run(){
  if(!this.machine)return;this.pause();const machine=this.machine,button=$('#run-button'),version=++this.runVersion;button.disabled=true;$('#run-error').hidden=true;
  try{
   const result=await this.bridge.call('execute',{type:machine.type,operation:'simulate',definition:machine.definition,input:$('#test-input').value});
   if(version!==this.runVersion)return;this.result=result;this.position=0;$('#run-result').hidden=false;
   $('#verdict').textContent=result.accepted?'Accepted':'Rejected';$('#verdict').className='verdict '+(result.accepted?'accepted':'rejected');
   $('#run-summary').textContent='Ends in '+displayState(result.finalState)+(machine.type==='nfa'?(result.accepted?' · includes an accepting state':' · no accepting state'):(result.accepted?' · accepting state':' · non-accepting state'));
   this.renderTrace();
  }catch(error){if(version!==this.runVersion)return;this.result=null;$('#run-result').hidden=true;$('#run-error').textContent=error.message;$('#run-error').hidden=false;this.graph.highlight(machine.definition.startState);}
  finally{if(version===this.runVersion)button.disabled=false;}
 }
 renderTrace(){
  if(!this.result)return;const {trace,input}=this.result,current=trace[this.position],symbols=[...input];
  $('#trace-position').textContent=this.position+' / '+symbols.length+' '+(symbols.length===1?'symbol':'symbols');
  const tape=$('#input-tape');
  const items=symbols;
  tape.replaceChildren(...items.map((symbol,index)=>element('button',{type:'button',class:'tape-cell '+(symbols.length&&index<this.position?'consumed':'')+' '+(symbols.length&&index===this.position?'next':''),text:displayWord(symbol),'aria-label':'Symbol '+(index+1)+': '+symbol+'. Jump after this symbol.',onclick:()=>{this.pause();this.position=index+1;this.renderTrace();}})));
  if(!symbols.length)tape.append(element('span',{class:'chip muted',text:'ε · empty string'}));
  $('#trace-detail').textContent=this.position===0?'Start in '+displayState(current.state):displayState(this.result.trace[this.position-1].state)+' —'+current.symbol+'→ '+displayState(current.state);
  $('#trace-back').disabled=this.position===0;$('#trace-next').disabled=this.position===symbols.length;$('#trace-play').disabled=!symbols.length;
  const previous=trace[this.position-1];this.graph.highlight(current.state,{from:previous?.state,to:current.state,symbol:current.symbol,edges:current.edges});this.onState(current.state);
 }
 move(amount){if(!this.result)return;this.position=Math.min(this.result.trace.length-1,Math.max(0,this.position+amount));this.renderTrace();}
 pause(){clearInterval(this.timer);this.timer=null;$('#trace-play').textContent='▶ Play';}
 togglePlay(){
  if(this.timer){this.pause();return;}if(!this.result||this.result.trace.length<2)return;
  if(this.position===this.result.trace.length-1)this.position=0;
  $('#trace-play').textContent='Ⅱ Pause';this.renderTrace();
  this.timer=setInterval(()=>{this.move(1);if(this.position===this.result.trace.length-1)this.pause();},750);
 }
 async runBatch(){
  const button=$('#batch-button');button.disabled=true;$('#batch-error').hidden=true;
  const machine=this.machine,version=++this.batchVersion;
  try{
   const inputs=$('#batch-input').value.replace(/\r/g,'').split('\n').filter(input=>input.length>0);
   const rows=await this.bridge.call('execute',{type:machine.type,operation:'batch',definition:machine.definition,inputs});
   if(version!==this.batchVersion)return;
   const table=element('table',{class:'data-table batch-table'});
   table.append(element('caption',{class:'sr-only',text:'Batch test results'}),element('thead',{},element('tr',{},['String','Result','Final state',''].map(text=>element('th',{scope:'col',text})))));
   table.append(element('tbody',{},rows.map(result=>element('tr',{},[
    element('td',{class:'mono',text:displayWord(result.input)}),
    element('td',{},element('span',{class:result.error?'error-text':result.accepted?'text-accepted':'text-rejected',text:result.error?'Invalid input':result.accepted?'Accepted':'Rejected',title:result.error||''})),
    element('td',{class:result.error?'muted':'mono',text:result.error||displayState(result.finalState)}),
    element('td',{},element('button',{class:'text-button',type:'button',text:'Trace →','aria-label':'Trace '+displayWord(result.input),onclick:()=>{$('#test-input').value=result.input;this.onShowTest();this.run();}}))
   ]))));
   $('#batch-results').replaceChildren(element('p',{class:'result-caption',text:rows.filter(row=>row.accepted).length+' accepted · '+rows.filter(row=>!row.error&&!row.accepted).length+' rejected · '+rows.filter(row=>row.error).length+' invalid'}),table);
  }catch(error){if(version!==this.batchVersion)return;$('#batch-results').replaceChildren();$('#batch-error').textContent=error.message;$('#batch-error').hidden=false;}
  finally{if(version===this.batchVersion)button.disabled=false;}
 }
 async analyzeWord(){
  const button=$('#word-button');button.disabled=true;$('#word-error').hidden=true;
  try{
   const result=await this.bridge.call('word',{text:$('#word-input').value});
   $('#word-results').replaceChildren(...[['Prefixes',result.prefixes],['Suffixes',result.suffixes],['Unique substrings',result.substrings]].map(([title,values])=>element('section',{class:'word-group'},[
    element('div',{class:'word-group-heading'},[element('h3',{text:title}),element('span',{class:'count-pill',text:values.length})]),
    element('div',{class:'chips word-chips'},values.map(word=>word.length===0
      ?element('span',{class:'chip muted',text:'""','aria-label':'Zero-length result'})
      :element('button',{type:'button',class:'chip chip-button',text:displayWord(word),title:'Test '+displayWord(word)+' in the active machine',onclick:()=>{$('#test-input').value=word;this.onShowTest();this.run();}})))
   ])),element('p',{class:'field-hint',text:'Select a result button to test it in the active machine.'}));
  }catch(error){$('#word-results').replaceChildren();$('#word-error').textContent=error.message;$('#word-error').hidden=false;}
  finally{button.disabled=false;}
 }
}
