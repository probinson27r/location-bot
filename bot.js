const { ActivityHandler, MessageFactory, TurnContext, ActivityTypes, CardFactory } = require('botbuilder');
const Database = require('./database');
const HolidayService = require('./utils/holidays');
const LocationAliases = require('./locationAliases');
const AIAgent = require('./utils/aiAgent');
const GraphService = require('./utils/graphService');
const { 
    createLocationCard, 
    createErrorCard,
    createTeamLocationCard,
    createMemberLocationCard
} = require('./cards/locationCard');
const moment = require('moment-timezone');

class LocationBot extends ActivityHandler {
    constructor() {
        super();
        this.database = new Database();
        this.holidayService = new HolidayService();
        this.locationAliases = new LocationAliases();
        this.aiAgent = new AIAgent();
        this.graphService = new GraphService();
        this.conversationReferences = {};
        
        // Add deduplication tracking
        this.recentMessages = new Map(); // Map of messageId -> timestamp
        this.DEDUPLICATION_WINDOW = 30000; // 30 seconds in milliseconds
        
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
            try {
                await this.addConversationReference(context.activity);
                
                // Create a unique message identifier for deduplication (without timestamp)
                const userId = context.activity.from.id;
                const messageText = context.activity.text || '[Card Submission]';
                const messageId = `${userId}-${messageText}`; // Simple user + message combo
                
                // Check for duplicate messages
                const now = Date.now();
                if (this.recentMessages.has(messageId)) {
                    const lastProcessed = this.recentMessages.get(messageId);
                    if (now - lastProcessed < this.DEDUPLICATION_WINDOW) {
                        console.log(`🔄 Ignoring duplicate message from ${context.activity.from.name}: "${messageText}" (${now - lastProcessed}ms ago)`);
                        return; // Skip processing this duplicate
                    }
                }
                
                // Track this message
                this.recentMessages.set(messageId, now);
                
                // Clean up old entries (older than deduplication window)
                for (const [id, processedTime] of this.recentMessages.entries()) {
                    if (now - processedTime > this.DEDUPLICATION_WINDOW) {
                        this.recentMessages.delete(id);
                    }
                }
                
                const userMessage = context.activity.text?.toLowerCase().trim();
                const userName = context.activity.from.name || 'Unknown User';
                
                // Log incoming request with user details
                console.log(`📨 Request received from ${userName} (${userId}): "${context.activity.text || '[Card Submission]'}"`);
                
                // Handle text commands
                if (userMessage) {
                    await this.handleTextCommand(context, userMessage);
                } else if (context.activity.value) {
                    // Handle card submissions
                    await this.handleCardSubmission(context);
                }
            } catch (error) {
                console.error(`❌ Error processing message from ${context.activity.from.name || 'Unknown User'}:`, error);
                
                // Send a simple error message if we haven't already responded
                try {
                    await context.sendActivity('❌ Sorry, something went wrong processing your message. Please try again.');
                } catch (responseError) {
                    console.error('❌ Error sending error response (response may have already been sent):', responseError.message);
                }
            }

            await next();
        });
    }

    async initialize() {
        await this.database.initialize();
        console.log('Location bot initialized');
    }

    /**
     * Update user's work location in Teams via Microsoft Graph API
     */
    async updateTeamsWorkLocation(user, location) {
        // Only update Teams if Graph service is configured and user has email
        if (!this.graphService.isConfigured()) {
            console.log(`⚠️ Graph Service: Not configured, skipping Teams location update for ${user.display_name}`);
            return false;
        }

        if (!user.email) {
            console.log(`⚠️ Graph Service: No email address for ${user.display_name}, skipping Teams location update`);
            return false;
        }

        // Only update for 'Remote' and 'Office' locations, skip 'clear'
        if (location !== 'Remote' && location !== 'Office') {
            console.log(`⚠️ Graph Service: Location '${location}' not applicable for Teams update`);
            return false;
        }

        try {
            console.log(`📊 Updating Teams work location for ${user.display_name} (${user.email}) to ${location}`);
            
            const success = await this.graphService.updateUserWorkLocation(user.email, location);
            
            if (success) {
                console.log(`✅ Teams work location updated successfully for ${user.display_name}`);
            } else {
                console.log(`❌ Failed to update Teams work location for ${user.display_name}`);
            }
            
            return success;
            
        } catch (error) {
            console.error(`❌ Error updating Teams work location for ${user.display_name}:`, error.message);
            return false;
        }
    }

    /**
     * Analyze user message using AI agent to determine location intent
     */
    async analyzeUserMessage(message) {
        console.log(`🤖 Analyzing user message with AI: "${message}"`);
        
        try {
            const analysis = await this.aiAgent.analyzeLocationIntent(message);
            console.log(`🤖 AI Analysis result:`, analysis);
            
            // Map AI results to our location types
            const locationMapping = {
                'office': 'office',
                'remote': 'remote', 
                'not_working': 'clear',
                'location_query': 'location_query',
                'holiday_query': 'holiday_query',
                'team_query': 'team_query',
                'unclear': null
            };
            
            const mappedLocation = locationMapping[analysis.location];
            
            if (mappedLocation && analysis.confidence >= 0.4) {
                return {
                    alias: analysis.detected_phrases[0] || analysis.location,
                    location: mappedLocation,
                    originalPhrase: message,
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning,
                    source: analysis.source,
                    aiAnalysis: analysis
                };
            }
            
            console.log(`🤖 AI confidence too low (${analysis.confidence}) or unclear, returning null`);
            return null;
            
        } catch (error) {
            console.error('🤖 Error in AI analysis:', error);
            return null;
        }
    }

    /**
     * Handle text-based commands
     */
    async handleTextCommand(context, command) {
        const user = await this.getOrCreateUser(context);
        
        console.log(`⚡ Processing message "${command}" for user ${user.display_name} (ID: ${user.id})`);
        
        // First check for direct location commands using aliases
        const locationFromAlias = this.locationAliases.getLocationFromAlias(command);
        if (locationFromAlias) {
            console.log(`🔄 Direct command "${command}" mapped to location "${locationFromAlias}"`);
            await this.handleLocationCommand(context, user, locationFromAlias);
            return;
        }

        // Check for "where is" or "location" followed by a name
        const whereIsMatch = command.match(/^(?:where is|location)\s+(.+)$/i);
        const findMatch = command.match(/^find\s+(.+)$/i);
        
        // BUT FIRST check if this is a team-related query
        const teamQueries = [
            /^(?:where is|where are)\s+(my\s+)?(team|everyone|colleagues|coworkers|workmates)$/i,
            /^(?:location of|find)\s+(my\s+)?(team|everyone|colleagues|coworkers|workmates)$/i
        ];
        
        const isTeamQuery = teamQueries.some(pattern => pattern.test(command));
        
        if (isTeamQuery) {
            console.log(`👥 User ${user.display_name} requested team overview via team query: "${command}"`);
            await this.sendTeamLocationOverview(context);
            return;
        }
        
        if (whereIsMatch || findMatch) {
            const searchName = (whereIsMatch || findMatch)[1].trim();
            console.log(`🔍 User ${user.display_name} searching for: "${searchName}"`);
            await this.handleTeamMemberLocationQuery(context, searchName);
            return;
        }

        // Handle other specific commands
        if (command === 'help') {
            console.log(`❓ User ${user.display_name} requested help`);
            await this.sendHelpMessage(context);
        } else if (command === 'status') {
            console.log(`📊 User ${user.display_name} requested status`);
            await this.sendStatusMessage(context, user);
        } else if (command === 'location' || command === 'set location') {
            console.log(`📍 User ${user.display_name} requested location prompt`);
            await this.sendLocationPrompt(context, user);
        } else if (command === 'stats') {
            console.log(`📈 User ${user.display_name} requested stats`);
            await this.sendStatsMessage(context, user);
        } else if (command === 'history') {
            console.log(`🕒 User ${user.display_name} requested history`);
            await this.sendTodayHistoryMessage(context, user);
        } else if (command === 'team' || command === 'team locations' || command === 'team status') {
            console.log(`👥 User ${user.display_name} requested team overview`);
            await this.sendTeamLocationOverview(context);
        } else if (command === 'yes' || command === 'y') {
            console.log(`✅ User ${user.display_name} said yes - need context for what they're confirming`);
            await context.sendActivity('I\'m not sure what you\'re confirming. Please use the location selection card or type "remote" or "office" directly.');
        } else if (command === 'no' || command === 'n') {
            console.log(`❌ User ${user.display_name} said no - sending location prompt`);
            await this.sendLocationPrompt(context, user);
        } else if (command === 'holidays' || command === 'public holidays') {
            console.log(`🎄 User ${user.display_name} requested holidays`);
            await this.sendHolidaysList(context);
        } else if (command === 'next holidays' || command === 'upcoming holidays') {
            console.log(`🎄 User ${user.display_name} requested next holidays`);
            await this.sendNextHolidays(context);
        } else {
            // Try to parse the phrase for location terms
            const locationParsed = await this.analyzeUserMessage(command);
            if (locationParsed) {
                if (locationParsed.location === 'holiday_query') {
                    console.log(`🎄 AI detected holiday query: "${command}"`);
                    // Determine if user wants full list or just next holidays
                    if (command.toLowerCase().includes('next') || command.toLowerCase().includes('upcoming')) {
                        await this.sendNextHolidays(context);
                    } else {
                        await this.sendHolidaysList(context);
                    }
                } else if (locationParsed.location === 'team_query') {
                    console.log(`👥 AI detected team query: "${command}"`);
                    
                    // Try to get person name from AI analysis first, then manual extraction
                    let personName = locationParsed.aiAnalysis?.extracted_person_name || this.extractPersonNameFromQuery(command);
                    
                    if (personName && personName !== 'my team' && personName !== 'team') {
                        console.log(`🔍 AI detected person query for: "${personName}"`);
                        await this.handleTeamMemberLocationQuery(context, personName);
                    } else {
                        console.log(`👥 AI detected general team query, showing team overview`);
                        await this.sendTeamLocationOverview(context);
                    }
                } else if (locationParsed.location === 'location_query') {
                    console.log(`📍 AI detected location query: "${command}"`);
                    await this.sendStatusMessage(context, user);
                } else if (locationParsed.location === 'unclear' && locationParsed.reasoning.includes('working but location not specified')) {
                    console.log(`💼 AI detected user is working but location unclear: "${command}"`);
                    await context.sendActivity(`Great! I can see you're working today. Where are you working from?`);
                    await this.sendLocationPrompt(context, user);
                } else {
                    console.log(`💬 Detected location "${locationParsed.location}" from phrase, asking for confirmation`);
                    await this.sendLocationConfirmation(context, user, locationParsed);
                }
            } else {
                console.log(`❌ User ${user.display_name} sent unknown command: "${command}"`);
                await context.sendActivity('I didn\'t understand that command. Type "help" to see available commands, "team" to see everyone\'s location, or ask "where is [name]" to find a specific person.\n\nYou can also tell me where you\'re working by saying something like "I\'m working from home" or "I\'m in the office today".\n\nFor holiday information, try asking "when is the next holiday?" or type "holidays".');
            }
        }
    }

    /**
     * Send location confirmation when detected from phrase
     */
    async sendLocationConfirmation(context, user, parsedLocation) {
        console.log(`📝 Sending confirmation for detected location: ${parsedLocation.location} from phrase: "${parsedLocation.originalPhrase}"`);
        
        try {
            let locationEmoji, locationName, confirmationText, actionText;
            
            if (parsedLocation.location === 'clear') {
                locationEmoji = '🚫';
                locationName = 'Not Working';
                confirmationText = `Hi ${user.display_name}! I detected that you might not be working today from your message:`;
                actionText = `Would you like me to clear your location for today? This will remove any existing work location.`;
            } else {
                locationEmoji = parsedLocation.location === 'remote' ? '🏠' : '🏢';
                locationName = parsedLocation.location.charAt(0).toUpperCase() + parsedLocation.location.slice(1);
                confirmationText = `Hi ${user.display_name}! I detected that you might be working ${locationName} from your message:`;
                actionText = `Would you like me to set your location to ${locationEmoji} ${locationName} for today?`;
            }
            
            // Create confidence and reasoning display
            const confidenceEmoji = parsedLocation.confidence >= 0.8 ? '🎯' : parsedLocation.confidence >= 0.6 ? '👍' : '🤔';
            const confidenceText = this.aiAgent.getConfidenceDescription(parsedLocation.confidence);
            const sourceText = parsedLocation.source === 'ai' ? '🤖 AI' : '📋 Rules';
            
            const confirmationCard = {
                type: 'AdaptiveCard',
                version: '1.2',
                body: [
                    {
                        type: 'TextBlock',
                        text: '🤔 Location Confirmation',
                        size: 'Large',
                        weight: 'Bolder',
                        color: 'Accent'
                    },
                    {
                        type: 'TextBlock',
                        text: confirmationText,
                        wrap: true,
                        spacing: 'Medium'
                    },
                    {
                        type: 'TextBlock',
                        text: `"${parsedLocation.originalPhrase}"`,
                        wrap: true,
                        spacing: 'Small',
                        style: 'emphasis'
                    },
                    {
                        type: 'TextBlock',
                        text: actionText,
                        wrap: true,
                        spacing: 'Medium'
                    },
                    {
                        type: 'FactSet',
                        facts: [
                            {
                                title: 'Analysis Source:',
                                value: sourceText
                            },
                            {
                                title: 'Confidence:',
                                value: `${confidenceEmoji} ${confidenceText} (${Math.round(parsedLocation.confidence * 100)}%)`
                            },
                            {
                                title: 'Reasoning:',
                                value: parsedLocation.reasoning || 'Pattern-based detection'
                            }
                        ],
                        spacing: 'Medium'
                    }
                ],
                actions: [
                    {
                        type: 'Action.Submit',
                        title: `✅ Yes, ${parsedLocation.location === 'clear' ? 'clear my location' : `set to ${locationEmoji} ${locationName}`}`,
                        data: {
                            action: 'confirm_location',
                            location: locationName,
                            originalPhrase: parsedLocation.originalPhrase,
                            confidence: parsedLocation.confidence,
                            source: parsedLocation.source
                        }
                    },
                    {
                        type: 'Action.Submit',
                        title: '❌ No, that\'s not right',
                        data: {
                            action: 'reject_location',
                            originalPhrase: parsedLocation.originalPhrase,
                            confidence: parsedLocation.confidence,
                            source: parsedLocation.source
                        }
                    }
                ]
            };

            console.log(`📤 Sending AI-enhanced confirmation card for ${locationName}`);
            const statusText = parsedLocation.location === 'clear' 
                ? `💬 I think you're not working today. Let me confirm... (${confidenceText} confidence)`
                : `💬 I think you said you're working ${locationName.toLowerCase()}. Let me confirm... (${confidenceText} confidence)`;
            
            await context.sendActivity(statusText);
            await context.sendActivity({ attachments: [CardFactory.adaptiveCard(confirmationCard)] });
            console.log(`✅ AI-enhanced confirmation card sent successfully`);
            
        } catch (error) {
            console.error(`❌ Error sending location confirmation:`, error);
            // Fallback to text-based confirmation with error protection
            try {
                const locationName = parsedLocation.location === 'clear' ? 'not working' : parsedLocation.location;
                const confidenceText = parsedLocation.confidence ? ` (${Math.round(parsedLocation.confidence * 100)}% confidence)` : '';
                
                await context.sendActivity(`💬 I detected you might be ${locationName} from: "${parsedLocation.originalPhrase}"${confidenceText}\n\nType "yes" to confirm or "no" to choose a different option.`);
            } catch (fallbackError) {
                console.error('❌ Error sending fallback location confirmation (response may have already been sent):', fallbackError.message);
            }
        }
    }

    /**
     * Handle adaptive card submissions
     */
    async handleCardSubmission(context) {
        const data = context.activity.value;
        const user = await this.getOrCreateUser(context);
        const currentDate = this.holidayService.getCurrentDate();

        console.log(`🃏 Card submission from ${user.display_name} (ID: ${user.id}) - Action: ${data.action}`);

        try {
            switch (data.action) {
                case 'location_selected':
                    console.log(`📍 User ${user.display_name} selected location: ${data.location}`);
                    await this.handleLocationSelection(context, user, data.location, currentDate);
                    break;
                
                case 'confirm_location':
                    console.log(`✅ User ${user.display_name} confirmed location: ${data.location} from phrase: "${data.originalPhrase}"`);
                    await this.handleLocationCommand(context, user, data.location.toLowerCase());
                    break;
                
                case 'reject_location':
                    console.log(`❌ User ${user.display_name} rejected location detection from phrase: "${data.originalPhrase}"`);
                    await this.sendLocationPrompt(context, user);
                    break;
                
                case 'restart_selection':
                    console.log(`🔄 User ${user.display_name} restarting location selection`);
                    await this.sendLocationPrompt(context, user);
                    break;
                
                default:
                    console.log(`❌ User ${user.display_name} sent unknown card action: ${data.action}`);
                    await context.sendActivity('Unknown action received.');
            }
        } catch (error) {
            console.error(`❌ Error handling card submission from ${user.display_name}:`, error);
            
            // Send error response with protection against double responses
            try {
                const errorCard = createErrorCard(user.display_name, 'An error occurred while processing your response. Please try again.');
                await context.sendActivity({ attachments: [errorCard] });
            } catch (errorResponseError) {
                console.error('❌ Error sending error card (response may have already been sent):', errorResponseError.message);
                
                // Try simple text fallback
                try {
                    await context.sendActivity('❌ Sorry, something went wrong. Please try again.');
                } catch (textFallbackError) {
                    console.error('❌ Error sending text fallback (response already sent):', textFallbackError.message);
                }
            }
        }
    }

    /**
     * Handle location selection (Remote, Office)
     */
    async handleLocationSelection(context, user, location, currentDate) {
        // Save simple location response
        const isUpdate = await this.saveLocationResponse(user, currentDate, location);
        
        // Send simple text confirmation
        const locationEmoji = location === 'Remote' ? '🏠' : '🏢';
        const updateText = isUpdate ? 'updated' : 'set';
        const timeText = new Date().toLocaleTimeString('en-AU', { 
            timeZone: 'Australia/Perth',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        console.log(`✅ Sending text confirmation to ${user.display_name} for ${location} (isUpdate: ${isUpdate}) (from card selection)`);
        await context.sendActivity(`✅ **Location ${updateText}!**\n\n${locationEmoji} **${location}** at ${timeText}\n\n💡 You can change your location anytime by typing "remote" or "office", or just tell me naturally like "I'm working from home".`);
    }

    /**
     * Save location response to database with tenant isolation
     */
    async saveLocationResponse(user, date, location, morningLocation = null, afternoonLocation = null) {
        try {
            // Check if this is an update (user already has entries for today)
            const existingCount = await this.database.getLocationCount(user.tenant_id, user.id, date);
            const isUpdate = existingCount > 0;

            // Get reminder count if exists (only for first entry of the day)
            let reminderCount = 0;
            if (!isUpdate) {
                const pendingReminders = await this.database.getPendingReminders(user.tenant_id, date);
                const userReminder = pendingReminders.find(r => r.user_id === user.id);
                reminderCount = userReminder ? userReminder.reminder_count : 0;
                
                // Remove pending reminder since user has now responded
                await this.database.removePendingReminder(user.tenant_id, user.id, date);
            }

            // Save to database first
            await this.database.saveLocationResponse(
                user.tenant_id,
                user.id, 
                date, 
                location, 
                morningLocation, 
                afternoonLocation, 
                reminderCount
            );
            
            // Enhanced logging with user details
            const userDisplayName = user.display_name || 'Unknown User';
            const actionType = isUpdate ? 'updated' : 'saved';
            
            console.log(`📍 Location ${actionType} for ${userDisplayName} (ID: ${user.id}, Tenant: ${user.tenant_id}): ${location} on ${date}`);
            
            // Update Teams work location via Graph API (async, don't wait for it)
            this.updateTeamsWorkLocation(user, location).catch(error => {
                console.error(`❌ Teams location update failed for ${userDisplayName}:`, error.message);
            });
            
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
        console.log(`📍 Sending location selection card to ${user.display_name}`);
        const locationCard = createLocationCard(user.display_name);
        
        // Send the card
        await context.sendActivity({ attachments: [locationCard] });
    }

    /**
     * Send help message
     */
    async sendHelpMessage(context) {
        const aiStatus = this.aiAgent.isAIAvailable() ? '🤖 AI-Powered' : '📋 Rule-Based';
        
        const helpText = `
**Location Bot Commands:**

🔄 **remote** - Set your location to Remote  
🏢 **office** - Set your location to Office  
📍 **location** - Get prompted to choose your location  
👀 **status** - Check your current location  
📊 **stats** - View your location statistics  
🕒 **history** - View today's location changes  
👥 **team** - View team location overview  
🔍 **where is [name]** - Find specific team member  

🎄 **Holiday Commands:**  
• **holidays** - View all public holidays for next 12 months  
• **next holidays** - View next 5 upcoming holidays  
• Or ask naturally: "When is the next holiday?", "What holidays are coming up?"

👥 **Team Commands:**  
• **team** - View team location overview  
• **where is [name]** - Find specific team member  
• Or ask naturally: "Where is my team?", "Who is in the office?", "Team status please"

📱 **Quick Actions:**  
• You can set your location right from cards or by typing  
• You can also tell me your location anytime by typing "remote" or "office"  
• I'll send friendly reminders if you haven't set your location  

💬 **Natural Language (${aiStatus}):**  
• Just tell me where you're working naturally!  
• Examples: "I'm working from home today", "At the office now", "I'm sick today"  
• I'll analyze your message and show my confidence level before confirming  
• Supports office, remote, and not-working (sick/holiday/vacation) detection  

⏰ **Daily Schedule:**  
• I'll ask for your location each morning at 9:00 AM  
• Friendly reminders at 9:30 AM and 10:00 AM if needed  
• No prompts on weekends or public holidays

🤖 **AI Features:**  
• Intelligent message analysis with confidence scoring  
• Context-aware location detection  
• Fallback to rule-based processing if AI is unavailable`;
        
        await context.sendActivity(MessageFactory.text(helpText));
    }

    /**
     * Send status message
     */
    async sendStatusMessage(context, user) {
        const currentDate = this.holidayService.getCurrentDate();
        const latestLocation = await this.database.getLatestLocationForUser(user.tenant_id, user.id, currentDate);
        const locationCount = await this.database.getLocationCount(user.tenant_id, user.id, currentDate);
        
        if (latestLocation) {
            const locationText = latestLocation.work_location === 'Remote' ? '🏠 Remote' : '🏢 Office';
            const responseTime = new Date(latestLocation.response_time).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            await context.sendActivity(`📊 **Your Status for ${currentDate}:**\n\n` +
                `📍 Current Location: ${locationText}\n` +
                `⏰ Set at: ${responseTime}\n` +
                `🔄 Updates today: ${locationCount} time${locationCount === 1 ? '' : 's'}`);
        } else {
            await context.sendActivity('⏳ You haven\'t set your location for today yet.');
        }
    }

    /**
     * Send today's location history
     */
    async sendTodayHistoryMessage(context, user) {
        const currentDate = this.holidayService.getCurrentDate();
        const history = await this.database.getUserLocationHistory(user.tenant_id, user.id, currentDate);
        
        if (history.length > 0) {
            let historyText = `📅 **Your Location History for ${currentDate}:**\n\n`;
            
            history.forEach((entry, index) => {
                const responseTime = new Date(entry.response_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                
                const locationText = entry.work_location === 'Remote' ? '🏠 Remote' : '🏢 Office';
                historyText += `${index + 1}. ${locationText} - ${responseTime}\n`;
            });
            
            await context.sendActivity(historyText);
        } else {
            await context.sendActivity('📅 No location history found for today.');
        }
    }

    /**
     * Send stats message
     */
    async sendStatsMessage(context, user) {
        const endDate = this.holidayService.getCurrentDate();
        const startDate = this.holidayService.getCurrentTime().subtract(7, 'days').format('YYYY-MM-DD');
        
        const stats = await this.database.getLocationStats(user.tenant_id, startDate, endDate);
        const userStats = stats.filter(s => s.display_name === user.display_name);
        
        if (userStats.length > 0) {
            let statsText = `📈 **Your Location Statistics (Last 7 Days):**\n\n`;
            
            userStats.forEach(stat => {
                const date = this.holidayService.formatDateShort(stat.date);
                const locationText = stat.work_location === 'Remote' ? '🏠 Remote' : '🏢 Office';
                const count = stat.update_count;
                
                statsText += `📅 ${date}: ${locationText} (${count} update${count === 1 ? '' : 's'})\n`;
            });
            
            await context.sendActivity(statsText);
        } else {
            await context.sendActivity('📈 No location data found for the last 7 days.');
        }
    }

    /**
     * Get or create user in database with tenant isolation
     */
    async getOrCreateUser(context) {
        const teamsUserId = context.activity.from.id;
        const tenantId = context.activity.conversation.tenantId || 'unknown-tenant';
        
        // Debug logging to see what user data we're receiving
        console.log(`🔍 User data from context: ID=${teamsUserId}, Name="${context.activity.from.name}", Email="${context.activity.from.email || 'N/A'}", TenantID=${tenantId}`);
        
        let user = await this.database.getUserByTeamsId(tenantId, teamsUserId);
        
        if (!user) {
            // Create new user
            const displayName = context.activity.from.name || 'Unknown User';
            const email = context.activity.from.email || '';
            const employeeNumber = context.activity.from.aadObjectId || '';
            
            console.log(`👤 Creating new user: ${displayName} (${teamsUserId}) for tenant ${tenantId}`);
            
            await this.database.insertOrUpdateUser(tenantId, teamsUserId, displayName, employeeNumber, email);
            user = await this.database.getUserByTeamsId(tenantId, teamsUserId);
        } else {
            console.log(`👤 Found existing user: ${user.display_name} (ID: ${user.id}) for tenant ${tenantId}`);
        }
        
        // Add tenant_id to user object for easy access
        user.tenant_id = tenantId;
        return user;
    }

    /**
     * Save user info when they join with tenant isolation
     */
    async saveUserInfo(context, member) {
        const teamsUserId = member.id;
        const tenantId = context.activity.conversation.tenantId || 'unknown-tenant';
        const displayName = member.name || 'Unknown User';
        const email = member.email || '';
        const employeeNumber = member.aadObjectId || '';
        
        console.log(`👤 Saving user info for tenant ${tenantId}: ${displayName} (${teamsUserId})`);
        await this.database.insertOrUpdateUser(tenantId, teamsUserId, displayName, employeeNumber, email);
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
     * Close database connection
     */
    close() {
        if (this.database) {
            this.database.close();
        }
    }

    /**
     * Clean up pending responses (called periodically)
     */
    async cleanupPendingResponses() {
        try {
            console.log('🧹 Running periodic cleanup of pending responses...');
            
            // Get current date
            const currentDate = this.holidayService.getCurrentDate();
            
            // Clean up pending reminders older than 3 days
            const threeDaysAgo = this.holidayService.getCurrentTime().subtract(3, 'days').format('YYYY-MM-DD');
            
            // Note: We need to clean up across all tenants, but the database method should handle tenant isolation
            const cleanedCount = await this.database.cleanupOldPendingReminders(threeDaysAgo);
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} old pending reminders (older than ${threeDaysAgo})`);
            } else {
                console.log('🧹 No old pending reminders to clean up');
            }
            
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }

    /**
     * Handle team member location queries
     */
    async handleTeamMemberLocationQuery(context, searchName) {
        const currentDate = this.holidayService.getCurrentDate();
        const currentUser = await this.getOrCreateUser(context);
        
        console.log(`🔍 Starting search for "${searchName}" on date ${currentDate}`);
        
        try {
            // First check if user is searching for themselves
            if (searchName.toLowerCase() === currentUser.display_name.toLowerCase()) {
                console.log(`👤 User is searching for themselves: ${currentUser.display_name} (ID: ${currentUser.id})`);
                const locationInfo = await this.database.getUserCurrentLocation(currentUser.tenant_id, currentUser.id, currentDate);
                console.log(`📍 Self location info result:`, locationInfo || 'No location data found');
                
                if (locationInfo) {
                    console.log(`✅ Sending self location card for ${currentUser.display_name}`);
                    const memberCard = createMemberLocationCard(locationInfo, currentDate);
                    
                    // Add fallback text for debugging
                    await context.sendActivity(`📍 Your current location: ${locationInfo.work_location || 'No location set'}`);
                    await context.sendActivity({ attachments: [memberCard] });
                } else {
                    console.log(`❌ No location data found for ${currentUser.display_name}`);
                    await context.sendActivity(`❌ You haven't set your location for today yet.`);
                }
                return;
            }
            
            // Search for other users
            console.log(`🔍 Attempting exact match for "${searchName}"`);
            let targetUser = await this.database.getUserByDisplayName(currentUser.tenant_id, searchName);
            console.log(`🔍 Exact match result:`, targetUser ? `Found ${targetUser.display_name} (ID: ${targetUser.id})` : 'No exact match');
            
            if (!targetUser) {
                // If no exact match, try searching for partial matches
                console.log(`🔍 Attempting partial match search for "${searchName}"`);
                const matches = await this.database.searchUsersByName(currentUser.tenant_id, searchName);
                console.log(`🔍 Partial search found ${matches.length} matches:`, matches.map(u => `${u.display_name} (ID: ${u.id})`));
                
                if (matches.length === 0) {
                    console.log(`❌ No matches found for "${searchName}"`);
                    await context.sendActivity(`❌ Sorry, I couldn't find anyone named "${searchName}". Try typing "team" to see all team members.`);
                    return;
                } else if (matches.length === 1) {
                    targetUser = matches[0];
                    console.log(`✅ Single match found: ${targetUser.display_name} (ID: ${targetUser.id})`);
                } else {
                    // Multiple matches found - exclude current user and show options
                    const otherMatches = matches.filter(u => u.id !== currentUser.id);
                    if (otherMatches.length === 1) {
                        targetUser = otherMatches[0];
                        console.log(`✅ Single other match found: ${targetUser.display_name} (ID: ${targetUser.id})`);
                    } else {
                        const matchNames = otherMatches.map(u => `${u.display_name} (ID: ${u.id})`).join(', ');
                        console.log(`🔍 Multiple other matches found: ${matchNames}`);
                        await context.sendActivity(`🔍 Found multiple people matching "${searchName}": ${otherMatches.map(u => u.display_name).join(', ')}. Please be more specific or use the team command to see everyone.`);
                        return;
                    }
                }
            }
            
            // Get user's current location
            console.log(`📍 Getting current location for ${targetUser.display_name} (ID: ${targetUser.id}) on ${currentDate}`);
            const locationInfo = await this.database.getUserCurrentLocation(targetUser.tenant_id, targetUser.id, currentDate);
            console.log(`📍 Location info result:`, locationInfo || 'No location data found');
            
            if (locationInfo) {
                console.log(`✅ Sending location card for ${targetUser.display_name}`);
                const memberCard = createMemberLocationCard(locationInfo, currentDate);
                
                // Add fallback text for debugging
                await context.sendActivity(`📍 Location info for ${locationInfo.display_name}: ${locationInfo.work_location || 'No location set'}`);
                await context.sendActivity({ attachments: [memberCard] });
            } else {
                console.log(`❌ No location data found for ${targetUser.display_name}`);
                await context.sendActivity(`❌ ${targetUser.display_name} hasn't set their location for today yet.`);
            }
            
        } catch (error) {
            console.error('❌ Error querying team member location:', error);
            await context.sendActivity('❌ Sorry, there was an error looking up that team member\'s location.');
        }
    }

    /**
     * Send team location overview with tenant isolation
     */
    async sendTeamLocationOverview(context) {
        const currentDate = this.holidayService.getCurrentDate();
        const currentUser = await this.getOrCreateUser(context);
        
        console.log(`👥 Getting team locations for date: ${currentDate} for tenant ${currentUser.tenant_id}`);
        
        try {
            const teamLocations = await this.database.getTeamCurrentLocations(currentUser.tenant_id, currentDate);
            console.log(`👥 Team locations query returned ${teamLocations.length} results:`, teamLocations);
            
            if (teamLocations.length === 0) {
                console.log(`📋 No team members found, sending empty message`);
                await context.sendActivity('📋 No team members found in the system yet.');
                return;
            }
            
            // Calculate statistics
            const membersWithLocation = teamLocations.filter(member => member.work_location).length;
            const totalMembers = teamLocations.length;
            
            const locationCounts = {
                Remote: teamLocations.filter(m => m.work_location === 'Remote').length,
                Office: teamLocations.filter(m => m.work_location === 'Office').length
            };
            
            console.log(`✅ Creating team location card for ${teamLocations.length} members`);
            console.log(`📊 Stats: ${membersWithLocation}/${totalMembers} members responded, Remote: ${locationCounts.Remote}, Office: ${locationCounts.Office}`);
            
            // Send just the card (no text summary to avoid duplication)
            const teamCard = createTeamLocationCard(teamLocations, currentDate);
            console.log(`🃏 Team card created for ${teamLocations.length} members`);
            await context.sendActivity({ attachments: [teamCard] });
            
        } catch (error) {
            console.error('❌ Error fetching team locations:', error);
            await context.sendActivity('❌ Sorry, there was an error retrieving the team location overview.');
        }
    }

    /**
     * Handle location commands using aliases
     */
    async handleLocationCommand(context, user, locationType) {
        const currentDate = this.holidayService.getCurrentDate();
        
        if (locationType === 'clear') {
            // Handle clearing location (not working)
            console.log(`🚫 User ${user.display_name} clearing location (not working)`);
            
            try {
                const cleared = await this.database.clearUserLocation(user.tenant_id, user.id, currentDate);
                
                const timeText = new Date().toLocaleTimeString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                
                if (cleared > 0) {
                    console.log(`✅ Cleared ${cleared} location entries for ${user.display_name}`);
                    await context.sendActivity(`✅ **Location cleared!**\n\n🚫 **Not Working** at ${timeText}\n\n💡 Your work location has been removed for today. You can set it again anytime by typing "remote" or "office".`);
                } else {
                    console.log(`ℹ️ No existing location to clear for ${user.display_name}`);
                    await context.sendActivity(`ℹ️ **Location status updated!**\n\n🚫 **Not Working** at ${timeText}\n\n💡 You didn't have a location set for today anyway. You can set one anytime by typing "remote" or "office".`);
                }
                
                // Remove any pending reminders since user has indicated they're not working
                await this.database.removePendingReminder(user.tenant_id, user.id, currentDate);
                
            } catch (error) {
                console.error('❌ Error clearing user location:', error);
                await context.sendActivity('❌ Sorry, there was an error clearing your location. Please try again.');
            }
            
            return;
        }
        
        // Handle regular location setting (Remote/Office)
        
        // Capitalize first letter for consistency
        const location = locationType.charAt(0).toUpperCase() + locationType.slice(1);
        
        const locationEmoji = location === 'Remote' ? '🏠' : '🏢';
        console.log(`${locationEmoji} User ${user.display_name} setting location to ${location}`);
        
        // Save simple location response
        const isUpdate = await this.saveLocationResponse(user, currentDate, location);
        
        // Send simple text confirmation
        const updateText = isUpdate ? 'updated' : 'set';
        const timeText = new Date().toLocaleTimeString('en-AU', { 
            timeZone: 'Australia/Perth',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        console.log(`✅ Sending text confirmation to ${user.display_name} for ${location} (isUpdate: ${isUpdate})`);
        await context.sendActivity(`✅ **Location ${updateText}!**\n\n${locationEmoji} **${location}** at ${timeText}\n\n💡 You can change your location anytime by typing "remote" or "office", or just tell me naturally like "I'm working from home".`);
    }

    /**
     * Send upcoming holidays for the next 12 months
     */
    async sendHolidaysList(context) {
        console.log(`🎄 Fetching upcoming holidays for next 12 months`);
        
        try {
            const holidays = await this.holidayService.getUpcomingHolidays();
            
            if (holidays.length === 0) {
                await context.sendActivity('🎄 No upcoming public holidays found for the next 12 months.');
                return;
            }
            
            const formattedHolidays = this.holidayService.formatHolidaysForDisplay(holidays);
            
            // Group holidays by month for better display
            const holidaysByMonth = {};
            formattedHolidays.forEach(holiday => {
                const monthYear = moment(holiday.date).tz(this.holidayService.timezone).format('MMMM YYYY');
                if (!holidaysByMonth[monthYear]) {
                    holidaysByMonth[monthYear] = [];
                }
                holidaysByMonth[monthYear].push(holiday);
            });
            
            let holidayText = `🎄 **Public Holidays in Western Australia - Next 12 Months**\n\n`;
            holidayText += `📅 Found ${holidays.length} upcoming public holidays\n\n`;
            
            // Display holidays grouped by month
            Object.keys(holidaysByMonth).forEach(monthYear => {
                holidayText += `**${monthYear}**\n`;
                
                holidaysByMonth[monthYear].forEach(holiday => {
                    const emoji = holiday.daysUntil <= 7 ? '⭐' : '🎄';
                    holidayText += `${emoji} **${holiday.name}**\n`;
                    holidayText += `   📅 ${holiday.dayOfWeek}, ${holiday.formattedDate}\n`;
                    holidayText += `   ${holiday.timeIndicator}\n\n`;
                });
                
                holidayText += '\n';
            });
            
            holidayText += `💡 **Tip**: Type "next holidays" for just the next 5 upcoming holidays\n`;
            holidayText += `📍 These holidays may affect work location reminders`;
            
            await context.sendActivity(holidayText);
            
        } catch (error) {
            console.error('🎄 Error fetching holidays:', error);
            await context.sendActivity('❌ Sorry, there was an error fetching the holiday information. Please try again later.');
        }
    }

    /**
     * Send next 5 upcoming holidays
     */
    async sendNextHolidays(context) {
        console.log(`🎄 Fetching next 5 upcoming holidays`);
        
        try {
            const holidays = await this.holidayService.getNextHolidays(5);
            
            if (holidays.length === 0) {
                await context.sendActivity('🎄 No upcoming public holidays found.');
                return;
            }
            
            const formattedHolidays = this.holidayService.formatHolidaysForDisplay(holidays);
            
            let holidayText = `🎄 **Next ${holidays.length} Public Holidays in Western Australia**\n\n`;
            
            formattedHolidays.forEach((holiday, index) => {
                const emoji = holiday.daysUntil <= 7 ? '⭐' : '🎄';
                holidayText += `${index + 1}. ${emoji} **${holiday.name}**\n`;
                holidayText += `   📅 ${holiday.dayOfWeek}, ${holiday.formattedDate}\n`;
                holidayText += `   ${holiday.timeIndicator}\n\n`;
            });
            
            holidayText += `💡 **Tip**: Type "holidays" to see all holidays for the next 12 months\n`;
            holidayText += `📍 Work location reminders are skipped on public holidays`;
            
            await context.sendActivity(holidayText);
            
        } catch (error) {
            console.error('🎄 Error fetching next holidays:', error);
            await context.sendActivity('❌ Sorry, there was an error fetching the holiday information. Please try again later.');
        }
    }

    /**
     * Extract person name from a query
     */
    extractPersonNameFromQuery(query) {
        const lowerQuery = query.toLowerCase().trim();
        
        // Remove common conversational qualifiers
        const timeQualifiers = /\s+(today|now|currently|this\s+morning|this\s+afternoon|right\s+now|at\s+the\s+moment)\??$/i;
        const cleanQuery = query.replace(timeQualifiers, '').trim();
        
        // Pattern: "where is [name]" or "where is [name] today"  
        let match = cleanQuery.match(/^(?:where\s+is|location\s+of)\s+(.+?)(\s+today|\s+now|\s+currently)?$/i);
        if (match) {
            const name = match[1].trim();
            // Don't match team-related queries
            if (!name.match(/^(my\s+)?(team|everyone|colleagues|coworkers|workmates)$/i)) {
                return name;
            }
        }
        
        // Pattern: "is [name] in the office" or "is [name] remote"
        match = cleanQuery.match(/^is\s+(.+?)\s+(in\s+the\s+office|at\s+the\s+office|remote|at\s+home|working|in\s+today)$/i);
        if (match) {
            return match[1].trim();
        }
        
        // Pattern: "find [name]" or "find [name]'s location"  
        match = cleanQuery.match(/^find\s+(.+?)(?:'s\s+location|'s\s+status)?$/i);
        if (match) {
            const name = match[1].trim();
            if (!name.match(/^(my\s+)?(team|everyone|colleagues|coworkers|workmates)$/i)) {
                return name;
            }
        }
        
        // Pattern: "[name]'s location" or "[name]'s status"
        match = cleanQuery.match(/^(.+?)(?:'s\s+(?:location|status|work\s+location))$/i);
        if (match) {
            const name = match[1].trim();
            if (!name.match(/^(my\s+)?(team|everyone|colleagues|coworkers|workmates)$/i)) {
                return name;
            }
        }
        
        // Return null for general team queries or if no pattern matched
        return null;
    }
}

module.exports = LocationBot; 