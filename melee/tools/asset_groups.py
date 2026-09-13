#!/usr/bin/env python3
"""Semantic preload groups for GALE01r2. File metadata remains the source of truth."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
# External CharacterKind, not internal FighterKind. Include transformation partners,
# Nana, Kirby hats and shared clone effects before entering a match.
FIGHTERS=[
('Captain Falcon','Ca','captain','Ca'),('Donkey Kong','Dk','dk','Dk'),('Fox','Fx','fox','Fx'),
('Mr. Game & Watch','Gw','gw','Gw'),('Kirby','Kb','kirby kirbytm','Kb'),('Bowser','Kp','koopa','Kp'),
('Link','Lk','link','Lk'),('Luigi','Lg','luigi','Lg Mr'),('Mario','Mr','mario','Mr'),('Marth','Ms','mars','Ms'),
('Mewtwo','Mt','mewtwo','Mt'),('Ness','Ns','ness','Ns'),('Peach','Pe','peach','Pe'),('Pikachu','Pk','pikachu','Pk'),
('Ice Climbers','Pp Nn','ice','Ic'),('Jigglypuff','Pr','purin','Pr'),('Samus','Ss','samus','Ss'),('Yoshi','Ys','yoshi','Ys'),
('Zelda','Zd Sk','zs','Zd Sk'),('Sheik','Sk Zd','zs','Sk Zd'),('Falco','Fc','falco','Fx'),('Young Link','Cl','clink','Lk'),
('Dr. Mario','Dr','drmario','Mr'),('Roy','Fe','emblem','Fe Ms'),('Pichu','Pc','pichu','Pc Pk'),('Ganondorf','Gn','ganon','Gn Ca')]
STAGES=[
(2,'Fountain of Dreams','Iz','izumi'),(3,'Pokémon Stadium','Ps','pstadium pokesta'),(4,"Princess Peach’s Castle",'Cs','castle'),
(5,'Kongo Jungle','Kg','garden kongo'),(6,'Brinstar','Ze','zebes'),(7,'Corneria','Cn','corneria venom'),(8,"Yoshi’s Story",'St','ystory'),
(9,'Onett','Ot','onetto onetto2 onett'),(10,'Mute City','Mc','mutecity'),(11,'Rainbow Cruise','Rc','rcruise'),
(12,'Jungle Japes','Gd','kongo garden'),(13,'Great Bay','Gb','greatbay saria'),(14,'Hyrule Temple','Sh','shrine akaneia'),
(15,'Brinstar Depths','Kr','kraid klaid'),(16,"Yoshi’s Island",'Yt','yorster smari3'),(17,'Green Greens','Gr','greens'),
(18,'Fourside','Fs','fourside'),(19,'Mushroom Kingdom','I1','inis1_01 inis1_02 docmari'),(20,'Mushroom Kingdom II','I2','inis2_01 inis2_02 docmari'),
(22,'Venom','Ve','venom corneria'),(23,'Poké Floats','Pu','pura pokemon'),(24,'Big Blue','Bb','bigblue mrider'),
(25,'Icicle Mountain','Im','icemt baloon'),(26,'Icicle Mountain','Im','icemt baloon'),(27,'Flat Zone','Fz','flatzone'),
(28,'Dream Land','Op','old_kb pupupu'),(29,"Yoshi’s Island 64",'Oy','old_ys'),(30,'Kongo Jungle 64','Ok','old_dk'),
(31,'Battlefield','NBa','sp_zako hyaku'),(32,'Final Destination','NLa','sp_end hyaku2 last')]
# 13th community tier list (March 2021), used only as a cache warming hint.
# https://www.ssbwiki.com/List_of_SSBM_tier_lists_(NTSC)
TIER=[2,9,15,20,19,0,12,14,13,17,16,7,22,25,8,1,21,6,3,10,23,24,11,18,4,5]
# All VS stages are unlocked. Warm all six tournament stages first.
COMPETITIVE=[8,2,3,28,31,32]
def unused_twin(path,paths):
    """GALE01 reads the .usd twin of a .dat file (lbFileGetFullName) and the audio/us/
    twin of a voice bank (lbaudio_ax str_audio_us); the other twin is never opened."""
    if path.endswith('.dat') and path[:-4]+'.usd' in paths: return True
    return path.startswith('files/audio/') and not path.startswith('files/audio/us/') and 'files/audio/us/'+path.rsplit('/',1)[1] in paths
def build(manifest):
    paths={f['path'] for f in manifest['files']}
    files=[f for f in manifest['files'] if not unused_twin(f['path'],paths)]; groups={}
    def group(key,name,predicate):
        chosen=[f for f in files if predicate(Path(f['path']).name,f['path'])]
        blocks=sorted({i for f in chosen for i in range(f['first'],f['first']+f['blocks'])})
        groups[key]={'name':name,'blocks':blocks}
    menu_audio={'main.ssm','nr_name.ssm','nr_select.ssm','nr_vs.ssm','nr_title.ssm','mhands.ssm','pokemon.ssm','end.ssm','smash2.sem','menu01.hps','menu02.hps','s_select.hps'}
    group('menu','menus',lambda n,p:(p.startswith('sys/') or n.startswith(('Mn','Sd','Lb','DbCo','EfMn','NtMemAc','ItCo'))) or n in menu_audio or n in ('PlCo.dat','EfCoData.dat','IfAll.usd'))
    # PlMh/PlCh: leaving the rules screen preloads the hands; keep that read off the disc gate.
    group('match','match essentials',lambda n,p:n.startswith(('Pd','TyData','It','If','GmRst.','GmPause.','GmGo','EfCo','PlCo','PlMh','PlCh','ff_','vs_hyou')) or n in ('item_h.hps','item_s.hps','nr_vs.ssm','end.ssm'))
    for i,(name,prefixes,sounds,effects) in enumerate(FIGHTERS):
        prefix=tuple('Pl'+x for x in prefixes.split())+tuple('Ef'+x for x in effects.split())+tuple('GmRstM'+x for x in prefixes.split())
        sound={x+'.ssm' for x in sounds.split()}
        group('fighter:'+str(i),name,lambda n,p,prefix=prefix,sound=sound:n.startswith(prefix) or n in sound or (i==14 and n=='GmRstMPn.dat'))
    for i,name,prefix,sounds in STAGES:
        sound={x+ext for x in sounds.split() for ext in ('.hps','.ssm')}
        group('stage:'+str(i),name,lambda n,p,prefix=prefix,sound=sound:n.startswith('Gr'+prefix) or n in sound)
    # Prefetch plan while the player is in the menus: what every match needs, the
    # fighters most players pick, the stages most matches land on, then the rest.
    tier=['fighter:'+str(i) for i in TIER]
    competitive=['stage:'+str(i) for i in COMPETITIVE]
    other_stages=['stage:'+str(s[0]) for s in STAGES if s[0] not in COMPETITIVE+[26]]
    plan=['match']+tier[:8]+competitive+tier[8:]+other_stages
    return {'version':2,'groups':groups,'plan':plan,'competitive':competitive,'prioritySource':'https://www.ssbwiki.com/List_of_SSBM_tier_lists_(NTSC)'}
def main():
    dist=ROOT/'build/melee-web/dist'
    manifest=json.loads((dist/'assets-manifest.json').read_text())
    catalog=build(manifest)
    (dist/'asset-groups.json').write_text(json.dumps(catalog,separators=(',',':')))
    mb=lambda blocks:round(sum(manifest['blocks'][i]['size'] for i in blocks)/1048576,2)
    for key in ['menu','match','fighter:2','stage:31']:
        g=catalog['groups'][key];print(key,len(g['blocks']),mb(g['blocks']),'MB')
    print('plan',len(catalog['plan']),'groups',mb({i for k in catalog['plan'] for i in catalog['groups'][k]['blocks']}),'MB')
if __name__=='__main__':main()
