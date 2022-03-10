const puppeteer = require('puppeteer');
const fs = require("fs");
const tokensFileBuffer = fs.readFileSync("tokens/tokens.txt");
const tokensTradableFileBuffer = fs.readFileSync("tokens/tradable.txt");
const tokensNotTradableFileBuffer = fs.readFileSync("tokens/not-tradable.txt");
const tokensFileString = tokensFileBuffer.toString();
const tokensTradableFileString = tokensTradableFileBuffer.toString();
const tokensNotTradableFileString = tokensNotTradableFileBuffer.toString();


const outputDir = "output"
const swapAmountADA= 1000;
const tradable = [];
const notTradable = [];

// example: 9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d7753554e444145
const encodedAssets = tokensFileBuffer.toString("utf-8").split("\n").map(tokenId => tokenId.trim());
console.log(`${encodedAssets.length} tokens.`);
const assets = encodedAssets.map(encodedAsset => {
    return {
        id: encodedAsset,
        policyId: encodedAsset.substring(0, 56),
        encodedName: encodedAsset.substring(56, encodedAsset.length)
    }
})
const getPair = (asset) => {
    return {
        id: asset.id,
        sundaeswap: `https://exchange.sundaeswap.finance/#/swap?swap_to=${asset.policyId}.${asset.encodedName}&swap_from=cardano.ada`,
        minswap: `https://app.minswap.org/en-US/swap?currencySymbolA=&tokenNameA=&currencySymbolB=${asset.policyId}&tokenNameB=${asset.encodedName}`,
    }
}
const pairs = assets.map(asset => getPair(asset));
const fillFirstInput = async (page, amount) => {
    await page.type('input', amount, {
        delay: 100
    })
};
(async () => {

    // clear the tradable and not-tradable token files.
    fs.writeFileSync("tokens/tradable.txt", ``)
    fs.writeFileSync("tokens/not-tradable.txt", ``)
    fs.writeFileSync("tokens/report.txt", ``)

    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();

    let sundaeswapValue;
    let minswapValue;
    for(let i = 0; i < pairs.length; i++){
        // first page
        await page.goto(pairs[i].sundaeswap, {
            waitUntil: "networkidle0"
        });
        await fillFirstInput(page, `${swapAmountADA}`)
        await page.waitForTimeout(2000);
        sundaeswapValue = await page.evaluate(() => {
            let value = document.querySelectorAll("input")[1].value;
            console.log(`value: ${value}`);
            return value;
        })
        await page.screenshot({ path: `${outputDir}/pair_${pairs[i].id}_sundaeswap.png` });

        // second page
        await page.goto(pairs[i].minswap, {
            waitUntil: "networkidle0"
        })
        await fillFirstInput(page, `${swapAmountADA}`)
        await page.waitForTimeout(2000);
        minswapValue = await page.evaluate(() => {
            let value = document.querySelectorAll("input")[1].value;
            console.log(`value: ${value}`);
            return value;
        })
        await page.screenshot({ path: `${outputDir}/pair_${pairs[i].id}_minswap.png` });
        let bestBuyOffer = Math.min(sundaeswapValue, minswapValue)/swapAmountADA;
        let marginTargetPair = Math.abs(sundaeswapValue - minswapValue);
        let profitADA = bestBuyOffer * marginTargetPair;
        let marginPercentage = ((profitADA/swapAmountADA) * 100)
        let marginPercentageText = `${((profitADA/swapAmountADA) * 100).toFixed(4)} %`

        console.log(`arbitrage-evaluation: ${JSON.stringify({
            id: pairs[i].id, sundaeswapValue, minswapValue, marginTargetPair, profitADA, marginPercentageText
        })}`);
        console.log(`processed ${i+1}/${assets.length} tokens (${((i/assets.length)*100).toFixed(4)}%). tradable tokens: ${tradable.length}/${assets.length}`)
        if(marginPercentage && marginPercentage > 0){
            tradable.push(pairs[i].id);
            fs.appendFileSync("tokens/tradable.txt", `\n${pairs[i].id}`)
            fs.appendFileSync("tokens/report.txt", `\n${JSON.stringify({
                id: pairs[i].id, sundaeswapValue, minswapValue, marginTargetPair, profitADA, marginPercentageText, time: (new Date()).toString()
            })}`)
        } else {
            notTradable.push(pairs[i].id);
            fs.appendFileSync("tokens/not-tradable.txt", `\n${pairs[i].id}`)
        }
    }
    await browser.close();
})();