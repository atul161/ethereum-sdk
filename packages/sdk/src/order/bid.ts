import type { Erc20AssetType, Order, OrderForm, RaribleV2OrderForm } from "@rarible/ethereum-api-client"
import type { BigNumberValue } from "@rarible/utils/build/bn"
import { toBn } from "@rarible/utils/build/bn"
import type { Step } from "@rarible/action"
import { Action } from "@rarible/action"
import { toBigNumber } from "@rarible/types"
import type { EthAssetType } from "@rarible/ethereum-api-client/build/models/AssetType"
import type { Ethereum } from "@rarible/ethereum-provider"
import type { Maybe } from "@rarible/types/build/maybe"
import type { HasOrder, HasPrice, OrderRequest, UpsertOrder } from "./upsert-order"
import type { AssetTypeRequest, AssetTypeResponse } from "./check-asset-type"
import type { SimpleOrder } from "./types"
import type { SellUpdateRequest } from "./sell"
import { createWethContract } from "./contracts/weth"

export type BidRequest = {
	makeAssetType: EthAssetType | Erc20AssetType
	amount: number
	takeAssetType: AssetTypeRequest
	convertNativeToken?: boolean
} & HasPrice & OrderRequest

export type BidOrderOrderStageId = "convert" | "approve" | "sign"
export type BidOrderAction = Action<BidOrderOrderStageId, BidRequest, Order>

export type BidUpdateRequest = HasOrder & HasPrice

export type BidUpdateOrderAction = Action<BidOrderOrderStageId, BidUpdateRequest, Order>

export class OrderBid {
	constructor(
		private ethereum: Maybe<Ethereum>,
		private readonly upserter: UpsertOrder,
		private readonly checkAssetType: (asset: AssetTypeRequest) => Promise<AssetTypeResponse>,
	) {
		this.getBidAction = this.getBidAction.bind(this)
	}

	getBidAction(request: BidRequest): BidOrderAction {
		const convertEthStage: Step<"convert", undefined, OrderForm> = {
			id: "convert" as const,
			run: async () => {

			},
		}

		const approveStage: Step<"approve", undefined, OrderForm> = {
			id: "approve" as const,
			run: async () => {
				if (request.makeAssetType.assetClass !== "ERC20") {
					throw new Error(`Make asset type should be ERC-20, received=${request.makeAssetType.assetClass}`)
				}
				const form = await this.getBidForm(request)
				const checked = await this.upserter.checkLazyOrder(form) as OrderForm
				await this.upserter.approve(checked, true)
				return checked
			},
		}
		const signStage: Step<"sign", OrderForm, Order> = {
			id: "sign" as const,
			run: (checked: OrderForm) => this.upserter.upsertRequest(checked),
		}

		let bid

		if (request.convertNativeToken) {
			bid = Action.create(convertEthStage)
				.thenStep(approveStage)
		} else {
			bid = Action.create(approveStage)
		}

		return bid.thenStep(signStage)
	}

	readonly update: BidUpdateOrderAction = Action
		.create({
			id: "approve" as const,
			run: async (request: BidUpdateRequest) => {
				const order = await this.upserter.getOrder(request)
				if (order.make.assetType.assetClass !== "ERC20") {
					throw new Error(`Make asset type should be ERC-20, received=${order.make.assetType.assetClass}`)
				}
				if (order.type === "CRYPTO_PUNK") {
					return request
				} else {
					const price = await this.upserter.getPrice(request, order.make.assetType)
					const form = await this.prepareOrderUpdateForm(order, price)
					const checked = await this.upserter.checkLazyOrder(form) as OrderForm
					await this.upserter.approve(checked, true)
					return checked
				}
			},
		})
		.thenStep({
			id: "sign" as const,
			run: (form: OrderForm | SellUpdateRequest) => {
				if ("type" in form && (form.type === "RARIBLE_V1" || form.type === "RARIBLE_V2")) {
					return this.upserter.upsertRequest(form)
				}
				return this.upserter.updateCryptoPunkOrder(form)
			},
		})

	private async getBidForm(request: BidRequest): Promise<RaribleV2OrderForm> {
		const form = await this.upserter.prepareOrderForm(request, false)
		const price = await this.upserter.getPrice(request, request.makeAssetType)
		return {
			...form,
			make: {
				assetType: request.makeAssetType,
				value: toBigNumber(toBn(price).multipliedBy(request.amount).toString()),
			},
			take: {
				assetType: await this.checkAssetType(request.takeAssetType),
				value: toBigNumber(request.amount.toString()),
			},
		}
	}

	async prepareOrderUpdateForm(order: SimpleOrder, price: BigNumberValue): Promise<OrderForm> {
		if (order.type === "RARIBLE_V1" || order.type === "RARIBLE_V2") {
			return this.upserter.getOrderFormFromOrder(order, {
				assetType: order.make.assetType,
				value: toBigNumber(toBn(price).multipliedBy(order.take.value).toString()),
			}, order.take)
		}
		throw new Error(`Unsupported order type: ${order.type}`)
	}

	convertEthToWeth() {
		createWethContract(this.ethereum)
	}
}
