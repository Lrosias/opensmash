/* Ganondorf.asm retains Captain's state machine; the ROM supplies every move's
 * animation, timing, hitboxes and Dark Dive throw descriptor. captainshared.asm
 * replaces the two Falcon effects and attaches the punch to joint 16. */
static FTStatusDesc ganon_status[64];
extern EFDesc dEFManagerCaptainFalconKickEffectDesc,dEFManagerCaptainFalconPunchEffectDesc;
GObj *port_remix_ganon_effect(GObj *fighter,int kick){
 FTStruct *fp=ftGetStruct(fighter);EFDesc d=kick?dEFManagerCaptainFalconKickEffectDesc:dEFManagerCaptainFalconPunchEffectDesc;
 d.file_head=kick?fp->data->p_file_special2:fp->data->p_file_special3;
 GObj *g=efManagerMakeEffectForce(&d);if(!g)return NULL;
 efGetStruct(g)->fighter_gobj=fighter;DObj *o=DObjGetStruct(g);
 o->user_data.p=fp->joints[kick?23:16];o->rotate.vec.f.y=fp->lr*(kick?HALF_PI32:-HALF_PI32);
 if(kick&&fp->status_id==nFTCaptainStatusSpecialAirLw)o->rotate.vec.f.z=-fp->lr*F_CLC_DTOR32(60.0F);
 return g;
}
static void ganon_install(FighterDescriptor *d){
 const FighterDescriptor *parent=port_fighter_descriptor(nFTKindCaptain);
 memcpy(ganon_status,safe_statuses,sizeof(ganon_status));
 memcpy(ganon_status,parent->special_descs,(nFTCaptainStatusSpecialAirHi-nFTCommonStatusSpecialStart+1)*sizeof(*ganon_status));
 d->special_descs=ganon_status;memcpy(d->special_handler,parent->special_handler,sizeof(d->special_handler));d->computer_attack_list=parent->computer_attack_list;
}
