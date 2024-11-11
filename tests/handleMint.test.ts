import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { beforeAll, describe, test } from 'matchstick-as'

import { handleMint } from '../src/mappings/core'
import { Bundle, Pool, Token } from '../src/types/schema'
import { Mint } from '../src/types/templates/Pool/Pool'
import { convertTokenToDecimal, fastExponentiation, safeDiv } from '../src/utils'
import { FACTORY_ADDRESS, ONE_BD } from '../src/utils/constants'
import { hexToInt24 } from '../src/utils/tick'
import {
  assertObjectMatches,
  invokePoolCreatedWithMockedEthCalls,
  MOCK_EVENT,
  TEST_METIS_PRICE_USD,
  TEST_USDC_DERIVED_METIS,
  TEST_WMETIS_DERIVED_METIS,
  USDC_MAINNET_FIXTURE,
  USDC_WMETIS_03_MAINNET_POOL,
  WMETIS_MAINNET_FIXTURE,
} from './constants'

class MintFixture {
  sender: Address
  owner: Address
  tickLower: i32
  tickUpper: i32
  amount: BigInt
  amount0: BigInt
  amount1: BigInt
}

// https://explorer.metis.io/tx/0xb6fce507d7d8dbb29742cd09e74d45b7834e17997c54c1232124acc57e390cca
const MINT_FIXTURE: MintFixture = {
  sender: Address.fromString('0x15030b11560F1615a3C07430cd1b130e0FD991f9'),
  owner: Address.fromString('0x3c93aef118f8c2183b32dca29aa6220f2b2a1593'),
  tickLower: hexToInt24('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffff2764c'),
  tickUpper: hexToInt24('0x00000000000000000000000000000000000000000000000000000000000d89b4'),
  amount: BigInt.fromString('25884214074323'),
  amount0: BigInt.fromString('6699925382453724202'),
  amount1: BigInt.fromString('100000000'),
}

const MINT_EVENT = new Mint(
  Address.fromString(USDC_WMETIS_03_MAINNET_POOL),
  MOCK_EVENT.logIndex,
  MOCK_EVENT.transactionLogIndex,
  MOCK_EVENT.logType,
  MOCK_EVENT.block,
  MOCK_EVENT.transaction,
  [
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(MINT_FIXTURE.sender)),
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(MINT_FIXTURE.owner)),
    new ethereum.EventParam('bottomTick', ethereum.Value.fromI32(MINT_FIXTURE.tickLower)),
    new ethereum.EventParam('topTick', ethereum.Value.fromI32(MINT_FIXTURE.tickUpper)),
    new ethereum.EventParam('liquidityAmount', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount)),
    new ethereum.EventParam('amount0', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount0)),
    new ethereum.EventParam('amount1', ethereum.Value.fromUnsignedBigInt(MINT_FIXTURE.amount1)),
  ],
  MOCK_EVENT.receipt,
)

