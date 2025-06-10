const fs = require('fs');
const path = require('path');

class LocationAliases {
    constructor() {
        this.aliases = new Map();
        this.loadAliases();
    }

    loadAliases() {
        try {
            const aliasFile = path.join(__dirname, 'location-aliases.txt');
            const content = fs.readFileSync(aliasFile, 'utf8');
            
            console.log('📝 Loading location aliases...');
            
            const lines = content.split('\n');
            let aliasCount = 0;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue;
                }
                
                // Parse alias=location format
                const [alias, location] = trimmedLine.split('=').map(s => s.trim());
                
                if (alias && location) {
                    // Validate location type
                    if (['remote', 'office', 'clear'].includes(location.toLowerCase())) {
                        this.aliases.set(alias.toLowerCase(), location.toLowerCase());
                        aliasCount++;
                        console.log(`📝 Loaded alias: "${alias}" -> "${location}"`);
                    } else {
                        console.warn(`⚠️ Invalid location type "${location}" for alias "${alias}"`);
                    }
                }
            }
            
            console.log(`✅ Loaded ${aliasCount} location aliases`);
            
        } catch (error) {
            console.error('Error loading location aliases:', error);
            console.log('Using default aliases only');
            this.loadDefaultAliases();
        }
    }

    loadDefaultAliases() {
        // Fallback default aliases
        this.aliases.set('home', 'remote');
        this.aliases.set('wfh', 'remote');
        this.aliases.set('remote', 'remote');
        this.aliases.set('office', 'office');
        this.aliases.set('work', 'office');
        this.aliases.set('clear', 'clear');
        this.aliases.set('off', 'clear');
        console.log('✅ Loaded default location aliases');
    }

    /**
     * Get the standard location type for an input
     * @param {string} input - User input (e.g., "home", "office", "wfh", "clear")
     * @returns {string|null} - Standard location type ("remote", "office", "clear") or null if not found
     */
    getLocationFromAlias(input) {
        if (!input) return null;
        
        const normalizedInput = input.toLowerCase().trim();
        return this.aliases.get(normalizedInput) || null;
    }

    /**
     * Check if an input is a valid location alias
     * @param {string} input - User input
     * @returns {boolean} - True if it's a valid alias
     */
    isValidLocationAlias(input) {
        return this.getLocationFromAlias(input) !== null;
    }

    /**
     * Get all aliases for a specific location type
     * @param {string} locationType - "remote", "office", or "clear"
     * @returns {string[]} - Array of aliases for that location
     */
    getAliasesForLocation(locationType) {
        const aliases = [];
        for (const [alias, location] of this.aliases.entries()) {
            if (location === locationType.toLowerCase()) {
                aliases.push(alias);
            }
        }
        return aliases;
    }

    /**
     * Get all available aliases
     * @returns {Map} - Map of all aliases
     */
    getAllAliases() {
        return new Map(this.aliases);
    }

    /**
     * Reload aliases from file
     */
    reloadAliases() {
        this.aliases.clear();
        this.loadAliases();
    }
}

module.exports = LocationAliases; 