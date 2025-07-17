import { vintedSearch } from "./bot/search.js";
import { postArticles } from "./bot/post.js";
import { fetchCookies } from "./api/fetch-auth.js";
import logger from "./utils/logger.js";

/**
 * Executes a single search for a given channel, finds new articles, and posts them.
 * @param {object} client The Discord client instance.
 * @param {Set<number>} processedArticleIds A set of article IDs that have already been seen.
 * @param {object} channel The search channel configuration object.
 */
const runSearch = async (client, processedArticleIds, channel) => {
    try {
        const articles = await vintedSearch(channel, processedArticleIds);

        if (articles && articles.length > 0) {
            logger.info(`Found ${articles.length} new article(s) for search "${channel.channelName}".`);
            articles.forEach(article => processedArticleIds.add(article.id));
            await postArticles(articles, client.channels.cache.get(channel.channelId));
        }
    } catch (err) {
        logger.error(`Error running search for "${channel.channelName}": ${err.message}`);
    }
};

/**
 * Sets up a recurring interval to run a search for a single channel.
 * @param {object} client The Discord client instance.
 * @param {Set<number>} processedArticleIds A set of seen article IDs.
 * @param {object} channel The search channel configuration.
 */
const runInterval = (client, processedArticleIds, channel) => {
    runSearch(client, processedArticleIds, channel);
    setTimeout(() => runInterval(client, processedArticleIds, channel), channel.frequency * 1000);
};

/**
 * Sets up a recurring interval to refresh cookies and clean the processed IDs set.
 * @param {Set<number>} processedArticleIds A set of seen article IDs.
 */
const setupCookieRefresher = (processedArticleIds) => {
    setInterval(async () => {
        try {
            await fetchCookies();
            logger.info('Successfully refreshed cookies.');

            // To prevent the set from growing indefinitely, we periodically remove the oldest half of the IDs.
            const halfSize = Math.floor(processedArticleIds.size / 2);
            const newIds = Array.from(processedArticleIds).slice(halfSize);
            processedArticleIds.clear();
            newIds.forEach(id => processedArticleIds.add(id));
            logger.info(`Cleaned processed articles set. New size: ${processedArticleIds.size}`);

        } catch (err) {
            logger.error(`Error during scheduled cookie refresh: ${err.message}`);
        }
    }, 1 * 60 * 60 * 1000); // Interval set to 1 hour
};

/**
 * The main entry point for the bot's monitoring logic.
 * @param {object} client The Discord client instance.
 * @param {Array<object>} mySearches An array of search channel configurations.
 */
export const run = async (client, mySearches) => {
    const processedArticleIds = new Set();
    
    try {
        await fetchCookies();
    } catch (err) {
        logger.error(`Initial cookie fetch failed: ${err.message}`);
    }
 
    // Stagger the start time for each search to avoid sending too many requests at once.
    mySearches.forEach((channel, index) => {
        setTimeout(async () => {
            try {
                logger.info(`Initialising articles for "${channel.channelName}".`);
                const initArticles = await vintedSearch(channel, processedArticleIds);
                initArticles.forEach(article => processedArticleIds.add(article.id));
                logger.info(`Initialisation for "${channel.channelName}" complete. Found ${initArticles.length} existing articles.`);
                
                // Start the recurring search interval for this channel.
                runInterval(client, processedArticleIds, channel);
            } catch (err) {
                logger.error(`Error initialising articles for "${channel.channelName}": ${err.message}`);
            }
        }, index * 2000); // Stagger by 2 seconds for each search
    });

    // Set up the separate, long-term interval for refreshing cookies.
    setupCookieRefresher(processedArticleIds);
};
