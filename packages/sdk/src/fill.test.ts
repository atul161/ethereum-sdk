import { Web3Ethereum } from "@rarible/web3-ethereum"
import { toAddress } from "@rarible/types"
import Web3 from "web3"
import { createRaribleSdk } from "./index"

test("fill", async () => {
	const provider = new Web3.providers.HttpProvider("https://node-mainnet.rarible.com")
	const web3 = new Web3(provider)
	const from = toAddress("0x3aa3e6bbc5da36f8897eec3f93aa7769273e7f89")
	const sdk = createRaribleSdk(new Web3Ethereum({ web3, from }), "mainnet")
	const order = await sdk.apis.order.getOrderByHash({ hash: "0xf7c71b2e75454e9292e2d5e1ae571ce5251ee1c67c20ffccb13b57314612dacd" })
	if (order.type === "RARIBLE_V2") {
		await sdk.order.fill({
			order,
			amount: 1,
		})
	}
})
