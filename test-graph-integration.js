require('dotenv').config();
const GraphService = require('./utils/graphService');

async function testGraphIntegration() {
    console.log('🧪 Testing Microsoft Graph Integration...\n');
    
    // Initialize Graph service
    const graphService = new GraphService();
    
    // Check configuration
    console.log('1. Configuration Check:');
    const isConfigured = graphService.isConfigured();
    console.log(`   ✅ Graph Service Configured: ${isConfigured}`);
    
    if (!isConfigured) {
        console.log('   ❌ Missing required configuration. Please ensure MICROSOFT_APP_ID and MICROSOFT_APP_PASSWORD are set.');
        return;
    }
    
    console.log(`   📋 App ID: ${process.env.MICROSOFT_APP_ID}`);
    console.log(`   📋 Tenant ID: ${process.env.GRAPH_TENANT_ID || 'common'}`);
    console.log('');
    
    // Test authentication
    console.log('2. Authentication Test:');
    try {
        const connectionTest = await graphService.testConnection();
        if (connectionTest) {
            console.log('   ✅ Graph API authentication successful');
        } else {
            console.log('   ❌ Graph API authentication failed');
        }
    } catch (error) {
        console.log('   ❌ Graph API authentication error:', error.message);
    }
    console.log('');
    
    // Test user profile retrieval (if we have a test email)
    const testEmail = process.env.TEST_USER_EMAIL; // Optional test user email
    if (testEmail) {
        console.log('3. User Profile Test:');
        try {
            const profile = await graphService.getUserProfile(testEmail);
            if (profile) {
                console.log(`   ✅ Successfully retrieved profile for ${profile.displayName}`);
                console.log(`   📧 Email: ${profile.mail || profile.userPrincipalName}`);
                console.log(`   📍 Office Location: ${profile.officeLocation || 'Not set'}`);
            } else {
                console.log(`   ❌ Could not retrieve profile for ${testEmail}`);
            }
        } catch (error) {
            console.log(`   ❌ Error retrieving profile: ${error.message}`);
        }
        console.log('');
        
        // Test location update (commented out to avoid actual changes)
        console.log('4. Location Update Test (DRY RUN):');
        console.log(`   🔄 Would update ${testEmail} work location to 'Remote'`);
        console.log('   💡 Uncomment the code below to test actual updates');
        /*
        try {
            const updateResult = await graphService.updateUserWorkLocation(testEmail, 'Remote');
            if (updateResult) {
                console.log(`   ✅ Successfully updated work location for ${testEmail}`);
            } else {
                console.log(`   ❌ Failed to update work location for ${testEmail}`);
            }
        } catch (error) {
            console.log(`   ❌ Error updating work location: ${error.message}`);
        }
        */
    } else {
        console.log('3. User Profile Test: Skipped (no TEST_USER_EMAIL provided)');
        console.log('   💡 Set TEST_USER_EMAIL environment variable to test user operations');
    }
    
    console.log('\n🏁 Graph Integration Test Complete');
}

// Run the test
testGraphIntegration().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 