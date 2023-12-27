## Scanner To Gather Data for Strategies
- Collects transaction data and vault balances before and after the arb transaction. Currently only supported for two-order system with specific input and output vaults and tokens.
- Check the arguments for the tool:
```sh
ts-node scanArb.ts --help
```
- Example
```sh
ts-node scanArb.ts -s https://api.thegraph.com/subgraphs/name/siddharth2207/nhsobv3npe2 -o  "0x51e6e60cdba02cef63c65917cdb594179e790bbd749d52d5efa5b4ef70c4e4c7,0xe4cda2a5c590002bf8a260ec65b65cb9ca82a78ffd60b1056f665d89e387a3bb" --rpc-url https://polygon.llamarpc.com
```