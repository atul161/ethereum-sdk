import { Web3Ethereum } from "@rarible/web3-ethereum"
import { toAddress } from "@rarible/types"
import Web3 from "web3"
import { createRaribleSdk } from "./index"

test("fill", async () => {
	const provider = new Web3.providers.HttpProvider("https://node-mainnet.rarible.com")
	const web3 = new Web3(provider)
	const from = toAddress("0x208c05f23083bfbe508b7a3974fa1b995a8155bf")
	const sdk = createRaribleSdk(new Web3Ethereum({ web3, from }), "mainnet")
	const order = await sdk.apis.order.getOrderByHash({ hash: "0xa1eb145a4d60743b983b4560a1168ef397f2f5b7c31ca1f7209850564fb0efec" })
	if (order.type === "RARIBLE_V2") {
		await sdk.order.acceptBid({
			order,
			amount: 1,
			assetType: { contract: toAddress("0x6632a9d63e142f17a668064d41a21193b49b41a0"), tokenId: "2536" },
		})
	}
})
