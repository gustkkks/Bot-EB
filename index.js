const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = '.';
const CARGO_CDP = '1489819596314771616';

const cdps = new Map();
const sessoesEmbed = new Map();

function temPerm(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function diasParaMs(dias) {
  return dias * 24 * 60 * 60 * 1000;
}

function formatarTempo(ms) {
  if (ms <= 0) return '0s';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (d > 0) parts.push(d + 'd');
  if (h > 0) parts.push(h + 'h');
  if (m > 0) parts.push(m + 'm');
  if (s > 0) parts.push(s + 's');
  return parts.join(' ');
}

async function aplicarCDP(guild, userId, dias) {
  const chave = guild.id + '_' + userId;
  if (cdps.has(chave) && cdps.get(chave).timer) {
    clearTimeout(cdps.get(chave).timer);
  }
  const expira = Date.now() + diasParaMs(dias);
  try {
    const member = await guild.members.fetch(userId);
    await member.roles.add(CARGO_CDP);
  } catch (e) { console.error(e.message); }
  const timer = setTimeout(async function() {
    await removerCDP(guild, userId, true);
  }, diasParaMs(dias));
  cdps.set(chave, { guildId: guild.id, userId, expira, timer, dias });
}

async function removerCDP(guild, userId, automatico) {
  const chave = guild.id + '_' + userId;
  const dados = cdps.get(chave);
  if (dados && dados.timer && !automatico) clearTimeout(dados.timer);
  cdps.delete(chave);
  try {
    const member = await guild.members.fetch(userId);
    await member.roles.remove(CARGO_CDP);
  } catch (e) { console.error(e.message); }
}

function montarEmbed(s) {
  const e = new EmbedBuilder();
  if (s.titulo) e.setTitle(s.titulo);
  if (s.descricao) e.setDescription(s.descricao);
  if (s.autor) e.setAuthor({ name: s.autor });
  if (s.imagem) e.setImage(s.imagem);
  if (s.thumbnail) e.setThumbnail(s.thumbnail);
  if (s.rodape) e.setFooter({ text: s.rodape });
  try { if (s.cor) e.setColor(s.cor); } catch (_) { e.setColor('#2b2d31'); }
  return e;
}

function botoesEmbed(s) {
  if (!s.botoes || !s.botoes.length) return null;
  const row = new ActionRowBuilder();
  s.botoes.forEach(function(b) {
    row.addComponents(
      new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.url)
    );
  });
  return row;
}

function menuEmbed() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('embed_menu')
      .setPlaceholder('Configure a embed')
      .addOptions([
        { label: 'Titulo', value: 'titulo', emoji: '📝' },
        { label: 'Descricao', value: 'descricao', emoji: '📄' },
        { label: 'Cor', value: 'cor', emoji: '🎨' },
        { label: 'Imagem', value: 'imagem', emoji: '🖼️' },
        { label: 'Thumbnail', value: 'thumbnail', emoji: '🔲' },
        { label: 'Rodape', value: 'rodape', emoji: '📋' },
        { label: 'Autor', value: 'autor', emoji: '✍️' },
        { label: 'Adicionar Botao', value: 'botao', emoji: '🔘' },
        { label: 'Remover Botao', value: 'rm_botao', emoji: '🗑️' },
        { label: 'Enviar', value: 'enviar', emoji: '✅' },
        { label: 'Cancelar', value: 'cancelar', emoji: '❌' }
      ])
  );
}

client.once(Events.ClientReady, async function(c) {
  console.log('Online: ' + c.user.tag);
  const cmds = [
    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Cria uma embed personalizada')
  ].map(function(x) { return x.toJSON(); });
  try {
    await new REST({ version: '10' })
      .setToken(process.env.TOKEN)
      .put(Routes.applicationCommands(c.user.id), { body: cmds });
    console.log('Slash commands registrados.');
  } catch (e) { console.error(e); }
});

