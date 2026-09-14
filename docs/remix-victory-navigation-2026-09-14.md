# Victory returns to character select

Candidate `a3530b428018b3cb` supersedes `177296af1d2f83be` locally.
A, Start and B on the victory screen now return to character select. The Start
instant-rematch shortcut is removed. Existing player ports, fighter selections
and colors remain selected, and the next match proceeds through stage selection.
The optional R/Z stats view remains available.

Built on the original victory presentation branch, including latest publishing
main `7fa59a7f`. No publication is included in this change.

Validation: three complete four-human matches, using P4's Start, A and B in turn;
each reaches native character-select scene 16, preserving the four ports and
choices. Subsequent matches start through character and stage selection.
The costume regression checks all 141 colors and confirms four duplicate fighters
retain distinct/manual colors through results, selection and another match.
No browser errors or display-list overflows. Native result-selection contracts pass.

Candidate and evidence:
`/Volumes/OpenSmashBuilds/main/build/remix/native-victory-select-20260914`.
The local preview remains http://127.0.0.1:4202/.
