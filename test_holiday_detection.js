const AIAgent = require('./utils/aiAgent');

// Simple test script to demonstrate AI query detection
async function testQueryDetection() {
    const aiAgent = new AIAgent();
    
    const testQueries = [
        // Holiday queries
        "When is the next public holiday?",
        "What holidays are coming up?",
        
        // Team queries
        "Where is my team?",
        "Team status please",
        "Who is in the office?",
        "Show me the team",
        
        // Working status
        "I am working today even though it's a holiday",
        "I'm working from home today",
        "I'm working today",
        
        // Holiday status
        "I'm on holiday today",
        "Taking a holiday next week",
        
        // General
        "I'm sick today",
        "Working from home"
    ];
    
    console.log('🧪 Testing AI Query Detection (Holiday, Team, Working)\n');
    
    for (const query of testQueries) {
        try {
            const result = await aiAgent.analyzeLocationIntent(query);
            console.log(`Query: "${query}"`);
            console.log(`→ Category: ${result.location}`);
            console.log(`→ Confidence: ${Math.round(result.confidence * 100)}%`);
            console.log(`→ Reasoning: ${result.reasoning}`);
            console.log('');
        } catch (error) {
            console.error(`Error analyzing "${query}":`, error.message);
        }
    }
}

// Run the test
testQueryDetection().catch(console.error); 