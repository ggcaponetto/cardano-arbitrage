const puppeteer = require('puppeteer');
const fs = require("fs");
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const chalk = require('chalk');
const { Cluster } = require('puppeteer-cluster');
const argv = yargs(hideBin(process.argv)).argv
const axios = require("axios");

const tokensFileBuffer = fs.readFileSync("tokens/tokens.txt");
const tokensTradableFileBuffer = fs.readFileSync("tokens/tradable.txt");
const tokensNotTradableFileBuffer = fs.readFileSync("tokens/not-tradable.txt");

const tokensFileString = tokensFileBuffer.toString("utf-8");
const tokensTradableFileString = tokensTradableFileBuffer.toString("utf-8");
const tokensNotTradableFileString = tokensNotTradableFileBuffer.toString("utf-8");

const tokensArray = tokensFileString.split("\n").map(tokenId => tokenId.trim());
const tokensTradableArray = tokensTradableFileString.split("\n").map(tokenId => tokenId.trim());
const tokensNotTradableArray = tokensNotTradableFileString.split("\n").map(tokenId => tokenId.trim());

const swapAmountsADA = [
    2000
]
const encodedAssets = (()=>{
    if(argv["resume"]){
        return tokensArray;
    } else if(argv["tradable-tokens"]){
        return  tokensTradableArray;
    } else {
        throw new Error("please provide an argument among [--tradable-tokens, --resume]");
    }
})();

const tempReport = [];

// console.log(`${encodedAssets.length} tokens.`);
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
let pairs = assets.map(asset => getPair(asset));

const fillFirstInput = async (page, amount) => {
    await page.type('input', amount, {
        delay: 100
    })
};

async function getSundaeQueue(){
    let data = '{"query":"query queueDepth($poolIdents: [String!]) {\\n  queueDepth(poolIdents: $poolIdents) {\\n    depth\\n    poolIdent\\n    pool {\\n      ...PoolFragment\\n    }\\n  }\\n}\\n\\nfragment PoolFragment on Pool {\\n  apr\\n  assetA {\\n    ...AssetFragment\\n  }\\n  assetB {\\n    ...AssetFragment\\n  }\\n  assetLP {\\n    ...AssetFragment\\n  }\\n  fee\\n  quantityA\\n  quantityB\\n  quantityLP\\n  ident\\n  assetID\\n}\\n\\nfragment AssetFragment on Asset {\\n  assetId\\n  policyId\\n  assetName\\n  decimals\\n  logo\\n  ticker\\n  dateListed\\n}\\n","operationName":"queueDepth"}';
    let config = {
        method: 'post',
        url: 'https://stats.sundaeswap.finance/graphql',
        headers: {
            'Content-Type': 'text/plain'
        },
        data : data
    };

    return axios(config);
}

async function getMinswapQueue(){
    let data = JSON.stringify({
        "query": "\n    query TopPools($assetName: String, $offset: Int, $limit: Int) {\n  topPools(assetName: $assetName, offset: $offset, limit: $limit) {\n    assetA {\n      currencySymbol\n      tokenName\n      ...allMetadata\n    }\n    assetB {\n      currencySymbol\n      tokenName\n      ...allMetadata\n    }\n    reserveA\n    reserveB\n    lpAsset {\n      currencySymbol\n      tokenName\n    }\n    totalLiquidity\n    reserveADA\n    volumeADAByDay\n    volumeADAByWeek\n    pendingOrders\n  }\n}\n    \n    fragment allMetadata on Asset {\n  metadata {\n    name\n    ticker\n    url\n    decimals\n  }\n}\n    ",
        "variables": {
            "assetName": null,
            "offset": 0,
            "limit": 817
        }
    });
    let config = {
        method: 'post',
        url: 'https://monorepo-mainnet-hehe.minswap.org/graphql',
        headers: {
            'content-type': 'application/json',
            'accept': '*/*'
        },
        data : data
    };
    return axios(config);
}

