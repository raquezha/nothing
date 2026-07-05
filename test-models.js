import fs from 'fs';
import { ANTIGRAVITY_ROUTING, ANTIGRAVITY_MODELS, getAntigravityRequestModelId } from './packages/antigravity/dist/antigravity/models.js';

for (const model of ANTIGRAVITY_MODELS) {
    const reqModel = getAntigravityRequestModelId(model.id, "low");
    console.log(`Model: ${model.id} -> ${reqModel}`);
}
