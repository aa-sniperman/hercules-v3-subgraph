import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { assert, createMockedFunction, newMockEvent } from 'matchstick-as'

import { handlePoolCreated } from '../src/mappings/factory'
import { Pool as PoolEvent } from '../src/types/Factory/Factory'
import { Pool, Token } from '../src/types/schema'
import { ZERO_BD, ZERO_BI } from '../src/utils/constants'

export const NULL_ETH_HEX_STRING = '0x0000000000000000000000000000000000000000000000000000000000000001'

const USDC_MAINNET_ADDRESS = '0xEA32A96608495e54156Ae48931A7c20f0dcc1a21'
const WETH_MAINNET_ADDRESS = '0x420000000000000000000000000000000000000a'
const WMETIS_MAINNET_ADDRESS = '0x75cb093e4d61d2a2e65d8e0bbb01de8d89b53481'
export const USDC_WMETIS_03_MAINNET_POOL = '0xa4e4949e0cccd8282f30e7e113d8a551a1ed1aeb'
export const WETH_WMETIS_03_MAINNET_POOL = '0xbd718c67cd1e2f7fbe22d47be21036cd647c7714'
export const POOL_FEE_TIER_03 = 3000

export class TokenFixture {
  address: string
  symbol: string
  name: string
  totalSupply: string
  decimals: string
  balanceOf: string
}

export const USDC_MAINNET_FIXTURE: TokenFixture = {
  address: USDC_MAINNET_ADDRESS,
  symbol: 'm.USDC',
  name: 'USDC Tokens',
  totalSupply: '300',
  decimals: '6',
  balanceOf: '1000',
}

export const WETH_MAINNET_FIXTURE: TokenFixture = {
  address: WETH_MAINNET_ADDRESS,
  symbol: 'WETH',
  name: 'Ether',
  totalSupply: '100',
  decimals: '18',
  balanceOf: '500',
}

export const WMETIS_MAINNET_FIXTURE: TokenFixture = {
  address: WMETIS_MAINNET_ADDRESS,
  symbol: 'WMETIS',
  name: 'Wrapped METIS',
  totalSupply: '200',
  decimals: '18',
  balanceOf: '750',
}

export const getTokenFixture = (tokenAddress: string): TokenFixture => {
  if (tokenAddress == USDC_MAINNET_FIXTURE.address) {
    return USDC_MAINNET_FIXTURE
  } else if (tokenAddress == WETH_MAINNET_FIXTURE.address) {
    return WETH_MAINNET_FIXTURE
  } else if (tokenAddress == WMETIS_MAINNET_FIXTURE.address) {
    return WMETIS_MAINNET_FIXTURE
  } else {
    throw new Error('Token address not found in fixtures')
  }
}

export class PoolFixture {
  address: string
  token0: TokenFixture
  token1: TokenFixture
  feeTier: string
  tickSpacing: string
  liquidity: string
}

export const USDC_WMETIS_03_MAINNET_POOL_FIXTURE: PoolFixture = {
  address: USDC_WMETIS_03_MAINNET_POOL,
  token0: WMETIS_MAINNET_FIXTURE,
  token1: USDC_MAINNET_FIXTURE,
  feeTier: '3000',
  tickSpacing: '60',
  liquidity: '100',
}

export const WETH_WMETIS_03_MAINNET_POOL_FIXTURE: PoolFixture = {
  address: WETH_WMETIS_03_MAINNET_POOL,
  token0: WMETIS_MAINNET_FIXTURE,
  token1: WETH_MAINNET_FIXTURE,
  feeTier: '3000',
  tickSpacing: '60',
  liquidity: '200',
}

export const getPoolFixture = (poolAddress: string): PoolFixture => {
  if (poolAddress == USDC_WMETIS_03_MAINNET_POOL) {
    return USDC_WMETIS_03_MAINNET_POOL_FIXTURE
  } else if (poolAddress == WETH_WMETIS_03_MAINNET_POOL) {
    return WETH_WMETIS_03_MAINNET_POOL_FIXTURE
  } else {
    throw new Error('Pool address not found in fixtures')
  }
}

export const TEST_METIS_PRICE_USD = BigDecimal.fromString('40')
export const TEST_USDC_DERIVED_METIS = BigDecimal.fromString('1').div(BigDecimal.fromString('40'))
export const TEST_WMETIS_DERIVED_METIS = BigDecimal.fromString('1')

export const MOCK_EVENT = newMockEvent()

