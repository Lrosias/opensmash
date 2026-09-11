// Stable native fighter IDs; bosses, polygons and regional duplicates are omitted.
export const REMIX_FIGHTERS=Object.freeze([...Array(12).keys(),29,30,31,32,33,52,55,56,57,58,59,62,63,64,65,68,73,72,34,38,74,75]);
export const REMIX_STAGES=Object.freeze([6,16,9,10,11,12,13,14]);
export const validFighter=id=>Number.isInteger(id)&&REMIX_FIGHTERS.includes(id);
export const validStage=id=>Number.isInteger(id)&&REMIX_STAGES.includes(id);
