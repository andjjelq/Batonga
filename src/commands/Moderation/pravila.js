import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    EmbedBuilder,
    AttachmentBuilder,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

// Tvoja slika iz repoa (glavni folder, pored package.json).
const SLIKA_FAJL = path.join(process.cwd(), 'pravila.png.png');

const TEXT_CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
];

const PRAVILA = `▫️ 🤠 **POŠTUJ SVE ČLANOVE**
Budi pristojan i ljubazan. Uvrede, diskriminacija i govor mržnje nisu dozvoljeni.

▫️ 🏷️ **SPAM JE ZABRANJEN**
Zabranjeno je spamovanje porukama, tagovima, linkovima ili emojijima.

▫️ 🔞 **NEPRIMJEREN SADRŽAJ**
Strogo zabranjeno. ⚠️
To uključuje NSFW, nasilni, uvredljivi ili ilegalni sadržaj bilo koje vrste.

▫️ 🗂️ **POŠTUJ KANALE**
Koristi kanale prema njihovoj namjeni. Ne šalji poruke u pogrešne kanale.

▫️ 🚫 **REKLAMIRANJE**
Zabranjeno je dijeljenje linkova ka drugim serverima, sajtovima ili sadržaju bez odobrenja.`;

function resolveTargetChannel(interaction) {
    const selected = interaction.options.getChannel('channel');
    if (selected) {
        return selected;
    }

    if (!interaction.channel || !TEXT_CHANNEL_TYPES.includes(interaction.channel.type)) {
        return null;
    }

    return interaction.channel;
}

export default {
    data: new SlashCommandBuilder()
        .setName('pravila')
        .setDescription('Objavi pravila servera (tekst + slika)')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Kanal u koji se šalju pravila (podrazumijevano trenutni kanal)')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    category: 'moderation',
    abuseProtection: { maxAttempts: 5, windowMs: 60_000 },

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferSuccess) {
            logger.warn('Pravila interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'pravila',
            });
            return;
        }

        const channel = resolveTargetChannel(interaction);
        if (!channel) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Izaberi tekstualni kanal ili pokreni komandu u njemu.',
            });
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (
            !botPermissions?.has(PermissionFlagsBits.SendMessages) ||
            !botPermissions?.has(PermissionFlagsBits.EmbedLinks)
        ) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Bot nema dozvolu za slanje poruka i embed linkova u ${channel}.`,
            });
        }

        let sentMessage;
        try {
            const embed = new EmbedBuilder()
                .setTitle('PRAVILA SERVERA 📑')
                .setDescription(PRAVILA)
                .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
                .setColor(0x2b2d31);

            const files = [];
            if (fs.existsSync(SLIKA_FAJL)) {
                files.push(new AttachmentBuilder(SLIKA_FAJL, { name: 'pravila.png' }));
                embed.setImage('attachment://pravila.png');
            } else {
                logger.warn('Pravila: slika nije pronađena', { path: SLIKA_FAJL });
            }

            sentMessage = await channel.send({ embeds: [embed], files });
        } catch (error) {
            logger.error('Pravila send failed', {
                error: error?.message,
                guildId: interaction.guildId,
                channelId: channel.id,
            });
            await InteractionHelper.safeEditReply(interaction, {
                content: 'Slanje pravila nije uspjelo. Provjeri dozvole bota u tom kanalu.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    'Pravila objavljena',
                    `Objavljeno u ${channel}. [Otvori poruku](${sentMessage.url})`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