describe('handleMint', () => {
  beforeAll(() => {
    invokePoolCreatedWithMockedEthCalls(MOCK_EVENT)

    const bundle = new Bundle('1')
    bundle.metisPriceUSD = TEST_METIS_PRICE_USD
    bundle.save()

    const usdcEntity = Token.load(USDC_MAINNET_FIXTURE.address)!
    usdcEntity.derivedMetis = TEST_USDC_DERIVED_METIS
    usdcEntity.save()

    const metisEntity = Token.load(WMETIS_MAINNET_FIXTURE.address)!
    metisEntity.derivedMetis = TEST_WMETIS_DERIVED_METIS
    metisEntity.save()
  })

  test('success - mint event, pool tick is between tickUpper and tickLower', () => {
    // put the pools tick in range
    const pool = Pool.load(USDC_WMETIS_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(MINT_FIXTURE.tickLower + MINT_FIXTURE.tickUpper).div(BigInt.fromI32(2))
    pool.save()

    handleMint(MINT_EVENT)

    const amountToken0 = convertTokenToDecimal(MINT_FIXTURE.amount0, BigInt.fromString(WMETIS_MAINNET_FIXTURE.decimals))
    const amountToken1 = convertTokenToDecimal(MINT_FIXTURE.amount1, BigInt.fromString(USDC_MAINNET_FIXTURE.decimals))
    const poolTotalValueLockedMetis = amountToken0
      .times(TEST_WMETIS_DERIVED_METIS)
      .plus(amountToken1.times(TEST_USDC_DERIVED_METIS))
    const poolTotalValueLockedUSD = poolTotalValueLockedMetis.times(TEST_METIS_PRICE_USD)

    assertObjectMatches('Factory', FACTORY_ADDRESS, [
      ['txCount', '1'],
      ['totalValueLockedMetis', poolTotalValueLockedMetis.toString()],
      ['totalValueLockedUSD', poolTotalValueLockedUSD.toString()],
    ])

    assertObjectMatches('Pool', USDC_WMETIS_03_MAINNET_POOL, [
      ['txCount', '1'],
      ['liquidity', MINT_FIXTURE.amount.toString()],
      ['totalValueLockedToken0', amountToken0.toString()],
      ['totalValueLockedToken1', amountToken1.toString()],
      ['totalValueLockedMetis', poolTotalValueLockedMetis.toString()],
      ['totalValueLockedUSD', poolTotalValueLockedUSD.toString()],
    ])

    assertObjectMatches('Token', USDC_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', amountToken1.toString()],
      ['totalValueLockedUSD', amountToken1.times(TEST_USDC_DERIVED_METIS.times(TEST_METIS_PRICE_USD)).toString()],
    ])

    assertObjectMatches('Token', WMETIS_MAINNET_FIXTURE.address, [
      ['txCount', '1'],
      ['totalValueLocked', amountToken0.toString()],
      ['totalValueLockedUSD', amountToken0.times(TEST_WMETIS_DERIVED_METIS.times(TEST_METIS_PRICE_USD)).toString()],
    ])

    assertObjectMatches('Mint', MOCK_EVENT.transaction.hash.toHexString() + '-' + MOCK_EVENT.logIndex.toString(), [
      ['transaction', MOCK_EVENT.transaction.hash.toHexString()],
      ['timestamp', MOCK_EVENT.block.timestamp.toString()],
      ['pool', USDC_WMETIS_03_MAINNET_POOL],
      ['token0', WMETIS_MAINNET_FIXTURE.address],
      ['token1', USDC_MAINNET_FIXTURE.address],
      ['owner', MINT_FIXTURE.owner.toHexString()],
      ['sender', MINT_FIXTURE.sender.toHexString()],
      ['origin', MOCK_EVENT.transaction.from.toHexString()],
      ['amount', MINT_FIXTURE.amount.toString()],
      ['amount0', amountToken0.toString()],
      ['amount1', amountToken1.toString()],
      ['amountUSD', poolTotalValueLockedUSD.toString()],
      ['tickUpper', MINT_FIXTURE.tickUpper.toString()],
      ['tickLower', MINT_FIXTURE.tickLower.toString()],
      ['logIndex', MOCK_EVENT.logIndex.toString()],
    ])

    const lowerTickPrice = fastExponentiation(BigDecimal.fromString('1.0001'), MINT_FIXTURE.tickLower)
    assertObjectMatches('Tick', USDC_WMETIS_03_MAINNET_POOL + '#' + MINT_FIXTURE.tickLower.toString(), [
      ['tickIdx', MINT_FIXTURE.tickLower.toString()],
      ['pool', USDC_WMETIS_03_MAINNET_POOL],
      ['poolAddress', USDC_WMETIS_03_MAINNET_POOL],
      ['createdAtTimestamp', MOCK_EVENT.block.timestamp.toString()],
      ['createdAtBlockNumber', MOCK_EVENT.block.number.toString()],
      ['liquidityGross', MINT_FIXTURE.amount.toString()],
      ['liquidityNet', MINT_FIXTURE.amount.toString()],
      ['price0', lowerTickPrice.toString()],
      ['price1', safeDiv(ONE_BD, lowerTickPrice).toString()],
    ])

    const upperTickPrice = fastExponentiation(BigDecimal.fromString('1.0001'), MINT_FIXTURE.tickUpper)
    assertObjectMatches('Tick', USDC_WMETIS_03_MAINNET_POOL + '#' + MINT_FIXTURE.tickUpper.toString(), [
      ['tickIdx', MINT_FIXTURE.tickUpper.toString()],
      ['pool', USDC_WMETIS_03_MAINNET_POOL],
      ['poolAddress', USDC_WMETIS_03_MAINNET_POOL],
      ['createdAtTimestamp', MOCK_EVENT.block.timestamp.toString()],
      ['createdAtBlockNumber', MOCK_EVENT.block.number.toString()],
      ['liquidityGross', MINT_FIXTURE.amount.toString()],
      ['liquidityNet', MINT_FIXTURE.amount.neg().toString()],
      ['price0', upperTickPrice.toString()],
      ['price1', safeDiv(ONE_BD, upperTickPrice).toString()],
    ])
  })

  test('success - mint event, pool tick is not between tickUpper and tickLower', () => {
    // put the pools tick out of range
    const pool = Pool.load(USDC_WMETIS_03_MAINNET_POOL)!
    pool.tick = BigInt.fromI32(MINT_FIXTURE.tickLower - 1)
    const liquidityBeforeMint = pool.liquidity
    pool.save()

    handleMint(MINT_EVENT)

    // liquidity should not be updated
    assertObjectMatches('Pool', USDC_WMETIS_03_MAINNET_POOL, [['liquidity', liquidityBeforeMint.toString()]])
  })
})
