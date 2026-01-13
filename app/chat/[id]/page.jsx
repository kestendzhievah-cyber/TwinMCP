"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ChatPage;
const react_1 = __importStar(require("react"));
const navigation_1 = require("next/navigation");
const lucide_react_1 = require("lucide-react");
function ChatPage() {
    const params = (0, navigation_1.useParams)();
    const chatbotId = params.id;
    const [chatbot, setChatbot] = (0, react_1.useState)(null);
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [inputMessage, setInputMessage] = (0, react_1.useState)('');
    const [isTyping, setIsTyping] = (0, react_1.useState)(false);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [isDarkMode, setIsDarkMode] = (0, react_1.useState)(false);
    const [copiedMessageId, setCopiedMessageId] = (0, react_1.useState)(null);
    const messagesEndRef = (0, react_1.useRef)(null);
    const inputRef = (0, react_1.useRef)(null);
    // Mock data - replace with API calls
    (0, react_1.useEffect)(() => {
        // Load chatbot info
        const loadChatbot = async () => {
            try {
                // TODO: Call API to get chatbot info
                setChatbot({
                    id: chatbotId,
                    name: 'Assistant Support',
                    description: 'Je réponds aux questions sur notre produit et fournis un support technique.',
                    isActive: true,
                });
            }
            catch (error) {
                console.error('Error loading chatbot:', error);
            }
        };
        // Load initial messages
        const loadInitialMessages = () => {
            const welcomeMessage = {
                id: 'welcome',
                role: 'assistant',
                content: `Bonjour ! Je suis ${chatbot?.name || 'votre assistant'}. Comment puis-je vous aider aujourd'hui ?`,
                timestamp: new Date(),
            };
            setMessages([welcomeMessage]);
        };
        loadChatbot();
        loadInitialMessages();
    }, [chatbotId, chatbot?.name]);
    // Auto-scroll to bottom when new messages are added
    (0, react_1.useEffect)(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading)
            return;
        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsTyping(true);
        setIsLoading(true);
        try {
            // TODO: Call API to send message and get response
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            const assistantMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Merci pour votre question : "${userMessage.content}". Je suis ${chatbot?.name || 'votre assistant IA'} et je suis là pour vous aider. Comment puis-je vous assister davantage ?`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
        }
        catch (error) {
            console.error('Error sending message:', error);
            // Add error message
            const errorMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        }
        finally {
            setIsTyping(false);
            setIsLoading(false);
        }
    };
    const copyMessage = async (content, messageId) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        }
        catch (error) {
            console.error('Error copying message:', error);
        }
    };
    const formatTime = (date) => {
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    if (!chatbot) {
        return (<div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <lucide_react_1.Bot className="w-8 h-8 text-slate-600"/>
          </div>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
            Chatbot introuvable
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Le chatbot que vous recherchez n'existe pas ou n'est plus disponible.
          </p>
        </div>
      </div>);
    }
    return (<div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} transition-colors`}>
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b px-4 py-4`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <lucide_react_1.Bot className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {chatbot.name}
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {chatbot.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats badges */}
            <div className={`hidden sm:flex items-center gap-4 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <div className="flex items-center gap-1">
                <lucide_react_1.MessageSquare className="w-4 h-4"/>
                <span>1.2k</span>
              </div>
              <div className="flex items-center gap-1">
                <lucide_react_1.Users className="w-4 h-4"/>
                <span>847</span>
              </div>
            </div>

            {/* Theme toggle */}
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-lg transition-colors ${isDarkMode
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {isDarkMode ? <lucide_react_1.Sun className="w-4 h-4"/> : <lucide_react_1.Moon className="w-4 h-4"/>}
            </button>

            {/* CTA Button */}
            <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all flex items-center gap-2">
              <span className="hidden sm:inline">Créer le mien</span>
              <lucide_react_1.ExternalLink className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
          {messages.map((message) => (<div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (<div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <lucide_react_1.Bot className="w-4 h-4 text-white"/>
                </div>)}

              <div className={`max-w-[80%] rounded-2xl px-4 py-3 relative group ${message.role === 'user'
                ? isDarkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                : isDarkMode
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'bg-white text-slate-900 border border-slate-200'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Message actions */}
                <div className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                  <button onClick={() => copyMessage(message.content, message.id)} className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                    {copiedMessageId === message.id ? (<lucide_react_1.Check className="w-3 h-3 text-green-500"/>) : (<lucide_react_1.Copy className={`w-3 h-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}/>)}
                  </button>
                </div>

                {/* Timestamp */}
                <div className={`text-xs mt-2 flex items-center gap-1 ${message.role === 'user'
                ? 'text-blue-100'
                : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <lucide_react_1.Clock className="w-3 h-3"/>
                  {formatTime(message.timestamp)}
                </div>
              </div>

              {message.role === 'user' && (<div className="w-8 h-8 bg-slate-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">U</span>
                </div>)}
            </div>))}

          {/* Typing indicator */}
          {isTyping && (<div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <lucide_react_1.Bot className="w-4 h-4 text-white"/>
              </div>
              <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>)}

          <div ref={messagesEndRef}/>
        </div>

        {/* Input Form */}
        <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-t p-4`}>
          <form onSubmit={sendMessage} className="flex gap-3">
            <div className="flex-1 relative">
              <input ref={inputRef} type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Tapez votre message..." disabled={isLoading} className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isDarkMode
            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}/>
              {inputMessage && (<button type="button" onClick={() => setInputMessage('')} className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                  ×
                </button>)}
            </div>
            <button type="submit" disabled={!inputMessage.trim() || isLoading} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <lucide_react_1.Send className="w-4 h-4"/>
              <span className="hidden sm:inline">Envoyer</span>
            </button>
          </form>

          {/* Quick suggestions */}
          <div className={`mt-3 flex flex-wrap gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="text-xs">Suggestions :</span>
            {['Comment ça marche ?', 'Tarifs', 'Support technique', 'Fonctionnalités'].map((suggestion) => (<button key={suggestion} onClick={() => setInputMessage(suggestion)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${isDarkMode
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                {suggestion}
              </button>))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} px-4 py-3`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
          <div className={`flex items-center gap-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <span>Propulsé par Corel.IA</span>
            <span>•</span>
            <span>1,247 conversations</span>
          </div>
          <a href="https://corel.ia" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors">
            Visiter Corel.IA
          </a>
        </div>
      </footer>
    </div>);
}
//# sourceMappingURL=page.jsx.map