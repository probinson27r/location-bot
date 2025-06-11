const OpenAI = require('openai');

class AIAgent {
    constructor() {
        this.openai = null;
        this.initialize();
    }

    initialize() {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey || apiKey === 'your_openai_api_key_here') {
            console.log('🤖 AI Agent: OpenAI API key not configured, falling back to rule-based processing');
            this.openai = null;
            return;
        }

        try {
            this.openai = new OpenAI({
                apiKey: apiKey
            });
            console.log('🤖 AI Agent: OpenAI client initialized successfully');
        } catch (error) {
            console.error('🤖 AI Agent: Error initializing OpenAI client:', error);
            this.openai = null;
        }
    }

    /**
     * Analyze user message to determine work location intent
     * @param {string} message - User's message
     * @returns {Promise<Object>} - Analysis result with location, confidence, and reasoning
     */
    async analyzeLocationIntent(message) {
        if (!this.openai) {
            console.log('🤖 AI Agent: OpenAI not available, using fallback analysis');
            return this.fallbackAnalysis(message);
        }

        try {
            console.log(`🤖 AI Agent: Analyzing message: "${message}"`);

            const systemPrompt = `You are an AI assistant that analyzes employee messages to determine their work location status and understand conversational queries.

Your job is to classify messages into one of these categories:
- "office": User is working from the office/workplace
- "remote": User is working from home/remotely  
- "not_working": User is not working (sick, holiday, vacation, day off, etc.)
- "location_query": User is asking about their own current work location/status
- "holiday_query": User is asking about holidays/requesting holiday information
- "team_query": User is asking about team locations/status OR asking about a specific person's location
- "unclear": Message is ambiguous or doesn't contain location information

IMPORTANT: For team_query category, you should detect:
1. General team questions: "where is my team", "team status", "who is in the office"
2. Specific person questions: "where is John today?", "is Sarah in the office?", "find Mike's location"

When someone asks about a specific person (like "where is user today?"), classify it as "team_query" and extract just the person's name, ignoring conversational words like "today", "now", "currently", "this morning", etc.

CRITICAL: NEGATION DETECTION
Pay special attention to negation words that COMPLETELY CHANGE the meaning:
- "NOT working", "NO longer", "DON'T work", "CAN'T come", "WON'T be", "ISN'T working"
- "NOT at the office", "NO longer remote", "NOT coming in", "NOT working from home"
- "NEVER", "HAVEN'T", "HASN'T", "DIDN'T", "DOESN'T", "WASN'T", "WEREN'T"

If someone says "I am NOT working at the office" → classify as "not_working" (NOT "office")
If someone says "I am NOT at home today" → classify as "not_working" (NOT "remote")
If someone says "I DON'T work from office anymore" → classify as "not_working"

IMPORTANT PRIORITY RULES:
1. NEGATION takes highest priority - if someone says "NOT working" anywhere → "not_working"
2. If someone says they are "WORKING" without negation - determine WHERE they are working
3. Then determine WHERE they are working (office/remote)
4. Location queries about their own status
5. Holiday queries about dates/information
6. Team queries about other people's locations OR general team status
7. Not working status (sick/holiday/vacation)

CONTEXT CLUES FOR LOCATIONS:
- Office: "office", "building", "site", "workplace", "headquarters", "work", "coming in"
- Remote: "home", "remote", "remotely", "house", "working from home", "WFH"
- Not working: "sick", "holiday", "vacation", "day off", "unwell", "ill", "absent", "leave"
- Location queries: "where am I", "what's my location", "my status", "current location", "where did I set"
- Team queries: "where is [name]", "is [name] in", "find [name]", "team status", "where is my team"

PERSON NAME EXTRACTION:
When detecting team queries about specific people, extract just the core name and ignore time qualifiers:
- "where is John today?" → extract "John"
- "is Sarah in the office now?" → extract "Sarah" 
- "find Mike's location this morning" → extract "Mike"
- "where is user today?" → extract "user"

SPELLING VARIATIONS TO RECOGNIZE:
- Office: "ofice", "offce", "oficce", "offic"
- Remote: "remot", "romote", "reomte", "rmeote", "remotly"
- Home: "hom", "hoem"
- Working: "workin", "workng", "wokring"

EXAMPLES:
✅ "I am working from home" → remote
✅ "I am NOT working from home" → not_working
✅ "At the office today" → office  
✅ "NOT at the office today" → not_working
✅ "I'm sick today" → not_working
✅ "Where am I working today?" → location_query
✅ "What's my current location?" → location_query
✅ "Show my status" → location_query
✅ "Where is John today?" → team_query (extract: "John")
✅ "Is Sarah in the office?" → team_query (extract: "Sarah")
✅ "Find user's location" → team_query (extract: "user")
✅ "Where is my team?" → team_query (general team query)
✅ "Team status please" → team_query (general team query)
✅ "When is the next holiday?" → holiday_query
✅ "I don't work at the office anymore" → not_working
✅ "No longer working from home" → not_working

Always analyze the ENTIRE message context, not just individual words. For team queries about specific people, extract just the person's name without time qualifiers.`;

            const userPrompt = `Analyze this message: "${message}"

Return a JSON response with:
{
    "location": "office|remote|not_working|location_query|holiday_query|team_query|unclear",
    "confidence": 0.0-1.0,
    "reasoning": "explanation of why you chose this classification",
    "detected_phrases": ["list", "of", "key", "phrases", "found"],
    "extracted_person_name": "person name if this is a team query about specific person, otherwise null"
}

For team queries about specific people, extract just the person's name without time qualifiers:
- "where is John today?" → extracted_person_name: "John"
- "is Sarah in the office now?" → extracted_person_name: "Sarah"  
- "find user's location" → extracted_person_name: "user"
- "where is my team?" → extracted_person_name: null (general team query)

IMPORTANT: Always return valid JSON only, no other text.`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 300
            });

            const content = response.choices[0].message.content.trim();
            console.log(`🤖 AI Agent: Raw OpenAI response: ${content}`);

            try {
                const result = JSON.parse(content);
                
                // Validate the response structure
                if (!['office', 'remote', 'not_working', 'location_query', 'holiday_query', 'team_query', 'unclear'].includes(result.location)) {
                    throw new Error(`Invalid location value: ${result.location}`);
                }
                
                if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
                    throw new Error(`Invalid confidence value: ${result.confidence}`);
                }

                console.log(`🤖 AI Agent: Analysis complete - Location: ${result.location}, Confidence: ${result.confidence}`);
                console.log(`🤖 AI Agent: Reasoning: ${result.reasoning}`);
                
                return {
                    ...result,
                    source: 'ai',
                    originalMessage: message
                };

            } catch (parseError) {
                console.error('🤖 AI Agent: Error parsing OpenAI response:', parseError);
                console.log('🤖 AI Agent: Falling back to rule-based analysis');
                return this.fallbackAnalysis(message);
            }

        } catch (error) {
            console.error('🤖 AI Agent: Error calling OpenAI API:', error);
            console.log('🤖 AI Agent: Falling back to rule-based analysis');
            return this.fallbackAnalysis(message);
        }
    }

    /**
     * Fallback rule-based analysis when AI is not available
     * @param {string} message - User's message
     * @returns {Object} - Analysis result
     */
    fallbackAnalysis(message) {
        const lowerMessage = message.toLowerCase();
        
        // NEGATION DETECTION: Check for negation words that change meaning
        const negationPatterns = [
            // Basic negation words
            /\b(not|no|never|don't|dont|can't|cant|won't|wont|isn't|isnt|aren't|arent|wasn't|wasnt|weren't|werent|haven't|havent|hasn't|hasnt|didn't|didnt|doesn't|doesnt)\b/i,
            // Specific negation phrases
            /\b(no\s+longer|not\s+anymore|not\s+today|not\s+currently|not\s+working|don't\s+work|can't\s+work|won't\s+work)\b/i,
            // Complex negation patterns
            /\b(finished\s+work|done\s+work|stopped\s+working|quit\s+working|left\s+work|leaving\s+work)\b/i,
        ];
        
        const hasNegation = negationPatterns.some(pattern => pattern.test(lowerMessage));
        
        // If negation is detected with work-related terms, prioritize not_working
        if (hasNegation) {
            const workRelatedPatterns = [
                /\b(working|work|office|remote|home|building|site|workplace|headquarters|hq)\b/i,
                /\b(at|in|from)\s+(office|home|work|building|site|headquarters|hq)\b/i
            ];
            
            const hasWorkTerms = workRelatedPatterns.some(pattern => pattern.test(lowerMessage));
            
            if (hasWorkTerms) {
                console.log(`🚫 Negation detected with work terms: "${lowerMessage}"`);
                
                // Try to extract the specific negation phrase
                const negationPhrase = lowerMessage.match(/\b(not|no|never|don't|cant|won't|isn't|aren't|wasn't|weren't|haven't|hasn't|didn't|doesn't|no\s+longer|not\s+anymore|not\s+today|not\s+currently).{0,30}(working|office|home|work|building|site|remote)\b/i)?.[0] ||
                                     lowerMessage.match(/\b(finished|done|stopped|quit|left|leaving).{0,15}(work|working|office)\b/i)?.[0] ||
                                     'negation with work terms';
                
                return {
                    location: 'not_working',
                    confidence: 0.9,
                    reasoning: 'Negation detected with work-related terms (not working, no longer at office, etc.)',
                    detected_phrases: [negationPhrase],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }
        
        // PRIORITY 1: Check for location queries FIRST (before working patterns)
        const locationQueryPatterns = [
            /\bwhere\s+am\s+i\s+(working|workin|workng|wokring|today|now|currently)\b/i,
            /\bwhere\s+am\s+i\s+(at|located|set\s+to|working\s+from)\b/i,
            /\bam\s+i\s+(at\s+the\s+)?(office|ofice|offce|home|hom|hoem|remote|remot)\s*\?\s*$/i,
            /\bam\s+i\s+(working|workin|workng|wokring)\s+(at|from|in)\b/i,
            /\bwhat'?s\s+my\s+(current\s+)?(location|work\s+location|status|work\s+status)\b/i,
            /\bshow\s+(me\s+)?my\s+(location|status|work\s+status|current\s+location)\b/i,
            /\bwhere\s+did\s+i\s+set\s+(my\s+)?(location|status)\b/i,
            /\bwhat\s+(location|status)\s+(am\s+i|did\s+i\s+set)\b/i,
            /\bmy\s+(current\s+)?(work\s+)?(location|status)\b/i,
            /\bwhere\s+(am\s+i|did\s+i)\s+(at|working|today)\b/i,
            /\b(check|view|display)\s+my\s+(location|status)\b/i,
            /\bwhat'?s\s+my\s+(work\s+)?(setting|position)\b/i,
            // Question format variations
            /\bwhere\s+am\s+i\s*\?\s*$/i,
            /\bwhat'?s\s+my\s+location\s*\?\s*$/i,
            /\bmy\s+status\s*\?\s*$/i,
            /\bcurrent\s+location\s*\?\s*$/i
        ];

        for (const pattern of locationQueryPatterns) {
            if (pattern.test(lowerMessage)) {
                return {
                    location: 'location_query',
                    confidence: 0.9,
                    reasoning: `Matched location query pattern: ${pattern.source}`,
                    detected_phrases: [lowerMessage.match(pattern)?.[0] || 'location query'],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }
        
        // PRIORITY 2: Check for working indicators (these take precedence over single words)
        const workingPatterns = {
            office: {
                patterns: [
                    // Standard office patterns
                    /\b(at|in)\s+the\s+(office|ofice|offce|offfice|oficce|offic)\b/i,
                    /\b(office|ofice|offce|offfice|oficce|offic)\s+(today|now)\b/i,
                    /\bgoing\s+to\s+the\s+(office|ofice|offce|offfice|oficce|offic)\b/i,
                    /\bin\s+the\s+(building|bilding|buidling)\b/i,
                    /\bat\s+(work|wrk|wrok)\b/i,
                    /\bworking\s+(at|in)\s+(the\s+)?((office|ofice|offce|offfice|oficce|offic)|(work|wrk|wrok)|(building|bilding|buidling))\b/i,
                    // Office variations and slang
                    /\b(at|in)\s+the\s+(workplace|workplac|workplce|site|hq|headquarters|corprate|corporate)\b/i,
                    /\bwfo\b/i, // work from office
                    /\b(came|come|coming|went|going)\s+(to|into)\s+(office|ofice|offce|work|wrk|building|site)\b/i,
                    /\bi'?m\s+(at|in)\s+(office|ofice|offce|work|wrk|building|site)\b/i,
                    /\b(on|at)\s+(site|location|premise|premises)\b/i,
                    // Additional workplace patterns
                    /\bheading\s+to\s+the\s+(workplace|workplac|workplce|workplc|site|building|bilding|buidling)\b/i,
                    /\bgoing\s+to\s+the\s+(workplace|workplac|workplce|workplc|site|building|bilding|buidling)\b/i
                ],
                confidence: 0.8
            },
            remote: {
                patterns: [
                    // Standard remote patterns with spelling variations
                    /\bworking\s+from\s+(home|hom|hoem|house|hse)\b/i,
                    /\bwfh\b/i,
                    /\b(home|hom|hoem)\s+(office|ofice|offce)\b/i,
                    /\b(remote|remot|romote|reomte|rmeote)\s+(today|work|working)\b/i,
                    /\b(remotely|remotly|remtely)\b/i,
                    /\bworking\s+(from\s+)?(home|hom|hoem|house|remotely|remotly|remote|remot)\b/i,
                    // Additional home variations
                    /\b(at|from)\s+(home|hom|hoem|house|my\s+house|my\s+place)\b/i,
                    /\bi'?m\s+(home|hom|hoem|working\s+home|at\s+home)\b/i,
                    /\b(staying|working)\s+(home|hom|hoem)\b/i,
                    /\bhome\s+(today|this\s+week|all\s+week)\b/i
                ],
                confidence: 0.8
            }
        };

        // Check for specific work location patterns
        for (const [location, config] of Object.entries(workingPatterns)) {
            for (const pattern of config.patterns) {
                if (pattern.test(lowerMessage)) {
                    return {
                        location,
                        confidence: config.confidence,
                        reasoning: `Matched working pattern: ${pattern.source}`,
                        detected_phrases: [lowerMessage.match(pattern)?.[0] || 'working pattern'],
                        source: 'rules',
                        originalMessage: message
                    };
                }
            }
        }

        // PRIORITY 3: Check for general "working" without specific location (enhanced patterns)
        const generalWorkingPatterns = [
            /\b(i'm|im|i\s+am)\s+(working|workin|workng|wokring)\b/i,
            /\b(working|workin|workng|wokring)\s+(today|this\s+morning|now|currently)\b/i,
            /\bgoing\s+to\s+(work|wrk|wrok)\b/i,
            /\bheading\s+to\s+(work|wrk|wrok)\b/i,
            /\bi\s+(work|wrk|wrok)\s+today\b/i,
            /\b(at|doing)\s+(work|wrk|wrok)\s+today\b/i
        ];

        for (const pattern of generalWorkingPatterns) {
            if (pattern.test(lowerMessage)) {
                return {
                    location: 'unclear',
                    confidence: 0.7,
                    reasoning: 'User is working but location not specified',
                    detected_phrases: [lowerMessage.match(pattern)?.[0] || 'working'],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }

        // PRIORITY 4: Check for holiday queries (high confidence patterns with spelling variations)
        const holidayQueryPatterns = [
            /\bwhen\s+is\s+the\s+next\s+(public\s+)?(holiday|holyday|holidya|hoilday)/i,
            /\bwhat\s+(holidays|holydas|holidyas|hoildays)\s+are\s+(coming\s+up|upcoming)/i,
            /\bshow\s+(me\s+)?(the\s+)?(holidays|holydas|holidyas|hoildays)/i,
            /\blist\s+(of\s+)?(holidays|holydas|holidyas|hoildays)/i,
            /\b(next|upcoming)\s+(public\s+)?(holidays|holydas|holidyas|hoildays)/i,
            /\b(holiday|holyday|holidya|hoilday)\s+(schedule|calendar|dates)/i,
            /\bwhen\s+(are|is)\s+the\s+(holidays|holydas|holidyas|hoildays)/i,
            /\bpublic\s+(holiday|holyday|holidya|hoilday)\s+(information|schedule|dates)/i,
            // Additional patterns
            /\bwhen\s+(are|is)\s+(next\s+)?(holidays|holydas|public\s+holidays)/i,
            /\bany\s+(holidays|holydas)\s+(coming|upcoming)/i,
            // Fix for hoildays pattern
            /\bwhat\s+(hoildays|holidays|holydas|holidyas)\s+are\s+(coming|upcoming)/i,
            /\b(hoildays|holidays|holydas|holidyas)\s+are\s+(coming|upcoming)/i
        ];

        for (const pattern of holidayQueryPatterns) {
            if (pattern.test(lowerMessage)) {
                return {
                    location: 'holiday_query',
                    confidence: 0.9,
                    reasoning: `Matched holiday query pattern: ${pattern.source}`,
                    detected_phrases: [lowerMessage.match(pattern)?.[0] || 'holiday query'],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }

        // PRIORITY 4.5: Check for team queries (high confidence patterns with spelling variations)
        const teamQueryPatterns = [
            /\b(where\s+(is|are)|location\s+of|find)\s+(my\s+)?(team|everyone|colleagues|coworkers|workmates)\b/i,
            /\b(team|everyone|colleagues|coworkers|workmates)\s+(status|location|locations|overview)\b/i,
            /\bwho\s+(is|are)\s+(in\s+the\s+)?(office|ofice|offce|home|hom|hoem|remote|remot|working)\b/i,
            // Add patterns for specific person queries
            /^(where\s+is|location\s+of|find)\s+\w+(\s+today|\s+now|\s+currently)?$/i,
            /^is\s+\w+\s+(in\s+the\s+office|at\s+the\s+office|remote|at\s+home|working)/i,
            /^\w+('s)?\s+(location|status|work\s+location)(\s+today|\s+now)?$/i
        ];
        
        for (const pattern of teamQueryPatterns) {
            if (pattern.test(lowerMessage)) {
                console.log(`🤖 Fallback: Team query detected with pattern: ${pattern}`);
                
                return {
                    location: 'team_query',
                    confidence: 0.9,
                    reasoning: 'Team query detected in message',
                    detected_phrases: [message],
                    extracted_person_name: null, // Let the bot handle person name extraction
                    source: 'fallback'
                };
            }
        }

        // PRIORITY 5: Check for explicit NOT working patterns (enhanced with spelling variations)
        const notWorkingPatterns = [
            /\bnot\s+(working|workin|workng|wokring)\b/i,
            /\b(sick|sik|sck)\s+(day|leave|today)\b/i,
            /\b(i'm|im)\s+on\s+(holiday|holyday|holidya|vacation|vacaton|leave)\b/i,
            /\bday\s+(off|of)\b/i,
            /\babsent\s+(today|this\s+week)\b/i,
            /\b(unwell|unwel|not\s+well|ill|sick|sik)\b/i,
            /\btaking\s+(a\s+)?(holiday|holyday|holidya|vacation|vacaton|leave|day\s+off)\b/i,
            /\b(calling\s+in\s+)?(sick|sik|ill|sck)\b/i,
            /\bcan'?t\s+(come\s+in|make\s+it)\b/i,
            // Additional not working patterns
            /\b(off\s+work|off\s+today|taking\s+today\s+off)\b/i,
            /\b(on\s+leave|medical\s+leave|personal\s+leave)\b/i,
            /\b(feeling\s+sick|not\s+feeling\s+well)\b/i,
            // Enhanced calling in patterns
            /\bcalling\s+in\s+(sick|sik|ill|sck|today)\b/i,
            /\bcalling\s+(sick|sik|ill|sck)\b/i
        ];

        for (const pattern of notWorkingPatterns) {
            if (pattern.test(lowerMessage)) {
                return {
                    location: 'not_working',
                    confidence: 0.85,
                    reasoning: `Matched not working pattern: ${pattern.source}`,
                    detected_phrases: [lowerMessage.match(pattern)?.[0] || 'not working'],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }

        // PRIORITY 6: Lower confidence single word matches with spelling variations (only if no working context)
        const singleWordPatterns = {
            office: /\b(office|ofice|offce|offfice|oficce|offic|work|wrk|wrok|site|building|bilding|buidling|workplace|workplac|workplce|workplc|hq|headquarters)\b/i,
            remote: /\b(home|hom|hoem|remote|remot|romote|reomte|rmeote|house|hse|remotely|remotly|remtely)\b/i
        };

        for (const [location, pattern] of Object.entries(singleWordPatterns)) {
            if (pattern.test(lowerMessage)) {
                return {
                    location,
                    confidence: 0.4,
                    reasoning: `Found keyword with spelling variation: ${pattern.source}`,
                    detected_phrases: [lowerMessage.match(pattern)?.[0] || 'keyword'],
                    source: 'rules',
                    originalMessage: message
                };
            }
        }

        return {
            location: 'unclear',
            confidence: 0.1,
            reasoning: 'No clear location indicators found',
            detected_phrases: [],
            source: 'rules',
            originalMessage: message
        };
    }

    /**
     * Check if AI is available
     * @returns {boolean}
     */
    isAIAvailable() {
        return this.openai !== null;
    }

    /**
     * Get a human-readable confidence description
     * @param {number} confidence 
     * @returns {string}
     */
    getConfidenceDescription(confidence) {
        if (confidence >= 0.8) return 'High';
        if (confidence >= 0.6) return 'Medium';
        if (confidence >= 0.4) return 'Low';
        return 'Very Low';
    }
}

module.exports = AIAgent; 