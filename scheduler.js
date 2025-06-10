const schedule = require('node-schedule');
const config = require('./config');
const HolidayService = require('./utils/holidays');
const Database = require('./database');
const { createLocationCard } = require('./cards/locationCard');

class LocationScheduler {
    constructor(botAdapter, conversationReferences) {
        this.botAdapter = botAdapter;
        this.conversationReferences = conversationReferences;
        this.holidayService = new HolidayService();
        this.database = new Database();
        this.jobs = {};
    }

    async initialize() {
        await this.database.initialize();
        this.scheduleDailyPrompts();
        this.scheduleReminders();
        this.scheduleDailyReset();
        console.log('Location scheduler initialized');
    }

    /**
     * Schedule daily location prompts at 9:00 AM
     */
    scheduleDailyPrompts() {
        this.jobs.dailyPrompt = schedule.scheduleJob(config.schedules.dailyPrompt, async () => {
            await this.sendDailyLocationPrompts();
        });
        
        console.log('Daily prompts scheduled for 9:00 AM (Monday-Friday)');
    }

    /**
     * Schedule reminder prompts at 9:30 AM and 10:00 AM
     */
    scheduleReminders() {
        // First reminder at 9:30 AM
        this.jobs.firstReminder = schedule.scheduleJob(config.schedules.firstReminder, async () => {
            await this.sendReminders(1);
        });

        // Second reminder at 10:00 AM
        this.jobs.secondReminder = schedule.scheduleJob(config.schedules.secondReminder, async () => {
            await this.sendReminders(2);
        });

        console.log('Reminder schedules set for 9:30 AM and 10:00 AM (Monday-Friday)');
    }

    /**
     * Schedule daily reset at 11:59 PM
     */
    scheduleDailyReset() {
        this.jobs.dailyReset = schedule.scheduleJob(config.schedules.dailyReset, async () => {
            await this.performDailyReset();
        });
        
        console.log('Daily reset scheduled for 11:59 PM (Monday-Friday)');
    }

    /**
     * Send daily location prompts to all users with tenant isolation
     */
    async sendDailyLocationPrompts() {
        try {
            const currentDate = this.holidayService.getCurrentDate();
            
            // Check if today is a working day
            const isWorkingDay = await this.holidayService.isWorkingDay(currentDate);
            if (!isWorkingDay) {
                console.log(`Skipping daily prompts - ${currentDate} is not a working day`);
                return;
            }

            console.log(`🔄 Sending daily location prompts for ${currentDate} (processing all tenants)`);

            // Get all users from database (this now returns users with tenant_id)
            const allUsers = await this.database.getAllUsers(''); // Empty string to get all tenants for migration
            
            // Group users by tenant for processing
            const usersByTenant = {};
            allUsers.forEach(user => {
                const tenantId = user.tenant_id || 'unknown-tenant';
                if (!usersByTenant[tenantId]) {
                    usersByTenant[tenantId] = [];
                }
                usersByTenant[tenantId].push(user);
            });

            console.log(`📊 Processing daily prompts for ${Object.keys(usersByTenant).length} tenants`);

            // Process each tenant separately
            for (const [tenantId, users] of Object.entries(usersByTenant)) {
                console.log(`🏢 Processing ${users.length} users for tenant: ${tenantId}`);
                
                for (const user of users) {
                    try {
                        // Check if user already responded today (with tenant isolation)
                        const hasResponded = await this.database.hasUserRespondedToday(tenantId, user.id, currentDate);
                        
                        if (!hasResponded) {
                            await this.sendLocationPromptToUser(user, false, 0);
                            // Add pending reminder for this user (with tenant isolation)
                            await this.database.addPendingReminder(tenantId, user.id, currentDate);
                        }
                    } catch (error) {
                        console.error(`Error sending prompt to user ${user.display_name} (tenant: ${tenantId}):`, error);
                    }
                }
            }
            
            console.log(`✅ Daily prompts completed for all tenants`);
        } catch (error) {
            console.error('Error in daily location prompts:', error);
        }
    }

