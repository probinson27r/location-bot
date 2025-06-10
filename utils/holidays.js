const moment = require('moment-timezone');
const axios = require('axios');
const config = require('../config');

class HolidayService {
    constructor() {
        this.timezone = config.timezone;
        this.holidayCache = new Map();
    }

    /**
     * Get current date in Western Australia timezone
     */
    getCurrentDate() {
        return moment().tz(this.timezone).format('YYYY-MM-DD');
    }

    /**
     * Get current time in Western Australia timezone
     */
    getCurrentTime() {
        return moment().tz(this.timezone);
    }

    /**
     * Check if a given date is a working day (Monday-Friday, not a public holiday)
     */
    async isWorkingDay(date) {
        const momentDate = moment(date).tz(this.timezone);
        
        // Check if it's a weekend
        const dayOfWeek = momentDate.day();
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
            return false;
        }

        // Check if it's a public holiday
        const isHoliday = await this.isPublicHoliday(date);
        return !isHoliday;
    }

    /**
     * Check if a given date is a public holiday in Western Australia
     */
    async isPublicHoliday(date) {
        const year = moment(date).year();
        
        // Check cache first
        const cacheKey = `${year}-${date}`;
        if (this.holidayCache.has(cacheKey)) {
            return this.holidayCache.get(cacheKey);
        }

        // Get holidays for the year
        const holidays = await this.getHolidaysForYear(year);
        const isHoliday = holidays.some(holiday => holiday.date === date);
        
        // Cache the result
        this.holidayCache.set(cacheKey, isHoliday);
        
        return isHoliday;
    }

    /**
     * Get all public holidays for Western Australia for a given year
     */
    async getHolidaysForYear(year) {
        const cacheKey = `holidays-${year}`;
        
        if (this.holidayCache.has(cacheKey)) {
            return this.holidayCache.get(cacheKey);
        }

        let holidays = [];

        try {
            // Try to fetch from holiday API if available
            if (config.holidayApiKey) {
                holidays = await this.fetchHolidaysFromAPI(year);
            } else {
                // Use hardcoded holidays for Western Australia
                holidays = this.getHardcodedHolidays(year);
            }
        } catch (error) {
            console.warn('Failed to fetch holidays from API, using hardcoded holidays:', error.message);
            holidays = this.getHardcodedHolidays(year);
        }

        // Cache for the year
        this.holidayCache.set(cacheKey, holidays);
        
        return holidays;
    }

    /**
     * Fetch holidays from external API
     */
    async fetchHolidaysFromAPI(year) {
        // Example using a holiday API (you can replace with your preferred service)
        const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
        
        // Filter for Western Australia or national holidays
        return response.data
            .filter(holiday => holiday.counties === null || holiday.counties.includes('AU-WA'))
            .map(holiday => ({
                date: holiday.date,
                name: holiday.name,
                localName: holiday.localName
            }));
    }

    /**
     * Hardcoded public holidays for Western Australia
     * This includes national holidays and WA-specific holidays
     */
    getHardcodedHolidays(year) {
        const holidays = [];

        // Fixed date holidays
        holidays.push(
            { date: `${year}-01-01`, name: "New Year's Day" },
            { date: `${year}-01-26`, name: "Australia Day" },
            { date: `${year}-04-25`, name: "ANZAC Day" },
            { date: `${year}-06-01`, name: "Western Australia Day" },
            { date: `${year}-12-25`, name: "Christmas Day" },
            { date: `${year}-12-26`, name: "Boxing Day" }
        );

        // Calculate Easter dates
        const easter = this.calculateEaster(year);
        holidays.push(
            { date: moment(easter).subtract(2, 'days').format('YYYY-MM-DD'), name: "Good Friday" },
            { date: moment(easter).add(1, 'days').format('YYYY-MM-DD'), name: "Easter Monday" }
        );

        // Calculate Queen's Birthday (first Monday in October for WA)
        const queensBirthday = moment(`${year}-10-01`).day(1); // First Monday in October
        if (queensBirthday.month() !== 9) { // If first Monday is not in October
            queensBirthday.add(7, 'days');
        }
        holidays.push({ date: queensBirthday.format('YYYY-MM-DD'), name: "Queen's Birthday" });

        // Calculate Labour Day (first Monday in March for WA)
        const labourDay = moment(`${year}-03-01`).day(1); // First Monday in March
        if (labourDay.month() !== 2) { // If first Monday is not in March
            labourDay.add(7, 'days');
        }
        holidays.push({ date: labourDay.format('YYYY-MM-DD'), name: "Labour Day" });

        return holidays;
    }

    /**
     * Calculate Easter Sunday for a given year
     */
    calculateEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        
        return moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    }

    /**
     * Get the next working day
     */
    async getNextWorkingDay(fromDate = null) {
        let date = fromDate ? moment(fromDate).tz(this.timezone) : this.getCurrentTime();
        
        do {
            date = date.add(1, 'day');
        } while (!(await this.isWorkingDay(date.format('YYYY-MM-DD'))));
        
        return date.format('YYYY-MM-DD');
    }

    /**
     * Check if current time is within working hours (9 AM - 5 PM)
     */
    isWorkingHours() {
        const now = this.getCurrentTime();
        const hour = now.hour();
        return hour >= 9 && hour < 17;
    }

    /**
     * Format date for display
     */
    formatDate(date, format = 'dddd, MMMM Do YYYY') {
        return moment(date).tz(this.timezone).format(format);
    }
}

module.exports = HolidayService; 