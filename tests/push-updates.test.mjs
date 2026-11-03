import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const script=resolve('scripts/push-updates.sh');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'dane-push-test-'));
 const remote=join(root,'remote.git'),runner=join(root,'runner'),author=join(root,'author');
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 git(root,'init','--bare','--initial-branch=main',remote);git(root,'clone',remote,author);
 git(author,'config','user.name','Test Author');git(author,'config','user.email','test@example.com');
 mkdirSync(join(author,'site/data'),{recursive:true});
 for(const name of ['prices','county-cache','terminal'])writeFileSync(join(author,`site/data/${name}.json`),'{}\n');
 writeFileSync(join(author,'README.md'),'Initial source\n');git(author,'add','.');git(author,'commit','-m','Initial');git(author,'push','origin','main');git(root,'clone',remote,runner);
 return {root,remote,runner,author,git};
}
test('updater preserves a source commit pushed after checkout and publishes its data',()=>{
 const f=fixture();try{
  writeFileSync(join(f.author,'README.md'),'New source during collection\n');f.git(f.author,'add','.');f.git(f.author,'commit','-m','Source edit');f.git(f.author,'push','origin','main');
  writeFileSync(join(f.runner,'site/data/prices.json'),'{"updated":true}\n');
  const result=spawnSync('bash',[script],{cwd:f.runner,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  assert.equal(f.git(f.root,'--git-dir='+f.remote,'show','main:README.md'),'New source during collection\n');
  assert.equal(f.git(f.root,'--git-dir='+f.remote,'show','main:site/data/prices.json'),'{"updated":true}\n');
  assert.equal(readFileSync(join(f.runner,'README.md'),'utf8'),'New source during collection\n');
 }finally{rmSync(f.root,{recursive:true,force:true})}
});
test('overlapping data edits stop without overwriting the remote',()=>{
 const f=fixture();try{
  writeFileSync(join(f.author,'site/data/prices.json'),'{"remote":true}\n');f.git(f.author,'add','.');f.git(f.author,'commit','-m','Concurrent data');f.git(f.author,'push','origin','main');
  writeFileSync(join(f.runner,'site/data/prices.json'),'{"runner":true}\n');
  const result=spawnSync('bash',[script],{cwd:f.runner,encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/No remote files were overwritten/);
  assert.equal(f.git(f.root,'--git-dir='+f.remote,'show','main:site/data/prices.json'),'{"remote":true}\n');
 }finally{rmSync(f.root,{recursive:true,force:true})}
});
