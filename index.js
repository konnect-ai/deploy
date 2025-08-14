// index.js
require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (_req, res) => res.send('✅ Konnect.AI Discord Bot UP'));
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Health server on :${PORT}`));

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const TOKEN  = process.env.DISCORD_TOKEN;
const PREFIX = '=>';

// Emojis par commandement
const EMOJI_MAP = {
  'Automate': '🤖','Pixel': '🎨','Midas': '💰','Picsou': '💶','Firewall': '🛡️',
  'Contact': '🤝','Viral': '📢','Jugeote': '⚖️','Qualito': '✅','Coach': '🧭',
  'Marius': '🎓','Sentinel': '🪖','General K': '👑','All':'📡'
};

// Noms EXACTS des salons (tels qu’ils apparaissent dans Discord)
const CHANNEL_MAP = {
  'Automate':  '🤖automate-dev-ia',
  'Pixel':     '🎨pixel-design',
  'Midas':     '💰midas-commercial',
  'Picsou':    '💶picsou-finances',
  'Firewall':  '🛡️firewall-sécurité',
  'Contact':   '🤝contact-client',
  'Viral':     '📢viral-marketing',
  'Jugeote':   '⚖️jugeote-legal',
  'Qualito':   '✅qualito-controle',
  'Coach':     '🧭coach-pilotage',
  'Marius':    '🎓marius-formation',
  'Sentinel':  '🪖sentinel',
  'General K': '🧑‍💻bureau-du-qg',
  'All':       null, // broadcast vers tous les salons mappés
  '_event':    '📡event-central' // log central si tu veux
};

// Couleurs des statuts
const STATUS_COLORS = { 'à faire': 0xE67E22, 'à continuer': 0x3498DB, 'validé': 0x2ECC71 };

// Anti-spam simple (cooldown par auteur)
const cooldown = new Map(); // key: userId, value: timestamp (ms)
const COOLDOWN_MS = 5000;

function makeEmbed(command, content, status, authorId) {
  const emoji = EMOJI_MAP[command] || '';
  const color = STATUS_COLORS[status] || 0x95A5A6;
  const nowParis = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const [date, time] = nowParis.split(' ');
  const label = status === 'validé' ? '✅ Validé' : (status === 'à continuer' ? '🔄 À continuer' : '🛠️ À faire');
  const value = status === 'validé' ? (content || '_aucune action_') : (content || '- …');

  return new EmbedBuilder()
    .setTitle(`${emoji} ${label} – ${command}`)
    .setColor(color)
    .addFields(
      { name: '📝 Auteur',     value: `<@${authorId}>`, inline: true },
      { name: '📅 Date',       value: date,             inline: true },
      { name: '⏰ Heure',      value: time,             inline: true },
      { name: '📌 Ordre reçu', value: content || '_(pas de contenu)_', inline: false }
    )
    .setFooter({ text: 'Konnect.AI QG — Confirmation de mission' });
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  const guild = client.guilds.cache.first();
  if (!guild) return console.log('❌ Aucun serveur trouvé.');
  console.log('👀 Salons détectés :');
  guild.channels.cache.filter(c => c.isTextBased()).forEach(c => console.log(' •', c.name));
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Anti-spam simple
  const last = cooldown.get(message.author.id) || 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  cooldown.set(message.author.id, Date.now());

  // Parsing: "=> Automate => à faire => contenu"
  const parts = message.content.split('=>').map(s => s.trim()).filter(Boolean);
  const command = parts[0] || 'General K';
  const action  = (parts[1] || 'à faire').toLowerCase();
  const content = parts.slice(2).join(' => ') || '';

  let status = 'à faire';
  if (action.startsWith('valid')) status = 'validé';
  else if (action.includes('contin')) status = 'à continuer';

  const embed = makeEmbed(command, content, status, message.author.id);

  try {
    if (command === 'All') {
      // Broadcast vers tous les salons mappés (sauf bureau et event)
      const targets = Object.entries(CHANNEL_MAP)
        .filter(([k, v]) => k !== 'All' && k !== 'General K' && k !== '_event' && !!v)
        .map(([_, v]) => v);

      const sent = new Set();
      for (const name of targets) {
        const ch = message.guild.channels.cache.find(c => c.name === name);
        if (ch && ch.isTextBased() && !sent.has(ch.id)) {
          await ch.send({ embeds: [embed] });
          sent.add(ch.id);
        }
      }
      // log central (optionnel)
      const logCh = message.guild.channels.cache.find(c => c.name === CHANNEL_MAP['_event']);
      if (logCh) await logCh.send({ content: '📡 **Broadcast All** délivré.', embeds: [embed] });
    } else {
      const targetName = CHANNEL_MAP[command];
      const ch = targetName
        ? message.guild.channels.cache.find(c => c.name === targetName)
        : message.channel;

      if (ch && ch.isTextBased()) {
        await ch.send({ embeds: [embed] });
      } else {
        await message.channel.send({ content: '⚠️ Salon introuvable, envoi local.', embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('❌ Envoi échoué:', err);
    await message.channel.send('🚫 Erreur d’envoi. Vérifie permissions & noms de salons.');
  }
});

client.login(TOKEN);
