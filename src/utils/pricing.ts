/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { exponentToBigDecimal, safeDiv } from '../utils/index'
import { Bundle, Pool, Token } from './../types/schema'
import { ONE_BD, ZERO_BD, ZERO_BI } from './constants'

const WMETIS_ADDRESS = '0x75cb093e4d61d2a2e65d8e0bbb01de8d89b53481'
const USDC_WMETIS_03_POOL = '0xa4e4949e0cccd8282f30e7e113d8a551a1ed1aeb'

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export let WHITELIST_TOKENS: string[] = [
  '0x420000000000000000000000000000000000000a', // WETH
  '0x75cb093e4d61d2a2e65d8e0bbb01de8d89b53481', // WMETIS
  '0xea32a96608495e54156ae48931a7c20f0dcc1a21', // USDC
  '0xbb06dca3ae6887fabf931640f67cab3e3a16f4dc', // USDT
]

let MINIMUM_METIS_LOCKED = BigDecimal.fromString('0')

let Q192 = Math.pow(2, 192)

let STABLE_COINS: string[] = [
  '0xea32a96608495e54156ae48931a7c20f0dcc1a21', // USDC
  '0xbb06dca3ae6887fabf931640f67cab3e3a16f4dc', // USDT
]

export function priceToTokenPrices(price: BigInt, token0: Token, token1: Token): BigDecimal[] {
  let num = price.times(price).toBigDecimal()
  let denom = BigDecimal.fromString(Q192.toString())
  let price1 = num.div(denom).times(exponentToBigDecimal(token0.decimals)).div(exponentToBigDecimal(token1.decimals))

  let price0 = safeDiv(BigDecimal.fromString('1'), price1)
  return [price0, price1]
}

export function getNativePriceInUSD(): BigDecimal {
  let usdcPool = Pool.load(USDC_WMETIS_03_POOL) // usdc is token1
  if (usdcPool !== null) {
    return usdcPool.token1Price
  } else {
    return ZERO_BD
  }
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived Matic (add stablecoin estimates)
 **/
export function findNativePerToken(token: Token): BigDecimal {
  if (token.id == WMETIS_ADDRESS) {
    return ONE_BD
  }
  let whiteList = token.whitelistPools
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityMetis = ZERO_BD
  let priceSoFar = ZERO_BD
  let bundle = Bundle.load('1')

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (STABLE_COINS.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle!.metisPriceUSD)
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      let poolAddress = whiteList[i]
      let pool = Pool.load(poolAddress)!
      if (pool.liquidity.gt(ZERO_BI)) {
        if (pool.token0 == token.id) {
          // whitelist token is token1
          let token1 = Token.load(pool.token1)!
          // get the derived Matic in pool
          let metisLocked = pool.totalValueLockedToken1.times(token1.derivedMetis)
          if (metisLocked.gt(largestLiquidityMetis) && metisLocked.gt(MINIMUM_METIS_LOCKED)) {
            largestLiquidityMetis = metisLocked
            // token1 per our token * Eth per token1
            priceSoFar = pool.token1Price.times(token1.derivedMetis as BigDecimal)
          }
        }
        if (pool.token1 == token.id) {
          let token0 = Token.load(pool.token0)!
          // get the derived Matic in pool
          let metisLocked = pool.totalValueLockedToken0.times(token0.derivedMetis)
          if (metisLocked.gt(largestLiquidityMetis) && metisLocked.gt(MINIMUM_METIS_LOCKED)) {
            largestLiquidityMetis = metisLocked
            // token0 per our token * Matic per token0
            priceSoFar = pool.token0Price.times(token0.derivedMetis as BigDecimal)
          }
        }
      }
    }
  }
  return priceSoFar // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
): BigDecimal {
  let bundle = Bundle.load('1')!
  let price0USD = token0.derivedMetis.times(bundle.metisPriceUSD)
  let price1USD = token1.derivedMetis.times(bundle.metisPriceUSD)

  // both are whitelist tokens, return sum of both amounts
  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD
}
