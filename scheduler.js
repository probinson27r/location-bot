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
     * Send daily location prompts to all users
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

            console.log(`Sending daily location prompts for ${currentDate}`);

            // Get all users from database
            const users = await this.database.getAllUsers();
            
            for (const user of users) {
                try {
                    // Check if user already responded today
                    const hasResponded = await this.database.hasUserRespondedToday(user.id, currentDate);
                    
                    if (!hasResponded) {
                        await this.sendLocationPromptToUser(user, false, 0);
                        // Add pending reminder for this user
                        await this.database.addPendingReminder(user.id, currentDate);
                    }
                } catch (error) {
                    console.error(`Error sending prompt to user ${user.display_name}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in daily location prompts:', error);
        }
    }

    /**
     * Send reminder prompts to users who haven't responded
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

            console.log(`Sending reminder ${reminderNumber} for ${currentDate}`);

            // Get users who need reminders
            const pendingReminders = await this.database.getPendingReminders(currentDate);
            
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
                        await this.database.updateReminderCount(reminder.user_id, currentDate);
                    }
                } catch (error) {
                    console.error(`Error sending reminder to user ${reminder.display_name}:`, error);
                }
            }
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