export const invokePoolCreatedWithMockedEthCalls = (mockEvent: ethereum.Event): void => {
  const pool = getPoolFixture(USDC_WMETIS_03_MAINNET_POOL)
  const feeTier = pool.feeTier
  const tickSpacing = pool.tickSpacing
  const token0 = getTokenFixture(pool.token0.address)
  const token1 = getTokenFixture(pool.token1.address)

  const token0Address = Address.fromString(token0.address)
  const token1Address = Address.fromString(token1.address)
  const poolAddress = Address.fromString(USDC_WMETIS_03_MAINNET_POOL)
  const parameters = [
    new ethereum.EventParam('token0', ethereum.Value.fromAddress(token0Address)),
    new ethereum.EventParam('token1', ethereum.Value.fromAddress(token1Address)),
    new ethereum.EventParam('fee', ethereum.Value.fromI32(parseInt(feeTier) as i32)),
    new ethereum.EventParam('tickSpacing', ethereum.Value.fromI32(parseInt(tickSpacing) as i32)),
    new ethereum.EventParam('pool', ethereum.Value.fromAddress(poolAddress)),
  ]
  const poolCreatedEvent = new PoolEvent(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    parameters,
    mockEvent.receipt,
  )
  // create mock contract calls for token0
  createMockedFunction(token0Address, 'symbol', 'symbol():(string)').returns([ethereum.Value.fromString(token0.symbol)])
  createMockedFunction(token0Address, 'name', 'name():(string)').returns([ethereum.Value.fromString(token0.name)])
  createMockedFunction(token0Address, 'totalSupply', 'totalSupply():(uint256)').returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(token0.totalSupply)),
  ])
  createMockedFunction(token0Address, 'decimals', 'decimals():(uint32)').returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(token0.decimals)),
  ])
  // create mock contract calls for token1
  createMockedFunction(token1Address, 'symbol', 'symbol():(string)').returns([ethereum.Value.fromString(token1.symbol)])
  createMockedFunction(token1Address, 'name', 'name():(string)').returns([ethereum.Value.fromString(token1.name)])
  createMockedFunction(token1Address, 'totalSupply', 'totalSupply():(uint256)').returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(token1.totalSupply)),
  ])
  createMockedFunction(token1Address, 'decimals', 'decimals():(uint32)').returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(token1.decimals)),
  ])
  handlePoolCreated(poolCreatedEvent)
}

// More lightweight than the method above which invokes handlePoolCreated. This
// method only creates the pool entity while the above method also creates the
// relevant token and factory entities.
export const createAndStoreTestPool = (poolFixture: PoolFixture): Pool => {
  const poolAddress = poolFixture.address
  const token0Address = poolFixture.token0.address
  const token1Address = poolFixture.token1.address
  const feeTier = parseInt(poolFixture.feeTier) as i32

  const pool = new Pool(poolAddress)
  pool.createdAtTimestamp = ZERO_BI
  pool.createdAtBlockNumber = ZERO_BI
  pool.token0 = token0Address
  pool.token1 = token1Address
  pool.fee = BigInt.fromI32(feeTier)
  pool.createdAtTimestamp = ZERO_BI
  pool.createdAtBlockNumber = ZERO_BI
  pool.liquidityProviderCount = ZERO_BI
  pool.tickSpacing = BigInt.fromI32(60)
  pool.tick = ZERO_BI
  pool.txCount = ZERO_BI
  pool.liquidity = ZERO_BI
  pool.sqrtPrice = ZERO_BI
  pool.feeGrowthGlobal0X128 = ZERO_BI
  pool.feeGrowthGlobal1X128 = ZERO_BI
  pool.communityFee = ZERO_BI
  pool.token0Price = ZERO_BD
  pool.token1Price = ZERO_BD
  pool.observationIndex = ZERO_BI
  pool.totalValueLockedToken0 = ZERO_BD
  pool.totalValueLockedToken1 = ZERO_BD
  pool.totalValueLockedUSD = ZERO_BD
  pool.totalValueLockedMetis = ZERO_BD
  pool.totalValueLockedUSDUntracked = ZERO_BD
  pool.volumeToken0 = ZERO_BD
  pool.volumeToken1 = ZERO_BD
  pool.volumeUSD = ZERO_BD
  pool.feesUSD = ZERO_BD
  pool.feesToken0 = ZERO_BD
  pool.feesToken1 = ZERO_BD
  pool.untrackedVolumeUSD = ZERO_BD
  pool.untrackedFeesUSD = ZERO_BD

  pool.collectedFeesToken0 = ZERO_BD
  pool.collectedFeesToken1 = ZERO_BD
  pool.collectedFeesUSD = ZERO_BD

  pool.save()
  return pool
}

export const createAndStoreTestToken = (tokenFixture: TokenFixture): Token => {
  const token = new Token(tokenFixture.address)
  token.symbol = tokenFixture.symbol
  token.name = tokenFixture.name
  token.decimals = BigInt.fromString(tokenFixture.decimals)
  token.totalSupply = BigInt.fromString(tokenFixture.totalSupply)
  token.volume = ZERO_BD
  token.volumeUSD = ZERO_BD
  token.untrackedVolumeUSD = ZERO_BD
  token.feesUSD = ZERO_BD
  token.txCount = ZERO_BI
  token.poolCount = ZERO_BI
  token.totalValueLocked = ZERO_BD
  token.totalValueLockedUSD = ZERO_BD
  token.totalValueLockedUSDUntracked = ZERO_BD
  token.derivedMetis = ZERO_BD
  token.whitelistPools = []

  token.save()
  return token
}

// Typescript for Subgraphs do not support Record types so we use a 2D string array to represent the object instead.
export const assertObjectMatches = (entityType: string, id: string, obj: string[][]): void => {
  for (let i = 0; i < obj.length; i++) {
    assert.fieldEquals(entityType, id, obj[i][0], obj[i][1])
  }
}
