# DOVE Go Fresh Cucumber & Green Tea Spray

Drop the official brand source image here as `source-official.jpg` (or `.png`).

Requirements:
- Must be the exact product: DOVE Aluminum Free Deodorant Spray Cucumber & Green Tea, 4 oz / 113 g
- Longest side >= 1600px for direct packshot route (below 1600px = generation route)
- Must be from an official Dove/Unilever source (www.dove.com, assets.unileversolutions.com)
- GTIN: 8801619537961 (250ml variant from Nigerian retailer) — verify exact variant match

After the image is dropped here, the agent will:
1. Compute SHA-256, dimensions, and MIME type
2. Add the candidate to data/catalogue-intake.json
3. Run `npm run catalogue:packshot:prepare-reviewed -- --candidate-id dove-go-fresh-cucumber-green-tea-spray --source data/catalogue-intake-assets/dove-go-fresh-cucumber-green-tea-spray/source-official.jpg`
4. Review the transparent packshot output
