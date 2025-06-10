const { ActivityHandler, MessageFactory, TurnContext } = require('botbuilder');
const Database = require('./database');
const HolidayService = require('./utils/holidays');
const { 
    createLocationCard, 
    createHybridLocationCard, 
    createConfirmationCard, 
    createErrorCard,
    createTeamLocationCard,
    createMemberLocationCard
} = require('./cards/locationCard');

class LocationBot extends ActivityHandler {
    constructor() {
        super();
        this.database = new Database();
        this.holidayService = new HolidayService();
        this.conversationReferences = {};
        this.pendingHybridResponses = new Map();

        // Handle members being added to the bot
        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello! I\'m the Location Bot. I\'ll ask you about your work location every morning at 9 AM. You can also type "help" to see available commands.';

            for (let member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText));
                    await this.saveUserInfo(context, member);
                }
            }

            await next();
        });

        // Handle regular messages
        this.onMessage(async (context, next) => {
            await this.addConversationReference(context.activity);
            
            const userMessage = context.activity.text?.toLowerCase().trim();
            
            // Handle text commands
            if (userMessage) {
                await this.handleTextCommand(context, userMessage);
            } else if (context.activity.value) {
                // Handle card submissions
                await this.handleCardSubmission(context);
            }

            await next();
        });
    }

    async initialize() {
        await this.database.initialize();
        console.log('Location bot initialized');
    }

    /**
     * Handle text-based commands
     */
    async handleTextCommand(context, message) {
        const user = await this.getOrCreateUser(context);
        
        // Check for "where is" or "location" followed by a name
        const whereIsMatch = message.match(/^(?:where is|location)\s+(.+)$/i);
        const findMatch = message.match(/^find\s+(.+)$/i);
        
        if (whereIsMatch || findMatch) {
            const searchName = (whereIsMatch || findMatch)[1].trim();
            await this.handleTeamMemberLocationQuery(context, searchName);
            return;
        }
        
        switch (message) {
            case 'help':
                await this.sendHelpMessage(context);
                break;
            case 'status':
                await this.sendStatusMessage(context, user);
                break;
            case 'location':
            case 'set location':
                await this.sendLocationPrompt(context, user);
                break;
            case 'stats':
                await this.sendStatsMessage(context, user);
                break;
            case 'history':
                await this.sendTodayHistoryMessage(context, user);
                break;
            case 'team':
            case 'team locations':
            case 'team status':
                await this.sendTeamLocationOverview(context);
                break;
            case 'remote':
                await this.handleDirectLocationCommand(context, user, 'Remote');
                break;
            case 'office':
            case 'work':
                await this.handleDirectLocationCommand(context, user, 'Office');
                break;
            case 'hybrid':
                await this.handleDirectLocationCommand(context, user, 'Hybrid');
                break;
            default:
                await context.sendActivity('I didn\'t understand that command. Type "help" to see available commands, "team" to see everyone\'s location, or ask "where is [name]" to find a specific person.');
        }
    }

    /**
     * Handle adaptive card submissions
     */
    async handleCardSubmission(context) {
        const data = context.activity.value;
        const user = await this.getOrCreateUser(context);
        const currentDate = this.holidayService.getCurrentDate();

        try {
            switch (data.action) {
                case 'location_selected':
                    await this.handleLocationSelection(context, user, data.location, currentDate);
                    break;
                
                case 'hybrid_submitted':
                    await this.handleHybridSubmission(context, user, data, currentDate);
                    break;
                
                case 'restart_selection':
                    await this.sendLocationPrompt(context, user);
                    break;
                
                default:
                    await context.sendActivity('Unknown action received.');
            }
        } catch (error) {
            console.error('Error handling card submission:', error);
            const errorCard = createErrorCard(user.display_name, 'An error occurred while processing your response. Please try again.');
            await context.sendActivity({ attachments: [errorCard] });
        }
    }

    /**
     * Handle direct location commands from text
     */
    async handleDirectLocationCommand(context, user, location) {
        const currentDate = this.holidayService.getCurrentDate();
        
        if (location === 'Hybrid') {
            // Store pending hybrid response and ask for details
            this.pendingHybridResponses.set(user.teams_user_id, {
                user,
                date: currentDate,
                timestamp: Date.now(),
                isDirectCommand: true
            });
            
            const hybridCard = createHybridLocationCard(user.display_name);
            await context.sendActivity({ attachments: [hybridCard] });
        } else {
            // Save simple location response
            const isUpdate = await this.saveLocationResponse(user, currentDate, location);
            
            const confirmationCard = createConfirmationCard(user.display_name, location, null, null, isUpdate);
            await context.sendActivity({ attachments: [confirmationCard] });
        }
    }

    /**
     * Handle location selection (Remote, Office, Hybrid)
     */
    async handleLocationSelection(context, user, location, currentDate) {
        if (location === 'Hybrid') {
            // Store pending hybrid response and ask for details
            this.pendingHybridResponses.set(user.teams_user_id, {
                user,
                date: currentDate,
                timestamp: Date.now(),
                isDirectCommand: false
            });
            
            const hybridCard = createHybridLocationCard(user.display_name);
            await context.sendActivity({ attachments: [hybridCard] });
        } else {
            // Save simple location response
            const isUpdate = await this.saveLocationResponse(user, currentDate, location);
            
            const confirmationCard = createConfirmationCard(user.display_name, location, null, null, isUpdate);
            await context.sendActivity({ attachments: [confirmationCard] });
        }
    }

    /**
     * Handle hybrid location submission
     */
    async handleHybridSubmission(context, user, data, currentDate) {
        const morningLocation = data.morningLocation;
        const afternoonLocation = data.afternoonLocation;

        // Validate that both locations are selected
        if (!morningLocation || !afternoonLocation) {
            const errorCard = createErrorCard(user.display_name, 'Please select both morning and afternoon locations.');
            await context.sendActivity({ attachments: [errorCard] });
            return;
        }

        // Save hybrid location response
        const isUpdate = await this.saveLocationResponse(user, currentDate, 'Hybrid', morningLocation, afternoonLocation);
        
        // Remove pending hybrid response
        this.pendingHybridResponses.delete(user.teams_user_id);
        
        const confirmationCard = createConfirmationCard(user.display_name, 'Hybrid', morningLocation, afternoonLocation, isUpdate);
        await context.sendActivity({ attachments: [confirmationCard] });
    }

    /**
     * Save location response to database
     */
    async saveLocationResponse(user, date, location, morningLocation = null, afternoonLocation = null) {
        try {
            // Check if this is an update (user already has entries for today)
            const existingCount = await this.database.getLocationCount(user.id, date);
            const isUpdate = existingCount > 0;

            // Get reminder count if exists (only for first entry of the day)
            let reminderCount = 0;
            if (!isUpdate) {
                const pendingReminders = await this.database.getPendingReminders(date);
                const userReminder = pendingReminders.find(r => r.user_id === user.id);
                reminderCount = userReminder ? userReminder.reminder_count : 0;
                
                // Remove pending reminder since user has now responded
                await this.database.removePendingReminder(user.id, date);
            }

            await this.database.saveLocationResponse(
                user.id, 
                date, 
                location, 
                morningLocation, 
                afternoonLocation, 
                reminderCount
            );
            
            console.log(`Location ${isUpdate ? 'updated' : 'saved'} for ${user.display_name}: ${location} on ${date}`);
            return isUpdate;
        } catch (error) {
            console.error('Error saving location response:', error);
            throw error;
        }
    }

    /**
     * Send location prompt to user
     */
    async sendLocationPrompt(context, user) {
        const locationCard = createLocationCard(user.display_name);
        await context.sendActivity({ attachments: [locationCard] });
    }

    /**
     * Send help message
     */
    async sendHelpMessage(context) {
        const helpText = `
**Location Bot Commands:**

**Set Your Location:**
🏠 **remote** - Set your location to Remote
🏢 **office** or **work** - Set your location to Office  
🔄 **hybrid** - Set your location to Hybrid (will ask for AM/PM details)
📍 **location** - Show location selection card

**Check Your Status:**
📊 **status** - Check your current location for today
📈 **stats** - View your recent location history (last 7 days)
🕒 **history** - View all your location changes for today

**Team Information:**
👥 **team** - View all team members' current locations
🔍 **where is [name]** - Find a specific team member's location
🔍 **location [name]** - Alternative way to find someone's location
🔍 **find [name]** - Another way to search for team members

**Other:**
❓ **help** - Show this help message

**Examples:**
• Type "remote" to set your location
• Type "team" to see everyone's current location  
• Type "where is John" to find John's location
• Type "location Sarah" to find Sarah's location

**How it works:**
• I'll ask you about your work location every morning at 9:00 AM
• You can also tell me your location anytime by typing "remote", "office", or "hybrid"
• You can update your location multiple times throughout the day
• Ask about your team members' locations anytime
• If you don't respond to morning prompts, I'll remind you at 9:30 AM and 10:00 AM
• For Hybrid, I'll ask for your morning and afternoon locations
• I won't send prompts on weekends or public holidays in Western Australia
        `;
        
        await context.sendActivity(MessageFactory.text(helpText));
    }

    /**
     * Send status message
     */
    async sendStatusMessage(context, user) {
        const currentDate = this.holidayService.getCurrentDate();
        const latestLocation = await this.database.getLatestLocationForUser(user.id, currentDate);
        const locationCount = await this.database.getLocationCount(user.id, currentDate);
        
        let statusText = `**Status for ${this.holidayService.formatDate(currentDate)}:**\n\n`;
        
        if (latestLocation) {
            let locationText = latestLocation.work_location;
            
            if (latestLocation.work_location === 'Hybrid') {
                locationText += ` (AM: ${latestLocation.morning_location}, PM: ${latestLocation.afternoon_location})`;
            }
            
            const responseTime = new Date(latestLocation.response_time).toLocaleString('en-AU', { 
                timeZone: 'Australia/Perth',
                timeStyle: 'short'
            });
            
            statusText += `✅ **Current Location**: ${locationText}\n`;
            statusText += `🕒 **Last Updated**: ${responseTime}\n`;
            
            if (locationCount > 1) {
                statusText += `📊 **Total Updates Today**: ${locationCount}`;
            }
        } else {
            statusText += '⏳ You haven\'t set your location for today yet.';
        }
        
        await context.sendActivity(MessageFactory.text(statusText));
    }

    /**
     * Send today's location history
     */
    async sendTodayHistoryMessage(context, user) {
        const currentDate = this.holidayService.getCurrentDate();
        const history = await this.database.getUserLocationHistory(user.id, currentDate);
        
        let historyText = `**Your Location History for ${this.holidayService.formatDate(currentDate)}:**\n\n`;
        
        if (history.length === 0) {
            historyText += 'No location updates for today.';
        } else {
            history.forEach((entry, index) => {
                const time = new Date(entry.response_time).toLocaleString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    timeStyle: 'short'
                });
                
                let locationText = entry.work_location;
                if (entry.work_location === 'Hybrid') {
                    locationText += ` (AM: ${entry.morning_location}, PM: ${entry.afternoon_location})`;
                }
                
                historyText += `${index + 1}. **${time}**: ${locationText}\n`;
            });
        }
        
        await context.sendActivity(MessageFactory.text(historyText));
    }

    /**
     * Send stats message
     */
    async sendStatsMessage(context, user) {
        const endDate = this.holidayService.getCurrentDate();
        const startDate = this.holidayService.getCurrentTime().subtract(7, 'days').format('YYYY-MM-DD');
        
        const stats = await this.database.getLocationStats(startDate, endDate);
        const userStats = stats.filter(s => s.display_name === user.display_name);
        
        let statsText = `**Your Location History (Last 7 Days):**\n\n`;
        
        if (userStats.length === 0) {
            statsText += 'No location records found for the past 7 days.';
        } else {
            userStats.forEach(stat => {
                const date = this.holidayService.formatDate(stat.date, 'MMM Do');
                let locationText = stat.work_location;
                
                if (stat.work_location === 'Hybrid') {
                    locationText += ` (AM: ${stat.morning_location}, PM: ${stat.afternoon_location})`;
                }
                
                statsText += `• **${date}**: ${locationText}\n`;
            });
        }
        
        await context.sendActivity(MessageFactory.text(statsText));
    }

    /**
     * Get or create user in database
     */
    async getOrCreateUser(context) {
        const teamsUserId = context.activity.from.id;
        let user = await this.database.getUserByTeamsId(teamsUserId);
        
        if (!user) {
            // Create new user
            const displayName = context.activity.from.name || 'Unknown User';
            const email = context.activity.from.email || '';
            const employeeNumber = context.activity.from.aadObjectId || '';
            
            await this.database.insertOrUpdateUser(teamsUserId, displayName, employeeNumber, email);
            user = await this.database.getUserByTeamsId(teamsUserId);
        }
        
        return user;
    }

    /**
     * Save user info when they join
     */
    async saveUserInfo(context, member) {
        const teamsUserId = member.id;
        const displayName = member.name || 'Unknown User';
        const email = member.email || '';
        const employeeNumber = member.aadObjectId || '';
        
        await this.database.insertOrUpdateUser(teamsUserId, displayName, employeeNumber, email);
    }

    /**
     * Add conversation reference for proactive messaging
     */
    addConversationReference(activity) {
        const conversationReference = TurnContext.getConversationReference(activity);
        this.conversationReferences[activity.from.id] = conversationReference;
    }

    /**
     * Get conversation references for scheduler
     */
    getConversationReferences() {
        return this.conversationReferences;
    }

    /**
     * Clean up expired pending hybrid responses (older than 1 hour)
     */
    cleanupPendingResponses() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [userId, response] of this.pendingHybridResponses.entries()) {
            if (response.timestamp < oneHourAgo) {
                this.pendingHybridResponses.delete(userId);
            }
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.database) {
            this.database.close();
        }
    }

    /**
     * Handle team member location queries
     */
    async handleTeamMemberLocationQuery(context, searchName) {
        const currentDate = this.holidayService.getCurrentDate();
        
        try {
            // First try exact match
            let targetUser = await this.database.getUserByDisplayName(searchName);
            
            if (!targetUser) {
                // If no exact match, try searching for partial matches
                const matches = await this.database.searchUsersByName(searchName);
                
                if (matches.length === 0) {
                    await context.sendActivity(`❌ Sorry, I couldn't find anyone named "${searchName}". Try typing "team" to see all team members.`);
                    return;
                } else if (matches.length === 1) {
                    targetUser = matches[0];
                } else {
                    // Multiple matches found
                    const matchNames = matches.map(u => u.display_name).join(', ');
                    await context.sendActivity(`🔍 Found multiple people matching "${searchName}": ${matchNames}. Please be more specific.`);
                    return;
                }
            }
            
            // Get user's current location
            const locationInfo = await this.database.getUserCurrentLocation(targetUser.id, currentDate);
            
            if (locationInfo) {
                const memberCard = createMemberLocationCard(locationInfo, currentDate);
                await context.sendActivity({ attachments: [memberCard] });
            } else {
                await context.sendActivity(`❌ Error retrieving location information for ${targetUser.display_name}.`);
            }
            
        } catch (error) {
            console.error('Error querying team member location:', error);
            await context.sendActivity('❌ Sorry, there was an error looking up that team member\'s location.');
        }
    }

    /**
     * Send team location overview
     */
    async sendTeamLocationOverview(context) {
        const currentDate = this.holidayService.getCurrentDate();
        
        try {
            const teamLocations = await this.database.getTeamCurrentLocations(currentDate);
            
            if (teamLocations.length === 0) {
                await context.sendActivity('📋 No team members found in the system yet.');
                return;
            }
            
            const teamCard = createTeamLocationCard(teamLocations, currentDate);
            await context.sendActivity({ attachments: [teamCard] });
            
        } catch (error) {
            console.error('Error fetching team locations:', error);
            await context.sendActivity('❌ Sorry, there was an error retrieving the team location overview.');
        }
    }
}

module.exports = LocationBot; 