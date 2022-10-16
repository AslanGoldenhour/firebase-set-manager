const { Dhedge, Dapp, Network, ethers } = require("@dhedge/v2-sdk");
const helpers = require('./helpers');
const coinmarketcap = require('./coinmarketcap');
const zapper = require("./zapper");
const _this = this;

exports.tokens = {
    polygon: {
        USDC: {
            address:  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            coinMarketCapId: 3408,
        },
        WBTC: {
            address:  '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            decimals: 8,
            coinMarketCapId: 1,
        },
        WETH: {
            address:  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            decimals: 18,
            coinMarketCapId: 1027,
        },
        MATIC: {
            address:  '0x0000000000000000000000000000000000001010',
            decimals: 18,
            coinMarketCapId: 3890,
        },
        AAVEV2: {
            address:  '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf',
            decimals: null,
            coinMarketCapId: null,
        },
    }
};

 exports.gasInfo = {
    gasPrice: ethers.utils.parseUnits('500', 'gwei'),
    gasLimit: 10000000
};

/**
 * Initial dHedge Pool
 * 
 * @param {String} mnemonic The mnemonic for the pool trader's wallet.
 * @param {String} poolAddress The address of a dhedge pool contract.
 * @param {String} network The blockchain network for this pool contract.
 * @returns {Object} a dhedge pool.
 */
 exports.initPool = async (mnemonic, poolAddress, network = Network.POLYGON) => {
    // Initialize our wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);
    const wallet = new ethers.Wallet.fromMnemonic(mnemonic);
    const walletWithProvider = wallet.connect(provider);
    
    // Initialize dHedge v2 API
    const dhedge = new Dhedge(walletWithProvider, network);
    return await dhedge.loadPool(poolAddress);
}



// /**
//  * Address to Token Symbol
//  * 
//  * @param {String} address a token contract address
//  * @param {String} network a blockchain network
//  * @returns {String} a token symbol
//  */
// exports.addressToSymbol = (address, network = 'polygon') => {
//     const tokens = _this.tokens[network];
//     for (const token in tokens) {
//         if (tokens[token].address.toLowerCase() === address.toLowerCase()) {
//             return token;
//         }
//     }
//     return null;
// }

exports.symbolToAddress = (symbol, network = 'polygon') => {
    const tokens = _this.tokens[network];
    for (const token in tokens) {
        if (token.toUpperCase() === symbol.toUpperCase()) {
            return tokens[token].address;
        }
    }
    return null;
}

/**
 * Token Address to Token Details
 * 
 * @param {String} address a token contract address
 * @param {String} network a blockchain network
 * @returns {Object} a list of useful information about a token
 */
exports.addressToTokenDetails = async (address, network = 'polygon') => {
    const tokens = _this.tokens[network];
    for (const token in tokens) {
        if (tokens[token].address.toLowerCase() === address.toLowerCase()) {
            // Get usd price from coin market cap
            const usdPrice = await coinmarketcap.getUsdPrice(tokens[token].coinMarketCapId);

            // Transform into object
            return {
                symbol: token,
                address: address.toLowerCase(),
                decimals: tokens[token].decimals,
                usdPrice: usdPrice,
            };
        }
    }
    return null;
}

/**
 * Update Token Balance in Array of Tokens 
 * 
 * @param {Array} tokens A list of tokens
 * @param {String} address A hex address for a token
 * @param {Number} integerChange Amount to change the token balance
 * @param {String} network The network to use to lookup the token address, if needed
 * @returns {Array} The updated list of tokens
 */
 exports.updateTokenBalance = async (tokens, address, integerChange, network = 'polygon') => {
    let newArray = [];
    let foundIt = false;

    for (const token of tokens) {
        if (token.address === address) {
            foundIt = true;
            const newBn = ethers.BigNumber.from(token.balanceInt + integerChange);
            const newBalances = _this.getBalanceInfo(newBn, token.decimals, token.usdPrice);
            newArray.push(Object.assign({}, token, newBalances));
        } else {
            newArray.push(token);
        }
    }

    if (foundIt === false) {
        // The token is new
        const tokenDetails = await _this.addressToTokenDetails(address, network);
        const tokenBalance = _this.getBalanceInfo(
            ethers.BigNumber.from(integerChange), 
            tokenDetails.decimals,
            tokenDetails.usdPrice
        );
        newArray.push(Object.assign(tokenDetails, tokenBalance));
    }

    return newArray;
}



/**
 * 
 * @param {Pool} pool a dHedge Pool object
 * @returns {Array} A list of assets approved for trading
 */
exports.getComposition = async (pool) => {
    return await pool.getComposition();
};

/**
 * Get Pool Balances
 * 
 * @param {Pool} pool a dHedge Pool object
 * @returns {Array} A list of tokens with info and balances
 */
exports.getPoolBalances = async (pool) => {

    helpers.log(pool.address);

    const composition = await _this.getComposition(pool);
    const network = pool.network;
    let assets = [];
    for (const asset of composition) {
        const tokenDetails = await _this.addressToTokenDetails(asset.asset, network);
        const tokenBalance = _this.getBalanceInfo(
            ethers.BigNumber.from(asset.balance), 
            tokenDetails.decimals,
            tokenDetails.usdPrice
        );
        assets.push(Object.assign(tokenDetails, tokenBalance));
    }
    return assets;
}

