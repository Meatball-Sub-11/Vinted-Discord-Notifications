import { SlashCommandBuilder, EmbedBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../../config/channels.json');

export const data = new SlashCommandBuilder()
    .setName('new_search')
    .setDescription('Start receiving notifications for this Vinted channel.')
    .addStringOption(option =>
        option.setName('name')
            .setDescription('The name of your new search.')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('url')
            .setDescription('The URL of the Vinted product page.')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('banned_keywords')
            .setDescription('Keywords to ban from the title of the search results. (separate with commas -> "keyword1, keyword2")')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('frequency')
            .setDescription('The frequency of the search in seconds. (defaults to 10s)')
            .setRequired(false));

//validate that the URL is a Vinted catalog URL with at least one query parameter
const validateUrl = (url) => {
    try {
        let route = new URL(url).pathname.split('/').pop();

        if (route !== "catalog") {
            return "invalid-url-with-example";
        }

        const urlObj = new URL(url);
        const searchParams = urlObj.searchParams;
        // check if the URL has at least one query parameter
        if (searchParams.toString().length === 0) {
            return "must-have-query-params"
        }

        return true;
    } catch (error) {
        return "invalid-url";
    }
}

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const url = interaction.options.getString('url');
    const banned_keywords = interaction.options.getString('banned_keywords') ? interaction.options.getString('banned_keywords').split(',').map(keyword => keyword.trim()) : [];
    let frequency = interaction.options.getString('frequency') || '10';
    const name = interaction.options.getString('name');
    const channel_id = interaction.channel.id;

    // validate the URL
    const validation = validateUrl(url);
    if (validation !== true) {
        await interaction.followUp({ content: validation});
        return;
    }

    // Validate the frequency
    const frequencyNum = parseInt(frequency, 10);
    if (isNaN(frequencyNum) || frequencyNum < 5) {
        await interaction.followUp({ content: 'The frequency must be a number and at least 5 seconds.'});
        return;
    }

    try {
        //register the search into the json file
        const searches = JSON.parse(fs.readFileSync(filePath));

        if (searches.some(search => search.channelName === name)) {
            await interaction.followUp({ content: 'A search with the name ' + name + ' already exists.'});
            return;
        }

        const search = {
            "channelId": channel_id,
            "channelName": name,
            "url": url,
            "frequency": frequencyNum,
            "titleBlacklist": banned_keywords
        };
        searches.push(search);

        try{
            fs.writeFileSync(filePath, JSON.stringify(searches, null, 2));
            logger.info(`New search "${name}" created by ${interaction.user.tag} in channel ${interaction.channel.id}.`);
        } catch (error) {
            logger.error({ message: `Error saving new search "${name}" to file`, error });
            await interaction.followUp({ content: 'There was an error saving the new search.'});
            return; // Important to exit after handling the error
        }

        const embed = new EmbedBuilder()
            .setTitle("Search saved!")
            .setDescription("Monitoring for " + name + " will be started on next restart.")
            .setColor(0x00FF00);

        await interaction.followUp({ embeds: [embed]});

    } catch (error) {
        logger.error({ message: `Error processing /new_search command for "${name}"`, error });
        await interaction.followUp({ content: 'There was an error starting the monitoring.'});
    }
}