// MENSAGENS - comandos .cdp
client.on(Events.MessageCreate, async function(msg) {
  if (msg.author.bot) return;
  if (!msg.guild) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd !== 'cdp') return;
  if (!temPerm(msg.member)) {
    return msg.reply({ embeds: [
      new EmbedBuilder().setColor('#ff4444').setDescription('❌ Sem permissão!')
    ]});
  }

  const sub = args[0] ? args[0].toLowerCase() : null;

  // .cdp @user <dias>
  if (!sub || msg.mentions.members.first()) {
    const alvo = msg.mentions.members.first();
    const dias = parseFloat(args[1] || args[0]);
    if (!alvo || isNaN(dias) || dias <= 0) {
      return msg.reply('Use: `.cdp @user <dias>` — ex: `.cdp @user 10`');
    }
    await aplicarCDP(msg.guild, alvo.id, dias);
    const expira = Date.now() + diasParaMs(dias);
    const e = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('🔒 CDP Aplicado')
      .addFields(
        { name: 'Usuário', value: alvo.toString(), inline: true },
        { name: 'Duração', value: dias + ' dia(s)', inline: true },
        { name: 'Expira em', value: formatarTempo(diasParaMs(dias)), inline: true },
        { name: 'Moderador', value: msg.author.toString(), inline: true }
      ).setTimestamp();
    return msg.reply({ embeds: [e] });
  }

  // .cdp editar @user <dias>
  if (sub === 'editar') {
    const alvo = msg.mentions.members.first();
    const dias = parseFloat(args[2]);
    if (!alvo || isNaN(dias) || dias <= 0) {
      return msg.reply('Use: `.cdp editar @user <dias>`');
    }
    await aplicarCDP(msg.guild, alvo.id, dias);
    const e = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('✏️ CDP Editado')
      .addFields(
        { name: 'Usuário', value: alvo.toString(), inline: true },
        { name: 'Nova duração', value: dias + ' dia(s)', inline: true },
        { name: 'Expira em', value: formatarTempo(diasParaMs(dias)), inline: true }
      ).setTimestamp();
    return msg.reply({ embeds: [e] });
  }

  // .cdp remover @user
  if (sub === 'remover') {
    const alvo = msg.mentions.members.first();
    if (!alvo) return msg.reply('Use: `.cdp remover @user`');
    await removerCDP(msg.guild, alvo.id, false);
    const e = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✅ CDP Removido')
      .addFields(
        { name: 'Usuário', value: alvo.toString(), inline: true },
        { name: 'Moderador', value: msg.author.toString(), inline: true }
      ).setTimestamp();
    return msg.reply({ embeds: [e] });
  }

  // .cdp ver @user
  if (sub === 'ver') {
    const alvo = msg.mentions.members.first();
    if (!alvo) return msg.reply('Use: `.cdp ver @user`');
    const chave = msg.guild.id + '_' + alvo.id;
    const dados = cdps.get(chave);
    if (!dados) return msg.reply(alvo.toString() + ' não tem CDP ativo.');
    const restante = dados.expira - Date.now();
    const e = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📋 CDP Ativo')
      .addFields(
        { name: 'Usuário', value: alvo.toString(), inline: true },
        { name: 'Tempo restante', value: formatarTempo(restante), inline: true }
      ).setTimestamp();
    return msg.reply({ embeds: [e] });
  }

  return msg.reply(
    'Comandos disponíveis:\n' +
    '`.cdp @user <dias>` — aplicar\n' +
    '`.cdp editar @user <dias>` — editar\n' +
    '`.cdp remover @user` — remover\n' +
    '`.cdp ver @user` — ver tempo restante'
  );
});

