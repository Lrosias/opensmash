# Native online cancellation

The native Original/Remix online scene already displays Casual, Ranked, and Friends. The browser wrapper previously called `cleanup()` after the SDK rejected a cancelled search; cleanup always opened its separate “Play together” mode picker and set native phase 6 (“Try again”). This stranded the player behind a duplicate selector.

The wrapper now remembers which entry started online play. A native entry restores the same paused menu engine, hides the browser selector, clears cancellation status to phase 0, and resumes native menu input. The optional browser shortcut returns to its own selector. Errors retain native retry status. Room and queue teardown, generation checks, and late-room rejection remain unchanged. Melee has one game-owned queue screen and does not need this change.

Validation:

- The browser regression reproduces the released-source failure: Cancel leaves the custom picker visible and native phase 6.
- Actual updated wrapper and current SDK (`c7087e338cdacd355b569dae4898db37e89aee97eed9d194919b3f6051fa3357`) pass Casual/Ranked cancellation and retry, Friends cancellation after its socket opens, menu-engine preservation, and switching between native and browser entries for both packaged Original and Remix profiles at widths 1440, 1000, and 375 (six browser cases).
- Network sockets and native menu rendering are explicit fixtures. This is not hosted/native gameplay or physical-touch acceptance.
- Thirteen existing competitive/profile tests pass. Independent review found no blocking issue.

Run the browser regression with `YOUGAME_SDK_PATH=/absolute/path/to/sdk.js node yougame/tests/native-online-cancel-browser.mjs`. `APP_SOURCE_PATH` can serve the previous app source to reproduce the regression.

Known pre-existing limits: the adapter control partially overlaps the optional browser shortcut at 375 pixels (the regression clicks its exposed corner); keyboard Enter on that shortcut is intercepted by native input. Cancellation during a ticket request before a socket exists, late successful connection after cancellation, and invitation bootstrap are not covered by this fixture. The existing SDK in-flight lobby promise behavior was not changed.

Release acceptance: on the new Original/Remix build, use the native Online menu, choose Casual, cancel search, and confirm the native three-choice screen responds immediately. Repeat with Ranked, then retry Casual and verify a single fresh search. Root delivery owner must publish and verify the hosted candidate before closing Luis’s defect.

Later product direction supersedes acceptance of custom fighter/readiness screens: Casual and Friends should enter synchronized native menus with YouGame participant slots mapped to the same global controller ports. This patch fixes cancellation only and is not evidence that that larger native-menu flow is complete.
