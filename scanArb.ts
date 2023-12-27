import axios from "axios";
import { ethers } from "ethers";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { Command } from "commander";
import fs from "fs"; 
import { argv } from "process"; 



async function main(argv){ 

      const cmdOptions = new Command()
      .requiredOption("-s --sg-url <sg-url>",`Subgraph Api Endipoint`)
      .requiredOption("-o --orders <orders>",`Comma separated order ids.`)
      .requiredOption("--rpc-url <network rpc>",`Network RPC`)
      .option("-t --start-timestamp  <unix timestamp>",`Starting timestamp to begin from`)
      .option("-p --pages  <unix timestamp>",`Starting timestamp to begin from`)
      .option("-f --file-path  <file path>",`File Path`)
      .description([
        "Trace a strategy towards an end."
      ].join("\n"))
      .parse(argv) 
      .opts(); 

    const orders = cmdOptions.orders.split(",").map(e => {return `"${e}"`}).toString()
    const sgUrl = cmdOptions.sgUrl
    const startTimestamp = cmdOptions.startTimestamp ? cmdOptions.startTimestamp : Math.round(Date.now() / 1000) - 86400
    const pages = cmdOptions.pages ? cmdOptions.pages : 10
    const filePath = cmdOptions.filePath ? cmdOptions.filePath : `./data/${Math.round(Date.now() / 1000)}.csv`
    const rpcUrl = cmdOptions.rpcUrl


    await scanData(
      sgUrl,
      startTimestamp,
      pages,
      orders,
      filePath,
      rpcUrl
    )


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


async function getGas(txHash: any, rpcUrl: string){
  let provider = new ethers.providers.JsonRpcProvider(rpcUrl) 
  let tx = await provider.getTransactionReceipt(txHash)   

  return {
    actualGasUsage : tx.gasUsed.toString(),
    effectiveGasPrice : tx.effectiveGasPrice.toString()
  }

} 

async function scanData(
  sgUrl: string,
  startTimestamp: number,
  pages: number,
  orderIds: string,
  filePath: string,
  rpcUrl:string

){  

     for(let j = 0 ; j < pages; j++){
      let query = `{
            takeOrderEntities(orderBy : timestamp, orderDirection :asc, first: 1000, skip:${1000 * j}, where: {context_: {timestamp_gt: "${startTimestamp}"}, order_: {id_in: [${orderIds}]}}) {
            context{
            id
            timestamp
            vaultInputsContext
            vaultOutputsContext 
            transaction{
                id
            }
          }
        }
      }` 
      
      const result = await axios.post(
          sgUrl,
          {
              query : query
          },
          { headers: { "Content-Type": "application/json" } }
      )  

      const takeOrderEntities = result.data.data.takeOrderEntities  

      const stream = fs.createWriteStream(filePath, {flags: "a"});  
      
      if(takeOrderEntities.length == 0) break;

      for(let i = 0 ; i < takeOrderEntities.length ; i++){ 
        const context = takeOrderEntities[i].context
        const validInputs = context.vaultInputsContext
        const validOutputs = context.vaultOutputsContext 
        const timestamp = context.timestamp 
        
        const inputBalanceBefore = ethers.BigNumber.from(validInputs[3])
        const inputBalanceDiff = ethers.BigNumber.from(validInputs[4])
        const inputBalanaceAfter = inputBalanceBefore.add(inputBalanceDiff) 
        
        const outputBalanceBefore = ethers.BigNumber.from(validOutputs[3])
        const outputBalanceDiff = ethers.BigNumber.from(validOutputs[4])
        const outputBalanaceAfter = outputBalanceBefore.sub(outputBalanceDiff) 

        const txHash = context.transaction.id
        const {actualGasUsage,effectiveGasPrice} = await getGas(txHash,rpcUrl)

        if(validInputs[1] == 18 && validOutputs[1] == 6){
          let outputCsvLine = stringify([
            [
                timestamp.toString(),
                inputBalanceBefore.toString(),
                inputBalanaceAfter.toString(),
                outputBalanceBefore.toString(),
                outputBalanaceAfter.toString(),
                txHash,
                actualGasUsage,
                effectiveGasPrice
              ],
          ]);
          stream.write(outputCsvLine, function() {});
        }else if(validInputs[1] == 6 && validOutputs[1] == 18){
          let outputCsvLine = stringify([
            [
                timestamp.toString(),
                outputBalanceBefore.toString(),
                outputBalanaceAfter.toString(),
                inputBalanceBefore.toString(),
                inputBalanaceAfter.toString(),
                txHash,
                actualGasUsage,
                effectiveGasPrice
              ],
          ]);
          stream.write(outputCsvLine, function() {});
        }
      } 
      stream.end();
     }     
} 

