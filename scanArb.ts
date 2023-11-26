import axios from "axios";
import { ethers } from "ethers";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import fs from "fs"; 


async function getGas(txHash: any){
  let provider = new ethers.providers.JsonRpcProvider("https://polygon.llamarpc.com") 
  let tx = await provider.getTransactionReceipt(txHash)   

  return {
    actualGasUsage : tx.gasUsed.toString(),
    effectiveGasPrice : tx.effectiveGasPrice.toString()
  }

} 

async function scanData(){  



     const sgUrl = "https://api.thegraph.com/subgraphs/name/siddharth2207/polytrade"  
    //  const sgUrl = "https://api.thegraph.com/subgraphs/name/siddharth2207/nhsbinomialstrat" 

     let query = `{
          takeOrderEntities(orderBy : timestamp, orderDirection :asc, first : 1000,where: {order_: {id_in: ["0xcfd91f5980def6df7b0c4aac45ce395d6ed1273fb2444fa621bceb4c9d1a4ee9","0xdbf7a02b69ef8bf8af5eba280e823c5b8b9f32b278579f1392ff99600283cd58"]}}) {
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
     
     const filePath = "./data/polytrade_bounty_strat.csv"
    // const filePath = "./data/nhs.csv"

     const stream = fs.createWriteStream(filePath, {flags: "a"});  

     console.log("takeOrderEntities.length : ",  takeOrderEntities.length)

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
      const {actualGasUsage,effectiveGasPrice} = await getGas(txHash)

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
scanData() 