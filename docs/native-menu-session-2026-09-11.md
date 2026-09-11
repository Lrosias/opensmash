# Native Casual and Friends session

Casual and Friends now join the YouGame lobby and run the normal native VS character-select, stage-select, game, and results screens. The wrapper does not ask players to choose fighters, Ready, or Start in HTML. Ranked retains its existing competitive rules integration pending a separate native conversion.

The platform participant roster assigns global controller ports. Each device samples its local controller indices into those slots; unoccupied slots are disconnected (`null`) on every peer. Engines use the opt-in `SSB64_YOUGAME_SESSION` contract, an unselected CSS bootstrap, and a shared seed. After every engine agrees on its initial frame, scene, battle ID, checksum, and seat mask, the host internally begins the platform match. A second armed barrier starts fixed two-frame lockstep without prediction.

The native machine pauses on its first terminal battle frame. Peers agree on the exact terminal frame, battle ID, checksum, and native winner before reporting the game and settling the platform round. After the authoritative receipt, a deferred fresh input timeline resumes the same native engine through results and back to CSS. Build, match, round, frozen roster, and checkpoint scope reject older input packets. The native PRNG and absolute frame continue. Roster changes require a new synchronized CSS engine after settlement because the first engine contract has an immutable seat mask; joins during a game do not alter its active ports. Active departures void and stop the session.

Independent review found and fixed a pending-boot departure race: dropping below two participants now invalidates the old boot token and cached readiness before any late engine can begin a stale roster.

Validation: seven focused coordinator tests, thirteen existing competitive/profile tests, two actual-app browser cases (Original/Remix) with explicit engine/SDK fixtures, and six real-SDK cancellation cases (both editions at 1440/1000/375 pixels) pass. The app fixture proves native Start forwarding, global holes, no HTML selection/readiness/results, same-engine settlement continuation, and clean online-engine disposal. Fixtures do not qualify native determinism or hosted netplay; root owns paired native-engine and private hosted acceptance before publication. No mobile/touch changes or YouGame SDK changes are included.

Run `node --test yougame/tests/native-room-session.test.mjs` and `node yougame/tests/native-room-app-browser.mjs`. The prior cancellation test also requires `YOUGAME_SDK_PATH` pointing at the reviewed SDK.
