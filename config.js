// Configuration settings for WhatsApp Super Bot Pro
export const config = {
  // Bot Settings
  botName: "WhatsApp Super Bot",
  prefix: ".", // Command prefix (e.g. .menu, .naat, .ping, .react on)
  port: 3000,
  
  // 🔐 Owner Permission Settings (Commands strictly for owner)
  ownerOnlyCommands: true, // If true, only the owner can use bot commands
  ownerNumbers: [
    "923267004137", 
    "03267004137", 
    "3267004137"
  ], // Strictly Kaleem Khan only

  // ⚡ Auto React Settings
  autoReact: true, // Master Auto-React switch (toggle with .react on / off)
  reactToOwnMessages: false, // Prevent infinite reaction loop on own messages
  reactInGroups: true, // React to group messages
  reactInPrivate: true, // React to private 1-on-1 chats
  antiDeleteAuto: true, // Auto Anti-Delete Shield: Immediately reposts deleted messages so no one can Delete for Everyone!
  viewOnceAuto: true, // Auto-send view once media to owner privately
  
  // Super Fast / Instant Reaction (0ms delay)
  minDelayMs: 0,
  maxDelayMs: 0,

  // List of emojis to randomly pick for reactions
  emojis: [
    "❤️", "🔥", "😂", "👍", "✨", 
    "⚡", "💯", "😎", "👏", "🤖", 
    "🎉", "🌟", "🙌", "💥", "🤩", 
    "👌", "🚀", "😍", "🥳", "🤙", "🌹", "👑", "💎"
  ],

  // 🤖 AI Chat & Auto-Reply Settings (OpenRouter Llama 3.3 70B & GPT-4o-mini)
  openRouterKey: process.env.OPENROUTER_API_KEY || "",
  aiAutoReply: true, // Master switch for AI auto-reply
  aiMode: "all", // "all" (everyone who messages gets instant reply) or "specific"
  aiAllowedUsers: [], // Array of phone numbers/JIDs allowed for AI auto-reply
  aiModel: "meta-llama/llama-3.3-70b-instruct", // Ultra fast & natural human-like
  aiReplyInPrivate: true, // Auto reply in private chats
  aiReplyInGroups: false // Auto reply in groups (set true if you want AI to reply in groups)
};
