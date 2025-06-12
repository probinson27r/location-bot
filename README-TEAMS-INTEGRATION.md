# Microsoft Teams Location Integration

This document describes how the location-bot integrates with Microsoft Teams to automatically update users' work location in their Teams profile when they update their location in the bot.

## Overview

When users update their location using the location-bot (Remote/Office), the bot automatically updates their Teams work location profile to match. This provides a seamless experience where the location status is synchronized across both the bot and Teams.

## Features

- **Automatic Sync**: Location updates in the bot automatically sync to Teams profile
- **Two-way Visibility**: Users can see their work location in both the bot and Teams
- **Error Handling**: Graceful fallback if Teams update fails
- **Async Processing**: Teams updates happen in background without affecting bot response time

## Technical Implementation

### Components

1. **GraphService** (`utils/graphService.js`)
   - Handles Microsoft Graph API authentication
   - Updates user profiles in Teams/Azure AD
   - Uses app-only authentication for server-to-server calls

2. **Bot Integration** (`bot.js`)
   - Calls Graph service when location is saved
   - Async error handling for Teams updates
   - Maintains bot functionality even if Teams sync fails

### Authentication

The integration uses **app-only authentication** with the following permissions:
- `User.ReadWrite.All` - Required to update user profiles

### Flow

1. User updates location in Teams (e.g., "remote", "office")
2. Bot saves location to database
3. Bot calls `updateTeamsWorkLocation()` asynchronously
4. Graph service authenticates with Microsoft Graph
5. User's `officeLocation` field is updated in Azure AD/Teams

## Configuration

### Environment Variables

```bash
MICROSOFT_APP_ID=<your-app-id>
MICROSOFT_APP_PASSWORD=<your-app-secret>
GRAPH_TENANT_ID=<your-tenant-id>
```

### Azure AD App Registration

The bot's Azure AD app registration needs:

1. **API Permissions**:
   - Microsoft Graph: `User.ReadWrite.All` (Application permission)

2. **Admin Consent**:
   - Application permissions require tenant admin consent
   - Grant consent through Azure Portal > App registrations > API permissions

### Location Mapping

| Bot Location | Teams Profile |
|--------------|---------------|
| Remote       | Remote        |
| Office       | Office        |
| Clear/None   | No update     |

## Testing

### Test Script

Use the provided test script to verify Graph integration:

```bash
node test-graph-integration.js
```

### Local Testing

Set environment variables and run:

```bash
MICROSOFT_APP_ID=<app-id> \
MICROSOFT_APP_PASSWORD=<app-secret> \
GRAPH_TENANT_ID=<tenant-id> \
node test-graph-integration.js
```

## Troubleshooting

### Common Issues

1. **"Insufficient privileges"**
   - Solution: Ensure admin consent is granted for Graph permissions

2. **"User not found"**
   - Solution: Ensure user has email address in bot database
   - User must exist in the same tenant as the app registration

3. **Authentication failures**
   - Solution: Verify app ID, secret, and tenant ID are correct
   - Check that app registration is not expired

### Logging

The integration provides detailed logging:
- `📊 Graph Service: ...` - Graph service operations
- `✅ Teams work location updated` - Successful updates
- `❌ Teams location update failed` - Failed updates with error details
- `⚠️ Graph Service: Not configured` - Configuration issues

## Security Considerations

1. **App-only Authentication**: Uses client credentials flow
2. **Minimal Permissions**: Only requests necessary Graph permissions
3. **Error Isolation**: Graph failures don't affect core bot functionality
4. **Async Processing**: Teams updates don't block user interactions

## Future Enhancements

1. **Bidirectional Sync**: Read Teams location and sync to bot
2. **Bulk Updates**: Batch process multiple location updates
3. **Custom Locations**: Support for custom office locations
4. **Calendar Integration**: Sync with Outlook calendar presence 