// INTERAÇÕES - /embed
client.on(Events.InteractionCreate, async function(i) {

  if (i.isChatInputCommand() && i.commandName === 'embed') {
    if (!temPerm(i.member)) {
      return i.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }
    sessoesEmbed.set(i.user.id, {
      titulo: null, descricao: null, cor: '#2b2d31',
      imagem: null, thumbnail: null, rodape: null,
      autor: null, botoes: []
    });
    const prev = new EmbedBuilder()
      .setTitle('Criador de Embed')
      .setDescription('Use o menu abaixo para configurar.')
      .setColor('#2b2d31');
    return i.reply({
      content: '## Configurador de Embed',
      embeds: [prev],
      components: [menuEmbed()],
      ephemeral: true
    });
  }

  // Menu embed
  if (i.isStringSelectMenu() && i.customId === 'embed_menu') {
    const v = i.values[0];
    const s = sessoesEmbed.get(i.user.id);
    if (!s) return i.reply({ content: 'Sessão expirada.', ephemeral: true });

    if (v === 'cancelar') {
      sessoesEmbed.delete(i.user.id);
      return i.update({ content: 'Cancelado.', embeds: [], components: [] });
    }

    if (v === 'rm_botao') {
      if (!s.botoes.length) return i.reply({ content: 'Sem botões.', ephemeral: true });
      s.botoes.pop();
      sessoesEmbed.set(i.user.id, s);
      const br = botoesEmbed(s);
      const comps = [menuEmbed()];
      if (br) comps.push(br);
      return i.update({ content: 'Botão removido.', embeds: [montarEmbed(s)], components: comps });
    }

    if (v === 'enviar') {
      const br = botoesEmbed(s);
      try {
        await i.channel.send({ embeds: [montarEmbed(s)], components: br ? [br] : [] });
        sessoesEmbed.delete(i.user.id);
        return i.update({ content: 'Embed enviada!', embeds: [], components: [] });
      } catch (e) { return i.reply({ content: 'Erro ao enviar.', ephemeral: true }); }
    }

    if (v === 'botao') {
      if (s.botoes.length >= 5) {
        return i.reply({ content: 'Limite de 5 botões!', ephemeral: true });
      }
      const modal = new ModalBuilder().setCustomId('em_botao').setTitle('Adicionar Botão')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('lbl').setLabel('Texto do botão')
              .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('url').setLabel('URL')
              .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://...')
          )
        );
      return i.showModal(modal);
    }

    const lbls = {
      titulo: 'Titulo', descricao: 'Descricao', cor: 'Cor (#hex)',
      imagem: 'Imagem URL', thumbnail: 'Thumbnail URL', rodape: 'Rodape', autor: 'Autor'
    };
    const inp = new TextInputBuilder()
      .setCustomId('val').setLabel(lbls[v] || v)
      .setStyle(v === 'descricao' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(false).setValue(s[v] || '');
    const modal = new ModalBuilder()
      .setCustomId('em_campo_' + v).setTitle(lbls[v] || v)
      .addComponents(new ActionRowBuilder().addComponents(inp));
    return i.showModal(modal);
  }

  // Modals embed
  if (i.isModalSubmit()) {
    if (i.customId.startsWith('em_campo_')) {
      const campo = i.customId.replace('em_campo_', '');
      const s = sessoesEmbed.get(i.user.id);
      if (!s) return i.reply({ content: 'Sessão expirada.', ephemeral: true });
      s[campo] = i.fields.getTextInputValue('val') || null;
      sessoesEmbed.set(i.user.id, s);
      let prev;
      try { prev = montarEmbed(s); } catch (_) {
        return i.reply({ content: 'Valor inválido.', ephemeral: true });
      }
      const br = botoesEmbed(s);
      const comps = [menuEmbed()];
      if (br) comps.push(br);
      return i.update({ content: campo + ' atualizado!', embeds: [prev], components: comps });
    }

    if (i.customId === 'em_botao') {
      const s = sessoesEmbed.get(i.user.id);
      if (!s) return i.reply({ content: 'Sessão expirada.', ephemeral: true });
      const url = i.fields.getTextInputValue('url');
      if (!url.startsWith('http')) {
        return i.reply({ content: 'URL inválida.', ephemeral: true });
      }
      s.botoes.push({ label: i.fields.getTextInputValue('lbl'), url });
      sessoesEmbed.set(i.user.id, s);
      const br = botoesEmbed(s);
      const comps = [menuEmbed()];
      if (br) comps.push(br);
      return i.update({
        content: 'Botão adicionado! (' + s.botoes.length + '/5)',
        embeds: [montarEmbed(s)],
        components: comps
      });
    }
  }
});

client.login(process.env.TOKEN);
