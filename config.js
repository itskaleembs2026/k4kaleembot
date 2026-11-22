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
  viewOnceAuto: false, // Auto-send view once media to owner privately
  
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

  // 🤖 AI Chat & Auto-Reply Settings (OpenRouter powered Llama 3.3 / ChatGPT)
  openRouterKey: "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",
  aiAutoReply: true, // Master switch for AI auto-reply
  aiMode: "specific", // "specific" (only allowed users/chats) or "all" (everyone)
  aiAllowedUsers: [], // Array of phone numbers/JIDs allowed for AI auto-reply
  aiModel: "meta-llama/llama-3.3-70b-instruct", // Ultra fast & smart
  aiReplyInPrivate: true, // Auto reply in private chats
  aiReplyInGroups: false // Auto reply in groups
};
