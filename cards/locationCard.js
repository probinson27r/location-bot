const { CardFactory } = require('botbuilder');

/**
 * Create the main location selection card
 */
function createLocationCard(userName, isReminder = false, reminderCount = 0) {
    const title = isReminder 
        ? `Reminder ${reminderCount + 1}: Where are you working today?`
        : 'Where are you working today?';
    
    const subtitle = isReminder
        ? `Hi ${userName}, we still need your location for today. Please select your work location:`
        : `Good morning ${userName}! Please let us know where you'll be working today:`;

    const card = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: title,
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent'
            },
            {
                type: 'TextBlock',
                text: subtitle,
                wrap: true,
                spacing: 'Medium'
            },
            {
                type: 'ActionSet',
                actions: [
                    {
                        type: 'Action.Submit',
                        title: '🏠 Remote',
                        data: {
                            action: 'location_selected',
                            location: 'Remote'
                        },
                        style: 'positive'
                    },
                    {
                        type: 'Action.Submit',
                        title: '🏢 Office',
                        data: {
                            action: 'location_selected',
                            location: 'Office'
                        },
                        style: 'positive'
                    }
                ],
                spacing: 'Large'
            }
        ]
    };

    return CardFactory.adaptiveCard(card);
}

/**
 * Create confirmation card after location is recorded
 */
function createConfirmationCard(userName, location, morningLocation = null, afternoonLocation = null, isUpdate = false) {
    let locationText = '';
    
    if (location === 'Remote') {
        locationText = '🏠 Remote';
    } else if (location === 'Office') {
        locationText = '🏢 Office';
    }

    const title = isUpdate ? '✅ Location Updated' : '✅ Location Recorded';
    const message = isUpdate 
        ? `Thanks ${userName}! Your work location has been updated to:`
        : `Thanks ${userName}! Your work location has been recorded:`;

    const card = {
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
            {
                type: 'TextBlock',
                text: title,
                size: 'Large',
                weight: 'Bolder',
                color: 'Good'
            },
            {
                type: 'TextBlock',
                text: message,
                wrap: true,
                spacing: 'Medium'
            },
            {
                type: 'Container',
                style: 'good',
                items: [
                    {
                        type: 'TextBlock',
                        text: locationText,
                        size: 'Medium',
                        weight: 'Bolder'
                    },
                    {
                        type: 'TextBlock',
                        text: `${isUpdate ? 'Updated' : 'Recorded'} at: ${new Date().toLocaleString('en-AU', { 
                            timeZone: 'Australia/Perth',
                            dateStyle: 'full',
                            timeStyle: 'short'
                        })}`,
                        size: 'Small',
                        color: 'Good'
                    }
                ]
            },
            {
                type: 'Container',
                style: 'emphasis',
                items: [
                    {
                        type: 'TextBlock',
                        text: isUpdate 
                            ? '💡 You can update your location anytime by typing "remote" or "office"'
                            : '💡 You can change your location anytime throughout the day by typing "remote" or "office"',
                        wrap: true,
                        size: 'Small',
                        color: 'Accent'
                    }
                ],
                spacing: 'Medium'
            }
        ]
    };

    return CardFactory.adaptiveCard(card);
}

/**
 * Create error card for validation issues
 */
function createErrorCard(userName, errorMessage) {
    const card = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: '⚠️ Please Try Again',
                size: 'Large',
                weight: 'Bolder',
                color: 'Warning'
            },
            {
                type: 'TextBlock',
                text: `Hi ${userName}, ${errorMessage}`,
                wrap: true,
                spacing: 'Medium'
            },
            {
                type: 'ActionSet',
                actions: [
                    {
                        type: 'Action.Submit',
                        title: 'Select Location Again',
                        data: {
                            action: 'restart_selection'
                        },
                        style: 'positive'
                    }
                ],
                spacing: 'Medium'
            }
        ]
    };

    return CardFactory.adaptiveCard(card);
}

/**
 * Create team location overview card (simplified version)
 */
