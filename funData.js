// ----------------------------------------------------
// 😂 VIRAL FUNNY MEME & SOUND EFFECTS (MYINSTANTS HD)
// Curated 13 Popular Urdu/Hindi & Global Viral Sounds
// ----------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FUN_AUDIO_DIR = path.resolve(__dirname, 'fun_audios');

export const funMemes = [
  {
    id: 1,
    key: 'faaah',
    name: 'Faaah Meme Sound',
    urduName: 'فاااااہ (Faaah Sound)',
    keywords: ['faaah', 'fah', 'faah', '1'],
    emoji: '💨',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_1.mp3'),
    url: 'https://www.myinstants.com/media/sounds/faaah.mp3'
  },
  {
    id: 2,
    key: 'sad_violin',
    name: 'Sad Violin Meme',
    urduName: 'سیڈ وائلن (Sad Violin)',
    keywords: ['sad', 'violin', 'sadviolin', 'dukh', 'rona', '2'],
    emoji: '🎻',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_2.mp3'),
    url: 'https://www.myinstants.com/media/sounds/sad-violin.mp3'
  },
  {
    id: 3,
    key: 'baby_laugh',
    name: 'Baby Laughing Meme',
    urduName: 'بچے کی پیاری ہنسی (Baby Laugh)',
    keywords: ['baby', 'babylaugh', 'bacha', 'laugh', 'hansi', '3'],
    emoji: '👶',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_3.mp3'),
    url: 'https://www.myinstants.com/media/sounds/baby-laughing-meme.mp3'
  },
  {
    id: 4,
    key: 'meme_final',
    name: 'Meme Final Background',
    urduName: 'میم فائنل بیک گراؤنڈ (Meme Final)',
    keywords: ['final', 'memefinal', 'bgm', 'ending', '4'],
    emoji: '🎬',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_4.mp3'),
    url: 'https://www.myinstants.com/media/sounds/meme-final.mp3'
  },
  {
    id: 5,
    key: 'haha_laugh',
    name: 'Haha Funny Laugh',
    urduName: 'ہا ہا ہنسی (Haha Laugh)',
    keywords: ['haha', 'hahaha', 'funnylaugh', 'lol', '5'],
    emoji: '😂',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_5.mp3'),
    url: 'https://www.myinstants.com/media/sounds/haha-funny.mp3'
  },
  {
    id: 6,
    key: 'du_bist',
    name: 'Du Bist Gut Genug',
    urduName: 'ڈو بسٹ گٹ گنوگ (Du Bist)',
    keywords: ['dubist', 'gut', 'genug', 'german', '6'],
    emoji: '🗣️',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_6.mp3'),
    url: 'https://www.myinstants.com/media/sounds/du-bist-gut-genug.mp3'
  },
  {
    id: 7,
    key: 'duck_toy',
    name: 'Duck Toy Squeak Sound',
    urduName: 'بطخ کا کھلونا (Duck Toy Squeak)',
    keywords: ['duck', 'ducktoy', 'quack', 'toy', '7'],
    emoji: '🦆',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_7.mp3'),
    url: 'https://www.myinstants.com/media/sounds/duck-toy-sound.mp3'
  },
  {
    id: 8,
    key: 'aayein',
    name: 'Aayein? Baigan Meme',
    urduName: 'آئیں؟ بینگن میم (Aayein Baigan)',
    keywords: ['aayein', 'baigan', 'ayein', 'baingan', 'aditya', '8'],
    emoji: '🍆',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_8.mp3'),
    url: 'https://www.myinstants.com/media/sounds/aayein-meme.mp3'
  },
  {
    id: 9,
    key: 'are_baap_re',
    name: 'Are Baap Re Yaad Aya',
    urduName: 'ارے باپ رے یاد آیا (Are Baap Re)',
    keywords: ['baapre', 'arebaapre', 'yaadaya', 'bapre', '9'],
    emoji: '😱',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_9.mp3'),
    url: 'https://www.myinstants.com/media/sounds/are-baap-re-yaad-aya.mp3'
  },
  {
    id: 10,
    key: 'rizzbot',
    name: 'Rizzbot Funny Laugh',
    urduName: 'رز بوٹ ہنسی (Rizzbot Laugh)',
    keywords: ['rizz', 'rizzbot', 'botlaugh', '10'],
    emoji: '🤖',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_10.mp3'),
    url: 'https://www.myinstants.com/media/sounds/rizzbot-laugh.mp3'
  },
  {
    id: 11,
    key: 'koun_hai_re',
    name: 'Koun Hai Re Baba',
    urduName: 'کون ہے رے؟ (Koun Hai Re)',
    keywords: ['kounhai', 'kounhaire', 'konhai', 'baba', '11'],
    emoji: '🤨',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_11.mp3'),
    url: 'https://www.myinstants.com/media/sounds/koun-hai-re.mp3'
  },
  {
    id: 12,
    key: 'oh_my_god',
    name: 'Oh Ma Gaud Vine Sound',
    urduName: 'او مائی گوڈ (Oh Ma Gaud Vine)',
    keywords: ['omg', 'ohmygod', 'ohmaguad', 'vine', '12'],
    emoji: '😲',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_12.mp3'),
    url: 'https://www.myinstants.com/media/sounds/oh-ma-gaud-vine.mp3'
  },
  {
    id: 13,
    key: 'troll_laugh',
    name: 'Troll Face Oh No No No Laugh',
    urduName: 'ٹرول فیس او نو نو (Troll Laugh)',
    keywords: ['troll', 'ohnono', 'trollface', 'kekw', '13'],
    emoji: '🤪',
    filePath: path.join(FUN_AUDIO_DIR, 'fun_13.mp3'),
    url: 'https://www.myinstants.com/media/sounds/oh-no-no-no-laugh.mp3'
  }
];