(async () => {

    // clear the tradable and not-tradable token files.
    if(argv["clean-tradable"]) {
        // console.log(`cleaning tradable.txt contents...`);
        fs.writeFileSync("tokens/tradable.txt", ``)
    }
    if(argv["clean-not-tradable"]) {
        // console.log(`cleaning not-tradable.txt contents...`);
        fs.writeFileSync("tokens/not-tradable.txt", ``)
    }
    if(argv["clean-report"]) {
        // console.log(`cleaning report.txt contents...`);
        fs.writeFileSync("tokens/report.txt", ``)
    }

    /*
    const browser = await puppeteer.launch({
        headless: !!argv["headless"],
        args:[
            '--start-maximized' // you can also use '--start-fullscreen'
        ]
    });
    */

    while(true){
        async function processPairs(page, pair){
            let swapAmountADA;
            let sundaeswapValue;
            let sundaeswapMinimumValueReceived;
            let sundaeSwapPriceImpact;
            let minswapValue;
            let minswapMinimumValueReceived;
            let minswapPriceImpact;
            // console.log(`processing token ${pair.id}`);
            try{
                swapAmountADA = swapAmountsADA[0];
                // only process assets that are not in not-tradable.txt and tradable.txt when processing all tokens
                if(argv["resume"]){
                    if(tokensTradableArray.includes(pair.id)){
                        // console.log(`skipping token ${i}/${pairs.length}. it's included in the tradable.txt`);
                    }
                    if(tokensNotTradableArray.includes(pair.id)){
                        // console.log(`skipping token ${i}/${pairs.length}. it's included in the not-tradable.txt`);
                    }
                }

                // sundaeswap page
                await page.goto(pair.sundaeswap, {
                    waitUntil: "networkidle0"
                });
                await fillFirstInput(page, `${swapAmountADA}`)
                await page.waitForTimeout(2000);
                sundaeswapValue = await page.evaluate(() => {
                    let value = parseFloat(document.querySelectorAll("input")[1].value);
                    // console.log(`value: ${value}`);
                    return value;
                })
                // open the advanced trading tab
                let swapSummaryButton = await page.evaluateHandle(() => {
                    let elements = [];
                    for (const a of document.querySelectorAll("p")) {
                        if (a.textContent.includes("Swap Summary")) {
                            elements.push(a)
                        }
                    }
                    return elements[0].parentElement;
                });
                await swapSummaryButton.click();

                // get the minimum amount of tokens received
                sundaeswapMinimumValueReceived = await page.evaluate(() => {
                    let elements = [];
                    for (const element of document.querySelectorAll("div")) {
                        if (element.textContent.includes("Min. tokens received")) {
                            elements.push(element)
                        }
                    }
                    let childen = elements[elements.length-2].children[1].children;
                    let minAmountReveived = parseFloat(`${childen[0].innerHTML}${childen[1].innerHTML}`.replace(",", ""));
                    return minAmountReveived;
                });
                sundaeSwapPriceImpact = await page.evaluate(() => {
                    let elements = [];
                    for (const element of document.querySelectorAll("div")) {
                        if (element.textContent.includes("Price Impact")) {
                            elements.push(element)
                        }
                    }
                    let children = elements[elements.length-1].children[1].children;
                    let priceImpact = parseFloat(`${children[1].innerHTML}`);
                    return priceImpact;
                });

                // minswap page
                await page.goto(pair.minswap, {
                    waitUntil: "networkidle0"
                })
                await fillFirstInput(page, `${swapAmountADA}`)
                await page.waitForTimeout(2000);
                minswapValue = await page.evaluate(() => {
                    let value = parseFloat(document.querySelectorAll("input")[1].value);
                    // console.log(`value: ${value}`);
                    return value;
                })
                // get the minimum amount of tokens received
                minswapMinimumValueReceived = await page.evaluate(() => {
                    let elements = [];
                    for (const element of document.querySelectorAll("div")) {
                        if (element.textContent.includes("Minimum received")) {
                            elements.push(element)
                        }
                    }
                    let editedValue = [...elements[elements.length-2].children][1].childNodes[0].textContent.replace(",", "");
                    let minAmountReveived = parseFloat(`${editedValue}`);
                    return minAmountReveived;
                });
                minswapPriceImpact = await page.evaluate(() => {
                    let elements = [];
                    for (const element of document.querySelectorAll("div")) {
                        if (element.textContent.includes("Price Impact")) {
                            elements.push(element)
                        }
                    }
                    let editedValue = [...elements[elements.length-2].children][1].childNodes[0].textContent.replace(",", "");
                    let priceImpact = parseFloat(`${editedValue}`);
                    return priceImpact;
                });

                let marginPercentage = (Math.abs(sundaeswapMinimumValueReceived - minswapMinimumValueReceived) / ((sundaeswapMinimumValueReceived + minswapMinimumValueReceived) / 2)) * 100;
                let marginPercentageText = `${marginPercentage.toFixed(4)} %`

                let sundaeQueueResponse = await getSundaeQueue();
                let minswapQueueResponse = await getMinswapQueue();
                let reportObject = {
                    marginPercentageText,
                    swapAmountADA,
                    policyId: pair.id.substring(0, 56),
                    sundaeswapMinimumValueReceived,
                    sundaeSwapPriceImpact,
                    minswapMinimumValueReceived,
                    minswapPriceImpact,
                    sundaeQueue: sundaeQueueResponse.data,
                    minswapQueue: minswapQueueResponse.data
                }
                if(marginPercentage > 0 /*&& minswapPriceImpact < 5 && sundaeSwapPriceImpact < 5*/){
                    reportObject.profitable = true;
                    console.log(chalk.greenBright(`arbitrage-evaluation: ${JSON.stringify(reportObject)}`));
                    fs.appendFileSync("tokens/tradable.txt", `\n${pair.id}`);
                    fs.writeFileSync("tokens/report.json", JSON.stringify(tempReport))
                    tempReport.push(reportObject);
                } else {
                    reportObject.profitable = false;
                    console.log(chalk.white(`arbitrage-evaluation: ${JSON.stringify(reportObject)}`));
                    fs.appendFileSync("tokens/not-tradable.txt", `\n${pair.id}`)
                }
                // console.log(`processed ${swapAmountADA} tokens`);
            }catch (e){
                // console.error(`could not process ${swapAmountADA}`);
            }
        }
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 10,
            monitor: true
        });
        await cluster.task(async ({ page, data }) => {
            await page.setViewport({ width: 1366, height: 768});
            data.url = `processing token ${data.pairIndex}/${pairs.length} with ID ${data.pair.id}`
            await processPairs(page, data.pair)
        });
        for (let i = 0; i < pairs.length; i++) {
            // add the pair to the cluster
            cluster.queue({
                pair: pairs[i],
                pairIndex: i,
            });
        }
        // many more pages
        await cluster.idle();
        await cluster.close();
        console.log(chalk.greenBright(`restarting the crawler...`));
    }
})();