import { themes } from './themes.js';

export class AssetGenerator {
    constructor() {
        this.cache = {}; // Could use localStorage if needed, but in-memory for now
    }

    async generateAssetsForTheme(themeName, onProgress) {
        const items = themes[themeName];
        if (!items) throw new Error("Unknown theme");

        const assets = [];
        const total = items.length;
        let completed = 0;

        // Configuration
        const BATCH_SIZE = 3; // Websim handles concurrent requests well, but let's be safe
        
        const generateItem = async (itemName, index) => {
            try {
                // Prompt engineering for consistency
                const prompt = `simple black and white line art vector icon of ${itemName}, thick lines, white background, no shading, coloring book style, centered, isolated, high contrast`;
                
                const result = await websim.imageGen({
                    prompt: prompt,
                    aspect_ratio: "1:1",
                    transparent: true
                });

                completed++;
                if (onProgress) onProgress(completed, total);

                return {
                    id: index,
                    name: itemName,
                    url: result.url
                };
            } catch (e) {
                console.error(`Failed to generate ${itemName}`, e);
                // Return a placeholder or retry logic could go here. 
                // For now, we return null and filter later
                return null;
            }
        };

        // Process in batches
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const promises = batch.map((item, offset) => generateItem(item, i + offset));
            const results = await Promise.all(promises);
            assets.push(...results);
        }

        return assets.filter(a => a !== null);
    }
}

import { themes } from './themes.js';

export class AssetGenerator {
    constructor() {
    }

    async generateAssetsForTheme(themeName, onProgress) {
        const items = themes[themeName];
        if (!items) throw new Error("Unknown theme");

        const assets = [];
        const total = items.length;
        let completed = 0;

        // Configuration
        const BATCH_SIZE = 4; 
        
        const generateItem = async (itemName, index) => {
            try {
                // Prompt engineering for specific style
                const prompt = `black and white outline sticker of ${itemName}, thick lines, white background, no shading, minimalist vector icon, high contrast, cute`;
                
                const result = await websim.imageGen({
                    prompt: prompt,
                    aspect_ratio: "1:1",
                    transparent: true
                });

                completed++;
                if (onProgress) onProgress(completed, total);

                return {
                    id: index,
                    name: itemName,
                    url: result.url
                };
            } catch (e) {
                console.error(`Failed to generate ${itemName}`, e);
                // Return a retry placeholder or skip
                return null;
            }
        };

        // Process in batches
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const promises = batch.map((item, offset) => generateItem(item, i + offset));
            const results = await Promise.all(promises);
            assets.push(...results);
        }

        return assets.filter(a => a !== null);
    }
}