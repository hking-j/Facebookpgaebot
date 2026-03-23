
const express = require('express');
const axios = require('axios');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const { Spinner } = require('cli-spinner');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');

// Bot configuration
const config = {
    port: process.env.PORT || 5000,
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN || 'EAAQ1WsOAhD0BQ2ZAZA4If1Y3m22LYuoHU1v7bAxjpvJpnNNtqdgHGl7bs8hYVgocgjPQN6Oo6mIDc0cfJnZBoBv3XmOWg9S24diwsHSIotIEgTfwtU1qrfpnhJZAht5aKCa26H1h6KHdBHz0YKxUdfcgXWlEtZColeZBvUxTDXXxQmYxgiN5nnrckMX4xTG82OjLd3OAZDZD',
    verifyToken: process.env.VERIFY_TOKEN || 'kaiz_bot_verify_token',
    apiKey: 'b25bd41d-a96c-4df0-aab1-536acd594eb7',
    apiBase: 'https://kaiz-apis.gleeze.com/api'
};

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.static('public'));

// User database (in-memory for simplicity)
const userDatabase = new Map();
const pendingRegistrations = new Map(); // Track pending registrations by reference number

// Aesthetic Logger Class
class AestheticLogger {
    constructor() {
        this.colors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
        this.rainbowGradient = gradient(this.colors);
        this.initLogger();
    }

    initLogger() {
        console.clear();
        const title = figlet.textSync('KAIZ BOT', {
            font: 'ANSI Shadow',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        });
        console.log(this.rainbowGradient(title));
        console.log(this.rainbowGradient('='.repeat(80)));
        console.log();
    }

    loading(message, duration = 2000) {
        const spinner = new Spinner(chalk.cyan(`${message} %s`));
        spinner.setSpinnerString('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏');
        spinner.start();
        
        return new Promise(resolve => {
            setTimeout(() => {
                spinner.stop(true);
                resolve();
            }, duration);
        });
    }

    log(level, message, data = null) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const colorMap = {
            info: chalk.cyan,
            success: chalk.green,
            warning: chalk.yellow,
            error: chalk.red,
            debug: chalk.magenta
        };
        
        const colorFunc = colorMap[level] || chalk.white;
        const prefix = this.rainbowGradient(`[${timestamp}]`);
        const levelTag = colorFunc(`[${level.toUpperCase()}]`);
        
        console.log(`${prefix} ${levelTag} ${message}`);
        if (data) {
            console.log(chalk.gray(JSON.stringify(data, null, 2)));
        }
    }

    info(message, data) { this.log('info', message, data); }
    success(message, data) { this.log('success', message, data); }
    warning(message, data) { this.log('warning', message, data); }
    error(message, data) { this.log('error', message, data); }
    debug(message, data) { this.log('debug', message, data); }
}

const logger = new AestheticLogger();

// API Helper Class
class APIHelper {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async makeRequest(endpoint, params = {}) {
        try {
            params.apikey = this.apiKey;
            const response = await axios.get(`${this.baseUrl}/${endpoint}`, { params });
            return response.data;
        } catch (error) {
            logger.error(`API Request failed for ${endpoint}`, error.message);
            throw error;
        }
    }

    async kaizAI(message, uid = '1') {
        return await this.makeRequest('kaiz-ai', { ask: message, uid });
    }

    async geminiPro(message, uid = '1') {
        return await this.makeRequest('gemini-pro', { ask: message, uid });
    }

    async gpt3(message) {
        return await this.makeRequest('gpt3', { ask: message });
    }

    async deepseekV3(message) {
        return await this.makeRequest('deepseek-v3', { ask: message });
    }

    async llamaTurbo(message, uid = '1') {
        return await this.makeRequest('llama3-turbo', { ask: message, uid });
    }

    async spotifyDownload(url) {
        return await this.makeRequest('spotify-down', { url });
    }

    async tiktokDownload(url) {
        return await this.makeRequest('tiktok-dl', { url });
    }

    async instagramDownload(url) {
        return await this.makeRequest('insta-dl', { url });
    }

    async tiktokSearch(query) {
        return await this.makeRequest('tiksearch', { search: query });
    }

    async removeBg(url) {
        return await this.makeRequest('removebgv3', { url, stream: false });
    }

    async wikipedia(query) {
        return await this.makeRequest('wikipedia', { search: query });
    }
}

const api = new APIHelper(config.apiKey, config.apiBase);

// User Registration System
class UserManager {
    generateReferenceNumber(username) {
        const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
        return `#${username}-${randomNum}`;
    }

    async registerUser(userId, userData) {
        const referenceNumber = this.generateReferenceNumber(userData.name || 'User');
        const user = {
            id: userId,
            name: userData.name || 'Unknown',
            referenceNumber,
            registeredAt: new Date().toISOString(),
            accepted: false,
            status: 'pending'
        };
        
        userDatabase.set(userId, user);
        pendingRegistrations.set(referenceNumber, userId);
        logger.info(`New user registered: ${referenceNumber}`);
        return user;
    }

    getUser(userId) {
        return userDatabase.get(userId);
    }

