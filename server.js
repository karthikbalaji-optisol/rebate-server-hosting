const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const cors = require('cors');

const corsOptions = {
    origin: '*', // or specify your SDK domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false, // set to true only if you use cookies or auth headers with credentials
    optionsSuccessStatus: 200
  };
const app = express();
app.use(cors(corsOptions));
  
// Explicitly handle preflight
app.options('*', cors(corsOptions));
const PORT = process.env.PORT || 8082;

// Configuration
const CONFIG = {
    SOAP_SERVICE_URL: 'https://q-app02.nam.wirecard.sys:9313/accountmanagementapiws/services/AccountManagementApiWebServices',
    AUTH_URL: 'https://apiauth-qa.swiftprepaid.com/connect/token',
    CLIENT_ID: 'd55f0027-52de-447e-acf5-1075eea7698a',
    CLIENT_SECRET: '47f48071fed08636f3c172a802cec7c3a0759bfaaaa0433568e96a1a118c4711',
    CARD_API_BASE: 'https://api-qa.onbe.io/managepayments/v1/accounts',
    BALANCE_SERVICE_URL: 'https://qa.nam.wirecard.sys:8084/service',
    TIMEOUT: 30000
};

// Middleware
app.use(express.json({ limit: '10mb' }));

// HTTPS Agent
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

// Axios clients
const soapClient = axios.create({
    httpsAgent,
    timeout: CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '""'
    }
});

const apiClient = axios.create({
    httpsAgent,
    timeout: CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Token cache
class TokenCache {
    constructor() {
        this.cache = new Map();
    }

    set(key, value, ttl = 3300000) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { value, expiry });
        setTimeout(() => this.cache.delete(key), ttl);
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item || Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
}

const tokenCache = new TokenCache();

// XML Parser
const xmlParser = new xml2js.Parser({ 
    explicitArray: false, 
    ignoreAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix]
});

// Utility logger
const logger = {
    info: (message, data = '') => console.log(`[INFO] ${message}`, data),
    error: (message, error = '') => console.error(`[ERROR] ${message}`, error)
};

// Helper Functions
async function getAccessToken() {
    const cachedToken = tokenCache.get('access_token');
    if (cachedToken) return cachedToken;

    try {
        const response = await axios.post(CONFIG.AUTH_URL, 
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CONFIG.CLIENT_ID,
                client_secret: CONFIG.CLIENT_SECRET
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            }
        );
        
        const token = response.data.access_token;
        const expiresIn = (response.data.expires_in || 3600) * 1000;
        tokenCache.set('access_token', token, expiresIn * 0.9);
        
        return token;
    } catch (error) {
        logger.error('Authentication failed:', error.message);
        throw new Error('Authentication failed');
    }
}