// /**
//  * Get Balance of a Token
//  * 
//  * @param {Array} assets An array returned from pool.getComposition()
//  * @param {String} token A token's contract address
//  * @returns {BigNumber} A token balance in hexidecimal format
//  */
// exports.getBalance = (assets, token) => {
//     for (const asset of assets) {
//         if (asset.asset.toLowerCase() === token.toLowerCase()) {
//             return ethers.BigNumber.from(asset.balance);
//         }
//     }

//     throw new Error('Could not find the specified asset (' + token + ') in the pool.');
// }

/**
 * Get Balance Info for a Token
 * 
 * @param {BigNumber} amountBN Amount in ethers.BigNumber format
 * @param {Integer} decimals Number of decimal places to consider
 * @param {Float} tokenPriceUsd The USD price of a token to convert the big number
 * @returns {Object} A list of balances in different formats
 */
exports.getBalanceInfo = (amountBN, decimals, tokenPriceUsd) => {
    const balanceDecimal = ethers.utils.formatUnits(amountBN, decimals);
    const balanceInt = _this.decimalToInteger(balanceDecimal, decimals);
    const balanceUsd = tokenPriceUsd * balanceDecimal;
    return {
        balanceBn: amountBN,
        balanceDecimal: balanceDecimal,
        balanceInt: balanceInt,
        balanceUsd: balanceUsd
    }
}



/**
 * Decial to Integer
 * 
 * @param {Float} amount Some decimal amount
 * @param {Integer} decimals Number of decimal places
 * @returns {Integer} The value without decimals
 */
exports.decimalToInteger = (amount, decimals) => {
    const response = Math.round(amount*('1e' + decimals));
    return isFinite(response) ? response : null;
}

exports.tradeUniswap = async (
        pool,
        from, 
        to, 
        amountOfFromToken, 
        slippageTolerance = 0.5,
        feeTier = 500
    ) => {
        helpers.log('SWAP WITH UNISWAP V3');
        helpers.delay();

        const tx = await pool.tradeUniswapV3(
            from,
            to,
            amountOfFromToken,
            feeTier,
            slippageTolerance,
            _this.gasInfo
        );
        helpers.log(tx);
        return tx;
}

exports.trade = async (from, to, amount, dapp = 'SUSHISWAP') => {
    let router;
    switch (dapp) {
      case 'TOROS':
        router = Dapp.TOROS;
        break;
      default:
        router = Dapp.SUSHISWAP;
    }
    
    const pool = await _this.initPool();
    const slippageTolerance = 0.5;
    const tx = await pool.trade(
        router,
        from,
        to,
        amount,
        slippageTolerance,
        _this.gasInfo
    );

    helpers.delay();
    return tx;
}

exports.lendDeposit = async (pool, token, amount) => {
    helpers.log('LEND DEPOSIT TO AAVE V2');
    helpers.delay();

    const tx = await pool.lend(
        Dapp.AAVE, 
        token, 
        amount,
        0,
        _this.gasInfo
    );
    helpers.log(tx);
    return tx;
}

exports.withdrawLentTokens = async (pool, token, amount) => {
    helpers.log('WITHDRAW LENT TOKENS FROM AAVE V2');
    helpers.delay();

    const tx = await pool.withdrawDeposit(
        Dapp.AAVE, 
        token, 
        amount,
        _this.gasInfo
    );
    helpers.log(tx);
    return tx;
}

exports.borrowDebt = async (pool, token, amount) => {
    helpers.log('BORROW TOKENS FROM AAVE V2');
    helpers.delay();

    const tx = await pool.borrow(
        Dapp.AAVE, 
        token, 
        amount,
        0,
        _this.gasInfo
    );

    helpers.log(tx);
    return tx;
}

exports.repayDebt = async (pool, token, amount) => {
    helpers.log('REPAY DEBT ON AAVE V2');
    helpers.delay();

    const tx = await pool.repay(
        Dapp.AAVE, 
        token, 
        amount,
        _this.gasInfo
    );
    helpers.log(tx);
    return tx;
}

/**
 * Approve All Spending Once
 * 
 * This method approves the spending of every approved token in the pool
 * on AAVE v2, Uniswap v3, etc.
 * 
 * @param {Pool} pool dHedge Pool object
 * @param {Array} dapps A list of dapps to approve
 * @returns {Boolean} Boolean true if successful.
 */
exports.approveAllSpendingOnce = async (pool, dapps) => {
    const assets = await pool.getComposition();
    let dappsToApprove = dapps;
    if (dappsToApprove === undefined) {
        dappsToApprove = [
            Dapp.AAVE,
            Dapp.UNISWAPV3,
            // Dapp.AAVEV3,
            // Dapp.SUSHISWAP,
            // Dapp.TOROS,
        ];
    }

    for (const asset of assets) {
        for (const dapp of dappsToApprove) {
            helpers.log('Approving spending of ' + asset.asset + ' on ' + dapp);

            const tx = await pool.approve(
                dapp,
                asset.asset,
                ethers.constants.MaxInt256,
                _this.gasInfo
            );
            helpers.log(tx);
        }
    }

    return true;
}