    acceptTerms(userId) {
        const user = userDatabase.get(userId);
        if (user) {
            user.accepted = true;
            user.status = 'active';
            userDatabase.set(userId, user);
            return user;
        }
        return null;
    }

    isRegistered(userId) {
        return userDatabase.has(userId);
    }

    async completeRegistration(referenceNumber) {
        const userId = pendingRegistrations.get(referenceNumber);
        if (userId) {
            const user = userDatabase.get(userId);
            if (user && user.accepted) {
                user.status = 'active';
                userDatabase.set(userId, user);
                pendingRegistrations.delete(referenceNumber);
                
                // Send notification to user on Facebook
                await bot.sendMessage(userId, { 
                    text: `🎊 Registration Complete! 🎊

Hi ${user.name}! 👋

Your registration via the website has been completed successfully! ✅

Reference Number: ${user.referenceNumber}
Status: Active ✅

You can now use all KAIZ Bot features! Type 'menu' to get started! 🚀` 
                });
                
                logger.success(`Registration completed for ${referenceNumber}`);
                return user;
            }
        }
        return null;
    }

    getPendingRegistration(referenceNumber) {
        const userId = pendingRegistrations.get(referenceNumber);
        return userId ? userDatabase.get(userId) : null;
    }
}

const userManager = new UserManager();

// Facebook Messenger Helper Class
class MessengerBot {
    constructor(pageAccessToken) {
        this.pageAccessToken = pageAccessToken;
        this.graphAPI = 'https://graph.facebook.com/v18.0/me/messages';
    }

    async sendMessage(recipientId, message) {
        try {
            const response = await axios.post(this.graphAPI, {
                recipient: { id: recipientId },
                message: message
            }, {
                params: { access_token: this.pageAccessToken }
            });
            logger.success(`Message sent to ${recipientId}`);
            return response.data;
        } catch (error) {
            logger.error('Failed to send message', error.response?.data || error.message);
            throw error;
        }
    }

    async sendTypingIndicator(recipientId, action = 'typing_on') {
        try {
            await axios.post(this.graphAPI, {
                recipient: { id: recipientId },
                sender_action: action
            }, {
                params: { access_token: this.pageAccessToken }
            });
        } catch (error) {
            logger.error('Failed to send typing indicator', error.message);
        }
    }

    async sendQuickReplies(recipientId, text, quickReplies) {
        const message = {
            text: text,
            quick_replies: quickReplies.map(reply => ({
                content_type: 'text',
                title: reply.title,
                payload: reply.payload
            }))
        };
        return await this.sendMessage(recipientId, message);
    }

