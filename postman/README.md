# Adgraam API Postman Collection

This directory contains a Postman collection for testing the Adgraam API endpoints.

## Collection Contents

The collection includes all API endpoints organized into the following folders:

- **Authentication**: Register and login endpoints
- **Users**: User profile management
- **Ad Accounts**: Ad account listing and retrieval
- **Campaigns**: Campaign management by account
- **Ad Sets**: Ad set management by account
- **Ads**: Ad management, including listing by account/campaign/ad set and insights
- **Documentation**: API documentation access

## Getting Started

### Prerequisites

- [Postman](https://www.postman.com/downloads/) application installed
- Adgraam API server running (default: http://localhost:3000)

### Importing the Collection

1. Open Postman
2. Click "Import" at the top left
3. Select the `adgraam_api_collection.json` file
4. The collection will be imported with all endpoints and example requests

### Setting Up Environment Variables

Create a Postman environment with the following variables:

1. `baseUrl`: The base URL of your API (default: http://localhost:3000/api/v1)
2. `accessToken`: Your authentication token (obtained after login)

### Authentication Flow

1. Use the **Register** endpoint to create a new account
2. Use the **Login** endpoint to get an access token
3. The access token will be automatically used for authenticated endpoints via the collection's Bearer token authorization

## Usage Tips

1. The collection is configured with variables so you can easily change the base URL if needed
2. Path parameters (like `:accountId` and `:campaignId`) should be replaced with actual values
3. Some endpoints have the `refresh` query parameter which can be set to `true` to force data refresh from external APIs

## Customizing Requests

Feel free to modify the request bodies and parameters as needed for your specific testing requirements. The included examples provide a starting point for common usage patterns. 