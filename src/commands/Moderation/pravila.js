import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';

import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

// Slika pravila
const SLIKA_LINK =
    'https://i.postimg.cc/CMQ3vPwj/Glossy-Blue-B-PRAVILA-Esports-Logo.png';

const TEXT_CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
];

// Emoji zapisani Unicode formatom
const EMOJI = {
    cowboy: '\u{1F920}',
    spam: '\u{1F3F7}\u{FE0F}',
    adult: '\u{1F51E}',
    warning: '\u{26A0}\u{FE0F}',
    channels: '\u{1F5C2}\u{FE0F}',
    no: '\u{1F6AB}',
    bullet: '\u{25AB}\u{FE0F}',
};

const PRAVILA = [
    `${EMOJI.bullet} ${EMOJI.cowboy} **POŠTUJ SVE ČLANOVE**`,
    'Budi pristojan i ljubazan. Uvrede, diskriminacija i govor mržnje nisu dozvoljeni.',
    '',
    `${EMOJI.bullet} ${EMOJI.spam} **SPAM JE ZABRANJEN**`,
    'Zabranjeno je spamovanje porukama, tagovima, linkovima ili emojijima.',
    '',
    `${EMOJI.bullet} ${EMOJI.adult} **NEPRIMJEREN SADRŽAJ**`,
    `Strogo zabranjeno. ${EMOJI.warning}`,
    'To uključuje NSFW, nasilni, uvredljivi ili ilegalni sadržaj bilo koje vrste.',
    '',
    `${EMOJI.bullet} ${EMOJI.channels} **POŠTUJ KANALE**`,
    'Koristi kanale prema njihovoj namjeni. Ne šalji poruke u pogrešne kanale.',
    '',
    `${EMOJI.bullet} ${EMOJI.no} **REKLAMIRANJE**`,
    'Zabranjeno je dijeljenje linkova ka drugim serverima, sajtovima ili sadržaju bez odobrenja.',
].join('\n');

function resolveTargetChannel(interaction) {
    const selected = interaction.options.getChannel('channel');

    if (selected) {
        return selected;
    }

    if (
        !interaction.channel ||
        !TEXT_CHANNEL_TYPES.includes(interaction.channel.type)
    ) {
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
                .setDescription('Kanal u koji se šalju pravila')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),

    category: 'moderation',

    abuseProtection: {
        maxAttempts: 5,
        windowMs: 60_000,
    },

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

        const botMember = interaction.guild.members.me;

        const botPermissions = channel.permissionsFor(botMember);

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
                .setTitle('PRAVILA SERVERA')
                .setDescription(PRAVILA)
                .setThumbnail(
                    interaction.client.user.displayAvatarURL({
                        size: 256,
                        extension: 'png',
                    }),
                )
                .setImage(SLIKA_LINK)
                .setColor(0x2b2d31);

            // Bot inače briše emojije iz embedova (src/utils/embeds.js),
            // pa naslov i tekst upisujemo direktno da emojiji ostanu.
            embed.data.title = 'PRAVILA SERVERA';
            embed.data.description = PRAVILA;

            console.log('[PRAVILA] Emoji test:', EMOJI);
            console.log('[PRAVILA] Opis:', PRAVILA);

            sentMessage = await channel.send({
                embeds: [embed],
            });

            logger.info('Pravila uspješno objavljena', {
                guildId: interaction.guildId,
                channelId: channel.id,
                messageId: sentMessage.id,
            });

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
