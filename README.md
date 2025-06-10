# Microsoft Teams Location Bot

[![CI/CD Pipeline](https://github.com/yourusername/location-bot/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/yourusername/location-bot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org)
[![Bot Framework](https://img.shields.io/badge/Bot%20Framework-4.20-blue.svg)](https://dev.botframework.com/)

A comprehensive Microsoft Teams bot that automatically asks team members about their daily work location and stores responses in a database. The bot handles Remote, Office, and Hybrid work arrangements with smart scheduling and reminder features.

## 🎯 Features

### Core Functionality
- **Daily Location Prompts**: Automatically asks users about their work location at 9:00 AM (Monday-Friday)
- **Proactive Location Setting**: Users can set their location anytime by typing "remote", "office", or "hybrid"
- **Multiple Daily Updates**: Users can change their location multiple times throughout the day
- **Team Location Queries**: Ask about specific team members' locations or view team overview
- **Smart Reminders**: Sends reminders at 9:30 AM and 10:00 AM if no response received
- **Hybrid Support**: For hybrid workers, collects separate morning and afternoon locations
- **Holiday Awareness**: Skips prompts on Western Australia public holidays and weekends
- **Database Storage**: Stores all location updates with timestamps, employee details, and location data

### Interactive Features
- **Adaptive Cards**: Beautiful, interactive cards for location selection and team overviews
- **Text Commands**: Support for direct location setting and team queries
- **Intelligent Search**: Find team members by partial name matching
- **User Management**: Automatic user registration and profile management
- **Location History**: View all location changes for any day
- **Statistics**: Personal location history and usage statistics

### Administrative Features
- **Health Monitoring**: Health check endpoint for system monitoring
- **Manual Triggers**: Admin endpoints to manually trigger prompts and reminders
- **Statistics API**: Retrieve location data for reporting and analytics
- **Detailed Tracking**: Full audit trail of all location changes throughout the day

## 🤖 AI-Powered Features

The Location Bot now includes an AI agent that intelligently processes user messages to determine work location intent:

### AI Capabilities
- **Smart Message Analysis**: Uses OpenAI's GPT models to understand natural language
- **Confidence Scoring**: Shows how confident the AI is about its interpretation  
- **Context Understanding**: Distinguishes between casual conversation and location updates
- **Multi-category Detection**: Office, Remote, Not Working (sick/holiday/vacation)
- **Fallback Processing**: Automatically falls back to rule-based processing if AI is unavailable

### Supported Phrases
The AI can understand phrases like:
- **Office**: "I'm at the office today", "Going to work now", "In the building"
- **Remote**: "Working from home", "WFH today", "Remote work today"  
- **Not Working**: "I'm sick today", "On holiday this week", "Taking a day off"

### Configuration
Add your OpenAI API key to the environment:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from: https://platform.openai.com/api-keys

If no API key is provided, the bot automatically falls back to rule-based pattern matching.

## 🏗️ Architecture

```
├── index.js              # Main server and bot initialization
├── bot.js                # Core bot logic and message handling
├── scheduler.js          # Scheduling system for daily prompts
├── database.js           # SQLite database operations
├── config.js             # Configuration management
├── cards/
│   └── locationCard.js   # Adaptive card templates
├── utils/
│   └── holidays.js       # Holiday service for Western Australia
└── data/                 # Database storage (auto-created)
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)
- Microsoft Teams app with bot registration
- Bot Framework credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/location-bot.git
   cd location-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   npm run setup
   # This copies env.example to .env
   # Edit .env with your Bot Framework credentials
   ```

4. **Configure your .env file**
   ```env
   MICROSOFT_APP_ID=your_bot_app_id
   MICROSOFT_APP_PASSWORD=your_bot_app_password
   PORT=3978
   DATABASE_PATH=./data/locations.db
   TIMEZONE=Australia/Perth
   ```

5. **Start the bot**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Health Check**
   Visit `http://localhost:3978/health` to verify the bot is running

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Build and start the bot
npm run docker:compose

# Stop the bot
npm run docker:down
```

### Using Docker directly
```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teams_user_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    employee_number TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Location Responses Table
```sql
CREATE TABLE location_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    response_time DATETIME NOT NULL,
    work_location TEXT NOT NULL,
    morning_location TEXT,
    afternoon_location TEXT,
    reminder_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
    -- Note: No unique constraint to allow multiple updates per day
);
```

### New Database Methods
- `getUserByDisplayName(name)` - Find user by display name (partial match)
- `searchUsersByName(term)` - Search for users with name containing term
- `getTeamCurrentLocations(date)` - Get current location for all team members
- `getUserCurrentLocation(userId, date)` - Get specific user's current location with stats

## 🤖 Bot Commands

Users can interact with the bot using these commands:

### Personal Location Commands
| Command | Description |
|---------|-------------|
| `remote` | Set your location to Remote |
| `office` or `work` | Set your location to Office |
| `hybrid` | Set your location to Hybrid (will ask for AM/PM details) |
| `location` | Show interactive location selection card |
| `status` | Check your current location for today |
| `history` | View all your location changes for today |
| `stats` | View your recent location history (last 7 days) |

### Team Location Commands
| Command | Description |
|---------|-------------|
| `team` | View all team members' current locations |
| `where is [name]` | Find a specific team member's location |
| `location [name]` | Alternative way to find someone's location |
| `find [name]` | Another way to search for team members |
| `help` | Show available commands and bot information |

### Holiday Commands
| Command | Description |
|---------|-------------|
| `holidays` or `public holidays` | View all public holidays for the next 12 months |
| `next holidays` or `upcoming holidays` | View the next 5 upcoming holidays |

**Holiday Features:**
- 🌐 **Live Data**: Uses the Nager.at API for up-to-date Western Australia public holidays
- 📅 **12-Month View**: Shows all holidays for the next year from current date
- ⭐ **Smart Timing**: Highlights holidays happening soon with special indicators
- 📍 **Location Integration**: Bot automatically skips work reminders on public holidays
- 🎄 **Rich Display**: Shows holiday names, dates, days of the week, and time until holiday
- 🤖 **AI-Powered Queries**: Ask naturally like "When is the next holiday?" or "What holidays are coming up?"

### Sample Holiday Output

#### Next 5 Holidays (`next holidays`)
```
🎄 Next 5 Public Holidays in Western Australia

1. ⭐ Christmas Day
   📅 Wednesday, 25 December 2024
   📅 In 3 days

2. 🎄 Boxing Day
   📅 Thursday, 26 December 2024
   📅 In 4 days

3. 🎄 New Year's Day
   📅 Wednesday, 1 January 2025
   📅 In 10 days

4. 🎄 Australia Day
   📅 Sunday, 26 January 2025
   📅 In 1 month

5. 🎄 Labour Day
   📅 Monday, 3 March 2025
   📅 In 2 months
```

#### Full Holiday List (`holidays`)
```
🎄 Public Holidays in Western Australia - Next 12 Months

📅 Found 12 upcoming public holidays

December 2024
🎄 Christmas Day
   📅 Wednesday, 25 December 2024
   📅 In 3 days

🎄 Boxing Day
   📅 Thursday, 26 December 2024
   📅 In 4 days

January 2025
🎄 New Year's Day
   📅 Wednesday, 1 January 2025
   📅 In 10 days

...and more
```

## 🎨 User Experience

### Daily Interaction Flow

1. **Morning Prompt (9:00 AM)**
   - Bot sends adaptive card with location options
   - User selects: Remote, Office, or Hybrid

2. **Proactive Updates**
   - Users can type "remote", "office", or "hybrid" anytime
   - No need to wait for daily prompts
   - Immediate confirmation of location updates

3. **Multiple Updates**
   - Users can change location throughout the day
   - Each update is stored with timestamp
   - View history with `history` command

4. **Hybrid Location Details**
   - If Hybrid selected, bot asks for morning/afternoon details
   - User selects locations for each time period

5. **Confirmation**
   - Bot confirms location recorded or updated
   - Shows timestamp and selected options
   - Helpful tips for future updates

6. **Reminders**
   - 9:30 AM: First reminder if no initial response
   - 10:00 AM: Final reminder if still no response

### Team Location Queries

#### Individual Team Member Lookup
```
User: where is Sarah

Bot: [Shows card with Sarah's location details]
     📍 Sarah Johnson's Location
     Monday, 15 January 2024
     🏢 Office
     ✅ Location set at 15 Jan 2024, 9:05 AM
```

#### Team Overview
```
User: team

Bot: [Shows comprehensive team card]
     Team Locations - Monday, 15 January 2024
     📊 Summary: 8/10 members set
     🏠 Remote: 3 | 🏢 Office: 4 | 🔄 Hybrid: 1
     
     [List of all team members with their locations and update times]
     ⚠️ 2 team members haven't set their location yet
```

#### Smart Search
```
User: find john

Bot: 🔍 Found multiple people matching "john": John Smith, Johnny Davis. Please be more specific.

User: where is john smith

Bot: [Shows John Smith's location card]
```

### Sample Team Location Card Features
- **Visual Summary**: Icons and counts for each location type
- **Individual Status**: Each team member shown with location and last update time
- **Missing Members**: Highlights who hasn't set their location
- **Update Indicators**: Shows if someone made multiple location changes
- **Time Information**: Displays when each location was last updated

## 🔌 API Endpoints

### Public Endpoints
- `POST /api/messages` - Bot Framework message endpoint
- `GET /health` - Health check and status

### Admin Endpoints (Remove in Production)
- `GET /admin/trigger-prompts` - Manually trigger daily prompts
- `GET /admin/trigger-reminders/1` - Manually trigger first reminder
- `GET /admin/trigger-reminders/2` - Manually trigger second reminder
- `GET /admin/stats?start=YYYY-MM-DD&end=YYYY-MM-DD` - Get latest location statistics
- `GET /admin/stats?start=YYYY-MM-DD&end=YYYY-MM-DD&all=true` - Get all location entries
- `GET /admin/stats/detailed/YYYY-MM-DD` - Get detailed location history for specific date

## 🌐 Microsoft Teams Integration

### Bot Registration
1. Create a new bot in the [Azure Bot Service](https://portal.azure.com)
2. Configure the messaging endpoint: `https://your-domain.com/api/messages`
3. Generate App ID and Password
4. Add Microsoft Teams channel

### App Manifest
Create a Teams app manifest with the bot configuration:

```json
{
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "your-app-id",
  "bots": [
    {
      "botId": "your-bot-app-id",
      "scopes": ["personal", "team"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": ["identity", "messageTeamMembers"]
}
```

## 🚢 Deployment

### Azure App Service
1. Create Azure App Service
2. Configure environment variables
3. Deploy using Git or Azure DevOps
4. Set up custom domain and SSL

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3978
CMD ["npm", "start"]
```

### Environment Configuration
- Set all required environment variables
- Configure file persistence for SQLite database
- Set up monitoring and logging

## 🔒 Security Considerations

- **Environment Variables**: Never commit credentials to source control
- **Bot Registration**: Secure your Bot Framework credentials
- **Database**: Regular backups of SQLite database
- **HTTPS**: Use HTTPS in production for secure communication
- **Admin Endpoints**: Remove or secure admin endpoints in production

## 📈 Monitoring and Maintenance

### Health Monitoring
The `/health` endpoint provides:
- Service status
- Uptime information
- Scheduler status
- Next scheduled job times

### Database Maintenance
- Regular database backups
- Monitor database size growth
- Clean up old data as needed

### Logging
The bot logs:
- User interactions and responses
- Scheduled job executions
- Error conditions and exceptions
- Database operations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/location-bot/issues)
- **Documentation**: Check this README and inline code comments
- **Bot Framework**: [Official Bot Framework documentation](https://docs.microsoft.com/en-us/azure/bot-service/)

## 🏷️ Versioning

We use [Semantic Versioning](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/yourusername/location-bot/tags).

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

⭐ **Star this repository if you find it helpful!** 