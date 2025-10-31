# Embedded Payments API

Embedded payments are payment solutions integrated directly into a platform or application, allowing users to complete transactions seamlessly without leaving the interface.

## Overview

This Node.js Express API provides endpoints for managing payment accounts, including account creation, balance inquiries, and card details retrieval. The service integrates with external payment processors through SOAP and REST APIs.

## Features

- **Account Creation**: Create new payment accounts with user registration
- **Balance Inquiry**: Retrieve account balance and member details
- **CVV Retrieval**: Get card CVV details for authorized users
- **Token Management**: Automatic OAuth token caching and refresh
- **Error Handling**: Comprehensive error handling with detailed responses
- **Health Monitoring**: Health check endpoint for service monitoring

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd embedded-payments/Backend
```

2. Navigate to the backend directory:
```bash
cd Backend
```

3. Install dependencies:
```bash
npm install
```

## Dependencies

The project uses the following key dependencies (as defined in [Backend/package.json](Backend/package.json)):

- **express**: ^5.1.0 - Web framework for Node.js
- **axios**: ^1.13.1 - HTTP client for API requests
- **xml2js**: ^0.6.2 - XML parser for SOAP responses
- **uuid**: ^13.0.0 - UUID generation for transaction IDs

## API Endpoints

### 1. Create Account
**POST** `/create-account`

Creates a new payment account with user registration details.

**Request Body:**
```json
{
  "program_id": "string",
  "partner_user_id": "string",
  "registration": {
    "firstName": "string",
    "lastName": "string",
    "emailAddress": "string",
    "address1": "string",
    "city": "string",
    "state": "string",
    "postal": "string",
    "country": "US"
  },
  "load": {
    "amount": 100,
    "comment": "Initial load"
  }
}
```

**Response:**
```json
{
  "success": true,
  "code": 0,
  "description": "Success",
  "data": {
    "accountNumber": "string",
    "cardNumber": "string",
    "cardExpiryDateMMYY": "string",
    "claimCode": "string"
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### 2. Get Balance Details
**POST** `/get-balance`

Retrieves balance and member details for a given DDA number.

**Request Body:**
```json
{
  "dda": "string" //accountNumber received in /create-account response
}
```

**Response:**
```json
{
  "member": {
    "deviceId": "string",
    "memberId": "string",
    "cardNumber": "string", //card number
    "firstName": "string",
    "lastName": "string",
    "userStatus": "active",
    "cardNumberMasked": "5445XXXXXXXX7195" //masked card number
  },
  "device": {
    "device_type": "string",
    "name": "string",
    "card": {
      "exp_year": "2025", //card expiry year
      "exp_month": "12", //card expiry month
      "type": "VISA"
    },
    "balance": {
      "available": "1", //This is available balance to be displayed on UI and divide by 100 (example: 1/100 = 0.01)
      "ledger": "1",
      "pending": "0"
    }
  }
}
```

### 3. Get CVV Details
**GET** `/get-cvv-details?programId={id}&partnerUserId={userId}`
id = Program identifier used for creating account
userdId = Partner user identifier received when created the account

Retrieves CVV details for a specific card.

**Query Parameters:**
- `programId`: Program identifier
- `partnerUserId`: Partner user identifier

**Response:**
```json
{
    "cvv": "5+Sb=fIgYm8A=", //encrypted cvv
    "_meta": {
        "code": 0,
        "description": "Processed Successfully",
        "subCode": "PROCESSED_SUCCESSFULLY",
        "existingTransaction": false,
        "operationStatus": {}
    }
}
```

### 4. Health Check
**GET** `/health`

Returns the service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## Running the Application

### Development Mode
```bash
(node .\server.js) or (npm start)
```

The server will start on `http://localhost:3000` (or the port specified in the PORT environment variable).

### Environment Variables

- `PORT`: Server port (default: 3000)

## Error Handling

The API implements comprehensive error handling through the [`handleError`](Backend/server.js) function:

- **400**: Bad Request (missing required parameters)
- **404**: Not Found (resource not found)
- **500**: Internal Server Error
- **503**: Service Unavailable (external service connection issues)

All error responses follow this format:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "context": "Operation context"
}
```

## Security Features

- HTTPS agent with configurable SSL verification
- OAuth token caching with automatic refresh
- Input validation middleware
- Request timeout configuration
- Secure credential management

## Logging

The application uses a simple logging utility ([`logger`](Backend/server.js)) that provides:
- Info level logging for successful operations
- Error level logging for failures and exceptions

## Architecture Components

### Core Classes and Functions

- [`TokenCache`](Backend/server.js): Manages OAuth token caching with TTL
- [`buildSoapXml`](Backend/server.js): Constructs SOAP XML requests
- [`parseSoapResponse`](Backend/server.js): Parses SOAP XML responses to JSON
- [`getAccessToken`](Backend/server.js): Handles OAuth authentication
- [`validateCreateAccountRequest`](Backend/server.js): Request validation middleware

### HTTP Clients

- `soapClient`: Configured for SOAP API calls
- `apiClient`: Configured for REST API calls

## Development Guidelines

1. Follow the existing error handling patterns
2. Use the logger utility for consistent logging
3. Implement proper input validation for new endpoints
4. Maintain the existing response format structure
5. Add appropriate middleware for request validation


## Support

For issues and questions, please refer to the project documentation or contact the development team.