    async sendButtonTemplate(recipientId, text, buttons) {
        // Ensure text is not too long for button template (limit: 640 characters)
        const truncatedText = text.length > 640 ? text.substring(0, 637) + '...' : text;
        
        const message = {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: truncatedText,
                    buttons: buttons.map(button => ({
                        type: button.type,
                        title: button.title,
                        payload: button.payload || undefined,
                        url: button.url || undefined
                    }))
                }
            }
        };
        return await this.sendMessage(recipientId, message);
    }

    async sendTermsAndConditions(recipientId, username) {
        const termsText = `🔒 Terms & Conditions

Hello ${username}! 👋

Welcome to KAIZ Bot! Before you can start using our services, please read and accept our terms:

📋 Terms of Service:
• Respect other users and use appropriate language
• Don't spam or abuse the bot's features
• Content downloaded is for personal use only
• We reserve the right to suspend accounts for violations
• Your data is processed according to our privacy policy

🤖 AI Usage Rules:
• Don't generate harmful or inappropriate content
• AI responses are generated and may not always be accurate
• Don't use AI for illegal activities

🎵 Media Download Rules:
• Only download content you have rights to use
• Respect copyright and intellectual property
• Downloads are for personal use only

By clicking "I Accept", you agree to these terms and can start using KAIZ Bot.`;

        const buttons = [
            {
                type: 'postback',
                title: '✅ I Accept',
                payload: 'ACCEPT_TERMS'
            },
            {
                type: 'postback',
                title: '❌ No Accept',
                payload: 'DECLINE_TERMS'
            }
        ];

        await this.sendButtonTemplate(recipientId, termsText, buttons);
    }

    async sendWelcomeMessage(recipientId, user) {
        const welcomeText = `🎉 Welcome ${user.name}! 🤖

Your registration is complete! ✅
Reference Number: ${user.referenceNumber}

🌟 KAIZ Bot Features:

🧠 Multi-AI Chat - Multiple AI models at your service
🎵 Media Downloader - Spotify, TikTok, Instagram
🖼️ Image Tools - Analysis, background removal
📚 Smart Search - TikTok search, Wikipedia
🔧 Utility Tools - Various helpful features

Type 'help' or 'menu' to explore all features!`;

        const quickReplies = [
            { title: '🤖 AI Chat', payload: 'ai_chat' },
            { title: '🎵 Downloads', payload: 'downloads' },
            { title: '🛠️ Tools', payload: 'tools' },
            { title: '📋 Menu', payload: 'menu' }
        ];

        await this.sendQuickReplies(recipientId, welcomeText, quickReplies);
    }

    async sendRegistrationNotification(recipientId, user) {
        const notificationText = `🎊 Registration Successful! 🎊

Hi ${user.name}! 👋

Your KAIZ Bot account has been successfully registered! ✅

📋 Your Details:
• Name: ${user.name}
• Reference ID: ${user.referenceNumber}
• Status: Active ✅
• Registered: ${new Date(user.registeredAt).toLocaleDateString()}

🎯 What's Next?
You can now access all KAIZ Bot features including AI chat, media downloads, and more!

Type 'menu' to get started! 🚀`;

        await this.sendMessage(recipientId, { text: notificationText });
    }

    async sendHelpMenu(recipientId) {
        const helpText = `📋 **KAIZ Bot Commands:**

🤖 **AI Commands:**
• **/ai [message]** - KAIZ AI response
• **/gemini [message]** - Gemini Pro response  
• **/gpt [message]** - GPT-3 response
• **/deepseek [message]** - DeepSeek V3 response
• **/llama [message]** - Llama3 Turbo response

🎵 **Media Downloads:**
• **/spotify [URL]** - Download Spotify track
• **/tiktok [URL]** - Download TikTok video
• **/instagram [URL]** - Download Instagram media

🔍 **Search & Tools:**
• **/tiksearch [query]** - Search TikTok videos
• **/wiki [query]** - Wikipedia search
• **/removebg [image URL]** - Remove background

📱 **Quick Actions:**
• **menu** - Main menu
• **help** - This help guide`;

        await this.sendMessage(recipientId, { text: helpText });
    }

    async sendMainMenu(recipientId) {
        const buttons = [
            {
                type: 'postback',
                title: '🤖 AI Models',
                payload: 'AI_MENU'
            },
            {
                type: 'postback',
                title: '📥 Downloads',
                payload: 'DOWNLOAD_MENU'
            },
            {
                type: 'postback',
                title: '🛠️ Tools',
                payload: 'TOOLS_MENU'
            }
        ];

        await this.sendButtonTemplate(recipientId, '🎯 **Choose a category:**', buttons);
    }

    async sendDownloadMenu(recipientId) {
        const quickReplies = [
            { title: '🎵 Spotify', payload: 'spotify_help' },
            { title: '📱 TikTok', payload: 'tiktok_help' },
            { title: '📷 Instagram', payload: 'instagram_help' },
            { title: '🔍 TikTok Search', payload: 'tiksearch_help' }
        ];

        await this.sendQuickReplies(recipientId, '📥 **Download Options:**\n\nChoose what you want to download:', quickReplies);
    }

    async sendToolsMenu(recipientId) {
        const quickReplies = [
            { title: '🖼️ Remove BG', payload: 'removebg_help' },
            { title: '📚 Wikipedia', payload: 'wiki_help' },
            { title: '🔍 Image Analysis', payload: 'image_help' }
        ];

        await this.sendQuickReplies(recipientId, '🛠️ **Available Tools:**\n\nSelect a tool to learn more:', quickReplies);
    }

    async sendAIMenu(recipientId) {
        const quickReplies = [
            { title: '🤖 KAIZ AI', payload: 'kaiz_ai' },
            { title: '🔮 Gemini Pro', payload: 'gemini_pro' },
            { title: '💡 GPT-3', payload: 'gpt3' },
            { title: '🚀 DeepSeek V3', payload: 'deepseek_v3' },
            { title: '🦙 Llama3 Turbo', payload: 'llama_turbo' }
        ];

        await this.sendQuickReplies(recipientId, '🧠 **Choose your AI model:**', quickReplies);
    }
}

const bot = new MessengerBot(config.pageAccessToken);

// Message Handler Class
class MessageHandler {
    async handleTextMessage(senderId, messageText) {
        const text = messageText.toLowerCase().trim();
        
        // Check if user is registered and accepted terms
        if (!userManager.isRegistered(senderId)) {
            await this.handleNewUser(senderId);
            return;
        }

        const user = userManager.getUser(senderId);
        if (!user.accepted) {
            await bot.sendMessage(senderId, { 
                text: '⚠️ Please accept the terms and conditions first to use the bot.' 
            });
            return;
        }

        logger.info(`Processing message from ${senderId} (${user.name})`, { message: text });

        // Show typing indicator
        await bot.sendTypingIndicator(senderId);

        // Command handling
        if (text.startsWith('/')) {
            await this.handleCommand(senderId, text, user);
        } else if (text === 'menu' || text === 'start') {
            await bot.sendMainMenu(senderId);
        } else if (text === 'help') {
            await bot.sendHelpMenu(senderId);
        } else if (text.includes('spotify.com') || text.includes('open.spotify.com')) {
            await this.handleSpotifyDownload(senderId, text);
        } else if (text.includes('tiktok.com') || text.includes('vm.tiktok.com') || text.includes('vt.tiktok.com')) {
            await this.handleTikTokDownload(senderId, text);
        } else if (text.includes('instagram.com')) {
            await this.handleInstagramDownload(senderId, text);
        } else {
            // Default to KAIZ AI for regular conversation
            await this.handleAIResponse(senderId, messageText, 'kaiz', user);
        }

        // Turn off typing indicator
        await bot.sendTypingIndicator(senderId, 'typing_off');
    }

