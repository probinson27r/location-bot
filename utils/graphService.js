const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');

class GraphService {
    constructor() {
        this.appId = process.env.MICROSOFT_APP_ID;
        this.appSecret = process.env.MICROSOFT_APP_PASSWORD;
        this.tenantId = process.env.GRAPH_TENANT_ID || 'common';
        
        // MSAL configuration for application authentication (app-only permissions)
        this.msalConfig = {
            auth: {
                clientId: this.appId,
                clientSecret: this.appSecret,
                authority: `https://login.microsoftonline.com/${this.tenantId}`
            }
        };
        
        this.msalClient = new ConfidentialClientApplication(this.msalConfig);
        this.graphClient = null;
        
        console.log('📊 Graph Service: Initialized with app-only authentication');
    }

    /**
     * Get an authenticated Microsoft Graph client using application permissions
     */
    async getGraphClient() {
        if (!this.graphClient) {
            try {
                // Get access token using client credentials flow (app-only)
                const clientCredentialRequest = {
                    scopes: ['https://graph.microsoft.com/.default']
                };
                
                const response = await this.msalClient.acquireTokenSilent(clientCredentialRequest);
                const accessToken = response.accessToken;
                
                // Create Graph client with the access token
                this.graphClient = Client.init({
                    authProvider: (done) => {
                        done(null, accessToken);
                    }
                });
                
                console.log('📊 Graph Service: Successfully authenticated with Microsoft Graph');
                
            } catch (error) {
                console.error('❌ Graph Service: Failed to authenticate:', error.message);
                throw error;
            }
        }
        
        return this.graphClient;
    }

    /**
     * Update user's work location in their Teams profile
     * @param {string} userPrincipalName - User's email/UPN 
     * @param {string} location - 'Remote' or 'Office'
     */
    async updateUserWorkLocation(userPrincipalName, location) {
        try {
            console.log(`📊 Graph Service: Updating work location for ${userPrincipalName} to ${location}`);
            
            const graphClient = await this.getGraphClient();
            
            // Map bot locations to Graph API values
            const locationMapping = {
                'Remote': 'Remote',
                'Office': 'Office'
            };
            
            const graphLocation = locationMapping[location];
            if (!graphLocation) {
                console.log(`⚠️ Graph Service: Location '${location}' not supported for Graph API update`);
                return false;
            }
            
            // Update user's profile with work location
            const updateData = {
                officeLocation: graphLocation
            };
            
            await graphClient
                .api(`/users/${userPrincipalName}`)
                .patch(updateData);
            
            console.log(`✅ Graph Service: Successfully updated ${userPrincipalName} work location to ${graphLocation}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Graph Service: Failed to update work location for ${userPrincipalName}:`, error.message);
            
            // Log specific error details for debugging
            if (error.response) {
                console.error(`❌ Graph Service: HTTP ${error.response.status} - ${error.response.statusText}`);
                if (error.response.data) {
                    console.error(`❌ Graph Service: Error details:`, error.response.data);
                }
            }
            
            return false;
        }
    }

    /**
     * Get user's current profile information from Graph
     * @param {string} userPrincipalName - User's email/UPN
     */
    async getUserProfile(userPrincipalName) {
        try {
            console.log(`📊 Graph Service: Getting profile for ${userPrincipalName}`);
            
            const graphClient = await this.getGraphClient();
            
            const user = await graphClient
                .api(`/users/${userPrincipalName}`)
                .select(['displayName', 'mail', 'userPrincipalName', 'officeLocation'])
                .get();
            
            console.log(`✅ Graph Service: Retrieved profile for ${user.displayName} - Office Location: ${user.officeLocation || 'Not set'}`);
            return user;
            
        } catch (error) {
            console.error(`❌ Graph Service: Failed to get profile for ${userPrincipalName}:`, error.message);
            return null;
        }
    }

    /**
     * Find user by Teams ID (requires mapping through Teams/Graph)
     * @param {string} teamsUserId - Teams user ID
     */
    async findUserByTeamsId(teamsUserId) {
        try {
            console.log(`📊 Graph Service: Looking up user by Teams ID: ${teamsUserId}`);
            
            const graphClient = await this.getGraphClient();
            
            // In Teams, the user ID might be in a specific format
            // We need to search by the Azure AD object ID or UPN
            
            // Try to get user directly if the teamsUserId is an Azure AD object ID
            try {
                const user = await graphClient
                    .api(`/users/${teamsUserId}`)
                    .select(['displayName', 'mail', 'userPrincipalName', 'id'])
                    .get();
                
                console.log(`✅ Graph Service: Found user by ID: ${user.displayName} (${user.userPrincipalName})`);
                return user;
                
            } catch (directLookupError) {
                console.log(`⚠️ Graph Service: Direct lookup failed, trying alternative methods`);
                
                // If direct lookup fails, we might need to extract the actual user ID from Teams format
                // Teams user IDs are often in format like "29:1abc123..." but Graph needs the actual AAD object ID
                // For now, return null and we'll handle this with additional mapping
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Graph Service: Failed to find user by Teams ID ${teamsUserId}:`, error.message);
            return null;
        }
    }

    /**
     * Test Graph API connectivity
     */
    async testConnection() {
        try {
            console.log('📊 Graph Service: Testing connection...');
            
            const graphClient = await this.getGraphClient();
            
            // Test by getting the application info
            const appInfo = await graphClient
                .api('/me')
                .get();
            
            console.log('✅ Graph Service: Connection test successful');
            return true;
            
        } catch (error) {
            console.error('❌ Graph Service: Connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Check if Graph Service is properly configured
     */
    isConfigured() {
        const hasRequiredConfig = this.appId && this.appSecret;
        
        if (!hasRequiredConfig) {
            console.log('⚠️ Graph Service: Missing required configuration (MICROSOFT_APP_ID or MICROSOFT_APP_PASSWORD)');
        }
        
        return hasRequiredConfig;
    }
}

module.exports = GraphService; 