import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { REST, Routes } from 'discord.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

//load command modules
const loadCommands = async () => {
    for (const file of commandFiles) {
        const module = await import(`./commands/${file}`);
        commands.push(module.data.toJSON());
    }
}

//register commands with Discord to (refreshes them if necessary)
export const registerCommands = async (client) => {
    await loadCommands();

    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        logger.info('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
        logger.error({ message: 'Error reloading application commands', error });
    }
}

//handle command interactions
export const handleCommands = async (interaction, mySearches) => {
    logger.info(`Received command: /${interaction.commandName} from user ${interaction.user.tag}`);

    try {
        const module = await import(`./commands/${interaction.commandName}.js`);
        await module.execute(interaction, mySearches);
    } catch (error) {
        logger.error({ 
            message: `Error handling command /${interaction.commandName}`,
            error: error
        });

        const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (e) {
            logger.error({ message: 'Error while sending error message to Discord', error: e});
        }
    }
}