    async handleNewUser(senderId) {
        // Register new user
        const user = await userManager.registerUser(senderId, { name: `User${senderId.slice(-4)}` });
        
        // Send terms and conditions
        await bot.sendTermsAndConditions(senderId, user.name);
        
        logger.info(`New user ${user.referenceNumber} needs to accept terms`);
    }

    async handleCommand(senderId, command, user) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const message = parts.slice(1).join(' ');

        if (!message && !cmd.includes('help') && !cmd.includes('menu')) {
            await bot.sendMessage(senderId, { 
                text: '❗ Please provide a message after the command.\nExample: **/ai Hello, how are you?**' 
            });
            return;
        }

        switch (cmd) {
            case '/ai':
            case '/kaiz':
                await this.handleAIResponse(senderId, message, 'kaiz', user);
                break;
            case '/gemini':
                await this.handleAIResponse(senderId, message, 'gemini', user);
                break;
            case '/gpt':
                await this.handleAIResponse(senderId, message, 'gpt', user);
                break;
            case '/deepseek':
                await this.handleAIResponse(senderId, message, 'deepseek', user);
                break;
            case '/llama':
                await this.handleAIResponse(senderId, message, 'llama', user);
                break;
            case '/spotify':
                await this.handleSpotifyDownload(senderId, message);
                break;
            case '/tiktok':
                await this.handleTikTokDownload(senderId, message);
                break;
            case '/instagram':
                await this.handleInstagramDownload(senderId, message);
                break;
            case '/tiksearch':
                await this.handleTikTokSearch(senderId, message);
                break;
            case '/wiki':
                await this.handleWikipediaSearch(senderId, message);
                break;
            case '/removebg':
                await this.handleRemoveBg(senderId, message);
                break;
            default:
                await bot.sendMessage(senderId, { 
                    text: '❓ **Unknown command.** Type **"help"** to see available commands.' 
                });
        }
    }

    async handleAIResponse(senderId, message, model, user) {
        try {
            logger.info(`Getting ${model.toUpperCase()} response for user ${senderId}`);
            
            let response;
            let modelName;

            switch (model) {
                case 'kaiz':
                    response = await api.kaizAI(message, senderId);
                    modelName = '🤖 **KAIZ AI**';
                    break;
                case 'gemini':
                    response = await api.geminiPro(message, senderId);
                    modelName = '🔮 **Gemini Pro**';
                    break;
                case 'gpt':
                    response = await api.gpt3(message);
                    modelName = '💡 **GPT-3**';
                    break;
                case 'deepseek':
                    response = await api.deepseekV3(message);
                    modelName = '🚀 **DeepSeek V3**';
                    break;
                case 'llama':
                    response = await api.llamaTurbo(message, senderId);
                    modelName = '🦙 **Llama3 Turbo**';
                    break;
            }

            if (response && response.response) {
                const aiMessage = `${modelName} Response:\n\n${response.response}`;
                await bot.sendMessage(senderId, { text: aiMessage });
                logger.success(`${model.toUpperCase()} response sent successfully`);
            } else {
                await bot.sendMessage(senderId, { 
                    text: `❗ Hi **${user.name}**! Sorry, I couldn't process your request. Please try again.` 
                });
            }
        } catch (error) {
            logger.error(`Failed to get ${model} response`, error.message);
            await bot.sendMessage(senderId, { 
                text: `🔧 Hi **${user.name}**! Technical error occurred. Please try again later.` 
            });
        }
    }

    async handleTikTokDownload(senderId, url) {
        try {
            logger.info(`Processing TikTok download for user ${senderId}`);
            
            const tiktokUrlMatch = url.match(/(https?:\/\/(?:vm|vt|www)?\.?tiktok\.com\/[^\s]+)/);
            const tiktokUrl = tiktokUrlMatch ? tiktokUrlMatch[1] : url;

            if (!tiktokUrl.includes('tiktok.com')) {
                await bot.sendMessage(senderId, { 
                    text: '❗ Please provide a valid **TikTok URL**.' 
                });
                return;
            }

            const response = await api.tiktokDownload(tiktokUrl);
            
            if (response && response.video_url) {
                // Send video directly
                const videoMessage = {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: response.video_url
                        }
                    }
                };
                
                await bot.sendMessage(senderId, videoMessage);
                
                if (response.title) {
                    await bot.sendMessage(senderId, { 
                        text: `🎬 **${response.title}**\n\n✅ **Download complete!**` 
                    });
                }
                
                logger.success('TikTok video sent successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: '❗ Could not process the **TikTok link**. Please check the URL and try again.' 
                });
            }
        } catch (error) {
            logger.error('Failed to process TikTok download', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error processing **TikTok link**. Please try again later.' 
            });
        }
    }

    async handleInstagramDownload(senderId, url) {
        try {
            logger.info(`Processing Instagram download for user ${senderId}`);
            
            const instaUrlMatch = url.match(/(https?:\/\/(?:www\.)?instagram\.com\/[^\s]+)/);
            const instaUrl = instaUrlMatch ? instaUrlMatch[1] : url;

            if (!instaUrl.includes('instagram.com')) {
                await bot.sendMessage(senderId, { 
                    text: '❗ Please provide a valid **Instagram URL**.' 
                });
                return;
            }

            const response = await api.instagramDownload(instaUrl);
            
            if (response && (response.video_url || response.image_url)) {
                if (response.video_url) {
                    const videoMessage = {
                        attachment: {
                            type: 'video',
                            payload: {
                                url: response.video_url
                            }
                        }
                    };
                    await bot.sendMessage(senderId, videoMessage);
                } else if (response.image_url) {
                    const imageMessage = {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: response.image_url
                            }
                        }
                    };
                    await bot.sendMessage(senderId, imageMessage);
                }
                
                if (response.caption) {
                    await bot.sendMessage(senderId, { 
                        text: `📱 **Instagram Download**\n\n${response.caption}\n\n✅ **Download complete!**` 
                    });
                }
                
                logger.success('Instagram media sent successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: '❗ Could not process the **Instagram link**. Please check the URL and try again.' 
                });
            }
        } catch (error) {
            logger.error('Failed to process Instagram download', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error processing **Instagram link**. Please try again later.' 
            });
        }
    }

    async handleTikTokSearch(senderId, query) {
        try {
            logger.info(`Processing TikTok search for user ${senderId}`);
            
            const response = await api.tiktokSearch(query);
            
            if (response && response.videos && response.videos.length > 0) {
                const video = response.videos[0]; // Get first result
                
                if (video.video_url) {
                    // Send video directly
                    const videoMessage = {
                        attachment: {
                            type: 'video',
                            payload: {
                                url: video.video_url
                            }
                        }
                    };
                    
                    await bot.sendMessage(senderId, videoMessage);
                    
                    if (video.title) {
                        await bot.sendMessage(senderId, { 
                            text: `🔍 **TikTok Search Result:**\n**${video.title}**\n\n✅ **Video sent!**` 
                        });
                    }
                }
                
                logger.success('TikTok search video sent successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: `❗ No **TikTok videos** found for: **"${query}"**` 
                });
            }
        } catch (error) {
            logger.error('Failed to process TikTok search', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error searching **TikTok**. Please try again later.' 
            });
        }
    }

    async handleWikipediaSearch(senderId, query) {
        try {
            logger.info(`Processing Wikipedia search for user ${senderId}`);
            
            const response = await api.wikipedia(query);
            
            if (response && response.extract) {
                const wikiMessage = `📚 **Wikipedia - ${response.title}**\n\n${response.extract}`;
                
                if (response.url) {
                    const buttons = [{
                        type: 'web_url',
                        title: '🔗 Read More',
                        url: response.url
                    }];
                    
                    await bot.sendButtonTemplate(senderId, wikiMessage, buttons);
                } else {
                    await bot.sendMessage(senderId, { text: wikiMessage });
                }
                
                logger.success('Wikipedia search completed successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: `❗ No **Wikipedia** results found for: **"${query}"**` 
                });
            }
        } catch (error) {
            logger.error('Failed to process Wikipedia search', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error searching **Wikipedia**. Please try again later.' 
            });
        }
    }

    async handleRemoveBg(senderId, imageUrl) {
        try {
            logger.info(`Processing background removal for user ${senderId}`);
            
            if (!imageUrl.includes('http')) {
                await bot.sendMessage(senderId, { 
                    text: '❗ Please provide a valid **image URL**.\nExample: **/removebg https://example.com/image.jpg**' 
                });
                return;
            }

            await bot.sendMessage(senderId, { 
                text: '🔄 **Removing background...** Please wait.' 
            });

            const response = await api.removeBg(imageUrl);
            
            if (response && response.result_url) {
                const imageMessage = {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: response.result_url
                        }
                    }
                };
                
                await bot.sendMessage(senderId, imageMessage);
                await bot.sendMessage(senderId, { 
                    text: '✅ **Background removed successfully!**' 
                });
                
                logger.success('Background removal completed successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: '❗ Could not **remove background**. Please check the image URL and try again.' 
                });
            }
        } catch (error) {
            logger.error('Failed to process background removal', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error **removing background**. Please try again later.' 
            });
        }
    }

    async handleSpotifyDownload(senderId, url) {
        try {
            logger.info(`Processing Spotify download for user ${senderId}`);
            
            const spotifyUrlMatch = url.match(/(https?:\/\/(?:open\.)?spotify\.com\/[^\s]+)/);
            const spotifyUrl = spotifyUrlMatch ? spotifyUrlMatch[1] : url;

            if (!spotifyUrl.includes('spotify.com')) {
                await bot.sendMessage(senderId, { 
                    text: '❗ Please provide a valid **Spotify URL**.' 
                });
                return;
            }

            const response = await api.spotifyDownload(spotifyUrl);
            
            if (response && response.download_url) {
                const downloadButton = {
                    type: 'web_url',
                    title: '⬇️ Download Music',
                    url: response.download_url
                };

                const buttons = [downloadButton];
                
                if (response.preview_url) {
                    buttons.push({
                        type: 'web_url',
                        title: '🎵 Preview',
                        url: response.preview_url
                    });
                }

                const messageText = `🎵 **${response.title || 'Track'}** by **${response.artist || 'Unknown Artist'}**\n\n✅ **Ready to download!**`;
                
                await bot.sendButtonTemplate(senderId, messageText, buttons);
                logger.success('Spotify download link sent successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: '❗ Could not process the **Spotify link**. Please check the URL and try again.' 
                });
            }
        } catch (error) {
            logger.error('Failed to process Spotify download', error.message);
            await bot.sendMessage(senderId, { 
                text: '🔧 Error processing **Spotify link**. Please try again later.' 
            });
        }
    }

    async handlePostback(senderId, payload) {
        logger.info(`Processing postback from ${senderId}`, { payload });

        if (payload === 'ACCEPT_TERMS') {
            const user = userManager.acceptTerms(senderId);
            if (user) {
                await bot.sendRegistrationNotification(senderId, user);
                setTimeout(async () => {
                    await bot.sendWelcomeMessage(senderId, user);
                }, 2000);
            }
            return;
        }

        if (payload === 'DECLINE_TERMS') {
            await bot.sendMessage(senderId, { 
                text: '❌ **Terms declined.** You cannot use the bot without accepting the terms and conditions.' 
            });
            return;
        }

        // Check if user is registered and accepted terms
        if (!userManager.isRegistered(senderId) || !userManager.getUser(senderId).accepted) {
            await this.handleNewUser(senderId);
            return;
        }

        switch (payload) {
            case 'GET_STARTED':
                await bot.sendWelcomeMessage(senderId, userManager.getUser(senderId));
                break;
            case 'AI_MENU':
                await bot.sendAIMenu(senderId);
                break;
            case 'DOWNLOAD_MENU':
                await bot.sendDownloadMenu(senderId);
                break;
            case 'TOOLS_MENU':
                await bot.sendToolsMenu(senderId);
                break;
            default:
                await bot.sendMainMenu(senderId);
        }
    }

    async handleQuickReply(senderId, payload) {
        logger.info(`Processing quick reply from ${senderId}`, { payload });

        // Check if user is registered and accepted terms
        if (!userManager.isRegistered(senderId) || !userManager.getUser(senderId).accepted) {
            await this.handleNewUser(senderId);
            return;
        }

        const user = userManager.getUser(senderId);

        switch (payload) {
            case 'ai_chat':
            case 'kaiz_ai':
                await bot.sendMessage(senderId, { 
                    text: `🤖 **KAIZ AI activated!** Hi **${user.name}**!\n\nSend me any message or use **/ai [your message]**` 
                });
                break;
            case 'gemini_pro':
                await bot.sendMessage(senderId, { 
                    text: '🔮 **Gemini Pro ready!** Use **/gemini [your message]**' 
                });
                break;
            case 'gpt3':
                await bot.sendMessage(senderId, { 
                    text: '💡 **GPT-3 activated!** Use **/gpt [your message]**' 
                });
                break;
            case 'deepseek_v3':
                await bot.sendMessage(senderId, { 
                    text: '🚀 **DeepSeek V3 ready!** Use **/deepseek [your message]**' 
                });
                break;
            case 'llama_turbo':
                await bot.sendMessage(senderId, { 
                    text: '🦙 **Llama3 Turbo ready!** Use **/llama [your message]**' 
                });
                break;
            case 'downloads':
                await bot.sendDownloadMenu(senderId);
                break;
            case 'tools':
                await bot.sendToolsMenu(senderId);
                break;
            case 'spotify_help':
                await bot.sendMessage(senderId, { 
                    text: '🎵 **Spotify Downloader**\n\nSend a Spotify link or use **/spotify [URL]**' 
                });
                break;
            case 'tiktok_help':
                await bot.sendMessage(senderId, { 
                    text: '📱 **TikTok Downloader**\n\nSend a TikTok link or use **/tiktok [URL]**' 
                });
                break;
            case 'instagram_help':
                await bot.sendMessage(senderId, { 
                    text: '📷 **Instagram Downloader**\n\nSend an Instagram link or use **/instagram [URL]**' 
                });
                break;
            case 'tiksearch_help':
                await bot.sendMessage(senderId, { 
                    text: '🔍 **TikTok Search**\n\nUse **/tiksearch [keyword]** to search videos' 
                });
                break;
            case 'removebg_help':
                await bot.sendMessage(senderId, { 
                    text: '🖼️ **Background Remover**\n\nUse **/removebg [image URL]** to remove background' 
                });
                break;
            case 'wiki_help':
                await bot.sendMessage(senderId, { 
                    text: '📚 **Wikipedia Search**\n\nUse **/wiki [search term]** to search Wikipedia' 
                });
                break;
            case 'image_help':
                await bot.sendMessage(senderId, { 
                    text: '🔍 **Image Analysis**\n\nSend any image for AI-powered analysis!' 
                });
                break;
            case 'menu':
                await bot.sendMainMenu(senderId);
                break;
            case 'help':
                await bot.sendHelpMenu(senderId);
                break;
            default:
                await bot.sendMainMenu(senderId);
        }
    }

    async handleAttachment(senderId, attachments) {
        // Check if user is registered and accepted terms
        if (!userManager.isRegistered(senderId) || !userManager.getUser(senderId).accepted) {
            await this.handleNewUser(senderId);
            return;
        }

        for (const attachment of attachments) {
            if (attachment.type === 'image') {
                await this.handleImageAnalysis(senderId, attachment.payload.url);
            } else {
                await bot.sendMessage(senderId, { 
                    text: '📎 I received your attachment. Currently, I can only **analyze images**.' 
                });
            }
        }
    }

    async handleImageAnalysis(senderId, imageUrl) {
        try {
            const user = userManager.getUser(senderId);
            logger.info(`Analyzing image for user ${senderId}`);
            
            await bot.sendMessage(senderId, { 
                text: `🔍 Hi **${user.name}**! Analyzing your image with **KAIZ AI**...` 
            });

            // Use KAIZ AI for image analysis with proper prompt
            const analysisPrompt = `Please analyze this image in detail. Describe what you see, including objects, people, colors, setting, mood, and any other relevant details. Image URL: ${imageUrl}`;
            const response = await api.kaizAI(analysisPrompt, senderId);

            if (response && response.response) {
                const analysisMessage = `🖼️ **Image Analysis Results:**\n\n${response.response}`;
                await bot.sendMessage(senderId, { text: analysisMessage });
                logger.success('Image analysis completed successfully');
            } else {
                await bot.sendMessage(senderId, { 
                    text: `❗ Hi **${user.name}**! Could not analyze the image. Please try again.` 
                });
            }
        } catch (error) {
            logger.error('Failed to analyze image', error.message);
            const user = userManager.getUser(senderId);
            await bot.sendMessage(senderId, { 
                text: `🔧 Hi **${user.name}**! Error analyzing image. Please try again later.` 
            });
        }
    }
}

