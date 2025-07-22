import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock environment variables
process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
process.env.DISCORD_PUBLIC_KEY = 'test-public-key';
process.env.DISCORD_APPLICATION_ID = 'test-app-id';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SERVICE_AUTH_SECRET = 'test-auth-secret';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    ws: { ping: 50 },
    guilds: {
      cache: new Map([
        ['guild-1', { id: 'guild-1', name: 'Test Guild' }],
      ]),
    },
    users: {
      cache: new Map([
        ['user-1', { id: 'user-1', username: 'testuser' }],
      ]),
      fetch: jest.fn(),
    },
    channels: {
      cache: new Map([
        ['channel-1', { id: 'channel-1', type: 0, send: jest.fn() }],
      ]),
    },
    on: jest.fn(),
    off: jest.fn(),
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMembers: 4,
    DirectMessages: 8,
    MessageContent: 16,
  },
  Partials: {
    Message: 'MESSAGE',
    Channel: 'CHANNEL',
    Reaction: 'REACTION',
  },
  EmbedBuilder: jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
  })),
  ActionRowBuilder: jest.fn(() => ({
    addComponents: jest.fn().mockReturnThis(),
  })),
  ButtonBuilder: jest.fn(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis(),
  })),
  StringSelectMenuBuilder: jest.fn(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    setMinValues: jest.fn().mockReturnThis(),
    setMaxValues: jest.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
  },
  InteractionType: {
    Ping: 1,
    ApplicationCommand: 2,
    MessageComponent: 3,
    ApplicationCommandAutocomplete: 4,
    ModalSubmit: 5,
  },
  InteractionResponseType: {
    Pong: 1,
    ChannelMessageWithSource: 4,
    DeferredChannelMessageWithSource: 5,
    DeferredMessageUpdate: 6,
    UpdateMessage: 7,
    ApplicationCommandAutocompleteResult: 8,
  },
  ChannelType: {
    GuildText: 0,
  },
  PermissionsBitField: {
    Flags: {
      SendMessages: 'SEND_MESSAGES',
      ViewChannel: 'VIEW_CHANNEL',
      ManageMessages: 'MANAGE_MESSAGES',
      Administrator: 'ADMINISTRATOR',
    },
  },
}));

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    addBulk: jest.fn().mockResolvedValue([
      { id: 'job-1' },
      { id: 'job-2' },
    ]),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    clean: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn(),
  }));
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  })),
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});