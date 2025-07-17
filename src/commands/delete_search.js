import { SlashCommandBuilder, EmbedBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../../config/channels.json');

export const data = new SlashCommandBuilder()
    .setName('delete_search')
    .setDescription('Stop receiving notifications for this Vinted channel.')
    .addStringOption(option =>
        option.setName('name')
            .setDescription('The name of the search to delete.')
            .setRequired(true));

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');

    try {
        //delete the search that has 'name' as name
        const searches = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const searchIndex = searches.findIndex(search => search.channelName === name);
        if (searchIndex === -1) {
            await interaction.followUp({ content: 'No search found with the name ' + name });
            return;
        }
        searches.splice(searchIndex, 1);

        await fs.promises.writeFile(filePath, JSON.stringify(searches, null, 2));

        logger.info(`Search "${name}" was deleted by ${interaction.user.tag}.`);

        const embed = new EmbedBuilder()
            .setTitle("Search " + name + " deleted!")
            .setDescription("It will stop being monitored on the next restart.")
            .setColor(0x00FF00);

        await interaction.followUp({ embeds: [embed] });

    } catch (error) {
        logger.error({ message: `Error deleting search "${name}"`, error });
        await interaction.followUp({ content: 'There was an error deleting the search.'});
    }
}