function buildSoapXml(requestData) {
    const transactionId = uuidv4();
    
    const mapKeyValues = (items) => items?.map(item => 
        `<ws:item><com:key>${item.key || ''}</com:key><com:value>${item.value || ''}</com:value></ws:item>`
    ).join('') || '';

    const reg = requestData.registration || {};
    const load = requestData.load || {};
    const addenda = reg.addenda || {};

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.accountmanagementapi.prepaid.citi.com" xmlns:req="http://request.accountmanagementapi.prepaid.citi.com" xmlns:com="http://common.accountmanagementapi.prepaid.citi.com" xmlns:dom="http://domain.accountmanagementapi.prepaid.citi.com">
    <soapenv:Header/>
    <soapenv:Body>
        <ws:createAccountRequest>
            <req:keyValue>${mapKeyValues(requestData.keyValue)}</req:keyValue>
            <req:partner_user_id>${requestData.partner_user_id || ''}</req:partner_user_id>
            <req:program_id>${requestData.program_id || ''}</req:program_id>
            <req:promotion_id>${requestData.promotion_id || '0'}</req:promotion_id>
            <req:transaction_id>${transactionId}</req:transaction_id>
            <req:accessLevel>${requestData.accessLevel || 1}</req:accessLevel>
            <req:accountPersonalized>${requestData.accountPersonalized || 'TRUE'}</req:accountPersonalized>
            <req:card>
                <dom:cardAccessLevel>${requestData.card?.cardAccessLevel || 1}</dom:cardAccessLevel>
            </req:card>
            <req:load>
                <dom:amount>${load.amount || 1}</dom:amount>
                <dom:comment>${load.comment || ''}</dom:comment>
                <dom:keyValue>${mapKeyValues(load.keyValue)}</dom:keyValue>
                <dom:claimable>${load.claimable !== undefined ? load.claimable : 1}</dom:claimable>
                <dom:notificationIndicator>${load.notificationIndicator !== undefined ? load.notificationIndicator : 0}</dom:notificationIndicator>
                <dom:templateId>${load.templateId || ''}</dom:templateId>
            </req:load>
            <req:registation>
                <dom:addenda>
                    <dom:reference_1>${addenda.reference_1 || ''}</dom:reference_1>
                    <dom:reference_2>${addenda.reference_2 || ''}</dom:reference_2>
                    <dom:reference_3>${addenda.reference_3 || ''}</dom:reference_3>
                    <dom:reference_4>${addenda.reference_4 || ''}</dom:reference_4>
                </dom:addenda>
                <dom:address1>${reg.address1 || ''}</dom:address1>
                <dom:address2>${reg.address2 || ''}</dom:address2>
                <dom:address3>${reg.address3 || ''}</dom:address3>
                <dom:address4>${reg.address4 || ''}</dom:address4>
                <dom:businessEmail>${reg.businessEmail || ''}</dom:businessEmail>
                <dom:businessPhone>${reg.businessPhone || ''}</dom:businessPhone>
                <dom:city>${reg.city || ''}</dom:city>
                <dom:country>${reg.country || 'US'}</dom:country>
                <dom:date_of_birth>${reg.date_of_birth || ''}</dom:date_of_birth>
                <dom:emailAddress>${reg.emailAddress || ''}</dom:emailAddress>
                <dom:firstName>${reg.firstName || ''}</dom:firstName>
                <dom:homeEmail>${reg.homeEmail || reg.emailAddress || ''}</dom:homeEmail>
                <dom:homePhone>${reg.homePhone || ''}</dom:homePhone>
                <dom:keyValue>${mapKeyValues(reg.keyValue)}</dom:keyValue>
                <dom:lastName>${reg.lastName || ''}</dom:lastName>
                <dom:middleName>${reg.middleName || ''}</dom:middleName>
                <dom:mobileEmail>${reg.mobileEmail || ''}</dom:mobileEmail>
                <dom:mobilePhone>${reg.mobilePhone || ''}</dom:mobilePhone>
                <dom:phone>${reg.phone || ''}</dom:phone>
                <dom:postal>${reg.postal || ''}</dom:postal>
                <dom:ssn>${reg.ssn || ''}</dom:ssn>
                <dom:state>${reg.state || ''}</dom:state>
                <dom:suffixName>${reg.suffixName || ''}</dom:suffixName>
                <dom:notificationIndicator>${reg.notificationIndicator !== undefined ? reg.notificationIndicator : 0}</dom:notificationIndicator>
            </req:registation>
        </ws:createAccountRequest>
    </soapenv:Body>
</soapenv:Envelope>`;
}

async function parseSoapResponse(xmlResponse) {
    try {
        const result = await xmlParser.parseStringPromise(xmlResponse);
        const createAccountReturn = result.Envelope.Body.createAccountReturn;
        
        const processStatus = {};
        const items = createAccountReturn.keyValue?.item;
        
        if (items) {
            const itemArray = Array.isArray(items) ? items : [items];
            itemArray.forEach(item => {
                if (item.key && item.value) {
                    processStatus[item.key] = item.value;
                }
            });
        }

        return {
            success: createAccountReturn.code === '0' || createAccountReturn.code === 0,
            code: parseInt(createAccountReturn.code) || 0,
            description: createAccountReturn.description || '',
            sub_code: createAccountReturn.sub_code || '',
            existingTransaction: createAccountReturn.existingTransaction === 'true',
            data: {
                accountNumber: createAccountReturn.accountNumber || null,
                partner_user_id: createAccountReturn.partner_user_id || null,
                claimCode: createAccountReturn.claimCode || null,
                cardNumber: createAccountReturn.cardNumber || null,
                cardExpiryDateMMYY: createAccountReturn.cardExpiryDateMMYY || null,
                panSeqNum: createAccountReturn.panSeqNum || null
            },
            processStatus,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(`Failed to parse SOAP response: ${error.message}`);
    }
}

async function getBalanceDetails(dda) {
    try {
        const response = await apiClient.post(
            `${CONFIG.BALANCE_SERVICE_URL}/member/inquiry`, 
            { ddaNumber: dda }
        );
        return response.data;
    } catch (error) {
        logger.error('Error fetching balance details:', error.message);
        return null;
    }
}

async function getDeviceDetails(deviceId) {
    try {
        const response = await apiClient.get(
            `${CONFIG.BALANCE_SERVICE_URL}/device/${deviceId}`
        );
        return response.data;
    } catch (error) {
        logger.error('Error fetching device details:', error.message);
        return null;
    }
}

// NEW FUNCTION: Get complete account details including balance and device info
// Update the getCompleteAccountDetails function to include programId
async function getCompleteAccountDetails(accountNumber, partnerUserId, programId) {
    try {
        // Step 1: Get balance details using accountNumber as DDA
        logger.info('Fetching balance details for account:', accountNumber);
        const balanceDetails = await getBalanceDetails(accountNumber);

        if (!balanceDetails) {
            logger.error('No balance details found for account:', accountNumber);
            return null;
        }

        // Step 2: Find active user
        let activeUserObject = null;
        if (Array.isArray(balanceDetails)) {
            activeUserObject = balanceDetails.find(obj => obj.userStatus === 'active');
        } else if (balanceDetails.userStatus === 'active') {
            activeUserObject = balanceDetails;
        }

        if (!activeUserObject) {
            logger.error('No active user found in balance details');
            return null;
        }

        // Step 3: Get device details if deviceId exists
        let deviceDetails = null;
        if (activeUserObject.deviceId) {
            logger.info('Fetching device details for device:', activeUserObject.deviceId);
            deviceDetails = await getDeviceDetails(activeUserObject.deviceId);
        }

        // Step 4: Return combined data in the format expected by Swagger including all required fields
        const result = {
            programId: programId, // Include programId from request
            accountNumber: accountNumber, // Include accountNumber from SOAP response
            partner_user_id: partnerUserId, // Include partner_user_id from SOAP response
            cardNumber: activeUserObject.cardNumber || null,
            cardNumberMasked: activeUserObject.cardNumberMasked || null,
            firstName: activeUserObject.firstName || null,
            lastName: activeUserObject.lastName || null,
            exp_year: deviceDetails?.definition?.card?.exp_year || null,
            exp_month: deviceDetails?.definition?.card?.exp_month || null,
            available: deviceDetails?.balance?.available || null
        };

        logger.info('Successfully compiled complete account details');
        return result;

    } catch (error) {
        logger.error('Error getting complete account details:', error.message);
        return null;
    }
}

// Update the create-account endpoint to use processStatus from SOAP and include programId
app.post('/create-account', validateCreateAccountRequest, async (req, res) => {
    try {
        // Step 1: Create account via SOAP
        const soapXml = buildSoapXml(req.body);
        logger.info('Sending SOAP request to create account');
        
        const soapResponse = await soapClient.post(CONFIG.SOAP_SERVICE_URL, soapXml);
        const jsonResponse = await parseSoapResponse(soapResponse.data);
        
        if (!jsonResponse.success) {
            logger.error('Account creation failed:', jsonResponse.description);
            return res.status(400).json(jsonResponse);
        }

        // Step 2: Get complete account details if account was created successfully
        let completeAccountDetails = null;
        if (jsonResponse.data.accountNumber) {
            logger.info('Account created successfully, fetching additional details...');
            completeAccountDetails = await getCompleteAccountDetails(
                jsonResponse.data.accountNumber, 
                jsonResponse.data.partner_user_id,
                req.body.program_id // Pass programId from request
            );
        }

        // Step 3: Use processStatus from SOAP response, fallback to default if empty
        let finalProcessStatus = {
            "register-user": "processed",
            "issue-card": "processed", 
            "add-funds": "processed"
        };

        // If we have process status from SOAP, use it instead of default
        if (jsonResponse.processStatus && Object.keys(jsonResponse.processStatus).length > 0) {
            finalProcessStatus = jsonResponse.processStatus;
        } else {
            logger.info('Using default processStatus (no data from SOAP)');
        }

        // Step 4: Build the final response according to Swagger specification
        const finalResponse = {
            success: jsonResponse.success,
            description: jsonResponse.description || "Processed Successfully",
            existingTransaction: jsonResponse.existingTransaction || false,
            data: completeAccountDetails || {
                programId: req.body.program_id || null,
                accountNumber: jsonResponse.data.accountNumber || null,
                partner_user_id: jsonResponse.data.partner_user_id || null,
                cardNumber: null,
                cardNumberMasked: null,
                firstName: null,
                lastName: null,
                exp_year: null,
                exp_month: null,
                available: null
            },
            processStatus: finalProcessStatus // Use processStatus from SOAP or default
        };

        logger.info('Account creation completed successfully');
        res.status(200).json(finalResponse);
        
    } catch (error) {
        handleError(res, error, 'create account');
    }
});

// Request validation
function validateCreateAccountRequest(req, res, next) {
    const { program_id, registration } = req.body;
    
    if (!program_id || !registration?.firstName || !registration?.lastName) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields",
            required: ["program_id", "registration.firstName", "registration.lastName"]
        });
    }
    next();
}

function validateQueryParams(requiredParams) {
    return (req, res, next) => {
        const missingParams = requiredParams.filter(param => !req.query[param]);
        
        if (missingParams.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required parameters",
                required: requiredParams,
                missing: missingParams
            });
        }
        next();
    };
}

function handleError(res, error, context = '') {
    logger.error(`${context} error:`, error.message);
    
    if (error.response) {
        return res.status(error.response.status).json({
            success: false,
            error: "API error",
            message: error.message,
            context
        });
    }
    
    if (error.request) {
        return res.status(503).json({
            success: false,
            error: "Service unavailable",
            message: "Unable to connect to external service",
            context
        });
    }
    
    return res.status(500).json({
        success: false,
        error: error.message,
        message: `Failed to ${context}`,
        context
    });
}

// Keep the existing get-balance endpoint to fetch balance details by DDA but not used in application
app.post('/get-balance', async (req, res) => {
    try {
        const { dda } = req.body;

        if (!dda) {
            return res.status(400).json({
                success: false,
                error: "Missing required parameter",
                required: ["dda"]
            });
        }

        const balanceDetails = await getBalanceDetails(dda);

        if (!balanceDetails) {
            return res.status(404).json({
                success: false,
                error: "Balance details not found",
                message: "Unable to retrieve balance details for the given DDA"
            });
        }

        // Find active user
        let activeUserObject = null;
        if (Array.isArray(balanceDetails)) {
            activeUserObject = balanceDetails.find(obj => obj.userStatus === 'active');
        } else if (balanceDetails.userStatus === 'active') {
            activeUserObject = balanceDetails;
        }

        if (!activeUserObject) {
            return res.status(404).json({
                success: false,
                error: "No active user found",
                message: "No user with active status found in the response"
            });
        }

        // Filter member response
        const allowedFields = ['deviceId', 'memberId', 'cardNumber', 'ebn', 'role', 'userStatus', 'firstName', 'lastName', 'cardNumberMasked'];
        const filteredResponse = {};
        
        allowedFields.forEach(field => {
            filteredResponse[field] = activeUserObject[field] || null;
        });

        // Get device details if deviceId exists
        let filteredDeviceDetails = null;
        if (filteredResponse.deviceId) {
            const deviceDetails = await getDeviceDetails(filteredResponse.deviceId);
            
            if (deviceDetails) {
                filteredDeviceDetails = {
                    device_type: deviceDetails.definition?.device_type || null,
                    name: deviceDetails.definition?.name || null,
                    card: {
                        exp_year: deviceDetails.definition?.card?.exp_year || null,
                        exp_month: deviceDetails.definition?.card?.exp_month || null,
                        cv_code: deviceDetails.definition?.card?.cv_code || null,
                        type: deviceDetails.definition?.card?.type || null,
                        number: deviceDetails.definition?.card?.number || null
                    },
                    balance: {
                        date: deviceDetails.balance?.date || null,
                        ledger: deviceDetails.balance?.ledger || null,
                        pending: deviceDetails.balance?.pending || null,
                        available: deviceDetails.balance?.available || null
                    }
                };
            }
        }

        res.status(200).json({
            member: filteredResponse,
            device: filteredDeviceDetails
        });
        
    } catch (error) {
        handleError(res, error, 'get balance details');
    }
});

app.get('/get-cvv-details', validateQueryParams(['programId', 'partnerUserId']), async (req, res) => {
    try {
        const { programId, partnerUserId } = req.query;
        
        const accessToken = await getAccessToken();
        const url = `${CONFIG.CARD_API_BASE}/cvv?programId=${programId}&partnerUserId=${partnerUserId}&accountNumber=`;
        
        const response = await apiClient.get(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        res.status(200).json(response.data);
    } catch (error) {
        handleError(res, error, 'get CVV details');
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});