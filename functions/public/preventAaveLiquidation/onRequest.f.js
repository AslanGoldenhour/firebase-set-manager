const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const helpers = require('../../libs/helpers');
const aave = require('../../libs/aave');

/**
 * Authenticated Hello World test
 */
exports = module.exports = functions
    .runWith({
        // Ensure the function has enough memory and time to process
        timeoutSeconds: 400,
        memory: "2GB",
        secrets: [
            "API_KEY", 
            "MNEMONIC", 
            "PROVIDER",
            "POOL_ADDRESS",
            "COIN_MARKET_CAP_API_KEY",
            "ZAPPER_API_KEY",
        ],
    })
    .https
    .onRequest(async (request, response) => {
        cors(request, response, async () => {
            try {
                // Force POST
                if (request.method !== "POST") return helpers.error(response, 400, 
                    "Request method must be POST.");
            
                // Handle Auth
                const { authorization }  = request.headers;
                if (!authorization) return helpers.error(response, 403, 
                    "Unauthorized. A key must be provided in the `authorization` header.");
                
                if (authorization !== process.env.API_KEY) return helpers.error(response, 403, 
                    "Unauthorized. The API key provided is invalid.");
                
                // Authorized!

                // await btcSuperYield.long();
                await aave.rebalanceDebt();

                // Respond
                response.status(200).send({ message: 'Success'});

                // Termininate the function
                return response.end();
            } catch (err) {
                functions.logger.error(err, { structuredData: true });
                return helpers.error(response, 400, err.message);
            }
        })
    });