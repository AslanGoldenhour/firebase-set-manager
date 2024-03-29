const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const { DateTime } = require("luxon");

function error(response, statusCode, message) {
    response.status(statusCode).send({
        "timestamp": DateTime.now(),
        "status": statusCode,
        "error": message
    });
    response.end();
}

/**
 * Authenticated Hello World test
 */
exports = module.exports = functions
    .runWith({
        // Ensure the function has enough memory and time to process
        timeoutSeconds: 120,
        memory: "1GB",
    })
    .https
    .onRequest(async (request, response) => {
        cors(request, response, async () => {
            try {
                // Force POST
                if (request.method !== "POST") return error(response, 400, 
                    "Request method must be POST.");
            
                // Handle Auth
                const { authorization }  = request.headers;
                if (!authorization) return error(response, 403, 
                    "Unauthorized. A key must be provided in the `authorization` header.");

                const config = functions.config();
                functions.logger.info(functions.config().auth.key);
                
                if (authorization !== config.auth.key) return error(response, 403, 
                    "Unauthorized. The API key provided is invalid.");
                
                // Authorized!
                response.status(200).send({ message: 'Authorized!' });

                // Termininate the function
                response.end();
            } catch (err) {
                functions.logger.error(err, { structuredData: true });
                return error(response, 400, err.message);
            }
        })
    });