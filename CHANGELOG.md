# Changelog

All notable changes to the Microsoft Teams Location Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Microsoft Teams Location Bot
- Daily location prompts at 9:00 AM (Monday-Friday)
- Smart reminders at 9:30 AM and 10:00 AM
- Support for Remote, Office, and Hybrid work locations
- Hybrid location details (morning/afternoon)
- Multiple daily location updates
- Team location queries and overview
- Western Australia holiday awareness
- Proactive location setting via text commands
- SQLite database for data storage
- Adaptive cards for beautiful UI
- Admin endpoints for testing and statistics
- Health monitoring endpoint
- Docker support for containerization
- GitHub Actions CI/CD pipeline

## [1.0.0] - 2024-01-15

### Added
- Core bot functionality
- Location tracking database
- Scheduled daily prompts
- Holiday service for Western Australia
- Interactive adaptive cards
- Team location management
- Comprehensive documentation
- Docker deployment support
- GitHub repository setup

### Features
- **Personal Commands**: `remote`, `office`, `hybrid`, `status`, `history`, `stats`
- **Team Commands**: `team`, `where is [name]`, `location [name]`, `find [name]`
- **Admin Endpoints**: Health check, manual triggers, statistics
- **Smart Scheduling**: Timezone-aware, holiday-aware prompts
- **Multiple Updates**: Users can change location throughout the day
- **Team Visibility**: View individual or team-wide location status

### Technical
- Node.js 16+ support
- SQLite database
- Bot Framework integration
- Moment.js timezone handling
- Restify web server
- Comprehensive error handling
- Production-ready Docker setup

---

## Future Releases

### Planned Features
- [ ] Integration with calendar systems
- [ ] Custom holiday configurations
- [ ] Multi-timezone support
- [ ] Reporting and analytics dashboard
- [ ] Mobile app companion
- [ ] Multi-language support
- [ ] Performance optimizations
- [ ] Advanced team management features 