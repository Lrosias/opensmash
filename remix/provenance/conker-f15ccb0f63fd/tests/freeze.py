from pathlib import Path
import json,hashlib,shutil,difflib
root=Path.cwd();work=root/'build/remix/conker-fix';base=root/'build/remix/candidates/f2654986e14088f5';dest=root/'build/remix/candidates/conker-f15ccb0f63fd'
assert not dest.exists();dest.mkdir()
shutil.copytree(base/'engine',dest/'engine')
for name in ['BattleShip.js','BattleShip.wasm']:shutil.copyfile(work/name,dest/'engine'/name)
(dest/'source/remix').mkdir(parents=True)
for name in ['special_conker.c','verify_conker_actions.py']:shutil.copyfile(work/name,dest/'source/remix'/name)
(dest/'evidence').mkdir();(dest/'tests').mkdir()
for name in ['repro.cjs','regression.cjs','transitions.cjs','adjacent.cjs','kirby.cjs','audio-entities.cjs','build-isolated.py','freeze.py']:
 shutil.copyfile(work/name,dest/'tests'/name)
for name in ['rom-actions.json','mapping-validation.json','validator-negative-tests.json','abi.json','failing-trace.json','failing-paused.json','failing-repro.log','trace.json','repro.log','regression.json','regression.log','transitions.json','transitions.log','specials-56.json','adjacent.log','kirby-56.json','kirby.log','entities-rollback.json','audio-entities.log','compile-final.log','build-commands.json','initial.png','BattleShip.js.symbols','conker.patch']:
 shutil.copyfile(work/name,dest/'evidence'/name)
readme='''# Conker special-motion correction

This immutable native candidate replaces f2654986e14088f5's failing Conker descriptors. It is not published. Adopt engine files into the publisher's current frontend; do not replace its keyboard or competitive/results code.

The old action-minus-25 formula is incorrect for nine of Conker's thirteen special states. In particular, states250/251 selected motions225/226 past the225-entry main-motion table. Neutral-B after walking off stage13 deterministically hung in gmCollisionGetFighterPartsWorldPosition at fixture frame68. The corrected descriptors use the pinned ROM's explicit13-entry mapping, covering neutral phases and grenade success/failure animations. Up-special entries are unchanged.

Only engine/BattleShip.js and engine/BattleShip.wasm differ from f265's engine directory. All assets, sound banks and engine manifest are unchanged. The native C change is source/remix/special_conker.c; the patch is evidence/conker.patch. The new offline verifier checks descriptor bounds and exact mappings against ROM SHA2567efec9e0983656bb0219a23c511cd1505a5f84d524e50ad4284dc1c7eb4d1403. Negative tests reject both an index225 overflow and a wrong in-range index.

Validation: exact old freeze sequence passes260frames;22 scenarios spanning both seats pass220-frame restore/replay of game state, fighters, weapons/items and sound statistics each. Coverage includes ground/air tap and charge-release, falling and landing transitions, and grenade success/failure. Existing Conker up/down/recovery tests plus130-frame replay pass; Kirby's acquired Conker move passes ground and air. A separate audible-engine test with Chrome output muted confirms the1545-entry sound bank is active and charged-shot/projectile state replays exactly for180frames. All browser tests are closed after running. Imports464/exports87 are unchanged. Final documented-source recompilation produces byte-identical tested JS and Wasm.

Build provenance: this is a minimal relink against the unchanged f265 local build objects, not a clean full-source rebuild. tests/build-isolated.py records the exact compile/link recipe and evidence/build-commands.json records its commands. It compiles an isolated stubs copy with the replacement Conker file and writes an isolated object/output; it does not modify shared sources/build outputs. Base source reconstruction is the separate f265 provenance supplement. To adopt from source, replace remix/special_conker.c, add remix/verify_conker_actions.py, run that verifier with ROM and source paths, then use the existing prepare/build workflow. The standalone regression runners target the isolated local server4207 and write under build/remix/conker-fix.

Independent native review and hosted dual-client retest remain required. The original f265 candidate is preserved unchanged as the failing reference.
'''
(dest/'README.md').write_text(readme)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[dict(path=str(p.relative_to(dest)),size=p.stat().st_size,sha256=h(p)) for p in sorted(dest.rglob('*')) if p.is_file()]
manifest=dict(id=dest.name,base='f2654986e14088f5',status='awaiting-independent-review-and-hosted-retest',native_sha256=h(dest/'engine/BattleShip.wasm'),js_sha256=h(dest/'engine/BattleShip.js'),source_sha256=h(dest/'source/remix/special_conker.c'),changed_engine_files=['BattleShip.js','BattleShip.wasm'],files=files)
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'},indent=2));print('manifest_sha256',h(dest/'manifest.json'));print('files',len(files))
