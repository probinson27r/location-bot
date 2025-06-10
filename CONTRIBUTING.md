# Contributing to Microsoft Teams Location Bot

Thank you for your interest in contributing to the Microsoft Teams Location Bot! We welcome contributions from the community.

## 📋 Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment for all contributors.

## 🚀 How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, please include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Environment details** (Node.js version, OS, etc.)
- **Screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear title** and description
- **Use case** explaining why this would be useful
- **Detailed explanation** of how it should work
- **Examples** if applicable

### Pull Requests

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Add tests** if applicable
5. **Update documentation** as needed
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to your branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

## 🛠️ Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/location-bot.git
   cd location-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your Bot Framework credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Coding Standards

- **JavaScript ES6+** syntax
- **Async/await** for asynchronous operations
- **Clear variable names** and function documentation
- **Error handling** for all async operations
- **Consistent formatting** (we recommend using Prettier)

### File Structure
```
├── index.js              # Main server entry point
├── bot.js                # Core bot logic
├── scheduler.js          # Scheduling system
├── database.js           # Database operations
├── config.js             # Configuration management
├── cards/                # Adaptive card templates
│   └── locationCard.js
└── utils/                # Utility functions
    └── holidays.js
```

## 🧪 Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test with Bot Framework Emulator
- Test timezone handling for Western Australia

## 📚 Documentation

- Update README.md for new features
- Add JSDoc comments for new functions
- Update API documentation as needed
- Include examples for new commands

## 🔄 Release Process

1. Version bumps follow [Semantic Versioning](https://semver.org/)
2. Update CHANGELOG.md with new features/fixes
3. Tag releases appropriately
4. Update deployment documentation

## 💡 Feature Ideas

Some areas where contributions would be particularly welcome:

- **Additional timezone support**
- **Integration with calendar systems**
- **Reporting and analytics features**
- **Mobile app companion**
- **Custom holiday configurations**
- **Multi-language support**
- **Performance optimizations**

## 🤝 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check the README and inline comments

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make workplace location tracking easier for teams! 🎉 