    /**
     * Send reminder prompts to users who haven't responded with tenant isolation
     */
    async sendReminders(reminderNumber) {
        try {
            const currentDate = this.holidayService.getCurrentDate();
            
            // Check if today is a working day
            const isWorkingDay = await this.holidayService.isWorkingDay(currentDate);
            if (!isWorkingDay) {
                console.log(`Skipping reminders - ${currentDate} is not a working day`);
                return;
            }

            console.log(`🔔 Sending reminder ${reminderNumber} for ${currentDate} (processing all tenants)`);

            // Get all tenants by getting all users and extracting unique tenant IDs
            const allUsers = await this.database.getAllUsers(''); // Get all users across tenants
            const tenantIds = [...new Set(allUsers.map(user => user.tenant_id || 'unknown-tenant'))];

            console.log(`📊 Processing reminders for ${tenantIds.length} tenants`);

            // Process each tenant separately
            for (const tenantId of tenantIds) {
                console.log(`🏢 Processing reminders for tenant: ${tenantId}`);
                
                try {
                    // Get users who need reminders for this specific tenant
                    const pendingReminders = await this.database.getPendingReminders(tenantId, currentDate);
                    
                    for (const reminder of pendingReminders) {
                        try {
                            // Check if this reminder number should be sent
                            if (reminder.reminder_count < reminderNumber) {
                                const user = {
                                    id: reminder.user_id,
                                    teams_user_id: reminder.teams_user_id,
                                    display_name: reminder.display_name
                                };
                                
                                await this.sendLocationPromptToUser(user, true, reminder.reminder_count);
                                await this.database.updateReminderCount(tenantId, reminder.user_id, currentDate);
                            }
                        } catch (error) {
                            console.error(`Error sending reminder to user ${reminder.display_name} (tenant: ${tenantId}):`, error);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing reminders for tenant ${tenantId}:`, error);
                }
            }
            
            console.log(`✅ Reminders completed for all tenants`);
        } catch (error) {
            console.error('Error in sending reminders:', error);
        }
    }

    /**
     * Send location prompt to a specific user
     */
    async sendLocationPromptToUser(user, isReminder = false, reminderCount = 0) {
        const conversationReference = this.conversationReferences[user.teams_user_id];
        
        if (!conversationReference) {
            console.warn(`No conversation reference found for user ${user.display_name}`);
            return;
        }

        const locationCard = createLocationCard(user.display_name, isReminder, reminderCount);

        await this.botAdapter.continueConversation(conversationReference, async (context) => {
            await context.sendActivity({
                attachments: [locationCard]
            });
        });

        console.log(`Location prompt sent to ${user.display_name} (reminder: ${isReminder}, count: ${reminderCount})`);
    }

    /**
     * Manually trigger daily prompts (for testing)
     */
    async triggerDailyPrompts() {
        console.log('Manually triggering daily prompts...');
        await this.sendDailyLocationPrompts();
    }

    /**
     * Manually trigger reminders (for testing)
     */
    async triggerReminders(reminderNumber = 1) {
        console.log(`Manually triggering reminder ${reminderNumber}...`);
        await this.sendReminders(reminderNumber);
    }

    /**
     * Perform daily reset with tenant isolation - clear pending reminders and optionally send summary
     */
    async performDailyReset() {
        try {
            const currentDate = this.holidayService.getCurrentDate();
            
            // Check if today was a working day
            const isWorkingDay = await this.holidayService.isWorkingDay(currentDate);
            if (!isWorkingDay) {
                console.log(`Skipping daily reset - ${currentDate} was not a working day`);
                return;
            }

            console.log(`🔄 Performing daily reset for ${currentDate} (processing all tenants)`);

            // Get all tenants by getting all users and extracting unique tenant IDs
            const allUsers = await this.database.getAllUsers(''); // Get all users across tenants
            const tenantIds = [...new Set(allUsers.map(user => user.tenant_id || 'unknown-tenant'))];

            console.log(`📊 Processing daily reset for ${tenantIds.length} tenants`);

            // Process each tenant separately
            for (const tenantId of tenantIds) {
                console.log(`🏢 Processing daily reset for tenant: ${tenantId}`);
                
                try {
                    // Get daily statistics before clearing for this tenant
                    const stats = await this.database.getDailyStatistics(tenantId, currentDate);
                    const nonRespondingUsers = await this.database.getUsersWhoDidntRespond(tenantId, currentDate);

                    // Clear pending reminders for today for this tenant
                    const clearedReminders = await this.database.clearAllPendingReminders(tenantId, currentDate);

                    // Log end-of-day summary per tenant
                    console.log(`📊 End-of-day summary for ${currentDate} (tenant: ${tenantId}):`);
                    console.log(`   ✅ ${stats.responded_users}/${stats.total_users} users responded`);
                    console.log(`   🏠 ${stats.remote_users || 0} Remote | 🏢 ${stats.office_users || 0} Office`);
                    console.log(`   📝 ${stats.total_updates || 0} total location updates`);
                    console.log(`   🗑️ ${clearedReminders} pending reminders cleared`);
                    
                    if (nonRespondingUsers.length > 0) {
                        console.log(`   ❌ Users who didn't respond: ${nonRespondingUsers.map(u => u.display_name).join(', ')}`);
                    }
                } catch (error) {
                    console.error(`Error processing daily reset for tenant ${tenantId}:`, error);
                }
            }

            console.log(`🌙 Daily reset completed for ${currentDate}. Ready for next working day.`);

        } catch (error) {
            console.error('Error in daily reset:', error);
        }
    }

    /**
     * Manually trigger daily reset (for testing)
     */
    async triggerDailyReset() {
        console.log('Manually triggering daily reset...');
        await this.performDailyReset();
    }

    /**
     * Add a conversation reference for a user
     */
    addConversationReference(userId, conversationReference) {
        this.conversationReferences[userId] = conversationReference;
    }

    /**
     * Remove pending reminder when user responds
     */
    async removeUserReminder(userId, date) {
        await this.database.removePendingReminder(userId, date);
    }

    /**
     * Get schedule status
     */
    getScheduleStatus() {
        const jobs = Object.keys(this.jobs).map(jobName => ({
            name: jobName,
            nextInvocation: this.jobs[jobName].nextInvocation()
        }));

        return {
            timezone: config.timezone,
            currentTime: this.holidayService.getCurrentTime().format(),
            scheduledJobs: jobs
        };
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        Object.values(this.jobs).forEach(job => {
            if (job) {
                job.cancel();
            }
        });
        
        if (this.database) {
            this.database.close();
        }
        
        console.log('Location scheduler stopped');
    }
}

module.exports = LocationScheduler; 