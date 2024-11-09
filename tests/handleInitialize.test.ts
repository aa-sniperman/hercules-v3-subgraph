import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { assert, beforeEach, clearStore, describe, test } from 'matchstick-as'

import { handleInitialize } from '../src/mappings/core'
import { Bundle, Pool, Token } from '../src/types/schema'
import { Initialize } from '../src/types/templates/Pool/Pool'
import { safeDiv } from '../src/utils'
import { findNativePerToken, getNativePriceInUSD } from '../src/utils/pricing'
import {
  assertObjectMatches,
  createAndStoreTestPool,
  createAndStoreTestToken,
  MOCK_EVENT,
  TEST_METIS_PRICE_USD,
  USDC_MAINNET_FIXTURE,
  USDC_WMETIS_03_MAINNET_POOL,
  USDC_WMETIS_03_MAINNET_POOL_FIXTURE,
  WETH_MAINNET_FIXTURE,
  WETH_WMETIS_03_MAINNET_POOL,
  WETH_WMETIS_03_MAINNET_POOL_FIXTURE,
  WMETIS_MAINNET_FIXTURE,
} from './constants'

class InitializeFixture {
  price: BigInt
  tick: i32
}

const INITIALIZE_FIXTURE: InitializeFixture = {
  price: BigInt.fromString('1111111111111111'),
  tick: 194280,
}

const INITIALIZE_EVENT = new Initialize(
  Address.fromString(USDC_WMETIS_03_MAINNET_POOL),
  MOCK_EVENT.logIndex,
  MOCK_EVENT.transactionLogIndex,
  MOCK_EVENT.logType,
  MOCK_EVENT.block,
  MOCK_EVENT.transaction,
  [
    new ethereum.EventParam('price', ethereum.Value.fromUnsignedBigInt(INITIALIZE_FIXTURE.price)),
    new ethereum.EventParam('tick', ethereum.Value.fromI32(INITIALIZE_FIXTURE.tick)),
  ],
  MOCK_EVENT.receipt,
)

describe('handleInitialize', () => {
  test('success', () => {
    createAndStoreTestPool(USDC_WMETIS_03_MAINNET_POOL_FIXTURE)

    const token0 = createAndStoreTestToken(USDC_MAINNET_FIXTURE)
    const token1 = createAndStoreTestToken(WMETIS_MAINNET_FIXTURE)

    const bundle = new Bundle('1')
    bundle.metisPriceUSD = TEST_METIS_PRICE_USD
    bundle.save()

    handleInitialize(INITIALIZE_EVENT)

    assertObjectMatches('Pool', USDC_WMETIS_03_MAINNET_POOL, [
      ['price', INITIALIZE_FIXTURE.price.toString()],
      ['tick', INITIALIZE_FIXTURE.tick.toString()],
    ])

    const expectedEthPrice = getNativePriceInUSD()
    assertObjectMatches('Bundle', '1', [['ethPriceUSD', expectedEthPrice.toString()]])

    const expectedToken0Price = findNativePerToken(token0 as Token)
    assertObjectMatches('Token', USDC_MAINNET_FIXTURE.address, [['derivedMetis', expectedToken0Price.toString()]])

    const expectedToken1Price = findNativePerToken(token1 as Token)
    assertObjectMatches('Token', WMETIS_MAINNET_FIXTURE.address, [['derivedMetis', expectedToken1Price.toString()]])
  })
})

describe('getNativePriceInUSD', () => {
  beforeEach(() => {
    clearStore()
    createAndStoreTestPool(USDC_WMETIS_03_MAINNET_POOL_FIXTURE)
  })

  test('success - stablecoin is token1', () => {
    const pool = Pool.load(USDC_WMETIS_03_MAINNET_POOL)!
    pool.token1Price = BigDecimal.fromString('1')
    pool.save()

    const ethPriceUSD = getNativePriceInUSD()

    assert.assertTrue(ethPriceUSD == BigDecimal.fromString('1'))
  })
})

describe('findNativePerToken', () => {
  beforeEach(() => {
    clearStore()

    const bundle = new Bundle('1')
    bundle.metisPriceUSD = TEST_METIS_PRICE_USD
    bundle.save()
  })

  test('success - token is wrapped native', () => {
    const token = createAndStoreTestToken(WMETIS_MAINNET_FIXTURE)
    const ethPerToken = findNativePerToken(token as Token)
    assert.assertTrue(ethPerToken == BigDecimal.fromString('1'))
  })

  test('success - token is stablecoin', () => {
    const token = createAndStoreTestToken(USDC_MAINNET_FIXTURE)
    const ethPerToken = findNativePerToken(token as Token)
    const expectedStablecoinPrice = safeDiv(BigDecimal.fromString('1'), TEST_METIS_PRICE_USD)
    assert.assertTrue(ethPerToken == expectedStablecoinPrice)
  })

  test('success - token is not wrapped native or stablecoin', () => {
    const pool = createAndStoreTestPool(WETH_WMETIS_03_MAINNET_POOL_FIXTURE)

    pool.liquidity = BigInt.fromString('100')
    pool.totalValueLockedToken1 = BigDecimal.fromString('100')
    pool.token1Price = BigDecimal.fromString('5')
    pool.save()

    const token0 = createAndStoreTestToken(WETH_MAINNET_FIXTURE)
    token0.whitelistPools = [WETH_WMETIS_03_MAINNET_POOL]
    token0.save()

    const token1 = createAndStoreTestToken(WMETIS_MAINNET_FIXTURE)
    token1.derivedMetis = BigDecimal.fromString('10')
    token1.save()

    const metisPerToken = findNativePerToken(token0 as Token)

    assert.assertTrue(metisPerToken == BigDecimal.fromString('50'))
  })

  test('success - token is not wrapped native or stablecoin, but has no pools', () => {
    const token0 = createAndStoreTestToken(WETH_MAINNET_FIXTURE)
    const ethPerToken = findNativePerToken(token0 as Token)
    assert.assertTrue(ethPerToken == BigDecimal.fromString('0'))
  })

  test('success - token is not wrapped native or stablecoin, but has no pools with liquidity', () => {
    const token0 = createAndStoreTestToken(WETH_MAINNET_FIXTURE)
    token0.whitelistPools = [WETH_WMETIS_03_MAINNET_POOL]
    token0.save()

    const ethPerToken = findNativePerToken(token0 as Token)
    assert.assertTrue(ethPerToken == BigDecimal.fromString('0'))
  })
})
