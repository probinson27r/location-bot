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
                    },
                    {
                        type: 'Action.Submit',
                        title: '🔄 Hybrid',
                        data: {
                            action: 'location_selected',
                            location: 'Hybrid'
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
 * Create the hybrid location details card
 */
function createHybridLocationCard(userName) {
    const card = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: 'Hybrid Work Location Details',
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent'
            },
            {
                type: 'TextBlock',
                text: `Thanks ${userName}! Since you selected Hybrid, please let us know your location for each part of the day:`,
                wrap: true,
                spacing: 'Medium'
            },
            {
                type: 'Container',
                style: 'emphasis',
                items: [
                    {
                        type: 'TextBlock',
                        text: 'Morning Location (AM)',
                        weight: 'Bolder',
                        size: 'Medium'
                    },
                    {
                        type: 'Input.ChoiceSet',
                        id: 'morningLocation',
                        placeholder: 'Select your morning location',
                        choices: [
                            {
                                title: '🏠 Remote (Morning)',
                                value: 'Remote'
                            },
                            {
                                title: '🏢 Office (Morning)',
                                value: 'Office'
                            }
                        ],
                        style: 'compact'
                    }
                ],
                spacing: 'Medium'
            },
            {
                type: 'Container',
                style: 'emphasis',
                items: [
                    {
                        type: 'TextBlock',
                        text: 'Afternoon Location (PM)',
                        weight: 'Bolder',
                        size: 'Medium'
                    },
                    {
                        type: 'Input.ChoiceSet',
                        id: 'afternoonLocation',
                        placeholder: 'Select your afternoon location',
                        choices: [
                            {
                                title: '🏠 Remote (Afternoon)',
                                value: 'Remote'
                            },
                            {
                                title: '🏢 Office (Afternoon)',
                                value: 'Office'
                            }
                        ],
                        style: 'compact'
                    }
                ],
                spacing: 'Medium'
            },
            {
                type: 'ActionSet',
                actions: [
                    {
                        type: 'Action.Submit',
                        title: 'Submit Hybrid Locations',
                        data: {
                            action: 'hybrid_submitted'
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
    
    if (location === 'Hybrid') {
        locationText = `🔄 Hybrid - Morning: ${morningLocation === 'Remote' ? '🏠 Remote' : '🏢 Office'}, Afternoon: ${afternoonLocation === 'Remote' ? '🏠 Remote' : '🏢 Office'}`;
    } else if (location === 'Remote') {
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
        version: '1.4',
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
                            ? '💡 You can update your location anytime by typing "remote", "office", or "hybrid"'
                            : '💡 You can change your location anytime throughout the day by typing "remote", "office", or "hybrid"',
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
 * Create team location overview card
 */
function createTeamLocationCard(teamLocations, date) {
    const totalMembers = teamLocations.length;
    const membersWithLocation = teamLocations.filter(member => member.work_location).length;
    const membersWithoutLocation = totalMembers - membersWithLocation;

    // Group by location type
    const locationCounts = {
        Remote: 0,
        Office: 0,
        Hybrid: 0
    };

    const locationItems = [];

    teamLocations.forEach(member => {
        if (member.work_location) {
            locationCounts[member.work_location]++;
            
            let locationText = '';
            let icon = '';
            
            if (member.work_location === 'Remote') {
                locationText = '🏠 Remote';
                icon = '🏠';
            } else if (member.work_location === 'Office') {
                locationText = '🏢 Office';
                icon = '🏢';
            } else if (member.work_location === 'Hybrid') {
                locationText = `🔄 Hybrid (AM: ${member.morning_location === 'Remote' ? '🏠' : '🏢'}, PM: ${member.afternoon_location === 'Remote' ? '🏠' : '🏢'})`;
                icon = '🔄';
            }
            
            const lastUpdate = member.response_time ? 
                new Date(member.response_time).toLocaleString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    timeStyle: 'short'
                }) : '';

            locationItems.push({
                type: 'ColumnSet',
                columns: [
                    {
                        type: 'Column',
                        width: 'auto',
                        items: [
                            {
                                type: 'TextBlock',
                                text: icon,
                                size: 'Medium'
                            }
                        ]
                    },
                    {
                        type: 'Column',
                        width: 'stretch',
                        items: [
                            {
                                type: 'TextBlock',
                                text: `**${member.display_name}**`,
                                wrap: true,
                                weight: 'Bolder',
                                size: 'Small'
                            },
                            {
                                type: 'TextBlock',
                                text: locationText,
                                wrap: true,
                                size: 'Small'
                            }
                        ]
                    },
                    {
                        type: 'Column',
                        width: 'auto',
                        items: [
                            {
                                type: 'TextBlock',
                                text: lastUpdate,
                                size: 'Small',
                                color: 'Accent',
                                horizontalAlignment: 'Right'
                            }
                        ]
                    }
                ],
                spacing: 'Small'
            });
        } else {
            locationItems.push({
                type: 'ColumnSet',
                columns: [
                    {
                        type: 'Column',
                        width: 'auto',
                        items: [
                            {
                                type: 'TextBlock',
                                text: '❓',
                                size: 'Medium'
                            }
                        ]
                    },
                    {
                        type: 'Column',
                        width: 'stretch',
                        items: [
                            {
                                type: 'TextBlock',
                                text: `**${member.display_name}**`,
                                wrap: true,
                                weight: 'Bolder',
                                size: 'Small'
                            },
                            {
                                type: 'TextBlock',
                                text: 'No location set',
                                wrap: true,
                                size: 'Small',
                                color: 'Warning'
                            }
                        ]
                    }
                ],
                spacing: 'Small'
            });
        }
    });

    const card = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: `Team Locations - ${new Date(date).toLocaleDateString('en-AU', { 
                    timeZone: 'Australia/Perth',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}`,
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent'
            },
            {
                type: 'Container',
                style: 'emphasis',
                items: [
                    {
                        type: 'ColumnSet',
                        columns: [
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {
                                        type: 'TextBlock',
                                        text: `📊 **Summary**: ${membersWithLocation}/${totalMembers} members set`,
                                        wrap: true,
                                        size: 'Small'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'ColumnSet',
                        columns: [
                            {
                                type: 'Column',
                                width: 'stretch',
                                items: [
                                    {
                                        type: 'TextBlock',
                                        text: `🏠 Remote: ${locationCounts.Remote} | 🏢 Office: ${locationCounts.Office} | 🔄 Hybrid: ${locationCounts.Hybrid}`,
                                        wrap: true,
                                        size: 'Small'
                                    }
                                ]
                            }
                        ]
                    }
                ],
                spacing: 'Medium'
            },
            {
                type: 'Container',
                items: locationItems,
                spacing: 'Medium'
            }
        ]
    };

    if (membersWithoutLocation > 0) {
        card.body.push({
            type: 'Container',
            style: 'attention',
            items: [
                {
                    type: 'TextBlock',
                    text: `⚠️ ${membersWithoutLocation} team member${membersWithoutLocation > 1 ? 's' : ''} haven't set their location yet`,
                    wrap: true,
                    size: 'Small',
                    weight: 'Bolder'
                }
            ],
            spacing: 'Medium'
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
        } else if (memberInfo.work_location === 'Hybrid') {
            locationText = `🔄 Hybrid - Morning: ${memberInfo.morning_location === 'Remote' ? '🏠 Remote' : '🏢 Office'}, Afternoon: ${memberInfo.afternoon_location === 'Remote' ? '🏠 Remote' : '🏢 Office'}`;
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
    createHybridLocationCard,
    createConfirmationCard,
    createErrorCard,
    createTeamLocationCard,
    createMemberLocationCard
}; 