function createTeamLocationCard(teamLocations, date) {
    const totalMembers = teamLocations.length;
    const membersWithLocation = teamLocations.filter(member => member.work_location).length;
    
    // Group by location type
    const locationCounts = {
        Remote: teamLocations.filter(m => m.work_location === 'Remote').length,
        Office: teamLocations.filter(m => m.work_location === 'Office').length
    };

    // Group members by location type
    const remoteMembers = teamLocations.filter(m => m.work_location === 'Remote');
    const officeMembers = teamLocations.filter(m => m.work_location === 'Office');
    const noLocationMembers = teamLocations.filter(m => !m.work_location);

    const card = {
        type: 'AdaptiveCard',
        version: '1.2', // Use older version for better compatibility
        body: [
            {
                type: 'TextBlock',
                text: '👥 Team Locations',
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent'
            },
            {
                type: 'TextBlock',
                text: new Date(date).toLocaleDateString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                size: 'Small',
                color: 'Accent',
                spacing: 'None'
            },
            {
                type: 'FactSet',
                facts: [
                    {
                        title: '📊 Summary:',
                        value: `${membersWithLocation}/${totalMembers} members set their location`
                    },
                    {
                        title: '🏠 Remote:',
                        value: `${locationCounts.Remote} members`
                    },
                    {
                        title: '🏢 Office:',
                        value: `${locationCounts.Office} members`
                    }
                ],
                spacing: 'Medium'
            }
        ]
    };

    // Add member details using simple TextBlocks
    if (remoteMembers.length > 0) {
        card.body.push({
            type: 'TextBlock',
            text: `🏠 Remote Workers (${remoteMembers.length})`,
            weight: 'Bolder',
            spacing: 'Medium'
        });

        remoteMembers.forEach(member => {
            const timeText = member.response_time ? 
                new Date(member.response_time).toLocaleTimeString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'No time';
            const updatesText = member.daily_updates > 1 ? ` (${member.daily_updates} updates)` : '';
            
            card.body.push({
                type: 'TextBlock',
                text: `${member.display_name} - ${timeText}${updatesText}`,
                spacing: 'Small',
                size: 'Small'
            });
        });
    }

    if (officeMembers.length > 0) {
        card.body.push({
            type: 'TextBlock',
            text: `🏢 Office Workers (${officeMembers.length})`,
            weight: 'Bolder',
            spacing: 'Medium'
        });

        officeMembers.forEach(member => {
            const timeText = member.response_time ? 
                new Date(member.response_time).toLocaleTimeString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'No time';
            const updatesText = member.daily_updates > 1 ? ` (${member.daily_updates} updates)` : '';
            
            card.body.push({
                type: 'TextBlock',
                text: `${member.display_name} - ${timeText}${updatesText}`,
                spacing: 'Small',
                size: 'Small'
            });
        });
    }

    if (noLocationMembers.length > 0) {
        card.body.push({
            type: 'TextBlock',
            text: `❓ Not Set Yet (${noLocationMembers.length})`,
            weight: 'Bolder',
            spacing: 'Medium',
            color: 'Warning'
        });

        noLocationMembers.forEach(member => {
            card.body.push({
                type: 'TextBlock',
                text: `${member.display_name} (no location set)`,
                spacing: 'Small',
                size: 'Small',
                color: 'Warning'
            });
        });
    }

    return CardFactory.adaptiveCard(card);
}

/**
 * Create individual team member location card
 */
function createMemberLocationCard(memberInfo, date) {
    let statusText = '';
    let statusColor = 'Default';
    let locationText = '';
    
    if (memberInfo.work_location) {
        if (memberInfo.work_location === 'Remote') {
            locationText = '🏠 Remote';
        } else if (memberInfo.work_location === 'Office') {
            locationText = '🏢 Office';
        }
        
        const lastUpdate = new Date(memberInfo.response_time).toLocaleString('en-AU', { 
            timeZone: 'Australia/Perth',
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        
        statusText = `✅ Location set at ${lastUpdate}`;
        statusColor = 'Good';
        
        if (memberInfo.daily_updates > 1) {
            statusText += ` (${memberInfo.daily_updates} updates today)`;
        }
    } else {
        locationText = '❓ No location set';
        statusText = '⏳ Hasn\'t set location for today';
        statusColor = 'Warning';
    }

    const card = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: `📍 ${memberInfo.display_name}'s Location`,
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent'
            },
            {
                type: 'TextBlock',
                text: `${new Date(date).toLocaleDateString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}`,
                size: 'Small',
                color: 'Accent',
                spacing: 'None'
            },
            {
                type: 'Container',
                style: memberInfo.work_location ? 'good' : 'attention',
                items: [
                    {
                        type: 'TextBlock',
                        text: locationText,
                        size: 'Medium',
                        weight: 'Bolder',
                        wrap: true
                    },
                    {
                        type: 'TextBlock',
                        text: statusText,
                        size: 'Small',
                        color: statusColor,
                        wrap: true
                    }
                ],
                spacing: 'Medium'
            }
        ]
    };

    if (memberInfo.employee_number) {
        card.body.push({
            type: 'Container',
            style: 'emphasis',
            items: [
                {
                    type: 'TextBlock',
                    text: `Employee #: ${memberInfo.employee_number}`,
                    size: 'Small'
                }
            ],
            spacing: 'Small'
        });
    }

    return CardFactory.adaptiveCard(card);
}

module.exports = {
    createLocationCard,
    createConfirmationCard,
    createErrorCard,
    createTeamLocationCard,
    createMemberLocationCard
}; 