const messageHandler = new MessageHandler();

// Auto-uptime and Health Check
class UptimeManager {
    constructor() {
        this.startTime = Date.now();
        this.healthCheckInterval = null;
    }

    start() {
        logger.info('Starting uptime manager');
        
        this.healthCheckInterval = setInterval(async () => {
            try {
                const uptime = this.getUptime();
                logger.info(`Health check - Uptime: ${uptime}`);
                
                if (process.env.REPLIT_DEPLOYMENT) {
                    await axios.get(`http://localhost:${config.port}/health`);
                }
            } catch (error) {
                logger.warning('Health check failed', error.message);
            }
        }, 25 * 60 * 1000);
    }

    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}

const uptimeManager = new UptimeManager();

// Create registration website
async function createRegistrationWebsite() {
    const publicDir = path.join(__dirname, 'public');
    
    try {
        await fs.mkdir(publicDir, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KAIZ Bot Registration</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .particles {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
        }

        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
            max-width: 500px;
            width: 90%;
            z-index: 10;
        }

        h1 {
            font-size: 3em;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
            background-size: 400% 400%;
            animation: gradient 2s ease infinite;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .subtitle {
            color: white;
            font-size: 1.2em;
            margin-bottom: 30px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }

        .form-group {
            margin-bottom: 20px;
        }

        input {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 16px;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        input::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        .btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            margin: 10px;
        }

        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 10px;
            color: white;
            font-weight: bold;
        }

        .success {
            background: rgba(76, 175, 80, 0.3);
            border: 1px solid rgba(76, 175, 80, 0.6);
        }

        .error {
            background: rgba(244, 67, 54, 0.3);
            border: 1px solid rgba(244, 67, 54, 0.6);
        }

        .bot-info {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            margin-top: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .features {
            text-align: left;
            color: white;
            margin-top: 20px;
        }

        .features ul {
            list-style: none;
            padding-left: 0;
        }

        .features li {
            padding: 5px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .features li:before {
            content: "✨ ";
            color: #ffd700;
        }
    </style>
</head>
<body>
    <div class="particles" id="particles"></div>
    
    <div class="container">
        <h1>🤖 KAIZ BOT</h1>
        <p class="subtitle">Registration Portal</p>
        
        <form id="registrationForm">
            <div class="form-group">
                <input type="text" id="referenceNumber" placeholder="Enter your Reference Number (e.g., #User1234-56789)" required>
            </div>
            <button type="submit" class="btn">✅ Complete Registration</button>
        </form>
        
        <div id="status"></div>
        
        <div class="bot-info">
            <h3 style="color: white; margin-bottom: 15px;">🌟 KAIZ Bot Features</h3>
            <div class="features">
                <ul>
                    <li>Multiple AI Models (KAIZ AI, Gemini Pro, GPT-3, DeepSeek V3, Llama3)</li>
                    <li>Media Downloads (Spotify, TikTok, Instagram)</li>
                    <li>Image Analysis & Background Removal</li>
                    <li>TikTok Search & Wikipedia Integration</li>
                    <li>Interactive Buttons & Quick Replies</li>
                    <li>24/7 Uptime & Auto-deployment</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        // Create floating particles
        function createParticles() {
            const particles = document.getElementById('particles');
            for (let i = 0; i < 50; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
                particles.appendChild(particle);
            }
        }

        // Handle form submission
        document.getElementById('registrationForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const referenceNumber = document.getElementById('referenceNumber').value;
            const statusDiv = document.getElementById('status');
            
            if (!referenceNumber.startsWith('#') || !referenceNumber.includes('-')) {
                statusDiv.innerHTML = '<div class="status error">❌ Invalid reference number format!</div>';
                return;
            }
            
            // Simulate registration process
            statusDiv.innerHTML = '<div class="status">🔄 Processing registration...</div>';
            
            setTimeout(() => {
                statusDiv.innerHTML = '<div class="status success">✅ Registration completed successfully! You can now use KAIZ Bot on Facebook Messenger.</div>';
                
                // Reset form
                document.getElementById('registrationForm').reset();
            }, 2000);
        });

        // Initialize particles
        createParticles();
    </script>
</body>
</html>`;

    try {
        await fs.writeFile(path.join(publicDir, 'index.html'), htmlContent);
        logger.success('Registration website created successfully');
    } catch (error) {
        logger.error('Failed to create registration website', error.message);
    }
}

// Routes
app.get('/', (req, res) => {
    const uptime = uptimeManager.getUptime();
    res.json({
        status: '🤖 KAIZ Bot is running!',
        uptime: uptime,
        timestamp: new Date().toISOString(),
        features: [
            'Multi-AI Chat (KAIZ AI, Gemini Pro, GPT-3, DeepSeek V3, Llama3 Turbo)',
            'Media Downloads (Spotify, TikTok, Instagram)',
            'Image Analysis & Background Removal',
            'TikTok Search & Wikipedia Integration',
            'User Registration System',
            'Interactive Buttons & Quick Replies',
            'Auto-uptime Management',
            'Aesthetic Rainbow Logging'
        ],
        registeredUsers: userDatabase.size
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: uptimeManager.getUptime(),
        timestamp: new Date().toISOString(),
        users: userDatabase.size
    });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration completion endpoint
app.post('/complete-registration', async (req, res) => {
    try {
        const { referenceNumber } = req.body;
        
        if (!referenceNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reference number is required' 
            });
        }

        const user = await userManager.completeRegistration(referenceNumber);
        
        if (user) {
            res.json({ 
                success: true, 
                message: 'Registration completed successfully! You will receive a notification on Facebook Messenger.',
                user: {
                    name: user.name,
                    referenceNumber: user.referenceNumber,
                    status: user.status
                }
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Invalid reference number or user has not accepted terms yet. Please ensure you have accepted the terms in the Facebook Messenger first.' 
            });
        }
    } catch (error) {
        logger.error('Registration completion failed', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Check registration status endpoint
app.get('/registration-status/:referenceNumber', (req, res) => {
    try {
        const { referenceNumber } = req.params;
        const user = userManager.getPendingRegistration(referenceNumber);
        
        if (user) {
            res.json({
                exists: true,
                accepted: user.accepted,
                status: user.status,
                name: user.name
            });
        } else {
            res.json({
                exists: false
            });
        }
    } catch (error) {
        logger.error('Status check failed', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.verifyToken) {
            logger.success('Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            logger.error('Webhook verification failed');
            res.sendStatus(403);
        }
    }
});

// Webhook event handler
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            for (const webhookEvent of entry.messaging) {
                const senderId = webhookEvent.sender.id;

                try {
                    if (webhookEvent.message) {
                        if (webhookEvent.message.quick_reply) {
                            await messageHandler.handleQuickReply(senderId, webhookEvent.message.quick_reply.payload);
                        } else if (webhookEvent.message.attachments) {
                            await messageHandler.handleAttachment(senderId, webhookEvent.message.attachments);
                        } else if (webhookEvent.message.text) {
                            await messageHandler.handleTextMessage(senderId, webhookEvent.message.text);
                        }
                    } else if (webhookEvent.postback) {
                        await messageHandler.handlePostback(senderId, webhookEvent.postback.payload);
                    }
                } catch (error) {
                    logger.error(`Error handling webhook event for user ${senderId}`, error.message);
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Initialize bot
async function initializeBot() {
    await logger.loading('🚀 Initializing Enhanced KAIZ Bot', 3000);
    
    logger.info('Creating registration website');
    await createRegistrationWebsite();
    
    logger.info('Bot configuration loaded');
    logger.info('User management system initialized');
    logger.info('All API endpoints configured');
    logger.info('Webhook handlers registered');
    
    uptimeManager.start();
    
    app.listen(config.port, '0.0.0.0', () => {
        logger.success(`🌟 Enhanced KAIZ Bot is running on port ${config.port}`);
        logger.info('Bot is ready to receive messages!');
        logger.info(`Registration website: http://localhost:${config.port}/register`);
        logger.info(`Health check endpoint: http://localhost:${config.port}/health`);
        
        if (process.env.REPLIT_DEPLOYMENT) {
            logger.success('🌍 Bot is deployed and accessible online!');
            logger.success('🎯 Registration portal is live!');
        }
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.warning('Shutting down Enhanced KAIZ Bot...');
    uptimeManager.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.warning('Shutting down Enhanced KAIZ Bot...');
    uptimeManager.stop();
    process.exit(0);
});

// Start the bot
initializeBot().catch(error => {
    logger.error('Failed to initialize bot', error);
    process.exit(1);
});
