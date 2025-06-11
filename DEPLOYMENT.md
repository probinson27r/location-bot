# 🚀 Azure Deployment Guide for Location Bot

This guide will help you deploy your Location Bot to Microsoft Azure.

## Prerequisites

- Azure subscription
- Azure CLI installed
- Git repository with your bot code
- Microsoft Teams admin access

## Step 1: Create Azure Resources

### 1.1 Create Resource Group
```bash
az group create --name rg-location-bot --location "East US"
```

### 1.2 Create Azure SQL Database
```bash
# Create SQL Server
az sql server create \
  --name locationbot-sql-server \
  --resource-group rg-location-bot \
  --location "East US" \
  --admin-user locationbotadmin \
  --admin-password "YourStrongPassword123!"

# Create Database
az sql db create \
  --resource-group rg-location-bot \
  --server locationbot-sql-server \
  --name location-bot \
  --service-objective Basic

# Configure firewall (allow Azure services)
az sql server firewall-rule create \
  --resource-group rg-location-bot \
  --server locationbot-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 1.3 Create App Service Plan
```bash
az appservice plan create \
  --name asp-location-bot \
  --resource-group rg-location-bot \
  --sku B1 \
  --is-linux
```

### 1.4 Create App Service
```bash
az webapp create \
  --resource-group rg-location-bot \
  --plan asp-location-bot \
  --name location-bot-app \
  --runtime "NODE|18-lts"
```

## Step 2: Create Bot Registration

### 2.1 Create Azure Bot Service
```bash
az bot create \
  --resource-group rg-location-bot \
  --name location-bot \
  --kind webapp \
  --sku F0 \
  --endpoint "https://location-bot-app.azurewebsites.net/api/messages"
```

### 2.2 Get Bot Credentials
```bash
# Get App ID
az bot show --resource-group rg-location-bot --name location-bot --query "msaAppId"

# Create App Password (save this securely!)
az ad app credential reset --id <APP_ID> --credential-description "BotPassword"
```

## Step 3: Configure Environment Variables

Set the following environment variables in your App Service:

```bash
az webapp config appsettings set \
  --resource-group rg-location-bot \
  --name location-bot-app \
  --settings \
  MicrosoftAppId="<YOUR_BOT_APP_ID>" \
  MicrosoftAppPassword="<YOUR_BOT_APP_PASSWORD>" \
  AZURE_SQL_SERVER="locationbot-sql-server.database.windows.net" \
  AZURE_SQL_DATABASE="location-bot" \
  AZURE_SQL_USERNAME="locationbotadmin" \
  AZURE_SQL_PASSWORD="YourStrongPassword123!" \
  NODE_ENV="production" \
  PORT="3978" \
  OPENAI_API_KEY="<YOUR_OPENAI_API_KEY>"
```

## Step 4: Deploy Your Code

### Option A: GitHub Actions (Recommended)
1. Fork this repository
2. Add these secrets to your GitHub repository:
   - `AZURE_APP_NAME`: location-bot-app
   - `AZURE_PUBLISH_PROFILE`: Download from Azure Portal
3. Push to main branch to trigger deployment

### Option B: Direct Deployment
```bash
# Build and deploy
npm install
az webapp deployment source config-zip \
  --resource-group rg-location-bot \
  --name location-bot-app \
  --src location-bot.zip
```

### Option C: VS Code Extension
1. Install Azure App Service extension
2. Right-click your project → "Deploy to Web App"
3. Select your subscription and app service

## Step 5: Configure Microsoft Teams

### 5.1 Create App Manifest
Create `manifest.json`:
```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "<YOUR_BOT_APP_ID>",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://your-company.com",
    "privacyUrl": "https://your-company.com/privacy",
    "termsOfUseUrl": "https://your-company.com/terms"
  },
  "name": {
    "short": "Location Bot",
    "full": "Employee Location Tracking Bot"
  },
  "description": {
    "short": "Track employee work locations",
    "full": "A bot for tracking daily employee work locations in Microsoft Teams"
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#FFFFFF",
  "bots": [
    {
      "botId": "<YOUR_BOT_APP_ID>",
      "scopes": ["personal", "team", "groupchat"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["location-bot-app.azurewebsites.net"]
}
```

### 5.2 Upload to Teams
1. Zip manifest.json with icon files
2. Go to Teams Admin Center
3. Upload the app package
4. Approve for your organization

## Step 6: Verify Deployment

### 6.1 Check App Service Logs
```bash
az webapp log tail --resource-group rg-location-bot --name location-bot-app
```

### 6.2 Test Health Endpoint
```bash
curl https://location-bot-app.azurewebsites.net/health
```

### 6.3 Test in Teams
1. Add the bot to a team or chat
2. Send "help" command
3. Try location commands

## Monitoring and Maintenance

### Enable Application Insights
```bash
az webapp config appsettings set \
  --resource-group rg-location-bot \
  --name location-bot-app \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<YOUR_INSIGHTS_KEY>"
```

### Set up Alerts
- Monitor app health
- Database connection issues
- High response times
- Error rates

## Scaling Considerations

### Database
- Start with Basic tier
- Scale to Standard/Premium as needed
- Consider read replicas for high traffic

### App Service
- Start with B1 (Basic)
- Scale to Standard/Premium for production
- Enable auto-scaling rules

### Multi-Tenant Isolation
- Database already supports tenant isolation
- Consider separate databases per major client
- Monitor tenant usage patterns

## Security Best Practices

1. **Use Azure Key Vault** for sensitive configuration
2. **Enable App Service Authentication** if needed
3. **Configure CORS** properly
4. **Use HTTPS only**
5. **Regular security updates**
6. **Monitor access logs**

## Troubleshooting

### Common Issues
1. **Bot not responding**: Check endpoint URL and credentials
2. **Database connection failed**: Verify firewall rules
3. **Cards not displaying**: Check adaptive card versions
4. **Slow responses**: Monitor database performance

### Logs Location
```bash
# App Service logs
az webapp log download --resource-group rg-location-bot --name location-bot-app

# Database logs
az sql db show --resource-group rg-location-bot --server locationbot-sql-server --name location-bot
```

## Cost Optimization

### Development Environment
- Use Free tier App Service (F1)
- Use Basic SQL Database
- Shared Application Insights

### Production Environment
- Standard App Service (S1+)
- Standard SQL Database
- Dedicated Application Insights

## Support

For issues:
1. Check Azure logs
2. Review Teams app manifest
3. Verify bot registration
4. Test database connectivity

---

🎉 **Congratulations!** Your Location Bot is now deployed to Azure and ready for your organization! 